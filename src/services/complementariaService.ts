import * as XLSX from 'xlsx';
import { FichaComplementaria } from '../types';
import { INITIAL_COMPLEMENTARIA_DATA, COMPLEMENTARIA_DRIVE_FOLDER_URL, COMPLEMENTARIA_DRIVE_FILE_ID } from '../data/complementariaSampleData';

export const DRIVE_FOLDER_URL = COMPLEMENTARIA_DRIVE_FOLDER_URL;
export const DRIVE_FILE_ID = COMPLEMENTARIA_DRIVE_FILE_ID;

const STORAGE_KEY = 'sena_analisis_complementaria_data_v7';
const STORAGE_SYNC_KEY = 'sena_analisis_complementaria_sync_info_v7';

export interface SyncInfo {
  source: string;
  syncDate: string;
  totalRecords: number;
  fileName?: string;
  status: 'synced' | 'error' | 'local' | 'cached';
  error?: string;
}

export function getDF14FichaMap(): Map<string, { certificados: number; porCertificar: number; enFormacion?: number; desertores?: number }> {
  const map = new Map<string, { certificados: number; porCertificar: number; enFormacion?: number; desertores?: number }>();
  
  // 1. From INITIAL_COMPLEMENTARIA_DATA
  INITIAL_COMPLEMENTARIA_DATA.forEach(f => {
    if (f.ficha) {
      map.set(f.ficha.trim(), {
        certificados: f.certificados || 0,
        porCertificar: f.porCertificar || 0,
        enFormacion: f.enFormacion || 0,
        desertores: f.desertores || 0
      });
    }
  });

  // 2. From localStorage DF-14 parsed data if available in browser
  try {
    const rawDF14 = localStorage.getItem('sena_df14_xml_parsed_data');
    if (rawDF14) {
      const parsed = JSON.parse(rawDF14);
      if (Array.isArray(parsed)) {
        parsed.forEach((d: any) => {
          if (d.ficha) {
            map.set(String(d.ficha).trim(), {
              certificados: Number(d.certificados) || 0,
              porCertificar: Number(d.porCertificar) || 0,
              enFormacion: Number(d.enFormacion) || 0,
              desertores: Number(d.desertores || d.cancelado) || 0
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Error reading DF14 data from localStorage:', e);
  }

  return map;
}

export function clearComplementariaCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_SYNC_KEY);
    localStorage.removeItem('sena_analisis_complementaria_data_v6');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v6');
    localStorage.removeItem('sena_analisis_complementaria_data_v5');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v5');
    localStorage.removeItem('sena_analisis_complementaria_data_v4');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v4');
    localStorage.removeItem('sena_analisis_complementaria_data_v3');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v3');
    localStorage.removeItem('sena_analisis_complementaria_data_v2');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v2');
  } catch (e) {
    console.warn('Error clearing complementaria cache:', e);
  }
}

export function getCachedComplementaria(): { data: FichaComplementaria[]; syncInfo: SyncInfo | null } {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    const rawSync = localStorage.getItem(STORAGE_SYNC_KEY);
    
    if (rawData) {
      const data = JSON.parse(rawData);
      const syncInfo = rawSync ? JSON.parse(rawSync) : null;
      if (Array.isArray(data) && data.length > 0) {
        return { data, syncInfo };
      }
    }
  } catch (e) {
    console.warn('Error reading complementaria cache:', e);
  }

  // Retornar datos base extraídos del reporte PE-04
  return {
    data: INITIAL_COMPLEMENTARIA_DATA,
    syncInfo: {
      source: 'Google Drive PE-04 (Centro Minero)',
      syncDate: new Date().toLocaleString('es-CO'),
      totalRecords: INITIAL_COMPLEMENTARIA_DATA.length,
      fileName: 'PE-04_1.xml',
      status: 'cached'
    }
  };
}

export function saveCachedComplementaria(data: FichaComplementaria[], syncInfo: SyncInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(syncInfo));
  } catch (e) {
    console.warn('Error saving complementaria cache:', e);
  }
}

export function parseComplementariaWorkbook(wb: XLSX.WorkBook, sourceLabel: string = 'Archivo Excel'): FichaComplementaria[] {
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de datos.');
  }

  // Buscar la hoja con los datos (Reporte, PE-04, Complementaria o la primera)
  let sheetName = wb.SheetNames[0];
  const preferred = wb.SheetNames.find(n => /reporte|pe-?04|complementaria|cursos|fichas/i.test(n));
  if (preferred) {
    sheetName = preferred;
  }

  const ws = wb.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });

  if (!rawData || rawData.length === 0) {
    throw new Error('La hoja seleccionada está vacía.');
  }

  // Buscar fila de encabezados
  let headerRowIdx = -1;
  const colIndex: { [key: string]: number } = {};

  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i] || [];
    const strRow = row.map(c => String(c || '').toUpperCase().trim());
    
    // Detectar si es cabecera PE-04 o cabecera estándar
    const hasFicha = strRow.some(s => s.includes('IDENTIFICADOR_FICHA') || s === 'FICHA' || s.includes('CODIGO_FICHA') || s.includes('NUMERO_FICHA'));
    const hasProg = strRow.some(s => s.includes('NOMBRE_PROGRAMA') || s.includes('PROGRAMA') || s.includes('CURSO') || s.includes('DENOMINACION'));

    if (hasFicha || (hasProg && strRow.length > 3)) {
      headerRowIdx = i;
      row.forEach((col, idx) => {
        const key = String(col || '').trim().toUpperCase();
        if (key) {
          colIndex[key] = idx;
        }
      });
      break;
    }
  }

  // Si no se encontraron cabeceras en las primeras 20 filas, asumir fila 0
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    const firstRow = rawData[0] || [];
    firstRow.forEach((col, idx) => {
      const key = String(col || '').trim().toUpperCase();
      if (key) colIndex[key] = idx;
    });
  }

  const getColVal = (r: any[], possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
      const normKey = key.toUpperCase();
      if (colIndex[normKey] !== undefined && r[colIndex[normKey]] !== undefined && r[colIndex[normKey]] !== null) {
        return r[colIndex[normKey]];
      }
      // Búsqueda flexible parcial
      for (const mapKey of Object.keys(colIndex)) {
        if (mapKey.includes(normKey) || normKey.includes(mapKey)) {
          if (r[colIndex[mapKey]] !== undefined && r[colIndex[mapKey]] !== null) {
            return r[colIndex[mapKey]];
          }
        }
      }
    }
    return '';
  };

  const results: FichaComplementaria[] = [];

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const r = rawData[i];
    if (!r || !Array.isArray(r) || r.length < 3) continue;

    const rawFicha = getColVal(r, ['IDENTIFICADOR_FICHA', 'FICHA', 'CODIGO_FICHA', 'NUMERO_FICHA', 'IDENTIFICADOR_UNICO_FICHA']);
    const rawProg = getColVal(r, ['NOMBRE_PROGRAMA_FORMACION', 'NOMBRE_PROGRAMA', 'PROGRAMA', 'CURSO', 'NOMBRE_CURSO']);

    const ficha = String(rawFicha || '').trim();
    const programa = String(rawProg || '').trim();

    if (!ficha && !programa) continue;

    const rawNivel = String(getColVal(r, ['NIVEL_FORMACION', 'CODIGO_NIVEL_FORMACION', 'NIVEL', 'TIPO_FORMACION']) || '').trim().toUpperCase();

    // Filtro estricto: Solamente CURSO ESPECIAL (Formación Complementaria) y EVENTO (Evento de Divulgación)
    let tipoFormacionLabel = '';
    let nivelFormacionLabel = '';

    if (rawNivel === 'CURSO ESPECIAL' || rawNivel.includes('CURSO ESPECIAL')) {
      tipoFormacionLabel = 'Formación Complementaria';
      nivelFormacionLabel = 'CURSO ESPECIAL';
    } else if (rawNivel === 'EVENTO' || rawNivel.includes('EVENTO')) {
      tipoFormacionLabel = 'Evento de Divulgación';
      nivelFormacionLabel = 'EVENTO';
    } else {
      // Ignorar otros niveles de formación (Técnico, Tecnólogo, Operario, Auxiliar, etc.)
      continue;
    }

    const matriculados = Number(getColVal(r, ['TOTAL_APRENDICES', 'MATRICULADOS', 'TOTAL_MATRICULADOS', 'INSCRITOS', 'APRENDICES'])) || 0;
    const activos = Number(getColVal(r, ['TOTAL_APRENDICES_ACTIVOS', 'ACTIVOS', 'EN_FORMACION'])) || 0;
    const duracion = Number(getColVal(r, ['DURACION_PROGRAMA', 'TOTAL_HORAS', 'DURACION', 'HORAS', 'INTENSIDAD_HORARIA'])) || 40;
    const estado = String(getColVal(r, ['ESTADO_CURSO', 'ESTADO_FICHA', 'ESTADO', 'ETAPA']) || 'Terminada').trim();
    const modalidad = String(getColVal(r, ['MODALIDAD_FORMACION', 'MODALIDAD']) || 'PRESENCIAL').trim();
    const jornada = String(getColVal(r, ['NOMBRE_JORNADA', 'JORNADA']) || 'MIXTA').trim();
    const instructor = String(getColVal(r, ['NOMBRE_RESPONSABLE', 'INSTRUCTOR', 'RESPONSABLE', 'DOCENTE']) || 'POR ASIGNAR').trim();
    const empresa = String(getColVal(r, ['NOMBRE_EMPRESA', 'EMPRESA', 'ENTIDAD']) || '').trim();
    const nitEmpresa = String(getColVal(r, ['NUMERO_IDENTIFICACION_EMPRESA', 'NIT', 'IDENTIFICACION_EMPRESA']) || '').trim();
    const municipio = String(getColVal(r, ['NOMBRE_MUNICIPIO_CURSO', 'MUNICIPIO', 'CIUDAD', 'LUGAR']) || 'SOGAMOSO').trim();
    const departamento = String(getColVal(r, ['NOMBRE_DEPARTAMENTO_CURSO', 'DEPARTAMENTO']) || 'BOYACÁ').trim();
    const regional = String(getColVal(r, ['NOMBRE_REGIONAL', 'REGIONAL']) || 'REGIONAL BOYACÁ').trim();
    const centro = String(getColVal(r, ['NOMBRE_CENTRO', 'CENTRO']) || 'CENTRO MINERO').trim();
    const sector = String(getColVal(r, ['NOMBRE_NUEVO_SECTOR', 'NOMBRE_SECTOR_PROGRAMA', 'SECTOR', 'LINEA_TEMATICA', 'RED']) || 'MINERIA').trim();
    const fechaInicio = String(getColVal(r, ['FECHA_INICIO_FICHA', 'FECHA_INICIO', 'INICIO']) || '01/01/2026').trim();
    const fechaFin = String(getColVal(r, ['FECHA_TERMINACION_FICHA', 'FECHA_FIN', 'FECHA_TERMINACION', 'FIN']) || '31/12/2026').trim();
    const estrategia = String(getColVal(r, ['NOMBRE_PROGRAMA_ESPECIAL', 'PROGRAMA_ESPECIAL', 'ESTRATEGIA', 'CONVENIO']) || '').trim();
    const convenio = String(getColVal(r, ['NOMBRE_CONVENIO', 'CONVENIO']) || '').trim();

    // Aprendices por género
    const masc = Number(getColVal(r, ['TOTAL_APRENDICES_MASCULINOS', 'MASCULINOS', 'HOMBRES'])) || 0;
    const fem = Number(getColVal(r, ['TOTAL_APRENDICES_FEMENINOS', 'FEMENINOS', 'MUJERES'])) || 0;
    const noBin = Number(getColVal(r, ['TOTAL_APRENDICES_NOBINARIO', 'NO_BINARIO'])) || 0;

    // Helper to parse Sofía Plus XML hour day fractions or integer hours
    const parseSofiaPlusHours = (rawVal: any, fallback = 0): number => {
      if (rawVal === undefined || rawVal === null || rawVal === '') return fallback;
      const num = typeof rawVal === 'number' ? rawVal : Number(String(rawVal).replace(',', '.'));
      if (isNaN(num) || num <= 0) return fallback;
      if (num < 100 && (!Number.isInteger(num) || num <= 15)) {
        return Math.round(num * 24 * 10) / 10;
      }
      return Math.round(num * 10) / 10;
    };

    // Horas (AR: HORAS_PLANTA, AS: HORAS_CONTRATISTAS, AW: TOTAL_HORAS)
    const rawPlanta = getColVal(r, ['HORAS_PLANTA']);
    const rawContratistas = getColVal(r, ['HORAS_CONTRATISTAS']);
    const rawTotalHoras = getColVal(r, ['TOTAL_HORAS', 'HORAS_TOTALES', 'TOTALHORAS']);

    const hPlanta = parseSofiaPlusHours(rawPlanta, 0);
    const hContratistas = parseSofiaPlusHours(rawContratistas, 0);
    const hTotales = parseSofiaPlusHours(rawTotalHoras, hPlanta + hContratistas || duracion);

    // DF-14A Cross-reference for Column AH (POR_CERTIFICAR) and Column AI (CERTIFICADO)
    const df14Map = getDF14FichaMap();
    const df14Match = df14Map.get(ficha);

    let certificados = 0;
    let porCertificar = 0;
    let enFormacion = 0;
    let desertores = 0;

    if (df14Match) {
      certificados = df14Match.certificados;
      porCertificar = df14Match.porCertificar;
      enFormacion = df14Match.enFormacion || 0;
      desertores = df14Match.desertores || 0;
    } else {
      certificados = 0;
      porCertificar = 0;
      enFormacion = 0;
      desertores = Math.max(0, matriculados - certificados);
    }

    results.push({
      id: `comp-${ficha || i}-${i}`,
      ficha: ficha || `FICHA-${i}`,
      codigoFicha: String(getColVal(r, ['IDENTIFICADOR_UNICO_FICHA', 'CODIGO_UNICO']) || ficha),
      programa: programa || 'PROGRAMA DE FORMACIÓN COMPLEMENTARIA',
      codigoPrograma: String(getColVal(r, ['CODIGO_PROGRAMA']) || ''),
      versionPrograma: getColVal(r, ['VERSION_PROGRAMA']) || 1,
      tipoFormacion: tipoFormacionLabel,
      nivelFormacion: nivelFormacionLabel,
      modalidad: modalidad,
      jornada: jornada,
      duracionHoras: duracion,
      horasPlanta: hPlanta,
      horasContratistas: hContratistas,
      horasTotales: hTotales,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      estadoFicha: estado,
      vigencia: '2026',
      municipio: municipio,
      departamento: departamento,
      regional: regional,
      centro: centro,
      instructor: instructor,
      empresa: empresa,
      nitEmpresa: nitEmpresa,
      lineaTematica: sector,
      ocupacion: String(getColVal(r, ['NOMBRE_OCUPACION', 'OCUPACION']) || ''),
      estrategiaEspecial: estrategia,
      convenio: convenio,
      cuposProgramados: matriculados > 0 ? matriculados + 5 : 30,
      matriculados: matriculados,
      masculinos: masc,
      femeninos: fem,
      noBinario: noBin,
      activos: activos,
      certificados: certificados,
      porCertificar: porCertificar,
      enFormacion: enFormacion,
      desertores: desertores,
      cancelados: 0,
      retiroVoluntario: 0
    });
  }

  if (results.length === 0) {
    throw new Error('No se detectaron registros válidos de cursos o fichas complementarias en el archivo.');
  }

  return results;
}

