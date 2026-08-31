const fs = require('fs');

const content = fs.readFileSync('src/data/inasistenciasSampleData.ts', 'latin1');
const lines = content.split('\n');
const line9 = lines[8];

let rawArrayStr = line9.substring(line9.indexOf('= [') + 2).trim();
if (rawArrayStr.endsWith(';')) {
  rawArrayStr = rawArrayStr.slice(0, -1);
}

// Replace corrupted smart quotes or quotes inside double-quoted values
// In line9, smart quotes \x93 and \x94 were replaced with \" which broke the JSON structure.
// Let's replace ' \”' or ' \"' or internal quotes
let sanitizedJson = rawArrayStr
  .replace(/\\"/g, "'") // replace escaped quotes with single quote
  .replace(/[\x80-\x9F]/g, '') // remove latin1 control bytes
  .replace(/[\x00-\x1F\x7F]/g, '');

let parsedRows = [];
try {
  parsedRows = JSON.parse(sanitizedJson);
} catch (e) {
  // Regex extraction of tuples: [ "col0", "col1", "col2", "col3", "col4", "col5", num, "col7", "col8" ]
  const tupleRegex = /\[\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*([0-9.]+)\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/g;
  let match;
  while ((match = tupleRegex.exec(content)) !== null) {
    parsedRows.push([
      match[1],
      match[2],
      match[3],
      match[4],
      match[5],
      match[6],
      Number(match[7]) || 0,
      match[8],
      match[9]
    ]);
  }
}

console.log('Parsed rows count:', parsedRows.length);

if (parsedRows.length === 0) {
  // Try using XLSX from Google Drive to generate the canonical fresh dataset!
  console.log('Downloading canonical inasistencias file from Google Drive...');
}

async function run() {
  if (parsedRows.length < 100) {
    const fileId = '1I2gsbdJgZJry4fsDgnp-rs2IB_LFEYF1';
    const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
    const res = await fetch(driveUrl);
    const buf = await res.arrayBuffer();
    const XLSX = require('xlsx');
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

    // Format A/B
    parsedRows = [];
    for (let i = 2; i < data.length; i++) {
      const r = data[i];
      if (!r || r.length < 5) continue;
      const ficha = String(r[0] || '').trim();
      const inst = String(r[3] || '').trim();
      const idAp = String(r[4] || '').trim();
      const nomAp = String(r[6] || '').trim();
      let fIni = '';
      if (typeof r[8] === 'number') {
        const d = new Date((r[8] - 25569) * 86400 * 1000);
        fIni = d.toISOString().split('T')[0];
      } else {
        fIni = String(r[8] || '').trim();
      }
      let fFin = '';
      if (typeof r[10] === 'number') {
        const d = new Date((r[10] - 25569) * 86400 * 1000);
        fFin = d.toISOString().split('T')[0];
      } else {
        fFin = String(r[10] || '').trim();
      }
      const horas = Number(r[11]) || 0;
      const just = String(r[12] || '').trim();
      const obs = String(r[18] || '').trim();

      if (ficha && idAp) {
        parsedRows.push([ficha, inst, idAp, nomAp, fIni, fFin, horas, just, obs]);
      }
    }
    console.log('Extracted from live Google Drive workbook:', parsedRows.length, 'records');
  }

  const cleanRows = parsedRows.map(row => {
    return [
      String(row[0] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[1] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[2] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[3] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[4] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[5] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      Number(row[6]) || 0,
      String(row[7] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
      String(row[8] || '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim(),
    ];
  });

  const outputCode = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InasistenciaRecord } from '../types';

function cleanDoc(str: string): string {
  return str ? str.replace(/\\D/g, '') : '';
}

function extractCod(str: string): string {
  const match = str.match(/\\d{6,8}/);
  return match ? match[0] : str.trim();
}

const RAW_ROWS: [string, string, string, string, string, string, number, string, string][] = ${JSON.stringify(cleanRows, null, 2)};

export const INITIAL_INASISTENCIAS_RECORDS: InasistenciaRecord[] = RAW_ROWS.map((r, i) => ({
  id: \`inas-\${i}\`,
  ficha: r[0],
  codigoFicha: extractCod(r[0]),
  instructor: r[1],
  idAprendiz: r[2],
  docNumerico: cleanDoc(r[2] || r[3]),
  aprendiz: r[3],
  fechaInicio: r[4],
  fechaFin: r[5],
  cantHoras: Number(r[6]) || 0,
  justificacion: r[7] || '',
  observaciones: r[8] || ''
}));
`;

  fs.writeFileSync('src/data/inasistenciasSampleData.ts', outputCode, 'utf8');
  console.log('Successfully wrote clean src/data/inasistenciasSampleData.ts with', cleanRows.length, 'records');
}

run().catch(console.error);
