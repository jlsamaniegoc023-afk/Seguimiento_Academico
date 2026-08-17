/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { InasistenciaRecord } from '../types';

export const DEFAULT_INASISTENCIAS_DRIVE_URL = 'https://drive.google.com/drive/folders/1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi?usp=sharing';

/**
 * Convierte serial de Excel a formato YYYY-MM-DD
 */
export function excelDateToDate(serial: any): string {
  if (!serial) return '';
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
  }
  return String(serial).trim();
}

/**
 * Extrae solo los dígitos de un string (ej: "CC - 1002537269" -> "1002537269")
 */
export function cleanDocDigits(docStr: string): string {
  if (!docStr) return '';
  return String(docStr).replace(/\D/g, '');
}

/**
 * Extrae el código numérico de una ficha (ej: "3196477 - ANALISIS Y DESARROLLO..." -> "3196477")
 */
export function extractCodigoFicha(fichaStr: string): string {
  if (!fichaStr) return '';
  const match = String(fichaStr).match(/\d{6,8}/);
  return match ? match[0] : String(fichaStr).trim();
}

/**
 * Normaliza nombres para comparación insensible a acentos y mayúsculas
 */
export function normalizeName(name: string): string {
  return String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procesa un libro de Excel XLSX/XLS de inasistencias soportando cualquier formato del SENA,
 * detección dinámica de encabezados, celdas combinadas/repetidas y múltiples registros.
 */
export function parseInasistenciasWorkbook(wb: XLSX.WorkBook): InasistenciaRecord[] {
  const records: InasistenciaRecord[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (!data || data.length < 2) return;

    // 1. Detección dinámica de la fila de encabezados y sus columnas
    let headerRowIdx = -1;
    const colMap: { [key: string]: number } = {};

    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i] || [];
      const strRow = row.map(c => String(c || '').toUpperCase().trim());
      if (
        strRow.some(c => c.includes('FICHA')) && 
        (strRow.some(c => c.includes('APRENDIZ')) || strRow.some(c => c.includes('INSTRUCTOR')) || strRow.some(c => c.includes('DOC') || c.includes('IDENTIF')))
      ) {
        headerRowIdx = i;
        row.forEach((col, idx) => {
          const c = String(col || '').toUpperCase().trim();
          if (c.includes('FICHA')) colMap.ficha = idx;
          else if (c.includes('INSTRUCTOR')) colMap.instructor = idx;
          else if (c.includes('IDENTIFICAC') || c.includes('DOCUMENTO') || c.includes('DOC')) colMap.idAprendiz = idx;
          else if (c.includes('APRENDIZ') || c.includes('NOMBRE')) colMap.aprendiz = idx;
          else if (c.includes('FECHA INI') || c.includes('FECHA_INI') || c === 'FECHA') colMap.fechaIni = idx;
          else if (c.includes('FECHA FIN') || c.includes('FECHA_FIN')) colMap.fechaFin = idx;
          else if (c.includes('HORA') || c.includes('CANT')) colMap.horas = idx;
          else if (c.includes('JUSTIF')) colMap.justificacion = idx;
          else if (c.includes('OBSERV')) colMap.observaciones = idx;
        });
        break;
      }
    }

    let lastFicha = '';
    let lastInstructor = '';
    let lastIdAprendiz = '';
    let lastAprendiz = '';

    const startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 2;

    for (let i = startIdx; i < data.length; i++) {
      const r = data[i];
      if (!r || r.length === 0 || r.every(v => v === null || v === undefined || v === '')) continue;

      let ficha = '';
      let instructor = '';
      let idAprendiz = '';
      let aprendiz = '';
      let fechaIni = '';
      let fechaFin = '';
      let horas = 0;
      let justificacion = '';
      let observacion = '';

      if (headerRowIdx >= 0) {
        ficha = colMap.ficha !== undefined ? String(r[colMap.ficha] || '').trim() : '';
        instructor = colMap.instructor !== undefined ? String(r[colMap.instructor] || '').trim() : '';
        idAprendiz = colMap.idAprendiz !== undefined ? String(r[colMap.idAprendiz] || '').trim() : '';
        aprendiz = colMap.aprendiz !== undefined ? String(r[colMap.aprendiz] || '').trim() : '';
        fechaIni = colMap.fechaIni !== undefined ? excelDateToDate(r[colMap.fechaIni]) : '';
        fechaFin = colMap.fechaFin !== undefined ? excelDateToDate(r[colMap.fechaFin]) : '';
        horas = colMap.horas !== undefined ? (Number(r[colMap.horas]) || 0) : 0;
        justificacion = colMap.justificacion !== undefined ? String(r[colMap.justificacion] || '').trim() : '';
        observacion = colMap.observaciones !== undefined ? String(r[colMap.observaciones] || '').trim() : '';
      } else {
        // Fallback Formatos A / B estándar
        if (r[0] && String(r[0]).trim() !== '') {
          ficha = String(r[0] || '').trim();
          instructor = String(r[3] || '').trim();
          idAprendiz = String(r[4] || '').trim();
          aprendiz = String(r[6] || '').trim();
          fechaIni = excelDateToDate(r[8]);
          fechaFin = excelDateToDate(r[10]);
          horas = Number(r[11]) || 0;
          justificacion = String(r[12] || '').trim();
          observacion = String(r[18] || '').trim();
        } else if (r[2] && String(r[2]).trim() !== '') {
          ficha = String(r[2] || '').trim();
          instructor = String(r[5] || '').trim();
          idAprendiz = String(r[7] || '').trim();
          aprendiz = String(r[9] || '').trim();
          fechaIni = excelDateToDate(r[13]);
          fechaFin = excelDateToDate(r[14]);
          horas = Number(r[15]) || 0;
          justificacion = String(r[16] || r[17] || r[18] || '').trim();
          observacion = String(r[18] || '').trim();
        }
      }

      // Propagar datos de la fila anterior cuando están combinados
      if (ficha) lastFicha = ficha;
      else ficha = lastFicha;

      if (instructor) lastInstructor = instructor;
      else instructor = lastInstructor;

      if (idAprendiz) lastIdAprendiz = idAprendiz;
      else idAprendiz = lastIdAprendiz;

      if (aprendiz) lastAprendiz = aprendiz;
      else aprendiz = lastAprendiz;

      if (!idAprendiz && !aprendiz) continue;
      if (horas <= 0 && !fechaIni) continue;

      const codFicha = extractCodigoFicha(ficha);
      const docNum = cleanDocDigits(idAprendiz || aprendiz);

      records.push({
        id: `inas-${sheetName}-${i}`,
        ficha,
        codigoFicha: codFicha,
        instructor: instructor || 'INSTRUCTOR NO ESPECIFICADO',
        idAprendiz: idAprendiz || '',
        docNumerico: docNum,
        aprendiz: aprendiz || '',
        fechaInicio: fechaIni,
        fechaFin: fechaFin || fechaIni,
        cantHoras: horas,
        justificacion: justificacion || observacion || 'SIN JUSTIFICACIÓN',
        observaciones: observacion
      });
    }
  });

  return records;
}

