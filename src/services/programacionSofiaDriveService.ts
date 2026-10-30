import * as XLSX from 'xlsx';
import {
  formatDriveModifiedDate,
  formatIsoToDisplay,
  parseRawDateToIso,
} from './gestionCurricularDriveService';

export const PROGRAMACION_SOFIA_DRIVE_FOLDER_ID = '1NGz4Uy5Vt-AfV2wJjHYalzn6W7DyT5ff';
export const PROGRAMACION_SOFIA_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${PROGRAMACION_SOFIA_DRIVE_FOLDER_ID}?usp=sharing`;

export interface DriveProgramacionFileItem {
  id: string;
  name: string;
  ficha: string;
  startsWithFicha: boolean;
  modifiedTime: string;
}

export interface ProgramacionSofiaEntry {
  id: string;
  ordenCronologico: number;
  instructor: string;
  nombreInstructor: string;
  apellidoInstructor: string;
  estadoInstructor: string;
  competencia: string;
  resultadoAprendizaje: string;
  ambiente: string;
  horaInicio: string;
  horaFin: string;
  fechaInicioIso: string;
  fechaInicioDisplay: string;
  fechaFinIso: string;
  fechaFinDisplay: string;
  horasProgramadas: number;
  horasEjecutadas: number;
  horasPendientes: number;
  diasCalendarioCubiertos: number;
  diasHabilesLVCubiertos: number;
  esEtapaPractica: boolean;
}

export interface InstructorAsignadoSummary {
  instructor: string;
  estadoInstructor: string;
  asignacionesCount: number;
  competenciasCount: number;
  horasProgramadas: number;
  porcentajeHoras: number;
  primeraFechaIso: string;
  primeraFechaDisplay: string;
  ultimaFechaIso: string;
  ultimaFechaDisplay: string;
  incluyeEtapaPractica: boolean;
}

export interface CompetenciaAsignadaSummary {
  competencia: string;
  instructores: string[];
  asignacionesCount: number;
  horasProgramadas: number;
  primeraFechaIso: string;
  primeraFechaDisplay: string;
  ultimaFechaIso: string;
  ultimaFechaDisplay: string;
}

export interface ProgramacionSofiaParsedReport {
  fichaConsultada: string;
  fichaReporte: string;
  programaReporte: string;
  centroReporte: string;
  municipioReporte: string;
  fechaInicioFichaIso: string;
  fechaInicioFichaDisplay: string;
  fechaFinFichaIso: string;
  fechaFinFichaDisplay: string;
  fileName: string;
  fileId: string;
  modifiedTimeIso: string;
  modifiedTimeDisplay: string;
  sheetName: string;

  // Totales de horas (encabezado SOFIA Plus + suma de filas)
  totalHorasProgramadasHeader: number | null;
  totalHorasEjecutadasHeader: number | null;
  totalHorasPendientesHeader: number | null;
  sumaHorasProgramadasFilas: number;
  horasProgramadasReferencia: number;
  porcentajeEjecucionHoras: number | null;

  // Cobertura general de las filas ordenadas por fecha
  primeraFechaProgramadaIso: string;
  primeraFechaProgramadaDisplay: string;
  ultimaFechaProgramadaIso: string;
  ultimaFechaProgramadaDisplay: string;

  entries: ProgramacionSofiaEntry[];
  instructoresResumen: InstructorAsignadoSummary[];
  competenciasResumen: CompetenciaAsignadaSummary[];
}

export type UnscheduledScopeMode =
  | 'CICLO_FICHA'
  | 'ETAPA_LECTIVA'
  | 'ENTRE_PROGRAMACIONES';

export type UnscheduledDayRule = 'HABILES_LV' | 'HABILES_LS' | 'CALENDARIO';

export interface TramoSinProgramacion {
  index: number;
  desdeIso: string;
  desdeDisplay: string;
  hastaIso: string;
  hastaDisplay: string;
  diasSegunRegla: number;
  diasHabilesLV: number;
  diasHabilesLS: number;
  diasCalendario: number;
  tipoBrecha:
    | 'Inicio sin programación asignada'
    | 'Interrupción entre programaciones'
    | 'Cierre sin programación asignada'
    | 'Periodo completo sin programación';
}

export interface FechaSinProgramacionItem {
  iso: string;
  display: string;
  diaSemana: string;
  mesKey: string;
  mesLabel: string;
  tramoIndex: number;
  tipoBrecha: TramoSinProgramacion['tipoBrecha'];
}

export interface MesCoberturaProgramacion {
  mesKey: string;
  mesLabel: string;
  diasEvaluados: number;
  diasConProgramacion: number;
  diasSinProgramacion: number;
  porcentajeCobertura: number;
}

export interface UnscheduledDaysAnalysis {
  ventanaInicioIso: string;
  ventanaInicioDisplay: string;
  ventanaFinIso: string;
  ventanaFinDisplay: string;
  scopeUsado: UnscheduledScopeMode;
  reglaDias: UnscheduledDayRule;
  totalDiasEvaluados: number;
  totalDiasCalendarioVentana: number;
  diasConProgramacion: number;
  diasSinProgramacion: number;
  porcentajeConProgramacion: number;
  porcentajeSinProgramacion: number;
  tramosSinProgramacion: TramoSinProgramacion[];
  fechasSinProgramacion: FechaSinProgramacionItem[];
  resumenMensual: MesCoberturaProgramacion[];
}

export type FetchFichaProgramacionResult =
  | {
      status: 'found';
      report: ProgramacionSofiaParsedReport;
      availableFiles: DriveProgramacionFileItem[];
    }
  | {
      status: 'not_found';
      ficha: string;
      message: string;
      availableFiles: DriveProgramacionFileItem[];
    };

const DAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

function roundHours(val: number): number {
  return Math.round(val * 10) / 10;
}

function parseFlexNum(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim().replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeaderText(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isoToUtcMs(iso: string): number | null {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function utcMsToIso(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countSpanDays(startIso: string, endIso: string): { cal: number; lv: number } {
  const sMs = isoToUtcMs(startIso);
  const eMs = isoToUtcMs(endIso);
  if (sMs === null || eMs === null || eMs < sMs) {
    return { cal: 0, lv: 0 };
  }
  let cal = 0;
  let lv = 0;
  for (let ms = sMs; ms <= eMs; ms += 86400000) {
    cal++;
    const dow = new Date(ms).getUTCDay();
    if (dow >= 1 && dow <= 5) lv++;
  }
  return { cal, lv };
}

export function parseProgramacionSofiaSpreadsheet(
  buffer: ArrayBuffer,
  fichaConsultada: string,
  meta?: {
    fileName?: string;
    fileId?: string;
    modifiedTimeIso?: string;
  }
): ProgramacionSofiaParsedReport {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames[0] || 'Hoja1';
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });

  let fichaReporte = '';
  let programaReporte = '';
  let centroReporte = '';
  let municipioReporte = '';
  let fechaInicioFichaRaw = '';
  let fechaFinFichaRaw = '';
  let totalHorasProgHeader: number | null = null;
  let totalHorasEjecHeader: number | null = null;
  let totalHorasPendHeader: number | null = null;

  // 1. Extraer metadatos del encabezado superior del reporte SOFIA Plus (primeras 20 filas)
  const scanTopLimit = Math.min(20, rawRows.length);
  for (let r = 0; r < scanTopLimit; r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const label = normalizeHeaderText(row[c]);
      if (!label) continue;
      const nextVal = String(row[c + 1] ?? '').trim();

      if (
        (label === 'codigo ficha' || label === 'ficha' || label === 'numero de ficha' || label === 'ficha de caracterizacion') &&
        nextVal
      ) {
        const m = nextVal.match(/\d{4,12}/);
        if (m) fichaReporte = m[0];
      } else if (label === 'fecha inicio ficha' || label === 'fecha de inicio ficha') {
        if (nextVal) fechaInicioFichaRaw = nextVal;
      } else if (label === 'fecha fin ficha' || label === 'fecha de fin ficha' || label === 'fecha terminacion ficha') {
        if (nextVal) fechaFinFichaRaw = nextVal;
      } else if (label === 'nombre programa' || label === 'programa de formacion' || label === 'denominacion del programa') {
        if (nextVal) programaReporte = nextVal;
      } else if (label === 'centro' || label === 'centro de formacion') {
        if (nextVal) centroReporte = nextVal;
      } else if (label === 'municipio' || label === 'ciudad') {
        if (nextVal) municipioReporte = nextVal;
      } else if (label.includes('total de horas programadas')) {
        if (nextVal !== '') totalHorasProgHeader = roundHours(parseFlexNum(nextVal));
      } else if (label.includes('total de horas ejecutadas')) {
        if (nextVal !== '') totalHorasEjecHeader = roundHours(parseFlexNum(nextVal));
      } else if (label.includes('total de horas pendientes')) {
        if (nextVal !== '') totalHorasPendHeader = roundHours(parseFlexNum(nextVal));
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

  // 2. Detectar fila de encabezados de la tabla de programación
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(40, rawRows.length); r++) {
    const rowNorm = (rawRows[r] || []).map(normalizeHeaderText);
    const joined = rowNorm.join('|');
    const hasInstructorOrComp =
      joined.includes('instructor') || joined.includes('competencia') || joined.includes('ambiente');
    const hasDateOrHours =
      joined.includes('fecha') || joined.includes('hora') || joined.includes('programacion');
    if (hasInstructorOrComp && hasDateOrHours) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) headerRowIdx = 0;

  const headerCells = (rawRows[headerRowIdx] || []).map(normalizeHeaderText);

  const findColIdx = (predicates: ((h: string) => boolean)[]): number => {
    for (const pred of predicates) {
      const idx = headerCells.findIndex((h) => h && pred(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const colNombreInst = findColIdx([
    (h) => h === 'nombre instructor' || h === 'nombres instructor' || h === 'nombres',
    (h) => h.includes('nombre') && h.includes('instructor') && !h.includes('completo'),
  ]);
  const colApellidoInst = findColIdx([
    (h) => h === 'apellido instructor' || h === 'apellidos instructor' || h === 'apellidos',
    (h) => h.includes('apellido') && h.includes('instructor'),
  ]);
  const colInstructorCompleto = findColIdx([
    (h) => h === 'instructor' || h === 'nombre completo del instructor' || h === 'funcionario',
    (h) => h.includes('instructor') && !h.includes('estado') && !h.includes('nombre') && !h.includes('apellido'),
  ]);
  const colEstadoInst = findColIdx([
    (h) => h.includes('estado') && h.includes('instructor'),
    (h) => h === 'estado',
  ]);
  const colCompetencia = findColIdx([
    (h) => h === 'competencia' || h === 'competencias programadas' || h === 'nombre competencia',
    (h) => h.includes('competencia'),
  ]);
  const colResultado = findColIdx([
    (h) => h.includes('resultado') && h.includes('aprendizaje'),
    (h) => h === 'resultado' || h === 'rap',
  ]);
  const colAmbiente = findColIdx([
    (h) => h.includes('ambiente'),
    (h) => h.includes('aula') || h.includes('salon'),
  ]);
  const colFechaInicio = findColIdx([
    (h) => h.includes('fecha') && h.includes('inicio') && h.includes('program'),
    (h) => h.includes('fecha') && h.includes('inicio'),
    (h) => h === 'fecha' || h === 'fecha programacion' || h === 'fechas',
  ]);
  const colFechaFin = findColIdx([
    (h) => h.includes('fecha') && h.includes('fin') && h.includes('program'),
    (h) => h.includes('fecha') && (h.includes('fin') || h.includes('termino') || h.includes('final')),
  ]);
  const colHoraInicio = findColIdx([
    (h) => h.includes('hora') && h.includes('inicio'),
    (h) => h === 'hora inicial',
  ]);
  const colHoraFin = findColIdx([
    (h) => h.includes('hora') && (h.includes('fin') || h.includes('final')),
  ]);
  const colHorasProg = findColIdx([
    (h) => h === 'horas programadas' || h === 'horas prog' || h === 'cantidad horas',
    (h) => h.includes('horas') && h.includes('program'),
    (h) => h === 'horas' || h === 'total horas',
  ]);
  const colHorasEjec = findColIdx([(h) => h.includes('horas') && h.includes('ejecut')]);
  const colHorasPend = findColIdx([(h) => h.includes('horas') && h.includes('pendient')]);

  const rawEntries: Omit<ProgramacionSofiaEntry, 'ordenCronologico'>[] = [];

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    if (!row.some((cell) => String(cell ?? '').trim() !== '')) continue;

    const getVal = (idx: number): string => (idx >= 0 ? String(row[idx] ?? '').trim() : '');

    const nombreInst = getVal(colNombreInst);
    const apellidoInst = getVal(colApellidoInst);
    const fullInst =
      nombreInst || apellidoInst
        ? `${nombreInst} ${apellidoInst}`.replace(/\s+/g, ' ').trim()
        : getVal(colInstructorCompleto);

    const competencia = getVal(colCompetencia);
    const resultadoAprendizaje = getVal(colResultado);
    const ambiente = getVal(colAmbiente);
    const estadoInstructor = getVal(colEstadoInst) || 'Activo';
    const horaInicio = getVal(colHoraInicio);
    const horaFin = getVal(colHoraFin);

    const rawStart = getVal(colFechaInicio);
    const rawEnd = colFechaFin >= 0 ? getVal(colFechaFin) : rawStart;

    let startIso = parseRawDateToIso(rawStart);
    let endIso = parseRawDateToIso(rawEnd) || startIso;
    if (!startIso && endIso) startIso = endIso;

    // Ignorar filas totales vacías o de pie de página sin instructor, sin competencia y sin fechas
    if (!fullInst && !competencia && !startIso) continue;
    const normFirstCell = normalizeHeaderText(row[0]);
    if (normFirstCell.startsWith('total') && !startIso) continue;

    if (startIso && endIso && endIso < startIso) {
      const tmp = startIso;
      startIso = endIso;
      endIso = tmp;
    }

    const horasProgramadas = roundHours(parseFlexNum(colHorasProg >= 0 ? row[colHorasProg] : 0));
    const horasEjecutadas = roundHours(parseFlexNum(colHorasEjec >= 0 ? row[colHorasEjec] : 0));
    const horasPendientes = roundHours(parseFlexNum(colHorasPend >= 0 ? row[colHorasPend] : 0));

    const span = startIso && endIso ? countSpanDays(startIso, endIso) : { cal: 0, lv: 0 };
    const compNorm = normalizeHeaderText(competencia + ' ' + resultadoAprendizaje);
    const esEtapaPractica =
      compNorm.includes('etapa practica') || compNorm.includes('etapa productiva');

    rawEntries.push({
      id: `prog-${r}`,
      instructor: fullInst || 'SIN INSTRUCTOR ASIGNADO',
      nombreInstructor: nombreInst,
      apellidoInstructor: apellidoInst,
      estadoInstructor,
      competencia: competencia || resultadoAprendizaje || 'Sin competencia especificada',
      resultadoAprendizaje,
      ambiente,
      horaInicio,
      horaFin,
      fechaInicioIso: startIso,
      fechaInicioDisplay: formatIsoToDisplay(startIso, rawStart),
      fechaFinIso: endIso,
      fechaFinDisplay: formatIsoToDisplay(endIso, rawEnd),
      horasProgramadas,
      horasEjecutadas,
      horasPendientes,
      diasCalendarioCubiertos: span.cal,
      diasHabilesLVCubiertos: span.lv,
      esEtapaPractica,
    });
  }

  // 3. ORDENAR CRONOLÓGICAMENTE POR LAS FECHAS (Requisito central)
  rawEntries.sort((a, b) => {
    const aHas = Boolean(a.fechaInicioIso);
    const bHas = Boolean(b.fechaInicioIso);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (a.fechaInicioIso !== b.fechaInicioIso) {
      return a.fechaInicioIso.localeCompare(b.fechaInicioIso);
    }
    if (a.fechaFinIso !== b.fechaFinIso) {
      return a.fechaFinIso.localeCompare(b.fechaFinIso);
    }
    if (a.horaInicio !== b.horaInicio) {
      return a.horaInicio.localeCompare(b.horaInicio);
    }
    return a.instructor.localeCompare(b.instructor, 'es');
  });

  const entries: ProgramacionSofiaEntry[] = rawEntries.map((item, idx) => ({
    ...item,
    ordenCronologico: idx + 1,
  }));

  const sumaHorasProgramadasFilas = roundHours(
    entries.reduce((acc, e) => acc + e.horasProgramadas, 0)
  );
  const horasProgramadasReferencia =
    totalHorasProgHeader !== null && totalHorasProgHeader > 0
      ? totalHorasProgHeader
      : sumaHorasProgramadasFilas;

  const porcentajeEjecucionHoras =
    totalHorasEjecHeader !== null && horasProgramadasReferencia > 0
      ? Math.round((totalHorasEjecHeader / horasProgramadasReferencia) * 1000) / 10
      : null;

  const datedEntries = entries.filter((e) => Boolean(e.fechaInicioIso));
  const primeraFechaProgramadaIso =
    datedEntries.length > 0 ? datedEntries[0].fechaInicioIso : '';
  const ultimaFechaProgramadaIso = datedEntries.reduce(
    (maxIso, e) => (e.fechaFinIso > maxIso ? e.fechaFinIso : maxIso),
    ''
  );

  // 4. Resumen agrupado por Instructor
  const instMap = new Map<
    string,
    {
      instructor: string;
      estadoInstructor: string;
      asignacionesCount: number;
      competencias: Set<string>;
      horasProgramadas: number;
      primeraFechaIso: string;
      ultimaFechaIso: string;
      incluyeEtapaPractica: boolean;
    }
  >();

  for (const e of entries) {
    const key = e.instructor.toUpperCase();
    const prev = instMap.get(key);
    if (!prev) {
      instMap.set(key, {
        instructor: e.instructor,
        estadoInstructor: e.estadoInstructor,
        asignacionesCount: 1,
        competencias: new Set([e.competencia]),
        horasProgramadas: e.horasProgramadas,
        primeraFechaIso: e.fechaInicioIso,
        ultimaFechaIso: e.fechaFinIso,
        incluyeEtapaPractica: e.esEtapaPractica,
      });
    } else {
      prev.asignacionesCount += 1;
      prev.competencias.add(e.competencia);
      prev.horasProgramadas += e.horasProgramadas;
      if (e.fechaInicioIso && (!prev.primeraFechaIso || e.fechaInicioIso < prev.primeraFechaIso)) {
        prev.primeraFechaIso = e.fechaInicioIso;
      }
      if (e.fechaFinIso && (!prev.ultimaFechaIso || e.fechaFinIso > prev.ultimaFechaIso)) {
        prev.ultimaFechaIso = e.fechaFinIso;
      }
      if (e.esEtapaPractica) prev.incluyeEtapaPractica = true;
    }
  }

  const totalBasePct = sumaHorasProgramadasFilas > 0 ? sumaHorasProgramadasFilas : 1;
  const instructoresResumen: InstructorAsignadoSummary[] = Array.from(instMap.values())
    .map((it) => ({
      instructor: it.instructor,
      estadoInstructor: it.estadoInstructor,
      asignacionesCount: it.asignacionesCount,
      competenciasCount: it.competencias.size,
      horasProgramadas: roundHours(it.horasProgramadas),
      porcentajeHoras:
        sumaHorasProgramadasFilas > 0
          ? Math.round((it.horasProgramadas / totalBasePct) * 1000) / 10
          : 0,
      primeraFechaIso: it.primeraFechaIso,
      primeraFechaDisplay: formatIsoToDisplay(it.primeraFechaIso),
      ultimaFechaIso: it.ultimaFechaIso,
      ultimaFechaDisplay: formatIsoToDisplay(it.ultimaFechaIso),
      incluyeEtapaPractica: it.incluyeEtapaPractica,
    }))
    .sort((a, b) => {
      if (a.primeraFechaIso && b.primeraFechaIso && a.primeraFechaIso !== b.primeraFechaIso) {
        return a.primeraFechaIso.localeCompare(b.primeraFechaIso);
      }
      return b.horasProgramadas - a.horasProgramadas;
    });

  // 5. Resumen agrupado por Competencia
  const compMap = new Map<
    string,
    {
      competencia: string;
      instructores: Set<string>;
      asignacionesCount: number;
      horasProgramadas: number;
      primeraFechaIso: string;
      ultimaFechaIso: string;
    }
  >();

  for (const e of entries) {
    const key = e.competencia.toUpperCase();
    const prev = compMap.get(key);
    if (!prev) {
      compMap.set(key, {
        competencia: e.competencia,
        instructores: new Set([e.instructor]),
        asignacionesCount: 1,
        horasProgramadas: e.horasProgramadas,
        primeraFechaIso: e.fechaInicioIso,
        ultimaFechaIso: e.fechaFinIso,
      });
    } else {
      prev.instructores.add(e.instructor);
      prev.asignacionesCount += 1;
      prev.horasProgramadas += e.horasProgramadas;
      if (e.fechaInicioIso && (!prev.primeraFechaIso || e.fechaInicioIso < prev.primeraFechaIso)) {
        prev.primeraFechaIso = e.fechaInicioIso;
      }
      if (e.fechaFinIso && (!prev.ultimaFechaIso || e.fechaFinIso > prev.ultimaFechaIso)) {
        prev.ultimaFechaIso = e.fechaFinIso;
      }
    }
  }

  const competenciasResumen: CompetenciaAsignadaSummary[] = Array.from(compMap.values())
    .map((c) => ({
      competencia: c.competencia,
      instructores: Array.from(c.instructores),
      asignacionesCount: c.asignacionesCount,
      horasProgramadas: roundHours(c.horasProgramadas),
      primeraFechaIso: c.primeraFechaIso,
      primeraFechaDisplay: formatIsoToDisplay(c.primeraFechaIso),
      ultimaFechaIso: c.ultimaFechaIso,
      ultimaFechaDisplay: formatIsoToDisplay(c.ultimaFechaIso),
    }))
    .sort((a, b) => (a.primeraFechaIso || '9999').localeCompare(b.primeraFechaIso || '9999'));

  const fechaInicioFichaIso = parseRawDateToIso(fechaInicioFichaRaw);
  const fechaFinFichaIso = parseRawDateToIso(fechaFinFichaRaw);
  const modIso = meta?.modifiedTimeIso || '';

  return {
    fichaConsultada,
    fichaReporte,
    programaReporte,
    centroReporte,
    municipioReporte,
    fechaInicioFichaIso,
    fechaInicioFichaDisplay: formatIsoToDisplay(fechaInicioFichaIso, fechaInicioFichaRaw),
    fechaFinFichaIso,
    fechaFinFichaDisplay: formatIsoToDisplay(fechaFinFichaIso, fechaFinFichaRaw),
    fileName: meta?.fileName || `Ficha ${fichaConsultada}.xls`,
    fileId: meta?.fileId || '',
    modifiedTimeIso: modIso,
    modifiedTimeDisplay: formatDriveModifiedDate(modIso),
    sheetName,
    totalHorasProgramadasHeader: totalHorasProgHeader,
    totalHorasEjecutadasHeader: totalHorasEjecHeader,
    totalHorasPendientesHeader: totalHorasPendHeader,
    sumaHorasProgramadasFilas,
    horasProgramadasReferencia,
    porcentajeEjecucionHoras,
    primeraFechaProgramadaIso,
    primeraFechaProgramadaDisplay: formatIsoToDisplay(primeraFechaProgramadaIso),
    ultimaFechaProgramadaIso,
    ultimaFechaProgramadaDisplay: formatIsoToDisplay(ultimaFechaProgramadaIso),
    entries,
    instructoresResumen,
    competenciasResumen,
  };
}

/**
 * Calcula con precisión cronológica los días que tuvieron programación asignada
 * y los días que NO tuvo programación esta Ficha dentro del alcance evaluado.
 */
export function computeUnscheduledDaysAnalysis(
  report: ProgramacionSofiaParsedReport,
  options: {
    scope: UnscheduledScopeMode;
    dayRule: UnscheduledDayRule;
    fallbackFechaInicioFichaIso?: string;
    fallbackFechaFinFichaIso?: string;
    fechaFinEtapaLectivaIso?: string;
  }
): UnscheduledDaysAnalysis {
  const {
    scope,
    dayRule,
    fallbackFechaInicioFichaIso = '',
    fallbackFechaFinFichaIso = '',
    fechaFinEtapaLectivaIso = '',
  } = options;

  const baseStartFicha =
    report.fechaInicioFichaIso ||
    fallbackFechaInicioFichaIso ||
    report.primeraFechaProgramadaIso;
  const baseEndFicha =
    report.fechaFinFichaIso ||
    fallbackFechaFinFichaIso ||
    report.ultimaFechaProgramadaIso;

  let ventanaInicioIso = baseStartFicha;
  let ventanaFinIso = baseEndFicha;

  if (scope === 'ETAPA_LECTIVA') {
    ventanaInicioIso = baseStartFicha;
    ventanaFinIso = fechaFinEtapaLectivaIso || baseEndFicha;
  } else if (scope === 'ENTRE_PROGRAMACIONES') {
    ventanaInicioIso = report.primeraFechaProgramadaIso || baseStartFicha;
    ventanaFinIso = report.ultimaFechaProgramadaIso || baseEndFicha;
  }

  const startMs = isoToUtcMs(ventanaInicioIso);
  const endMs = isoToUtcMs(ventanaFinIso);

  if (startMs === null || endMs === null || endMs < startMs) {
    return {
      ventanaInicioIso,
      ventanaInicioDisplay: formatIsoToDisplay(ventanaInicioIso),
      ventanaFinIso,
      ventanaFinDisplay: formatIsoToDisplay(ventanaFinIso),
      scopeUsado: scope,
      reglaDias: dayRule,
      totalDiasEvaluados: 0,
      totalDiasCalendarioVentana: 0,
      diasConProgramacion: 0,
      diasSinProgramacion: 0,
      porcentajeConProgramacion: 0,
      porcentajeSinProgramacion: 0,
      tramosSinProgramacion: [],
      fechasSinProgramacion: [],
      resumenMensual: [],
    };
  }

  // Construir intervalos fusionados de fechas con programación [msStart, msEnd]
  const rawIntervals: [number, number][] = [];
  for (const e of report.entries) {
    if (!e.fechaInicioIso || !e.fechaFinIso) continue;
    const s = isoToUtcMs(e.fechaInicioIso);
    const f = isoToUtcMs(e.fechaFinIso);
    if (s !== null && f !== null && f >= s) {
      rawIntervals.push([s, f]);
    }
  }
  rawIntervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const mergedIntervals: [number, number][] = [];
  for (const iv of rawIntervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push([iv[0], iv[1]]);
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      if (iv[0] <= last[1] + 86400000) {
        if (iv[1] > last[1]) last[1] = iv[1];
      } else {
        mergedIntervals.push([iv[0], iv[1]]);
      }
    }
  }

  const firstScheduledMs = mergedIntervals.length > 0 ? mergedIntervals[0][0] : null;
  const lastScheduledMs =
    mergedIntervals.length > 0 ? mergedIntervals[mergedIntervals.length - 1][1] : null;

  const isDayCountedByRule = (dow: number): boolean => {
    if (dayRule === 'HABILES_LV') return dow >= 1 && dow <= 5;
    if (dayRule === 'HABILES_LS') return dow >= 1 && dow <= 6;
    return true;
  };

  let ivPtr = 0;
  const isScheduledMs = (ms: number): boolean => {
    while (ivPtr < mergedIntervals.length && mergedIntervals[ivPtr][1] < ms) {
      ivPtr++;
    }
    if (ivPtr < mergedIntervals.length) {
      return ms >= mergedIntervals[ivPtr][0] && ms <= mergedIntervals[ivPtr][1];
    }
    return false;
  };

  let totalDiasCalendarioVentana = 0;
  let totalDiasEvaluados = 0;
  let diasConProgramacion = 0;
  let diasSinProgramacion = 0;

  // Para agrupar tramos continuos donde ningún instructor estuvo programado
  interface RawGap {
    desdeMs: number;
    hastaMs: number;
    diasCalendario: number;
    diasHabilesLV: number;
    diasHabilesLS: number;
    diasSegunRegla: number;
    fechasSegunRegla: { ms: number; iso: string; dow: number }[];
  }

  const rawGaps: RawGap[] = [];
  let openGap: RawGap | null = null;

  const monthlyMap = new Map<
    string,
    { mesKey: string; mesLabel: string; evaluados: number; conProg: number; sinProg: number }
  >();

  // Seguridad ante rangos anómalos (> 10 años = 3660 días)
  const safeEndMs = Math.min(endMs, startMs + 3660 * 86400000);

  for (let ms = startMs; ms <= safeEndMs; ms += 86400000) {
    totalDiasCalendarioVentana++;
    const dt = new Date(ms);
    const dow = dt.getUTCDay();
    const y = dt.getUTCFullYear();
    const mIdx = dt.getUTCMonth();
    const dNum = dt.getUTCDate();
    const iso = `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    const mesKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;

    const scheduled = isScheduledMs(ms);
    const counted = isDayCountedByRule(dow);

    if (counted) {
      totalDiasEvaluados++;
      let mEntry = monthlyMap.get(mesKey);
      if (!mEntry) {
        mEntry = {
          mesKey,
          mesLabel: `${MONTH_SHORT_ES[mIdx]} ${y}`,
          evaluados: 0,
          conProg: 0,
          sinProg: 0,
        };
        monthlyMap.set(mesKey, mEntry);
      }
      mEntry.evaluados++;
      if (scheduled) {
        diasConProgramacion++;
        mEntry.conProg++;
      } else {
        diasSinProgramacion++;
        mEntry.sinProg++;
      }
    }

    if (!scheduled) {
      if (!openGap) {
        openGap = {
          desdeMs: ms,
          hastaMs: ms,
          diasCalendario: 0,
          diasHabilesLV: 0,
          diasHabilesLS: 0,
          diasSegunRegla: 0,
          fechasSegunRegla: [],
        };
      }
      openGap.hastaMs = ms;
      openGap.diasCalendario++;
      if (dow >= 1 && dow <= 5) openGap.diasHabilesLV++;
      if (dow >= 1 && dow <= 6) openGap.diasHabilesLS++;
      if (counted) {
        openGap.diasSegunRegla++;
        openGap.fechasSegunRegla.push({ ms, iso, dow });
      }
    } else if (openGap) {
      rawGaps.push(openGap);
      openGap = null;
    }
  }
  if (openGap) {
    rawGaps.push(openGap);
  }

  const tramosSinProgramacion: TramoSinProgramacion[] = [];
  const fechasSinProgramacion: FechaSinProgramacionItem[] = [];

  let tramoCounter = 0;
  for (const g of rawGaps) {
    if (g.diasSegunRegla === 0) continue;
    tramoCounter++;

    let tipoBrecha: TramoSinProgramacion['tipoBrecha'] = 'Interrupción entre programaciones';
    if (firstScheduledMs === null || lastScheduledMs === null) {
      tipoBrecha = 'Periodo completo sin programación';
    } else if (g.hastaMs < firstScheduledMs) {
      tipoBrecha = 'Inicio sin programación asignada';
    } else if (g.desdeMs > lastScheduledMs) {
      tipoBrecha = 'Cierre sin programación asignada';
    }

    const desdeIso = utcMsToIso(g.desdeMs);
    const hastaIso = utcMsToIso(g.hastaMs);

    tramosSinProgramacion.push({
      index: tramoCounter,
      desdeIso,
      desdeDisplay: formatIsoToDisplay(desdeIso),
      hastaIso,
      hastaDisplay: formatIsoToDisplay(hastaIso),
      diasSegunRegla: g.diasSegunRegla,
      diasHabilesLV: g.diasHabilesLV,
      diasHabilesLS: g.diasHabilesLS,
      diasCalendario: g.diasCalendario,
      tipoBrecha,
    });

    for (const fItem of g.fechasSegunRegla) {
      const mIdx = Number(fItem.iso.slice(5, 7)) - 1;
      const yearStr = fItem.iso.slice(0, 4);
      fechasSinProgramacion.push({
        iso: fItem.iso,
        display: formatIsoToDisplay(fItem.iso),
        diaSemana: DAY_NAMES_ES[fItem.dow] || '',
        mesKey: fItem.iso.slice(0, 7),
        mesLabel: `${MONTH_NAMES_ES[mIdx] || ''} ${yearStr}`,
        tramoIndex: tramoCounter,
        tipoBrecha,
      });
    }
  }

  const resumenMensual: MesCoberturaProgramacion[] = Array.from(monthlyMap.values()).map((m) => ({
    mesKey: m.mesKey,
    mesLabel: m.mesLabel,
    diasEvaluados: m.evaluados,
    diasConProgramacion: m.conProg,
    diasSinProgramacion: m.sinProg,
    porcentajeCobertura:
      m.evaluados > 0 ? Math.round((m.conProg / m.evaluados) * 1000) / 10 : 0,
  }));

  const porcentajeConProgramacion =
    totalDiasEvaluados > 0
      ? Math.round((diasConProgramacion / totalDiasEvaluados) * 1000) / 10
      : 0;
  const porcentajeSinProgramacion =
    totalDiasEvaluados > 0
      ? Math.round((diasSinProgramacion / totalDiasEvaluados) * 1000) / 10
      : 0;

  return {
    ventanaInicioIso,
    ventanaInicioDisplay: formatIsoToDisplay(ventanaInicioIso),
    ventanaFinIso,
    ventanaFinDisplay: formatIsoToDisplay(ventanaFinIso),
    scopeUsado: scope,
    reglaDias: dayRule,
    totalDiasEvaluados,
    totalDiasCalendarioVentana,
    diasConProgramacion,
    diasSinProgramacion,
    porcentajeConProgramacion,
    porcentajeSinProgramacion,
    tramosSinProgramacion,
    fechasSinProgramacion,
    resumenMensual,
  };
}

