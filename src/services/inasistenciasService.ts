/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { InasistenciaRecord } from '../types';

export const DEFAULT_INASISTENCIAS_DRIVE_URL = 'https://docs.google.com/spreadsheets/d/1p7fQMaCHJJ3pRXBJHurb6ND3pcZdYDry/edit?usp=sharing';

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
 * Procesa un libro de Excel XLSX de inasistencias soportando los diferentes formatos del SENA
 */
export function parseInasistenciasWorkbook(wb: XLSX.WorkBook): InasistenciaRecord[] {
  const records: InasistenciaRecord[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (!data || data.length < 2) return;

    for (let i = 2; i < data.length; i++) {
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

      // Formato A: Col A (0)=Ficha, Col D (3)=Instructor, Col E (4)=Doc, Col G (6)=Aprendiz, Col I (8)=Fecha Ini, Col K (10)=Fecha Fin, Col L (11)=Horas, Col M (12)=Justificacion
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
      } 
      // Formato B (columnas desplazadas): Col C (2)=Ficha, Col F (5)=Instructor, Col H (7)=Doc, Col J (9)=Aprendiz, Col N (13)=Fecha Ini, Col O (14)=Fecha Fin, Col P (15)=Horas, Col S (18)=Justificacion
      else if (r[2] && String(r[2]).trim() !== '') {
        ficha = String(r[2] || '').trim();
        instructor = String(r[5] || '').trim();
        idAprendiz = String(r[7] || '').trim();
        aprendiz = String(r[9] || '').trim();
        fechaIni = excelDateToDate(r[13]);
        fechaFin = excelDateToDate(r[14]);
        horas = Number(r[15]) || 0;
        justificacion = String(r[16] || r[17] || r[18] || '').trim();
        observacion = String(r[18] || '').trim();
      } else {
        // Buscar dinámicamente si los datos están en otras columnas
        const nonNulls = r.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
        if (nonNulls.length >= 4) {
          const fichaCandidate = nonNulls.find(c => String(c).match(/\d{6,8}/));
          if (fichaCandidate) ficha = String(fichaCandidate);
          const numCandidate = nonNulls.find(c => typeof c === 'number' && c > 0 && c < 500);
          if (numCandidate) horas = Number(numCandidate);
        }
      }

      if (!ficha && !idAprendiz && !aprendiz) continue;

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
 * Descarga y analiza directamente el archivo de Inasistencias desde Google Drive
 */
export async function fetchInasistenciasFromDrive(driveUrl: string = DEFAULT_INASISTENCIAS_DRIVE_URL): Promise<InasistenciaRecord[]> {
  let sheetId = '';
  const sheetIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch) {
    sheetId = sheetIdMatch[1];
  } else {
    throw new Error('URL de Google Drive no válida. Debe contener el ID de la hoja de cálculo.');
  }

  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  let wb: XLSX.WorkBook | null = null;

  // 1. Intentar XLSX export
  try {
    const resp = await fetch(xlsxUrl);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 1000) {
        wb = XLSX.read(buffer, { type: 'array' });
      }
    }
  } catch (e) {
    console.warn('Fallo descarga directa XLSX de Drive:', e);
  }

  // 2. Intentar CSV si XLSX falló
  if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
    let csvResp = await fetch(csvUrl);
    if (!csvResp.ok) {
      csvResp = await fetch(gvizUrl);
    }
    if (!csvResp.ok) {
      throw new Error(`Error al acceder al documento de Google Drive (${csvResp.status}). Verifique que tenga permisos de lectura públicos.`);
    }
    const text = await csvResp.text();
    if (text.includes('<!DOCTYPE html>')) {
      throw new Error('El documento requiere permisos o el enlace no es público.');
    }
    wb = XLSX.read(text, { type: 'string' });
  }

  const parsed = parseInasistenciasWorkbook(wb);
  if (parsed.length === 0) {
    throw new Error('No se encontraron registros válidos de inasistencia en el documento.');
  }

  return parsed;
}

/**
 * Busca y calcula las inasistencias para un aprendiz específico en una ficha
 */
export function getInasistenciasAprendiz(
  inasistencias: InasistenciaRecord[],
  docAprendiz: string,
  fichaAprendiz: string,
  nombreAprendiz?: string
): { totalHoras: number; totalReportes: number; records: InasistenciaRecord[] } {
  if (!inasistencias || inasistencias.length === 0) {
    return { totalHoras: 0, totalReportes: 0, records: [] };
  }

  const cleanDoc = cleanDocDigits(docAprendiz);
  const codFicha = extractCodigoFicha(fichaAprendiz);
  const normNombre = nombreAprendiz ? normalizeName(nombreAprendiz) : '';

  const matched = inasistencias.filter(r => {
    // 1. Validar coincidencia de ficha si se proporciona
    const matchesFicha = !codFicha || !r.codigoFicha || r.codigoFicha === codFicha || r.ficha.includes(codFicha);
    if (!matchesFicha) return false;

    // 2. Validar coincidencia de documento
    if (cleanDoc && r.docNumerico && r.docNumerico === cleanDoc) {
      return true;
    }

    // 3. Fallback: Coincidencia por nombre si el documento no hizo match
    if (normNombre && r.aprendiz) {
      const rNorm = normalizeName(r.aprendiz);
      if (rNorm === normNombre || (normNombre.length > 8 && (rNorm.includes(normNombre) || normNombre.includes(rNorm)))) {
        return true;
      }
    }

    return false;
  });

  const totalHoras = matched.reduce((acc, curr) => acc + (curr.cantHoras || 0), 0);

  return {
    totalHoras,
    totalReportes: matched.length,
    records: matched
  };
}