/**
 * Descarga y analiza directamente el archivo de Inasistencias desde Google Drive (Soporta carpetas y archivos directos)
 */
export async function fetchInasistenciasFromDrive(driveUrl: string = DEFAULT_INASISTENCIAS_DRIVE_URL): Promise<InasistenciaRecord[]> {
  let folderId = '';
  let fileId = '';

  const folderMatch = driveUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (folderMatch) {
    folderId = folderMatch[1];
  }

  const fileMatch = driveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || driveUrl.match(/id=([a-zA-Z0-9-_]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Si es la carpeta conocida de inasistencias
  if (folderId === '1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi' || driveUrl.includes('1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi')) {
    fileId = '1I2gsbdJgZJry4fsDgnp-rs2IB_LFEYF1';
  }

  let wb: XLSX.WorkBook | null = null;

  // 1. Intento vía API Proxy interno de Vite
  try {
    const proxyUrl = `/api/drive-inasistencias?folderId=${encodeURIComponent(folderId)}&fileId=${encodeURIComponent(fileId)}&url=${encodeURIComponent(driveUrl)}`;
    const resp = await fetch(proxyUrl);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 1000) {
        wb = XLSX.read(buffer, { type: 'array' });
      }
    }
  } catch (e) {
    console.warn('Fallo proxy interno de inasistencias:', e);
  }

  // 2. Intento directo Google Sheets export XLSX
  if ((!wb || !wb.SheetNames || wb.SheetNames.length === 0) && fileId) {
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
    try {
      const resp = await fetch(xlsxUrl);
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

  // 3. Intento CSV export
  if ((!wb || !wb.SheetNames || wb.SheetNames.length === 0) && fileId) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv`;
    try {
      let csvResp = await fetch(csvUrl);
      if (!csvResp.ok) csvResp = await fetch(gvizUrl);
      if (csvResp.ok) {
        const text = await csvResp.text();
        if (!text.includes('<!DOCTYPE html>')) {
          wb = XLSX.read(text, { type: 'string' });
        }
      }
    } catch (e) {
      console.warn('Fallo CSV sheets:', e);
    }
  }

  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('No se pudo descargar el archivo de inasistencias desde Google Drive. Verifique los permisos de acceso.');
  }

  const parsed = parseInasistenciasWorkbook(wb);
  if (parsed.length === 0) {
    throw new Error('No se encontraron registros válidos de inasistencia en el documento analizado.');
  }

  return parsed;
}

/**
 * Estructura de índice optimizado para búsquedas inmediatas O(1)
 */
export interface InasistenciasIndex {
  byDoc: Map<string, InasistenciaRecord[]>;
  byName: Map<string, InasistenciaRecord[]>;
}

/**
 * Construye un índice en memoria para consultas instantáneas de sumatorias de inasistencia
 */
export function buildInasistenciasIndex(inasistencias: InasistenciaRecord[]): InasistenciasIndex {
  const byDoc = new Map<string, InasistenciaRecord[]>();
  const byName = new Map<string, InasistenciaRecord[]>();

  if (!inasistencias || inasistencias.length === 0) {
    return { byDoc, byName };
  }

  for (let i = 0; i < inasistencias.length; i++) {
    const r = inasistencias[i];
    
    // Indexar por documento limpio
    const doc = r.docNumerico || cleanDocDigits(r.idAprendiz);
    if (doc && doc.length >= 4) {
      const list = byDoc.get(doc);
      if (list) {
        list.push(r);
      } else {
        byDoc.set(doc, [r]);
      }
    }

    // Indexar por nombre normalizado
    if (r.aprendiz) {
      const norm = normalizeName(r.aprendiz);
      if (norm && norm.length >= 4) {
        const list = byName.get(norm);
        if (list) {
          list.push(r);
        } else {
          byName.set(norm, [r]);
        }
      }
    }
  }

  return { byDoc, byName };
}

/**
 * Busca y calcula la SUMATORIA TOTAL de horas de inasistencias para un aprendiz específico
 * Realiza coincidencia exacta por documento de identidad y fallback por nombre completo
 */
export function getInasistenciasAprendiz(
  inasistencias: InasistenciaRecord[] | InasistenciasIndex,
  docAprendiz: string,
  fichaAprendiz?: string,
  nombreAprendiz?: string
): { totalHoras: number; totalReportes: number; records: InasistenciaRecord[] } {
  if (!inasistencias) {
    return { totalHoras: 0, totalReportes: 0, records: [] };
  }

  const cleanDoc = cleanDocDigits(docAprendiz);
  const normNombre = nombreAprendiz ? normalizeName(nombreAprendiz) : '';

  let matched: InasistenciaRecord[] = [];

  // 1. Si se pasó un índice pre-construido
  if ('byDoc' in inasistencias && 'byName' in inasistencias) {
    const fromDoc = (cleanDoc && cleanDoc.length >= 4) ? (inasistencias.byDoc.get(cleanDoc) || []) : [];
    const fromName = (normNombre && normNombre.length >= 4) ? (inasistencias.byName.get(normNombre) || []) : [];

    const recordMap = new Map<string, InasistenciaRecord>();
    for (const r of fromDoc) {
      recordMap.set(r.id || `${r.fechaInicio}-${r.cantHoras}-${r.instructor}`, r);
    }
    for (const r of fromName) {
      const key = r.id || `${r.fechaInicio}-${r.cantHoras}-${r.instructor}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, r);
      }
    }
    matched = Array.from(recordMap.values());
  } 
  // 2. Si se pasó el arreglo crudo
  else if (Array.isArray(inasistencias)) {
    const recordMap = new Map<string, InasistenciaRecord>();
    
    if (cleanDoc && cleanDoc.length >= 4) {
      inasistencias.forEach(r => {
        if (r.docNumerico === cleanDoc || cleanDocDigits(r.idAprendiz) === cleanDoc) {
          recordMap.set(r.id || `${r.fechaInicio}-${r.cantHoras}-${r.instructor}`, r);
        }
      });
    }
    
    if (normNombre) {
      inasistencias.forEach(r => {
        if (!r.aprendiz) return;
        const rNorm = normalizeName(r.aprendiz);
        if (rNorm === normNombre || (normNombre.length > 8 && (rNorm.includes(normNombre) || normNombre.includes(rNorm)))) {
          const key = r.id || `${r.fechaInicio}-${r.cantHoras}-${r.instructor}`;
          if (!recordMap.has(key)) {
            recordMap.set(key, r);
          }
        }
      });
    }

    matched = Array.from(recordMap.values());
  }

  // Sumatoria total de todas las horas registradas para este aprendiz a lo largo de todos sus días y reportes
  const totalHoras = matched.reduce((acc, curr) => acc + (Number(curr.cantHoras) || 0), 0);

  return {
    totalHoras,
    totalReportes: matched.length,
    records: matched
  };
}