// Caché en memoria para respuesta instantánea al cambiar de pestañas
let cachedDriveFiles: DriveProgramacionFileItem[] | null = null;
const cachedReportsByFicha = new Map<string, ProgramacionSofiaParsedReport>();

export function getCachedProgramacionDriveFiles(): DriveProgramacionFileItem[] | null {
  return cachedDriveFiles;
}

export function setManualProgramacionReportForFicha(
  ficha: string,
  report: ProgramacionSofiaParsedReport
): void {
  cachedReportsByFicha.set(ficha.trim(), report);
}

export async function listProgramacionSofiaDriveFiles(
  forceRefresh = false
): Promise<DriveProgramacionFileItem[]> {
  if (!forceRefresh && cachedDriveFiles) {
    return cachedDriveFiles;
  }
  const res = await fetch(
    `/api/drive-programacion-ficha?action=list&folderId=${encodeURIComponent(
      PROGRAMACION_SOFIA_DRIVE_FOLDER_ID
    )}&_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    throw new Error('No fue posible consultar el listado de archivos de Programación SOFIA Plus en Drive.');
  }
  const data = await res.json();
  const files: DriveProgramacionFileItem[] = Array.isArray(data?.files) ? data.files : [];
  cachedDriveFiles = files;
  return files;
}

export async function fetchProgramacionSofiaForFicha(
  ficha: string,
  forceRefresh = false
): Promise<FetchFichaProgramacionResult> {
  const cleanFicha = String(ficha || '').trim();
  if (!cleanFicha) {
    throw new Error('Número de ficha no válido.');
  }

  if (!forceRefresh && cachedReportsByFicha.has(cleanFicha)) {
    return {
      status: 'found',
      report: cachedReportsByFicha.get(cleanFicha)!,
      availableFiles: cachedDriveFiles || [],
    };
  }

  const res = await fetch(
    `/api/drive-programacion-ficha?ficha=${encodeURIComponent(
      cleanFicha
    )}&folderId=${encodeURIComponent(PROGRAMACION_SOFIA_DRIVE_FOLDER_ID)}&_t=${Date.now()}`,
    { cache: 'no-store' }
  );

  if (res.status === 404) {
    const payload = await res.json().catch(() => ({}));
    const available: DriveProgramacionFileItem[] = Array.isArray(payload?.availableFiles)
      ? payload.availableFiles
      : cachedDriveFiles || [];
    cachedDriveFiles = available;
    return {
      status: 'not_found',
      ficha: cleanFicha,
      message:
        payload?.message ||
        `No se encontró en Google Drive un archivo Excel iniciado con "Ficha ${cleanFicha}".`,
      availableFiles: available,
    };
  }

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(
      errPayload?.error ||
        `Error al descargar la programación SOFIA Plus de la ficha ${cleanFicha} desde Google Drive.`
    );
  }

  const buffer = await res.arrayBuffer();
  const fileNameHeader = res.headers.get('X-Drive-File-Name');
  const fileIdHeader = res.headers.get('X-Drive-File-Id') || '';
  const modifiedHeader = res.headers.get('X-Drive-Modified-Time') || '';
  const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : `Ficha ${cleanFicha}.xls`;

  const report = parseProgramacionSofiaSpreadsheet(buffer, cleanFicha, {
    fileName,
    fileId: fileIdHeader,
    modifiedTimeIso: modifiedHeader,
  });

  cachedReportsByFicha.set(cleanFicha, report);
  return {
    status: 'found',
    report,
    availableFiles: cachedDriveFiles || [],
  };
}
