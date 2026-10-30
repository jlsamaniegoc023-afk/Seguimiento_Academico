import * as XLSX from 'xlsx';
import {
  formatDriveModifiedDate,
  formatIsoToDisplay,
  parseRawDateToIso,
} from './gestionCurricularDriveService';

export const JUICIOS_EVALUATIVOS_DRIVE_FOLDER_ID = '1jD0PQu1jlHKLgkngmo4Hogip3DA5g5t3';
export const JUICIOS_EVALUATIVOS_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${JUICIOS_EVALUATIVOS_DRIVE_FOLDER_ID}?usp=sharing`;

export interface DriveJuiciosFileItem {
  id: string;
  name: string;
  ficha: string;
  startsWithFicha: boolean;
  modifiedTime: string;
}

export type JuicioNormalized = 'APROBADO' | 'POR EVALUAR' | 'NO APROBADO' | 'OTRO';

export interface JuicioEvaluativoItem {
  id: string;
  competencia: string;
  resultadoAprendizaje: string;
  juicioRaw: string;
  juicio: JuicioNormalized;
  esEtapaPractica: boolean;
  fechaIso: string;
  fechaDisplay: string;
  horaHm: string;
  fechaHoraDisplay: string;
  fechaSortMs: number | null;
  instructorNombre: string;
  instructorDocumento: string;
  instructorRaw: string;
}

export interface AprendizJuicioResumen {
  key: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
  estadoAprendiz: string;
  esPorCertificar: boolean;

  totalResultados: number;
  aprobados: number;
  porEvaluar: number;
  noAprobados: number;
  otrosJuicios: number;
  porcentajeAvance: number;
  competenciasCount: number;
  etapaPracticaTotal: number;
  etapaPracticaAprobados: number;

  // Datos del último Juicio Evaluativo aprobado por el instructor (para Por Certificar corresponde al cierre/cambio de estado)
  fechaInstructorAproboIso: string;
  fechaInstructorAproboDisplay: string;
  horaInstructorAproboHm: string;
  fechaHoraInstructorAproboDisplay: string;
  fechaInstructorAproboSortMs: number | null;
  instructorAproboNombre: string;
  instructorAproboDocumento: string;
  instructorAproboRaw: string;
  competenciaUltimoJuicioAprobado: string;
  raUltimoJuicioAprobado: string;
  esEtapaPracticaUltimoJuicio: boolean;

  // Fecha específica de cambio de estado a Por Certificar (columna dedicada si existe, o fecha del juicio evaluativo final aprobado)
  fechaCambioEstadoPorCertificarIso: string;
  fechaCambioEstadoPorCertificarDisplay: string;

  detalles: JuicioEvaluativoItem[];
}

export interface EstadoAprendizDistribucionItem {
  estado: string;
  cantidad: number;
  porcentaje: number;
  esPorCertificar: boolean;
}

export interface JuiciosEvaluativosParsedReport {
  fichaConsultada: string;
  fichaReporte: string;
  fechaReporteDisplay: string;
  codigoPrograma: string;
  versionPrograma: string;
  denominacionPrograma: string;
  estadoFichaReporte: string;
  modalidadFormacion: string;
  regionalReporte: string;
  centroReporte: string;
  fechaInicioFichaIso: string;
  fechaInicioFichaDisplay: string;
  fechaFinFichaIso: string;
  fechaFinFichaDisplay: string;

  fileName: string;
  fileId: string;
  modifiedTimeIso: string;
  modifiedTimeDisplay: string;
  sheetName: string;

  totalRegistrosJuicios: number;
  totalAprendices: number;
  totalResultadosReferencia: number;
  totalJuiciosAprobados: number;
  totalJuiciosPorEvaluar: number;
  totalJuiciosNoAprobados: number;
  porcentajeGlobalAprobacion: number;

  aprendicesPorCertificarCount: number;
  aprendicesCertificadosCount: number;
  aprendicesEnFormacionCount: number;
  aprendicesBajasNovedadesCount: number;

  distribucionEstados: EstadoAprendizDistribucionItem[];
  aprendices: AprendizJuicioResumen[];
}

export type FetchFichaJuiciosResult =
  | {
      status: 'found';
      report: JuiciosEvaluativosParsedReport;
      availableFiles: DriveJuiciosFileItem[];
    }
  | {
      status: 'not_found';
      ficha: string;
      message: string;
      availableFiles: DriveJuiciosFileItem[];
    };

function normalizeText(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function getTodayBogotaIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export function computeDaysElapsedToCurrentDate(
  fromIso: string,
  currentDateIso = getTodayBogotaIso()
): number | null {
  if (!fromIso || !currentDateIso) return null;
  const fp = fromIso.split('-').map(Number);
  const cp = currentDateIso.split('-').map(Number);
  if (fp.length !== 3 || cp.length !== 3 || fp.some(isNaN) || cp.some(isNaN)) {
    return null;
  }
  const fUtc = Date.UTC(fp[0], fp[1] - 1, fp[2]);
  const cUtc = Date.UTC(cp[0], cp[1] - 1, cp[2]);
  const diff = Math.round((cUtc - fUtc) / 86400000);
  return diff < 0 ? 0 : diff;
}

interface ParsedTimestamp {
  isoDate: string;
  displayDate: string;
  timeHm: string;
  displayDateTime: string;
  sortMs: number | null;
}

function parseExcelOrTextDateTime(
  rawVal: unknown,
  formattedVal: unknown,
  date1904 = false
): ParsedTimestamp {
  const empty: ParsedTimestamp = {
    isoDate: '',
    displayDate: '—',
    timeHm: '',
    displayDateTime: '—',
    sortMs: null,
  };

  // Caso 1: Valor numérico serial de Excel (incluyendo fracción horaria como 46295.40902778)
  const numericCandidate =
    typeof rawVal === 'number'
      ? rawVal
      : typeof rawVal === 'string' && /^\d{5}(\.\d+)?$/.test(rawVal.trim())
      ? Number(rawVal.trim())
      : null;

  if (numericCandidate !== null && Number.isFinite(numericCandidate) && numericCandidate > 25000 && numericCandidate < 80000) {
    const offsetDays = date1904 ? 24107 : 25569;
    const totalMinutes = Math.round((numericCandidate - offsetDays) * 1440);
    const utcMs = totalMinutes * 60000;
    const dt = new Date(utcMs);
    if (!isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      const hh = dt.getUTCHours();
      const mm = dt.getUTCMinutes();
      const isoDate = `${y}-${m}-${d}`;
      const displayDate = `${d}/${m}/${y}`;
      const hasTime = hh !== 0 || mm !== 0;
      const timeHm = hasTime
        ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
        : '';
      return {
        isoDate,
        displayDate,
        timeHm,
        displayDateTime: timeHm ? `${displayDate} · ${timeHm}` : displayDate,
        sortMs: utcMs,
      };
    }
  }

  // Caso 2: Objeto Date directo
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const y = rawVal.getUTCFullYear();
    const m = String(rawVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getUTCDate()).padStart(2, '0');
    const hh = rawVal.getUTCHours();
    const mm = rawVal.getUTCMinutes();
    const isoDate = `${y}-${m}-${d}`;
    const displayDate = `${d}/${m}/${y}`;
    const hasTime = hh !== 0 || mm !== 0;
    const timeHm = hasTime ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '';
    return {
      isoDate,
      displayDate,
      timeHm,
      displayDateTime: timeHm ? `${displayDate} · ${timeHm}` : displayDate,
      sortMs: Date.UTC(y, Number(m) - 1, Number(d), hh, mm),
    };
  }

  // Caso 3: Cadena de texto (ej. "30/09/2026 09:49", "2026-09-30 09:49:00", "30/09/2026")
  const strSource = String(formattedVal || rawVal || '').trim();
  if (!strSource || strSource === '-' || /^-\s*$/.test(strSource)) {
    return empty;
  }

  const isoDate = parseRawDateToIso(strSource);
  if (!isoDate) return empty;

  const displayDate = formatIsoToDisplay(isoDate, strSource);
  let hh = 0;
  let mm = 0;
  let timeHm = '';

  const timeMatch = strSource.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
  if (timeMatch) {
    hh = Number(timeMatch[1]);
    mm = Number(timeMatch[2]);
    const ampm = (timeMatch[3] || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    if (hh !== 0 || mm !== 0 || strSource.includes(':')) {
      timeHm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  const [yNum, mNum, dNum] = isoDate.split('-').map(Number);
  const sortMs = Date.UTC(yNum, mNum - 1, dNum, hh, mm);

  return {
    isoDate,
    displayDate,
    timeHm,
    displayDateTime: timeHm ? `${displayDate} · ${timeHm}` : displayDate,
    sortMs,
  };
}

function parseInstructorCell(raw: unknown): {
  nombre: string;
  documento: string;
  completo: string;
} {
  const clean = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean === '-' || /^[-–—\s]+$/.test(clean)) {
    return { nombre: '', documento: '', completo: '' };
  }

  // Patrón habitual de SOFIA Plus: "CC 55131604 - DIANA CONSTANZA BELTRAN FIRIGUA" o "CC - 55131604 - NOMBRE"
  const parts = clean.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const second = parts[1];
    // Caso "CC - 55131604 - NOMBRE"
    if (/^[A-Z]{1,5}$/i.test(first) && /^\d{4,15}$/.test(second) && parts.length >= 3) {
      const doc = `${first.toUpperCase()} ${second}`;
      const nombre = parts.slice(2).join(' - ').trim();
      return { nombre: nombre || clean, documento: doc, completo: clean };
    }
    // Caso "CC 55131604 - DIANA CONSTANZA BELTRAN FIRIGUA" o "55131604 - NOMBRE"
    if (/\d{4,15}/.test(first)) {
      const nombre = parts.slice(1).join(' - ').trim();
      return { nombre: nombre || clean, documento: first, completo: clean };
    }
  }

  return { nombre: clean, documento: '', completo: clean };
}

function classifyJuicio(raw: unknown): JuicioNormalized {
  const n = normalizeText(raw);
  if (!n || n.includes('por evaluar') || n.includes('pendiente') || n === 'sin evaluar') {
    return 'POR EVALUAR';
  }
  if (n.includes('no aprobado') || n.includes('reprobado')) {
    return 'NO APROBADO';
  }
  if (n.includes('aprobado')) {
    return 'APROBADO';
  }
  return 'OTRO';
}

export function parseJuiciosEvaluativosSpreadsheet(
  buffer: ArrayBuffer,
  fichaConsultada: string,
  meta?: {
    fileName?: string;
    fileId?: string;
    modifiedTimeIso?: string;
  }
): JuiciosEvaluativosParsedReport {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);
  const sheetName = wb.SheetNames[0] || 'Hoja';
  const ws = wb.Sheets[sheetName];

  // Obtenemos tanto valores crudos (números seriales exactos con hora) como texto formateado
  const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: true,
    defval: '',
  });
  const formattedMatrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });

  let fechaReporteDisplay = '';
  let fichaReporte = '';
  let codigoPrograma = '';
  let versionPrograma = '';
  let denominacionPrograma = '';
  let estadoFichaReporte = '';
  let modalidadFormacion = '';
  let regionalReporte = '';
  let centroReporte = '';
  let fechaInicioRaw: unknown = '';
  let fechaInicioFmt: unknown = '';
  let fechaFinRaw: unknown = '';
  let fechaFinFmt: unknown = '';

  // 1. Extraer metadatos superiores del Reporte de Juicios de Evaluación SOFIA Plus (filas 0..20)
  const scanTopLimit = Math.min(20, formattedMatrix.length);
  for (let r = 0; r < scanTopLimit; r++) {
    const fRow = formattedMatrix[r] || [];
    const rRow = rawMatrix[r] || [];
    for (let c = 0; c < fRow.length; c++) {
      const rawLabel = normalizeText(fRow[c]).replace(/:$/, '').trim();
      if (!rawLabel) continue;

      // En SOFIA Plus la columna B suele venir combinada/vacía y el valor aparece en C (c+2)
      let valIdx = -1;
      for (let k = c + 1; k <= Math.min(c + 4, fRow.length - 1); k++) {
        if (String(fRow[k] ?? '').trim() !== '' || String(rRow[k] ?? '').trim() !== '') {
          valIdx = k;
          break;
        }
      }
      if (valIdx < 0) continue;

      const nextText = String(fRow[valIdx] ?? '').trim();
      const nextRaw = rRow[valIdx];

      if (rawLabel === 'fecha del reporte' || rawLabel === 'fecha reporte') {
        const parsedRep = parseExcelOrTextDateTime(nextRaw, nextText, date1904);
        fechaReporteDisplay = parsedRep.isoDate ? parsedRep.displayDate : nextText;
      } else if (
        rawLabel === 'ficha de caracterizacion' ||
        rawLabel === 'codigo ficha' ||
        rawLabel === 'numero de ficha' ||
        rawLabel === 'ficha'
      ) {
        const m = String(nextRaw || nextText).match(/\d{4,12}/);
        if (m) fichaReporte = m[0];
      } else if (rawLabel === 'codigo' || rawLabel === 'cogigo' || rawLabel === 'codigo programa') {
        codigoPrograma = nextText;
      } else if (rawLabel === 'version' || rawLabel === 'version programa') {
        versionPrograma = nextText;
      } else if (
        rawLabel === 'denominacion' ||
        rawLabel === 'programa de formacion' ||
        rawLabel === 'nombre programa'
      ) {
        denominacionPrograma = nextText;
      } else if (
        rawLabel.includes('estado de la ficha') ||
        rawLabel === 'estado ficha'
      ) {
        estadoFichaReporte = nextText;
      } else if (rawLabel === 'fecha inicio' || rawLabel === 'fecha de inicio') {
        fechaInicioRaw = nextRaw;
        fechaInicioFmt = nextText;
      } else if (rawLabel === 'fecha fin' || rawLabel === 'fecha de fin' || rawLabel === 'fecha final') {
        fechaFinRaw = nextRaw;
        fechaFinFmt = nextText;
      } else if (rawLabel.includes('modalidad')) {
        modalidadFormacion = nextText;
      } else if (rawLabel === 'regional') {
        regionalReporte = nextText;
      } else if (rawLabel.includes('centro de formacion') || rawLabel === 'centro') {
        centroReporte = nextText;
      }
    }
  }

  if (!fichaReporte && meta?.fileName) {
    const mName = meta.fileName.match(/(?:^|\D)(\d{5,12})(?:\D|$)/);
    if (mName) fichaReporte = mName[1];
  }
  if (!fichaReporte) {
    fichaReporte = fichaConsultada;
  }

  // 2. Detectar fila de encabezados de la tabla de juicios evaluativos
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(40, formattedMatrix.length); r++) {
    const normRow = (formattedMatrix[r] || []).map(normalizeText);
    const joined = normRow.join('|');
    const hasDocOrAprendiz =
      joined.includes('documento') || joined.includes('aprendiz') || joined.includes('apellidos');
    const hasJuicioOrComp =
      joined.includes('juicio') ||
      joined.includes('resultado de aprendizaje') ||
      joined.includes('competencia');
    if (hasDocOrAprendiz && hasJuicioOrComp) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) headerRowIdx = 0;

  const headerCells = (formattedMatrix[headerRowIdx] || []).map(normalizeText);
  const findColIdx = (predicates: ((h: string) => boolean)[]): number => {
    for (const pred of predicates) {
      const idx = headerCells.findIndex((h) => h && pred(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const colTipoDoc = findColIdx([
    (h) => h === 'tipo de documento' || h === 'tipo documento' || h === 'tipo doc',
    (h) => h.includes('tipo') && h.includes('doc'),
  ]);
  const colNumDoc = findColIdx([
    (h) => h === 'numero de documento' || h === 'numero documento' || h === 'documento' || h === 'identificacion',
    (h) => h.includes('documento') && !h.includes('tipo'),
  ]);
  const colNombre = findColIdx([
    (h) => h === 'nombre' || h === 'nombres' || h === 'nombres del aprendiz',
    (h) => h.includes('nombre') && !h.includes('apellido') && !h.includes('programa') && !h.includes('instructor'),
  ]);
  const colApellidos = findColIdx([
    (h) => h === 'apellidos' || h === 'apellido' || h === 'apellidos del aprendiz',
    (h) => h.includes('apellido'),
  ]);
  const colAprendizCompleto = findColIdx([
    (h) => h === 'aprendiz' || h === 'nombre completo' || h === 'nombre aprendiz',
  ]);
  const colEstado = findColIdx([
    (h) => h === 'estado' || h === 'estado aprendiz' || h === 'estado del aprendiz',
    (h) => h.includes('estado') && !h.includes('ficha') && !h.includes('cambio'),
  ]);
  const colCompetencia = findColIdx([
    (h) => h === 'competencia' || h === 'nombre competencia',
    (h) => h.includes('competencia'),
  ]);
  const colResultado = findColIdx([
    (h) => h === 'resultado de aprendizaje' || h === 'resultado aprendizaje' || h === 'resultado',
    (h) => h.includes('resultado') && h.includes('aprendizaje'),
  ]);
  const colJuicio = findColIdx([
    (h) => h === 'juicio de evaluacion' || h === 'juicio evaluativo' || h === 'juicio',
    (h) => h.includes('juicio') && !h.includes('fecha') && !h.includes('funcionario') && !h.includes('instructor'),
  ]);
  const colFechaJuicio = findColIdx([
    (h) => h.includes('fecha') && h.includes('juicio'),
    (h) => h.includes('fecha') && h.includes('aprobo'),
    (h) => h.includes('fecha') && h.includes('evalua'),
    (h) => h === 'fecha' || h === 'fecha y hora',
  ]);
  const colInstructor = findColIdx([
    (h) => h.includes('funcionario') && h.includes('juicio'),
    (h) => h.includes('instructor') && (h.includes('juicio') || h.includes('aprobo') || !h.includes('fecha')),
    (h) => h.includes('funcionario') || h.includes('evaluador'),
  ]);
  const colFechaCambioEstado = findColIdx([
    (h) => h.includes('fecha') && h.includes('cambio') && h.includes('estado'),
    (h) => h.includes('fecha') && h.includes('por certificar'),
  ]);

  interface ApprenticeAccumulator {
    key: string;
    tipoDocumento: string;
    numeroDocumento: string;
    nombre: string;
    apellidos: string;
    nombreCompleto: string;
    estadoAprendiz: string;
    competenciasSet: Set<string>;
    fechaCambioExplicitaIso: string;
    fechaCambioExplicitaDisplay: string;
    detalles: JuicioEvaluativoItem[];
  }

  const apprenticeMap = new Map<string, ApprenticeAccumulator>();
  let totalRegistrosJuicios = 0;

  for (let r = headerRowIdx + 1; r < formattedMatrix.length; r++) {
    const fRow = formattedMatrix[r] || [];
    const rRow = rawMatrix[r] || [];

    if (!fRow.some((cell) => String(cell ?? '').trim() !== '')) continue;

    const getFmt = (idx: number): string => (idx >= 0 ? String(fRow[idx] ?? '').trim() : '');
    const getRaw = (idx: number): unknown => (idx >= 0 ? rRow[idx] : '');

    const tipoDocumento = getFmt(colTipoDoc);
    const numeroDocumento = getFmt(colNumDoc).replace(/\.0$/, '');
    const nombre = getFmt(colNombre);
    const apellidos = getFmt(colApellidos);
    const fullFromParts = `${nombre} ${apellidos}`.replace(/\s+/g, ' ').trim();
    const nombreCompleto = fullFromParts || getFmt(colAprendizCompleto);

    // Ignorar filas de resumen/pie de página sin aprendiz ni documento
    if (!numeroDocumento && !nombreCompleto) continue;
    const normFirst = normalizeText(fRow[0]);
    if (normFirst.startsWith('total') && !numeroDocumento) continue;

    const estadoAprendiz = getFmt(colEstado) || 'SIN ESTADO';
    const competencia = getFmt(colCompetencia) || 'Sin competencia especificada';
    const resultadoAprendizaje = getFmt(colResultado) || 'Sin resultado especificado';
    const juicioRaw = getFmt(colJuicio) || 'POR EVALUAR';
    const juicio = classifyJuicio(juicioRaw);

    const parsedFechaJuicio = parseExcelOrTextDateTime(
      getRaw(colFechaJuicio),
      getFmt(colFechaJuicio),
      date1904
    );

    const parsedInst = parseInstructorCell(getFmt(colInstructor) || getRaw(colInstructor));

    const parsedCambioExp =
      colFechaCambioEstado >= 0
        ? parseExcelOrTextDateTime(
            getRaw(colFechaCambioEstado),
            getFmt(colFechaCambioEstado),
            date1904
          )
        : null;

    const compNorm = normalizeText(`${competencia} ${resultadoAprendizaje}`);
    const esEtapaPractica =
      compNorm.includes('etapa practica') ||
      compNorm.includes('etapa productiva') ||
      compNorm.includes('sector productivo');

    const key = numeroDocumento
      ? `${tipoDocumento.toUpperCase() || 'DOC'}_${numeroDocumento}`
      : `NOM_${normalizeText(nombreCompleto)}`;

    let acc = apprenticeMap.get(key);
    if (!acc) {
      acc = {
        key,
        tipoDocumento,
        numeroDocumento,
        nombre,
        apellidos,
        nombreCompleto: nombreCompleto || numeroDocumento,
        estadoAprendiz,
        competenciasSet: new Set<string>(),
        fechaCambioExplicitaIso: parsedCambioExp?.isoDate || '',
        fechaCambioExplicitaDisplay: parsedCambioExp?.displayDate || '',
        detalles: [],
      };
      apprenticeMap.set(key, acc);
    } else {
      if (parsedCambioExp?.isoDate && !acc.fechaCambioExplicitaIso) {
        acc.fechaCambioExplicitaIso = parsedCambioExp.isoDate;
        acc.fechaCambioExplicitaDisplay = parsedCambioExp.displayDate;
      }
    }

    if (competencia) {
      acc.competenciasSet.add(competencia.toUpperCase());
    }

    acc.detalles.push({
      id: `j-${r}`,
      competencia,
      resultadoAprendizaje,
      juicioRaw,
      juicio,
      esEtapaPractica,
      fechaIso: parsedFechaJuicio.isoDate,
      fechaDisplay: parsedFechaJuicio.displayDate,
      horaHm: parsedFechaJuicio.timeHm,
      fechaHoraDisplay: parsedFechaJuicio.displayDateTime,
      fechaSortMs: parsedFechaJuicio.sortMs,
      instructorNombre: parsedInst.nombre,
      instructorDocumento: parsedInst.documento,
      instructorRaw: parsedInst.completo,
    });

    totalRegistrosJuicios++;
  }

  let totalJuiciosAprobados = 0;
  let totalJuiciosPorEvaluar = 0;
  let totalJuiciosNoAprobados = 0;
  let maxResultadosPorAprendiz = 0;

  let aprendicesPorCertificarCount = 0;
  let aprendicesCertificadosCount = 0;
  let aprendicesEnFormacionCount = 0;
  let aprendicesBajasNovedadesCount = 0;

  const estadoCounter = new Map<string, number>();
  const aprendices: AprendizJuicioResumen[] = [];

  for (const acc of apprenticeMap.values()) {
    let aprobados = 0;
    let porEvaluar = 0;
    let noAprobados = 0;
    let otrosJuicios = 0;
    let etapaPracticaTotal = 0;
    let etapaPracticaAprobados = 0;

    for (const d of acc.detalles) {
      if (d.juicio === 'APROBADO') aprobados++;
      else if (d.juicio === 'POR EVALUAR') porEvaluar++;
      else if (d.juicio === 'NO APROBADO') noAprobados++;
      else otrosJuicios++;

      if (d.esEtapaPractica) {
        etapaPracticaTotal++;
        if (d.juicio === 'APROBADO') etapaPracticaAprobados++;
      }
    }

    totalJuiciosAprobados += aprobados;
    totalJuiciosPorEvaluar += porEvaluar;
    totalJuiciosNoAprobados += noAprobados;

    const totalResultados = acc.detalles.length;
    if (totalResultados > maxResultadosPorAprendiz) {
      maxResultadosPorAprendiz = totalResultados;
    }

    const porcentajeAvance =
      totalResultados > 0 ? Math.round((aprobados / totalResultados) * 1000) / 10 : 0;

    const estNorm = normalizeText(acc.estadoAprendiz);
    const esPorCertificar = estNorm.includes('por certificar');

    if (esPorCertificar) {
      aprendicesPorCertificarCount++;
    } else if (estNorm === 'certificado' || estNorm.startsWith('certificad')) {
      aprendicesCertificadosCount++;
    } else if (
      estNorm.includes('formacion') ||
      estNorm.includes('induccion') ||
      estNorm.includes('transito')
    ) {
      aprendicesEnFormacionCount++;
    } else {
      aprendicesBajasNovedadesCount++;
    }

    const cleanEstadoKey = acc.estadoAprendiz.trim().toUpperCase() || 'SIN ESTADO';
    estadoCounter.set(cleanEstadoKey, (estadoCounter.get(cleanEstadoKey) || 0) + 1);

    // Ordenar los juicios internos del aprendiz: más recientes primero, luego por competencia
    const sortedDetalles = [...acc.detalles].sort((a, b) => {
      if (a.fechaSortMs !== null && b.fechaSortMs !== null && a.fechaSortMs !== b.fechaSortMs) {
        return b.fechaSortMs - a.fechaSortMs;
      }
      if (a.fechaSortMs !== null && b.fechaSortMs === null) return -1;
      if (a.fechaSortMs === null && b.fechaSortMs !== null) return 1;
      return a.competencia.localeCompare(b.competencia, 'es');
    });

    // Identificar el último Juicio Evaluativo APROBADO por el instructor
    // En SOFIA Plus, cuando el aprendiz pasa a estado POR CERTIFICAR, la fecha y hora más reciente
    // de aprobación de juicio evaluativo corresponde al momento exacto en que completó todos sus RAs
    // y cambió a estado POR CERTIFICAR (desempatando a favor de Etapa Práctica si comparten minuto).
    const approvedCandidates = acc.detalles
      .filter((d) => d.juicio === 'APROBADO')
      .sort((a, b) => {
        const msA = a.fechaSortMs ?? -1;
        const msB = b.fechaSortMs ?? -1;
        if (msA !== msB) return msB - msA;
        if (a.esEtapaPractica !== b.esEtapaPractica) return a.esEtapaPractica ? -1 : 1;
        if (Boolean(a.instructorNombre) !== Boolean(b.instructorNombre)) {
          return a.instructorNombre ? -1 : 1;
        }
        return 0;
      });

    const latestApproved = approvedCandidates[0] || null;

    const fechaInstructorAproboIso = latestApproved?.fechaIso || '';
    const fechaInstructorAproboDisplay = latestApproved?.fechaDisplay || '—';
    const horaInstructorAproboHm = latestApproved?.horaHm || '';
    const fechaHoraInstructorAproboDisplay = latestApproved?.fechaHoraDisplay || '—';
    const fechaInstructorAproboSortMs = latestApproved?.fechaSortMs ?? null;
    const instructorAproboNombre = latestApproved?.instructorNombre || '';
    const instructorAproboDocumento = latestApproved?.instructorDocumento || '';
    const instructorAproboRaw = latestApproved?.instructorRaw || '';

    const fechaCambioIso = acc.fechaCambioExplicitaIso || fechaInstructorAproboIso;
    const fechaCambioDisplay = acc.fechaCambioExplicitaIso
      ? acc.fechaCambioExplicitaDisplay
      : fechaInstructorAproboDisplay;

    aprendices.push({
      key: acc.key,
      tipoDocumento: acc.tipoDocumento,
      numeroDocumento: acc.numeroDocumento,
      nombre: acc.nombre,
      apellidos: acc.apellidos,
      nombreCompleto: acc.nombreCompleto,
      estadoAprendiz: cleanEstadoKey,
      esPorCertificar,
      totalResultados,
      aprobados,
      porEvaluar,
      noAprobados,
      otrosJuicios,
      porcentajeAvance,
      competenciasCount: acc.competenciasSet.size,
      etapaPracticaTotal,
      etapaPracticaAprobados,
      fechaInstructorAproboIso,
      fechaInstructorAproboDisplay,
      horaInstructorAproboHm,
      fechaHoraInstructorAproboDisplay,
      fechaInstructorAproboSortMs,
      instructorAproboNombre,
      instructorAproboDocumento,
      instructorAproboRaw,
      competenciaUltimoJuicioAprobado: latestApproved?.competencia || '',
      raUltimoJuicioAprobado: latestApproved?.resultadoAprendizaje || '',
      esEtapaPracticaUltimoJuicio: Boolean(latestApproved?.esEtapaPractica),
      fechaCambioEstadoPorCertificarIso: esPorCertificar ? fechaCambioIso : '',
      fechaCambioEstadoPorCertificarDisplay: esPorCertificar ? fechaCambioDisplay : '—',
      detalles: sortedDetalles,
    });
  }

  // Ordenar aprendices: 1) POR CERTIFICAR primero, 2) EN FORMACIÓN, 3) CERTIFICADO, 4) Otros, luego por % avance y apellidos
  const statePriority = (a: AprendizJuicioResumen): number => {
    if (a.esPorCertificar) return 0;
    const n = normalizeText(a.estadoAprendiz);
    if (n.includes('formacion') || n.includes('induccion') || n.includes('transito')) return 1;
    if (n.startsWith('certificad')) return 2;
    if (n.includes('condicionado') || n.includes('aplazado') || n.includes('trasladado')) return 3;
    return 4;
  };

  aprendices.sort((a, b) => {
    const pa = statePriority(a);
    const pb = statePriority(b);
    if (pa !== pb) return pa - pb;
    if (a.esPorCertificar && b.esPorCertificar) {
      // Entre los aprendices Por Certificar, mostrar primero el que lleva más tiempo esperando (fecha más antigua primero)
      const msA = a.fechaInstructorAproboSortMs ?? Number.MAX_SAFE_INTEGER;
      const msB = b.fechaInstructorAproboSortMs ?? Number.MAX_SAFE_INTEGER;
      if (msA !== msB) return msA - msB;
    }
    if (b.porcentajeAvance !== a.porcentajeAvance) {
      return b.porcentajeAvance - a.porcentajeAvance;
    }
    return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es');
  });

  const totalAprendices = aprendices.length;
  const distribucionEstados: EstadoAprendizDistribucionItem[] = Array.from(
    estadoCounter.entries()
  )
    .map(([estado, cantidad]) => ({
      estado,
      cantidad,
      porcentaje:
        totalAprendices > 0 ? Math.round((cantidad / totalAprendices) * 1000) / 10 : 0,
      esPorCertificar: normalizeText(estado).includes('por certificar'),
    }))
    .sort((a, b) => {
      if (a.esPorCertificar !== b.esPorCertificar) return a.esPorCertificar ? -1 : 1;
      return b.cantidad - a.cantidad;
    });

  const parsedInicio = parseExcelOrTextDateTime(fechaInicioRaw, fechaInicioFmt, date1904);
  const parsedFin = parseExcelOrTextDateTime(fechaFinRaw, fechaFinFmt, date1904);
  const modIso = meta?.modifiedTimeIso || '';

  const porcentajeGlobalAprobacion =
    totalRegistrosJuicios > 0
      ? Math.round((totalJuiciosAprobados / totalRegistrosJuicios) * 1000) / 10
      : 0;

  return {
    fichaConsultada,
    fichaReporte,
    fechaReporteDisplay,
    codigoPrograma,
    versionPrograma,
    denominacionPrograma,
    estadoFichaReporte,
    modalidadFormacion,
    regionalReporte,
    centroReporte,
    fechaInicioFichaIso: parsedInicio.isoDate,
    fechaInicioFichaDisplay: parsedInicio.displayDate,
    fechaFinFichaIso: parsedFin.isoDate,
    fechaFinFichaDisplay: parsedFin.displayDate,
    fileName: meta?.fileName || `Ficha ${fichaConsultada} Reporte de Juicios Evaluativos.xls`,
    fileId: meta?.fileId || '',
    modifiedTimeIso: modIso,
    modifiedTimeDisplay: formatDriveModifiedDate(modIso),
    sheetName,
    totalRegistrosJuicios,
    totalAprendices,
    totalResultadosReferencia: maxResultadosPorAprendiz,
    totalJuiciosAprobados,
    totalJuiciosPorEvaluar,
    totalJuiciosNoAprobados,
    porcentajeGlobalAprobacion,
    aprendicesPorCertificarCount,
    aprendicesCertificadosCount,
    aprendicesEnFormacionCount,
    aprendicesBajasNovedadesCount,
    distribucionEstados,
    aprendices,
  };
}

// Caché en memoria para respuesta inmediata al alternar pestañas en la ventana emergente
let cachedJuiciosDriveFiles: DriveJuiciosFileItem[] | null = null;
const cachedJuiciosReportsByFicha = new Map<string, JuiciosEvaluativosParsedReport>();

export function getCachedJuiciosDriveFiles(): DriveJuiciosFileItem[] | null {
  return cachedJuiciosDriveFiles;
}

export function setManualJuiciosReportForFicha(
  ficha: string,
  report: JuiciosEvaluativosParsedReport
): void {
  cachedJuiciosReportsByFicha.set(ficha.trim(), report);
}

export async function listJuiciosEvaluativosDriveFiles(
  forceRefresh = false
): Promise<DriveJuiciosFileItem[]> {
  if (!forceRefresh && cachedJuiciosDriveFiles) {
    return cachedJuiciosDriveFiles;
  }
  const res = await fetch(
    `/api/drive-juicios-ficha?action=list&folderId=${encodeURIComponent(
      JUICIOS_EVALUATIVOS_DRIVE_FOLDER_ID
    )}&_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    throw new Error(
      'No fue posible consultar el listado de archivos de Juicios Evaluativos en Google Drive.'
    );
  }
  const data = await res.json();
  const files: DriveJuiciosFileItem[] = Array.isArray(data?.files) ? data.files : [];
  cachedJuiciosDriveFiles = files;
  return files;
}