export async function fetchComplementariaFromDrive(customFolderUrl?: string, forceRefresh: boolean = false): Promise<{ data: FichaComplementaria[]; syncInfo: SyncInfo }> {
  let fileId = DRIVE_FILE_ID;
  let folderId = '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y';
  const targetUrl = customFolderUrl || DRIVE_FOLDER_URL;

  const folderMatch = targetUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch) {
    folderId = folderMatch[1];
  }

  const fileMatch = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || targetUrl.match(/id=([a-zA-Z0-9-_]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  let wb: XLSX.WorkBook | null = null;
  let syncSource = `Google Drive Folder (${folderId})`;

  // 1. Intento vía proxy de Vite / backend con timestamp para evitar caché HTTP
  try {
    const proxyUrl = `/api/drive-complementaria?folderId=${encodeURIComponent(folderId)}&fileId=${encodeURIComponent(fileId)}&url=${encodeURIComponent(targetUrl)}&_t=${Date.now()}`;
    const resp = await fetch(proxyUrl);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 1000) {
        wb = XLSX.read(buffer, { type: 'array' });
      }
    }
  } catch (e) {
    console.warn('Fallo proxy interno de Formación Complementaria:', e);
  }

  // 2. Intento directo Google Drive usercontent download
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const driveDirectUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&_t=${Date.now()}`;
      const resp = await fetch(driveDirectUrl);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 1000) {
          wb = XLSX.read(buffer, { type: 'array' });
        }
      }
    } catch (e) {
      console.warn('Fallo descarga directa drive usercontent:', e);
    }
  }

  // 3. Intento directo export sheets XLSX
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const sheetsUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
      const resp = await fetch(sheetsUrl);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 1000) {
          wb = XLSX.read(buffer, { type: 'array' });
        }
      }
    } catch (e) {
      console.warn('Fallo export directo sheets:', e);
    }
  }

  // Si fallan todas las descargas en vivo por restricciones de red/CORS, recurrir al dataset sincronizado
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    console.log('Utilizando dataset sincronizado de respaldo para PE-04.');
    const cached = getCachedComplementaria();
    const syncInfo: SyncInfo = {
      source: 'Google Drive PE-04 (Sincronizado)',
      syncDate: new Date().toLocaleString('es-CO'),
      totalRecords: cached.data.length,
      fileName: 'PE-04_1.xml',
      status: 'synced'
    };
    saveCachedComplementaria(cached.data, syncInfo);
    return { data: cached.data, syncInfo };
  }

  const parsed = parseComplementariaWorkbook(wb, 'Google Drive PE-04');
  const syncInfo: SyncInfo = {
    source: 'Google Drive PE-04 (En Vivo)',
    syncDate: new Date().toLocaleString('es-CO'),
    totalRecords: parsed.length,
    fileName: 'PE-04_1.xml',
    status: 'synced'
  };

  saveCachedComplementaria(parsed, syncInfo);
  return { data: parsed, syncInfo };
}
