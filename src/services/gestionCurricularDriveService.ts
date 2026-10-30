import * as XLSX from 'xlsx';

export const GESTION_DRIVE_FOLDER_ID = '1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK';
export const GESTION_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GESTION_DRIVE_FOLDER_ID}`;
export const GESTION_DEFAULT_FILE_ID = '1CBCsLRu7T0ypYrUbrCc_afkLxjnS7-kQ';

export interface DesempenoYtoAK {
  colY_enTransito: number;            // Columna Y (24): EN_TRANSITO
  colZ_induccion: number;             // Columna Z (25): INDUCCION
  colAA_formacion: number;            // Columna AA (26): FORMACION
  colAB_condicionado: number;         // Columna AB (27): CONDICIONADO
  colAC_aplazado: number;             // Columna AC (28): APLAZADO
  colAD_retiroVoluntario: number;     // Columna AD (29): RETIRO_VOLUNTARIO
  colAE_cancelamientoVirtComp: number;// Columna AE (30): CANCELAMIENTO_VIRT_COMP
  colAF_desercionVirtComp: number;    // Columna AF (31): DESERCION_VIRT_COMP
  colAG_cancelado: number;            // Columna AG (32): CANCELADO
  colAH_porCertificar: number;        // Columna AH (33): POR_CERTIFICAR
  colAI_certificado: number;          // Columna AI (34): CERTIFICADO
  colAJ_trasladado: number;           // Columna AJ (35): TRASLADADO
  colAK_otro: number;                 // Columna AK (36): OTRO
}

export type CategoriaColumnaH = 'NO_NIVEL' | 'NIVEL_TITULADO';

export interface FichaCurricularDrive extends DesempenoYtoAK {
  // Identificación y diseño curricular (Columnas A - X)
  codigoRegional: string;       // A (0)
  regional: string;             // B (1)
  codigoCentro: string;         // C (2)
  centro: string;               // D (3)
  codigoPrograma: string;       // E (4)
  versionPrograma: string;      // F (5)
  programa: string;             // G (6)
  nivelFormacion: string;       // H (7) NIVEL_FORMACION
  categoriaColH: CategoriaColumnaH; // Agrupación de "No niveles" vs "Niveles Titulados" en Col H
  duracionMaxima: number;       // I (8)
  duracionEtapaLectiva: number; // J (9)
  duracionEtapaProductiva: number; // K (10)
  ficha: string;                // L (11) FICHA
  fechaInicio: string;          // M (12) DD/MM/YYYY
  fechaInicioIso: string;       // M (12) YYYY-MM-DD
  fechaFin: string;             // N (13) FECHA_FIN_FICHA DD/MM/YYYY (Cierre Etapa Productiva en niveles aplicables)
  fechaFinIso: string;          // N (13) FECHA_FIN_FICHA YYYY-MM-DD

  // Reglas de Etapa Lectiva y Etapa Productiva basadas en Columna N (FECHA_FIN_FICHA) y Columna H (NIVEL_FORMACION)
  aplicaEtapaProductiva: boolean;             // true para TÉCNICO, TECNÓLOGO, AUXILIAR y OPERARIO
  mesesRestadosEtapaLectiva: 0 | 3 | 6;       // 6 meses TÉCNICO/TECNÓLOGO, 3 meses AUXILIAR/OPERARIO, 0 otros
  reglaEtapaLectivaLabel: string;             // Etiqueta trazable de la regla aplicada
  fechaFinEtapaLectiva: string;               // DD/MM/YYYY calculada desde Col N (-6m o -3m)
  fechaFinEtapaLectivaIso: string;            // YYYY-MM-DD calculada desde Col N (-6m o -3m)
  fechaCierreEtapaProductiva: string;         // DD/MM/YYYY (= FECHA_FIN_FICHA Col N cuando aplica)
  fechaCierreEtapaProductivaIso: string;      // YYYY-MM-DD (= FECHA_FIN_FICHA Col N cuando aplica)
  fechaLimitePresentacionProductiva: string;  // DD/MM/YYYY (= FECHA_FIN_FICHA Col N + 1 año)
  fechaLimitePresentacionProductivaIso: string; // YYYY-MM-DD (= FECHA_FIN_FICHA Col N + 1 año)

  cupo: number;                 // O (14)
  diferenciaCupoEstados: number;// totalAprendicesYtoAK - cupo (0 = coincide exacto, >0 sobrecupo, <0 subocupación)
  estadoFicha: string;          // P (15) ESTADO_FICHA
  tipoRespuesta: string;        // Q (16) TIPO_RESPUESTA
  programaEspecial: string;     // R (17) PROGRAMA_ESPECIAL
  codigoConvenio: string;       // S (18)
  ampliacionCobertura: string;  // T (19)
  convenio: string;             // U (20)
  empresa: string;              // X (23)

  // Metadatos de trazabilidad y duplicidad en el archivo fuente
  filaReporte: number;          // Fila en el XML/Excel para auditoría de validación
  ocurrenciasFicha: number;     // 1 = única, >= 2 = ficha duplicada en Col L

  // Métricas calculadas de análisis y desempeño (basadas en Y..AK y O)
  totalAprendicesYtoAK: number;
  activosEjecucion: number;     // Y + Z + AA
  logroCertificacion: number;   // AH + AI
  novedadesAcademicas: number;  // AB + AC + AJ + AK
  bajasTotales: number;         // AD + AE + AF + AG
  tasaOcupacionCupo: number;    // (totalAprendicesYtoAK / cupo) * 100
  tasaCertificacion: number;    // (AI / totalAprendicesYtoAK) * 100
  tasaCulminacion: number;      // ((AI + AH) / totalAprendicesYtoAK) * 100
  tasaBajas: number;            // (bajasTotales / totalAprendicesYtoAK) * 100
  tasaRetencion: number;        // 100 - tasaBajas
  diagnostico: 'Óptimo' | 'En Seguimiento' | 'Alerta de Retención' | 'Sin Aprendices';
}

export interface ColumnYtoAKMeta {
  colLetter: string;
  xmlHeader: string;
  shortLabel: string;
  fullLabel: string;
  key: keyof DesempenoYtoAK;
  group: 'ejecucion' | 'logro' | 'novedad' | 'baja';
  barColor: string;
}

export const COLUMNS_Y_TO_AK_META: ColumnYtoAKMeta[] = [
  { colLetter: 'Y', xmlHeader: 'EN_TRANSITO', shortLabel: 'En Tránsito', fullLabel: 'Aprendices en Tránsito', key: 'colY_enTransito', group: 'ejecucion', barColor: '#0284c7' },
  { colLetter: 'Z', xmlHeader: 'INDUCCION', shortLabel: 'Inducción', fullLabel: 'En Inducción', key: 'colZ_induccion', group: 'ejecucion', barColor: '#0ea5e9' },
  { colLetter: 'AA', xmlHeader: 'FORMACION', shortLabel: 'En Formación', fullLabel: 'Activos en Formación', key: 'colAA_formacion', group: 'ejecucion', barColor: '#39A900' },
  { colLetter: 'AB', xmlHeader: 'CONDICIONADO', shortLabel: 'Condicionado', fullLabel: 'Matrícula Condicionada', key: 'colAB_condicionado', group: 'novedad', barColor: '#d97706' },
  { colLetter: 'AC', xmlHeader: 'APLAZADO', shortLabel: 'Aplazado', fullLabel: 'Aplazado', key: 'colAC_aplazado', group: 'novedad', barColor: '#f59e0b' },
  { colLetter: 'AD', xmlHeader: 'RETIRO_VOLUNTARIO', shortLabel: 'Retiro Volunt.', fullLabel: 'Retiro Voluntario', key: 'colAD_retiroVoluntario', group: 'baja', barColor: '#ea580c' },
  { colLetter: 'AE', xmlHeader: 'CANCELAMIENTO_VIRT_COMP', shortLabel: 'Canc. Virt/Comp', fullLabel: 'Cancelamiento Virtual / Complementaria', key: 'colAE_cancelamientoVirtComp', group: 'baja', barColor: '#e11d48' },
  { colLetter: 'AF', xmlHeader: 'DESERCION_VIRT_COMP', shortLabel: 'Deserc. Virt/Comp', fullLabel: 'Deserción Virtual / Complementaria', key: 'colAF_desercionVirtComp', group: 'baja', barColor: '#be123c' },
  { colLetter: 'AG', xmlHeader: 'CANCELADO', shortLabel: 'Cancelado', fullLabel: 'Cancelado Académico / Deserción', key: 'colAG_cancelado', group: 'baja', barColor: '#dc2626' },
  { colLetter: 'AH', xmlHeader: 'POR_CERTIFICAR', shortLabel: 'Por Certificar', fullLabel: 'Por Certificar', key: 'colAH_porCertificar', group: 'logro', barColor: '#0d9488' },
  { colLetter: 'AI', xmlHeader: 'CERTIFICADO', shortLabel: 'Certificado', fullLabel: 'Certificados Emitidos', key: 'colAI_certificado', group: 'logro', barColor: '#15803d' },
  { colLetter: 'AJ', xmlHeader: 'TRASLADADO', shortLabel: 'Trasladado', fullLabel: 'Trasladado', key: 'colAJ_trasladado', group: 'novedad', barColor: '#6366f1' },
  { colLetter: 'AK', xmlHeader: 'OTRO', shortLabel: 'Otro', fullLabel: 'Otro Estado', key: 'colAK_otro', group: 'novedad', barColor: '#64748b' },
];

export interface CurricularSyncMeta {
  fileName: string;
  fileId: string;
  folderId: string;
  driveModifiedAt: string;
  driveModifiedIso?: string;
  syncedAt: string;
  totalRows: number;
}

export function formatDriveModifiedDate(rawDate?: string | number | Date | null): string {
  if (!rawDate) return '';
  const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (isNaN(dateObj.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

function extractXmlReportDateFallback(xmlText: string): string {
  const m = xmlText.match(/<Data[^>]*>\s*(\d{2}[-/]\d{2}[-/]\d{4})\s*<\/Data>/i);
  if (m && m[1]) {
    return m[1].replace(/-/g, '/');
  }
  return '';
}

// Niveles formales de Formación Titulada SENA.
// Todo valor en Columna H que NO corresponda a estos niveles titulados (ej. CURSO ESPECIAL, COMPLEMENTARIA VIRTUAL, EVENTO, SIN NIVEL)
// se clasifica explícitamente en el grupo de "No Niveles" de la Columna H NIVEL_FORMACION.
const FORMAL_TITULADA_PATTERNS = [
  /^AUXILIAR$/i,
  /^OPERARIO$/i,
  /^T[EÉ]CNICO$/i,
  /^TECN[OÓ]LOGO$/i,
  /^PROFUNDIZACI[OÓ]N\s+T[EÉ]CNICA$/i,
  /^ESPECIALIZACI[OÓ]N\s+TECNOL[OÓ]GICA$/i,
];

export function classifyNivelFormacionColH(rawNivel: string): {
  normalizedNivel: string;
  categoriaColH: CategoriaColumnaH;
} {
  const clean = (rawNivel || '').trim().toUpperCase();
  if (!clean) {
    return { normalizedNivel: 'SIN NIVEL REGISTRADO', categoriaColH: 'NO_NIVEL' };
  }
  const isTitulada = FORMAL_TITULADA_PATTERNS.some((rx) => rx.test(clean));
  return {
    normalizedNivel: clean,
    categoriaColH: isTitulada ? 'NIVEL_TITULADO' : 'NO_NIVEL',
  };
}

export function parseRawDateToIso(raw: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '';

  // Formato ISO YYYY-MM-DD (con o sin hora "2025-02-19 00:00:00.0")
  const mIso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    const y = Number(mIso[1]);
    const m = Number(mIso[2]);
    const d = Number(mIso[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const check = new Date(y, m - 1, d);
      if (check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d) {
        return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return '';
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const mLat = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mLat) {
    const d = Number(mLat[1]);
    const m = Number(mLat[2]);
    const y = Number(mLat[3]);
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const check = new Date(y, m - 1, d);
      if (check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d) {
        return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return '';
  }

  // Serial numérico de Excel (ej. 45523)
  if (/^\d{5}(\.\d+)?$/.test(clean)) {
    const serial = Math.floor(Number(clean));
    if (serial > 30000 && serial < 70000) {
      const utcDays = serial - 25569;
      const dt = new Date(utcDays * 86400 * 1000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return '';
}

export function formatIsoToDisplay(iso: string, fallbackRaw = ''): string {
  if (!iso) {
    const clean = fallbackRaw.trim();
    return clean ? clean : '—';
  }
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function shiftIsoByMonths(iso: string, deltaMonths: number): string {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [y, m, d] = parts;
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(totalMonths / 12);
  const nm = ((totalMonths % 12) + 12) % 12 + 1;
  const maxDayInMonth = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d, maxDayInMonth);
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function toNum(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFichaRecord(
  cells: string[],
  filaReporte: number,
  idxMap?: Record<string, number>
): FichaCurricularDrive | null {
  const getCell = (colIdx: number, headerAliases?: string[]): string => {
    if (idxMap && headerAliases) {
      for (const alias of headerAliases) {
        if (idxMap[alias] !== undefined && cells[idxMap[alias]] !== undefined) {
          return String(cells[idxMap[alias]] || '').trim();
        }
      }
    }
    return String(cells[colIdx] || '').trim();
  };

  // Columna L (index 11): FICHA
  const ficha = getCell(11, ['FICHA', 'NUMERO_FICHA', 'CODIGO_FICHA']);
  if (!ficha || !/^\d{3,12}$/.test(ficha)) {
    return null;
  }

  const rawNivel = getCell(7, ['NIVEL_FORMACION']);
  const { normalizedNivel, categoriaColH } = classifyNivelFormacionColH(rawNivel);

  // Regla oficial de Fecha Fin Etapa Lectiva y Etapa Productiva a partir de Columna N (FECHA_FIN_FICHA):
  // - Restar 6 meses ÚNICAMENTE a programas de nivel TÉCNICO y TECNÓLOGO
  // - Restar 3 meses a programas de nivel AUXILIAR y OPERARIO
  const isTecnicoOrTecnologo = /^(T[EÉ]CNICO|TECN[OÓ]LOGO)$/i.test(normalizedNivel);
  const isAuxiliarOrOperario = /^(AUXILIAR|OPERARIO)$/i.test(normalizedNivel);

  const mesesRestadosEtapaLectiva: 0 | 3 | 6 = isTecnicoOrTecnologo
    ? 6
    : isAuxiliarOrOperario
    ? 3
    : 0;
  const aplicaEtapaProductiva = mesesRestadosEtapaLectiva > 0;
  const reglaEtapaLectivaLabel =
    mesesRestadosEtapaLectiva === 6
      ? 'Fecha Final − 6 meses (Técnico / Tecnólogo)'
      : mesesRestadosEtapaLectiva === 3
      ? 'Fecha Final − 3 meses (Auxiliar / Operario)'
      : 'No aplica resta (Complementaria / Otro)';

  const rawFechaInicio = getCell(12, ['FECHA_INICIO_FICHA']);
  const rawFechaFin = getCell(13, ['FECHA_FIN_FICHA']);
  const fechaInicioIso = parseRawDateToIso(rawFechaInicio);
  const fechaFinIso = parseRawDateToIso(rawFechaFin);

  const fechaFinEtapaLectivaIso =
    mesesRestadosEtapaLectiva > 0 && fechaFinIso
      ? shiftIsoByMonths(fechaFinIso, -mesesRestadosEtapaLectiva)
      : fechaFinIso;

  const fechaCierreEtapaProductivaIso = aplicaEtapaProductiva ? fechaFinIso : '';
  const fechaLimitePresentacionProductivaIso =
    aplicaEtapaProductiva && fechaFinIso ? shiftIsoByMonths(fechaFinIso, 12) : '';

  const estadoRaw = getCell(15, ['ESTADO_FICHA']);
  const estadoFicha = estadoRaw
    ? estadoRaw.charAt(0).toUpperCase() + estadoRaw.slice(1).toLowerCase().replace('ejecucion', 'ejecución')
    : 'Sin estado';

  const tipoRespuesta = (getCell(16, ['TIPO_RESPUESTA']) || 'SIN DEFINIR').toUpperCase();
  const programaEspecial = (getCell(17, ['PROGRAMA_ESPECIAL']) || 'SIN PROGRAMA ESPECIAL').toUpperCase();

  const cupo = toNum(getCell(14, ['CUPO']));

  // Columnas Y (24) a AK (36)
  const colY_enTransito = toNum(getCell(24, ['EN_TRANSITO']));
  const colZ_induccion = toNum(getCell(25, ['INDUCCION']));
  const colAA_formacion = toNum(getCell(26, ['FORMACION']));
  const colAB_condicionado = toNum(getCell(27, ['CONDICIONADO']));
  const colAC_aplazado = toNum(getCell(28, ['APLAZADO']));
  const colAD_retiroVoluntario = toNum(getCell(29, ['RETIRO_VOLUNTARIO']));
  const colAE_cancelamientoVirtComp = toNum(getCell(30, ['CANCELAMIENTO_VIRT_COMP']));
  const colAF_desercionVirtComp = toNum(getCell(31, ['DESERCION_VIRT_COMP']));
  const colAG_cancelado = toNum(getCell(32, ['CANCELADO']));
  const colAH_porCertificar = toNum(getCell(33, ['POR_CERTIFICAR']));
  const colAI_certificado = toNum(getCell(34, ['CERTIFICADO']));
  const colAJ_trasladado = toNum(getCell(35, ['TRASLADADO']));
  const colAK_otro = toNum(getCell(36, ['OTRO']));

  const activosEjecucion = colY_enTransito + colZ_induccion + colAA_formacion;
  const logroCertificacion = colAH_porCertificar + colAI_certificado;
  const novedadesAcademicas = colAB_condicionado + colAC_aplazado + colAJ_trasladado + colAK_otro;
  const bajasTotales = colAD_retiroVoluntario + colAE_cancelamientoVirtComp + colAF_desercionVirtComp + colAG_cancelado;

  const totalAprendicesYtoAK =
    activosEjecucion + logroCertificacion + novedadesAcademicas + bajasTotales;

  const diferenciaCupoEstados = totalAprendicesYtoAK - cupo;

  const tasaOcupacionCupo = cupo > 0 ? Math.round((totalAprendicesYtoAK / cupo) * 1000) / 10 : 0;
  const tasaCertificacion = totalAprendicesYtoAK > 0 ? Math.round((colAI_certificado / totalAprendicesYtoAK) * 1000) / 10 : 0;
  const tasaCulminacion = totalAprendicesYtoAK > 0 ? Math.round((logroCertificacion / totalAprendicesYtoAK) * 1000) / 10 : 0;
  const tasaBajas = totalAprendicesYtoAK > 0 ? Math.round((bajasTotales / totalAprendicesYtoAK) * 1000) / 10 : 0;
  const tasaRetencion = totalAprendicesYtoAK > 0 ? Math.round((100 - tasaBajas) * 10) / 10 : 0;

  let diagnostico: FichaCurricularDrive['diagnostico'] = 'En Seguimiento';
  if (totalAprendicesYtoAK === 0) {
    diagnostico = 'Sin Aprendices';
  } else if (tasaBajas >= 35) {
    diagnostico = 'Alerta de Retención';
  } else if (tasaRetencion >= 85 && (tasaCulminacion >= 70 || activosEjecucion > 0)) {
    diagnostico = 'Óptimo';
  }

  return {
    codigoRegional: getCell(0, ['CODIGO_REGIONAL']),
    regional: getCell(1, ['REGIONAL']) || 'REGIONAL BOYACÁ',
    codigoCentro: getCell(2, ['CODIGO_CENTRO']),
    centro: getCell(3, ['CENTRO']) || 'CENTRO MINERO',
    codigoPrograma: getCell(4, ['CODIGO_PROGRAMA']),
    versionPrograma: getCell(5, ['VERSION_PROGRAMA']),
    programa: getCell(6, ['PROGRAMA']) || 'PROGRAMA SIN NOMBRE',
    nivelFormacion: normalizedNivel,
    categoriaColH,
    duracionMaxima: toNum(getCell(8, ['DURACION_MAXIMA'])),
    duracionEtapaLectiva: toNum(getCell(9, ['DURACION_ETAPA_LECTIVA'])),
    duracionEtapaProductiva: toNum(getCell(10, ['DURACION_ETAPA_PRODUCTIVA'])),
    ficha,
    fechaInicio: formatIsoToDisplay(fechaInicioIso, rawFechaInicio),
    fechaInicioIso,
    fechaFin: formatIsoToDisplay(fechaFinIso, rawFechaFin),
    fechaFinIso,
    aplicaEtapaProductiva,
    mesesRestadosEtapaLectiva,
    reglaEtapaLectivaLabel,
    fechaFinEtapaLectiva: formatIsoToDisplay(fechaFinEtapaLectivaIso, rawFechaFin),
    fechaFinEtapaLectivaIso,
    fechaCierreEtapaProductiva: aplicaEtapaProductiva ? formatIsoToDisplay(fechaCierreEtapaProductivaIso, rawFechaFin) : 'No aplica',
    fechaCierreEtapaProductivaIso,
    fechaLimitePresentacionProductiva: aplicaEtapaProductiva ? formatIsoToDisplay(fechaLimitePresentacionProductivaIso) : 'No aplica',
    fechaLimitePresentacionProductivaIso,
    cupo,
    diferenciaCupoEstados,
    estadoFicha,
    tipoRespuesta,
    programaEspecial,
    codigoConvenio: getCell(18, ['CODIGO_CONVENIO']),
    ampliacionCobertura: getCell(19, ['AMPLIACION_COBERTURA']),
    convenio: getCell(20, ['CONVENIO']),
    empresa: getCell(23, ['EMPRESA']),
    filaReporte,
    ocurrenciasFicha: 1,
    colY_enTransito,
    colZ_induccion,
    colAA_formacion,
    colAB_condicionado,
    colAC_aplazado,
    colAD_retiroVoluntario,
    colAE_cancelamientoVirtComp,
    colAF_desercionVirtComp,
    colAG_cancelado,
    colAH_porCertificar,
    colAI_certificado,
    colAJ_trasladado,
    colAK_otro,
    totalAprendicesYtoAK,
    activosEjecucion,
    logroCertificacion,
    novedadesAcademicas,
    bajasTotales,
    tasaOcupacionCupo,
    tasaCertificacion,
    tasaCulminacion,
    tasaBajas,
    tasaRetencion,
    diagnostico,
  };
}

function annotateDuplicateFichas(records: FichaCurricularDrive[]): FichaCurricularDrive[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    counts.set(r.ficha, (counts.get(r.ficha) || 0) + 1);
  }
  for (const r of records) {
    r.ocurrenciasFicha = counts.get(r.ficha) || 1;
  }
  return records;
}

export function parseCurricularXml(xmlString: string): FichaCurricularDrive[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('El archivo XML no tiene un formato válido.');
  }

  const rowNodes = Array.from(xmlDoc.querySelectorAll('Table > Row, Worksheet Row, Row, row'));
  const allRows: string[][] = rowNodes.map((rowNode) => {
    const cellNodes = Array.from(rowNode.children).filter(
      (el) => el.localName === 'Cell' || el.tagName.endsWith('Cell') || el.tagName.toLowerCase() === 'cell'
    );
    const cells: string[] = [];
    let colIdx = 0;
    for (const cell of cellNodes) {
      const ssIdx =
        cell.getAttribute('ss:Index') ||
        cell.getAttribute('Index') ||
        cell.getAttribute('index');
      if (ssIdx) {
        const parsedIdx = parseInt(ssIdx, 10);
        if (!isNaN(parsedIdx) && parsedIdx > 0) {
          colIdx = parsedIdx - 1;
        }
      }
      const dataEl = Array.from(cell.children).find(
        (c) => c.localName === 'Data' || c.tagName.endsWith('Data')
      );
      cells[colIdx] = (dataEl ? dataEl.textContent || '' : cell.textContent || '').trim();
      colIdx++;
    }
    return cells;
  });

  let headerRowIdx = -1;
  const idxMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(20, allRows.length); r++) {
    const row = allRows[r];
    if (!row) continue;
    const normalized = row.map((v) =>
      (v || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
    );
    if (normalized.includes('FICHA') && normalized.includes('NIVEL_FORMACION')) {
      headerRowIdx = r;
      normalized.forEach((h, idx) => {
        if (h) idxMap[h] = idx;
      });
      break;
    }
  }

  const results: FichaCurricularDrive[] = [];
  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    if (r === headerRowIdx) continue;
    const record = buildFichaRecord(
      allRows[r],
      r + 1,
      Object.keys(idxMap).length > 0 ? idxMap : undefined
    );
    if (record) {
      results.push(record);
    }
  }
  return annotateDuplicateFichas(results);
}

export function parseCurricularSpreadsheetBuffer(buffer: ArrayBuffer): FichaCurricularDrive[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, defval: '' });

  let headerRowIdx = -1;
  const idxMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r] || [];
    const normalized = row.map((v) =>
      String(v || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
    );
    if (normalized.includes('FICHA') && normalized.some((c) => c.includes('NIVEL'))) {
      headerRowIdx = r;
      normalized.forEach((h, idx) => {
        if (h) idxMap[h] = idx;
      });
      break;
    }
  }

  const results: FichaCurricularDrive[] = [];
  const start = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  for (let r = start; r < rows.length; r++) {
    const cells = (rows[r] || []).map((v) => String(v ?? '').trim());
    const rec = buildFichaRecord(
      cells,
      r + 1,
      Object.keys(idxMap).length > 0 ? idxMap : undefined
    );
    if (rec) results.push(rec);
  }
  return annotateDuplicateFichas(results);
}

// In-memory cache so navigating between sidebar modules is instantaneous without sessionStorage overflow
let memoryCacheRecords: FichaCurricularDrive[] | null = null;
let memoryCacheMeta: CurricularSyncMeta | null = null;

export function getCachedCurricularDrive(): {
  records: FichaCurricularDrive[] | null;
  meta: CurricularSyncMeta | null;
} {
  return { records: memoryCacheRecords, meta: memoryCacheMeta };
}

export function setCachedCurricularDrive(
  records: FichaCurricularDrive[],
  meta: CurricularSyncMeta
) {
  memoryCacheRecords = records;
  memoryCacheMeta = meta;
}

export async function fetchCurricularFromDrive(
  folderOrFileUrl: string = GESTION_DRIVE_FOLDER_URL
): Promise<{ records: FichaCurricularDrive[]; meta: CurricularSyncMeta }> {
  let targetFolderId = GESTION_DRIVE_FOLDER_ID;
  let targetFileId = '';

  const mFile = folderOrFileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/);
  const mFolder = folderOrFileUrl.match(/\/folders\/([a-zA-Z0-9_-]{25,})/);
  const mParam = folderOrFileUrl.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);

  if (mFile) targetFileId = mFile[1];
  else if (mFolder) targetFolderId = mFolder[1];
  else if (mParam) targetFolderId = mParam[1];

  const query = targetFileId
    ? `fileId=${encodeURIComponent(targetFileId)}`
    : `folderId=${encodeURIComponent(targetFolderId)}`;

  const res = await fetch(`/api/drive-proxy?${query}&_t=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('No se pudo conectar con la carpeta de Google Drive mediante el servidor.');
  }

  const xmlText = await res.text();
  if (!xmlText || (!xmlText.includes('Row') && !xmlText.includes('Workbook') && !xmlText.includes('<?xml'))) {
    throw new Error('La respuesta recibida desde Google Drive no contiene un documento XML DF-14 válido.');
  }

  const fileNameHeader = res.headers.get('X-Drive-File-Name');
  const fileIdHeader = res.headers.get('X-Drive-File-Id');
  const driveModifiedHeader = res.headers.get('X-Drive-Modified-Time');
  const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : 'DF-14A_1.xml';
  const fileId = fileIdHeader || targetFileId || GESTION_DEFAULT_FILE_ID;

  const records = parseCurricularXml(xmlText);
  if (records.length === 0) {
    throw new Error('El archivo en Google Drive se descargó pero no contenía registros de fichas.');
  }

  const syncedAt = formatDriveModifiedDate(new Date());
  const driveModifiedAt =
    formatDriveModifiedDate(driveModifiedHeader) ||
    extractXmlReportDateFallback(xmlText) ||
    syncedAt;
  const driveModifiedIso = driveModifiedHeader ? parseRawDateToIso(driveModifiedHeader) : '';

  const meta: CurricularSyncMeta = {
    fileName,
    fileId,
    folderId: targetFolderId,
    driveModifiedAt,
    driveModifiedIso,
    syncedAt,
    totalRows: records.length,
  };

  setCachedCurricularDrive(records, meta);
  return { records, meta };
}