export async function fetchJuiciosEvaluativosForFicha(
  ficha: string,
  forceRefresh = false
): Promise<FetchFichaJuiciosResult> {
  const cleanFicha = String(ficha || '').trim();
  if (!cleanFicha) {
    throw new Error('Número de ficha no válido.');
  }

  if (!forceRefresh && cachedJuiciosReportsByFicha.has(cleanFicha)) {
    return {
      status: 'found',
      report: cachedJuiciosReportsByFicha.get(cleanFicha)!,
      availableFiles: cachedJuiciosDriveFiles || [],
    };
  }

  const res = await fetch(
    `/api/drive-juicios-ficha?ficha=${encodeURIComponent(
      cleanFicha
    )}&folderId=${encodeURIComponent(JUICIOS_EVALUATIVOS_DRIVE_FOLDER_ID)}&_t=${Date.now()}`,
    { cache: 'no-store' }
  );

  if (res.status === 404) {
    const payload = await res.json().catch(() => ({}));
    const available: DriveJuiciosFileItem[] = Array.isArray(payload?.availableFiles)
      ? payload.availableFiles
      : cachedJuiciosDriveFiles || [];
    cachedJuiciosDriveFiles = available;
    return {
      status: 'not_found',
      ficha: cleanFicha,
      message:
        payload?.message ||
        `No se encontró en Google Drive un archivo Excel iniciado con "Ficha ${cleanFicha}" en la carpeta de Juicios Evaluativos.`,
      availableFiles: available,
    };
  }

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(
      errPayload?.error ||
        `Error al descargar los Juicios Evaluativos de la ficha ${cleanFicha} desde Google Drive.`
    );
  }

  const buffer = await res.arrayBuffer();
  const fileNameHeader = res.headers.get('X-Drive-File-Name');
  const fileIdHeader = res.headers.get('X-Drive-File-Id') || '';
  const modifiedHeader = res.headers.get('X-Drive-Modified-Time') || '';
  const fileName = fileNameHeader
    ? decodeURIComponent(fileNameHeader)
    : `Ficha ${cleanFicha} Reporte de Juicios Evaluativos.xls`;

  const report = parseJuiciosEvaluativosSpreadsheet(buffer, cleanFicha, {
    fileName,
    fileId: fileIdHeader,
    modifiedTimeIso: modifiedHeader,
  });

  cachedJuiciosReportsByFicha.set(cleanFicha, report);
  return {
    status: 'found',
    report,
    availableFiles: cachedJuiciosDriveFiles || [],
  };
}
