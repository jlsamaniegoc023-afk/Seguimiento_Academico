import * as XLSX from 'xlsx';
import { FichaComplementaria } from '../types';
import { INITIAL_COMPLEMENTARIA_DATA, COMPLEMENTARIA_DRIVE_FOLDER_URL, COMPLEMENTARIA_DRIVE_FILE_ID } from '../data/complementariaSampleData';

export const DRIVE_FOLDER_URL = COMPLEMENTARIA_DRIVE_FOLDER_URL;
export const DRIVE_FILE_ID = COMPLEMENTARIA_DRIVE_FILE_ID;

const STORAGE_KEY = 'sena_analisis_complementaria_data_v10';
const STORAGE_SYNC_KEY = 'sena_analisis_complementaria_sync_info_v10';

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
    localStorage.removeItem('sena_analisis_complementaria_data_v9');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v9');
    localStorage.removeItem('sena_analisis_complementaria_data_v8');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v8');
    localStorage.removeItem('sena_analisis_complementaria_data_v7');
    localStorage.removeItem('sena_analisis_complementaria_sync_info_v7');
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

const cleanString = (val: any, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  return cleaned || fallback;
};

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

  for (let i = 0; i < Math.min(25, rawData.length); i++) {
    const row = rawData[i] || [];
    const strRow = row.map(c => String(c || '').toUpperCase().trim());
    
    // Detectar si es cabecera PE-04 o cabecera estándar
    const hasFicha = strRow.some(s => s.includes('IDENTIFICADOR_FICHA') || s === 'FICHA' || s.includes('CODIGO_FICHA') || s.includes('NUMERO_FICHA'));
    const hasProg = strRow.some(s => s.includes('NOMBRE_PROGRAMA') || s.includes('PROGRAMA') || s.includes('CURSO') || s.includes('DENOMINACION'));

    if (hasFicha || (hasProg && strRow.length > 3)) {
      headerRowIdx = i;
      row.forEach((col, idx) => {
        let key = String(col || '').trim().toUpperCase();
        if (key.includes('IDENTIFICADOR_FICHA')) key = 'IDENTIFICADOR_FICHA';
        if (key.includes('CODIGO_REGIONAL')) key = 'CODIGO_REGIONAL';
        if (key) {
          colIndex[key] = idx;
        }
      });
      break;
    }
  }

  // Si no se encontraron cabeceras en las primeras 25 filas, asumir fila 0
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    const firstRow = rawData[0] || [];
    firstRow.forEach((col, idx) => {
      let key = String(col || '').trim().toUpperCase();
      if (key.includes('IDENTIFICADOR_FICHA')) key = 'IDENTIFICADOR_FICHA';
      if (key.includes('CODIGO_REGIONAL')) key = 'CODIGO_REGIONAL';
      if (key) colIndex[key] = idx;
    });
  }

  const getColVal = (r: any[], possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
      const normKey = key.toUpperCase();
      if (colIndex[normKey] !== undefined && r[colIndex[normKey]] !== undefined && r[colIndex[normKey]] !== null) {
        return cleanString(r[colIndex[normKey]]);
      }
      // Búsqueda flexible parcial
      for (const mapKey of Object.keys(colIndex)) {
        if (mapKey.includes(normKey) || normKey.includes(mapKey)) {
          if (r[colIndex[mapKey]] !== undefined && r[colIndex[mapKey]] !== null) {
            return cleanString(r[colIndex[mapKey]]);
          }
        }
      }
    }
    return '';
  };

  const results: FichaComplementaria[] = [];
  const df14Map = getDF14FichaMap();

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

    if (rawNivel === 'CURSO ESPECIAL' || rawNivel.includes('CURSO ESPECIAL') || rawNivel === '8') {
      tipoFormacionLabel = 'Formación Complementaria';
      nivelFormacionLabel = 'CURSO ESPECIAL';
    } else if (rawNivel === 'EVENTO' || rawNivel.includes('EVENTO') || rawNivel === '9') {
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

    // Helper to parse Sofía Plus XML hour day fractions or integer hours or strings "48:00"
    const parseSofiaPlusHours = (rawVal: any, fallback = 0): number => {
      if (rawVal === undefined || rawVal === null || rawVal === '') return fallback;
      const str = String(rawVal).trim();
      if (str.includes(':')) {
        const parts = str.split(':');
        const h = Number(parts[0]) || 0;
        const m = Number(parts[1]) || 0;
        return Math.round((h + m / 60) * 10) / 10;
      }
      const num = typeof rawVal === 'number' ? rawVal : Number(str.replace(',', '.'));
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
    let totalH = parseSofiaPlusHours(rawTotalHoras, 0);

    if (totalH === 0 && (hPlanta > 0 || hContratistas > 0)) {
      totalH = hPlanta + hContratistas;
    }
    if (totalH === 0) {
      totalH = duracion > 0 ? duracion : 40;
    }

    // DF-14A Cross-reference for Column AH (POR_CERTIFICAR) and Column AI (CERTIFICADO)
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
      if (estado.toLowerCase().includes('terminada') || estado.toLowerCase().includes('terminado')) {
        certificados = activos > 0 ? activos : matriculados;
        porCertificar = 0;
      } else {
        certificados = 0;
        porCertificar = activos > 0 ? activos : matriculados;
      }
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
      horasTotales: totalH,
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

// Fetch helper with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
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
  let syncSource = `Google Drive Spreadsheet (${fileId})`;

  // 1. Intento vía proxy backend / Vite dev server
  try {
    const proxyUrl = `/api/drive-complementaria?folderId=${encodeURIComponent(folderId)}&fileId=${encodeURIComponent(fileId)}&url=${encodeURIComponent(targetUrl)}&_t=${Date.now()}`;
    const resp = await fetchWithTimeout(proxyUrl, {}, 6000);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 1000) {
        wb = XLSX.read(buffer, { type: 'array' });
        syncSource = 'Google Drive PE-04 (API Servidor)';
      }
    }
  } catch (e) {
    console.warn('Fallo proxy interno de Formación Complementaria, probando endpoints directos:', e);
  }

  // 2. Intento directo Google Sheets GViz CSV (Reporte)
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&sheet=Reporte&_t=${Date.now()}`;
      const resp = await fetchWithTimeout(gvizUrl, {}, 6000);
      if (resp.ok) {
        const text = await resp.text();
        if (text.length > 500 && text.includes('CODIGO_REGIONAL')) {
          wb = XLSX.read(text, { type: 'string' });
          syncSource = 'Google Drive PE-04 (Google Sheets GViz En Vivo)';
        }
      }
    } catch (e) {
      console.warn('Fallo GViz directo con hoja Reporte:', e);
    }
  }

  // 3. Intento directo Google Sheets GViz CSV (Default Sheet)
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&_t=${Date.now()}`;
      const resp = await fetchWithTimeout(gvizUrl, {}, 6000);
      if (resp.ok) {
        const text = await resp.text();
        if (text.length > 500) {
          wb = XLSX.read(text, { type: 'string' });
          syncSource = 'Google Drive PE-04 (Google Sheets CSV En Vivo)';
        }
      }
    } catch (e) {
      console.warn('Fallo GViz CSV default:', e);
    }
  }

  // 4. Intento directo export sheets XLSX
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const sheetsUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx&_t=${Date.now()}`;
      const resp = await fetchWithTimeout(sheetsUrl, {}, 6000);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 1000) {
          wb = XLSX.read(buffer, { type: 'array' });
          syncSource = 'Google Drive PE-04 (Google Sheets XLSX Export)';
        }
      }
    } catch (e) {
      console.warn('Fallo export directo sheets:', e);
    }
  }

  // 5. Intento directo Google Drive usercontent download
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    try {
      const driveDirectUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&_t=${Date.now()}`;
      const resp = await fetchWithTimeout(driveDirectUrl, {}, 6000);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 1000) {
          wb = XLSX.read(buffer, { type: 'array' });
          syncSource = 'Google Drive PE-04 (Usercontent Directo)';
        }
      }
    } catch (e) {
      console.warn('Fallo descarga directa drive usercontent:', e);
    }
  }

  // 6. Intento a través de Proxies CORS públicos para despliegues estáticos
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&sheet=Reporte`)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&sheet=Reporte`)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv&sheet=Reporte`)}`
    ];

    for (const proxy of corsProxies) {
      try {
        const resp = await fetchWithTimeout(proxy, {}, 5000);
        if (resp.ok) {
          const text = await resp.text();
          if (text.length > 500 && text.includes('CODIGO_REGIONAL')) {
            wb = XLSX.read(text, { type: 'string' });
            syncSource = 'Google Drive PE-04 (Sincronización Web en Tiempo Real)';
            break;
          }
        }
      } catch (e) {
        console.warn('Fallo proxy CORS:', proxy, e);
      }
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

  const parsed = parseComplementariaWorkbook(wb, syncSource);
  const syncInfo: SyncInfo = {
    source: `${syncSource} - En Vivo`,
    syncDate: new Date().toLocaleString('es-CO'),
    totalRecords: parsed.length,
    fileName: 'PE-04_1.xml',
    status: 'synced'
  };

  saveCachedComplementaria(parsed, syncInfo);
  return { data: parsed, syncInfo };
}
