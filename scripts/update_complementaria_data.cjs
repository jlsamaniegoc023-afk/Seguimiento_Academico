const XLSX = require('xlsx');
const fs = require('fs');

async function processDriveFile() {
  const fileId = '1f1VxWq-VMKbGHlAWgL6lO4YJoGLNJyOd';
  const url = 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download&confirm=t';
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  let headerRowIdx = -1;
  const colIndex = {};

  for (let i = 0; i < Math.min(25, rawData.length); i++) {
    const row = rawData[i] || [];
    const strRow = row.map(c => String(c || '').toUpperCase().trim());
    const hasFicha = strRow.some(s => s.includes('IDENTIFICADOR_FICHA') || s === 'FICHA' || s.includes('CODIGO_FICHA'));
    const hasProg = strRow.some(s => s.includes('NOMBRE_PROGRAMA') || s.includes('PROGRAMA') || s.includes('CURSO'));
    if (hasFicha || (hasProg && strRow.length > 3)) {
      headerRowIdx = i;
      row.forEach((col, idx) => {
        let key = String(col || '').trim().toUpperCase();
        if (key.includes('IDENTIFICADOR_FICHA')) key = 'IDENTIFICADOR_FICHA';
        if (key.includes('CODIGO_REGIONAL')) key = 'CODIGO_REGIONAL';
        if (key) colIndex[key] = idx;
      });
      break;
    }
  }

  const cleanString = (val, fallback = '') => {
    if (val === undefined || val === null) return fallback;
    const str = String(val).trim();
    const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    return cleaned || fallback;
  };

  const getColVal = (r, possibleKeys) => {
    for (const key of possibleKeys) {
      const normKey = key.toUpperCase();
      if (colIndex[normKey] !== undefined && r[colIndex[normKey]] !== undefined && r[colIndex[normKey]] !== null) {
        return cleanString(r[colIndex[normKey]]);
      }
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

  const parseSofiaPlusHours = (rawVal, fallback = 0) => {
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

  const results = [];
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const r = rawData[i];
    if (!r || !Array.isArray(r) || r.length < 3) continue;

    const rawFicha = getColVal(r, ['IDENTIFICADOR_FICHA', 'FICHA', 'CODIGO_FICHA']);
    const rawProg = getColVal(r, ['NOMBRE_PROGRAMA_FORMACION', 'NOMBRE_PROGRAMA', 'PROGRAMA', 'CURSO']);
    const ficha = String(rawFicha || '').trim();
    const programa = String(rawProg || '').trim();
    if (!ficha && !programa) continue;

    const rawNivel = String(getColVal(r, ['NIVEL_FORMACION', 'CODIGO_NIVEL_FORMACION']) || '').trim().toUpperCase();
    let tipoFormacionLabel = '';
    let nivelFormacionLabel = '';

    if (rawNivel === 'CURSO ESPECIAL' || rawNivel.includes('CURSO ESPECIAL') || rawNivel === '8') {
      tipoFormacionLabel = 'Formación Complementaria';
      nivelFormacionLabel = 'CURSO ESPECIAL';
    } else if (rawNivel === 'EVENTO' || rawNivel.includes('EVENTO') || rawNivel === '9') {
      tipoFormacionLabel = 'Evento de Divulgación';
      nivelFormacionLabel = 'EVENTO';
    } else {
      tipoFormacionLabel = getColVal(r, ['TIPO_DE_FORMACION', 'TIPO_FORMACION']) || 'Formación Complementaria';
      nivelFormacionLabel = rawNivel || 'CURSO ESPECIAL';
    }

    const estado = getColVal(r, ['ESTADO_CURSO', 'ESTADO_FICHA', 'ESTADO']) || 'En Ejecución';
    const duracion = Number(getColVal(r, ['DURACION_PROGRAMA', 'DURACION', 'INTENSIDAD_HORARIA'])) || 40;
    const matriculados = Number(getColVal(r, ['TOTAL_APRENDICES', 'TOTAL_MATRICULADOS', 'MATRICULADOS'])) || 0;
    const activos = Number(getColVal(r, ['TOTAL_APRENDICES_ACTIVOS', 'ACTIVOS'])) || matriculados;
    const masc = Number(getColVal(r, ['TOTAL_APRENDICES_MASCULINOS', 'MASCULINOS', 'HOMBRES'])) || 0;
    const fem = Number(getColVal(r, ['TOTAL_APRENDICES_FEMENINOS', 'FEMENINOS', 'MUJERES'])) || 0;
    const noBin = Number(getColVal(r, ['TOTAL_APRENDICES_NOBINARIO', 'NO_BINARIO'])) || 0;

    const rawPlanta = getColVal(r, ['HORAS_PLANTA']);
    const rawContratistas = getColVal(r, ['HORAS_CONTRATISTAS']);
    const rawTotalHoras = getColVal(r, ['TOTAL_HORAS', 'TOTAL_HORAS_EJECUTADAS', 'HORAS_EJECUTADAS']);

    const hPlanta = parseSofiaPlusHours(rawPlanta, 0);
    const hContratistas = parseSofiaPlusHours(rawContratistas, 0);
    let totalH = parseSofiaPlusHours(rawTotalHoras, 0);

    if (totalH === 0 && (hPlanta > 0 || hContratistas > 0)) {
      totalH = hPlanta + hContratistas;
    }
    if (totalH === 0) {
      totalH = duracion > 0 ? duracion : 40;
    }

    let certificados = 0;
    let porCertificar = 0;
    if (estado.toLowerCase().includes('terminada') || estado.toLowerCase().includes('terminado')) {
      certificados = activos > 0 ? activos : matriculados;
      porCertificar = 0;
    } else {
      certificados = 0;
      porCertificar = activos > 0 ? activos : matriculados;
    }

    results.push({
      id: `pe04-${ficha || i}-${i}`,
      ficha: ficha || `FICHA-${i}`,
      codigoFicha: getColVal(r, ['IDENTIFICADOR_UNICO_FICHA', 'CODIGO_UNICO']) || ficha,
      programa: programa,
      versionPrograma: getColVal(r, ['VERSION_PROGRAMA', 'VERSION']) || '1',
      codigoPrograma: getColVal(r, ['CODIGO_PROGRAMA']) || '',
      tipoFormacion: tipoFormacionLabel,
      nivelFormacion: nivelFormacionLabel,
      modalidad: getColVal(r, ['MODALIDAD_FORMACION', 'MODALIDAD']) || 'Presencial',
      jornada: getColVal(r, ['NOMBRE_JORNADA', 'JORNADA']) || 'DIURNA',
      duracionHoras: duracion,
      horasPlanta: hPlanta,
      horasContratistas: hContratistas,
      horasTotales: totalH,
      fechaInicio: getColVal(r, ['FECHA_INICIO_FICHA', 'FECHA_INICIO']) || '',
      fechaFin: getColVal(r, ['FECHA_TERMINACION_FICHA', 'FECHA_FIN']) || '',
      estadoFicha: estado,
      vigencia: '2026',
      municipio: getColVal(r, ['NOMBRE_MUNICIPIO_CURSO', 'MUNICIPIO']) || 'SOGAMOSO',
      departamento: getColVal(r, ['NOMBRE_DEPARTAMENTO_CURSO', 'DEPARTAMENTO']) || 'BOYACA',
      regional: getColVal(r, ['NOMBRE_REGIONAL', 'REGIONAL']) || 'BOYACA',
      centro: getColVal(r, ['NOMBRE_CENTRO', 'CENTRO']) || 'CENTRO MINERO',
      instructor: getColVal(r, ['NOMBRE_RESPONSABLE', 'INSTRUCTOR', 'RESPONSABLE']) || 'POR ASIGNAR',
      empresa: getColVal(r, ['NOMBRE_EMPRESA', 'EMPRESA']) || '',
      nitEmpresa: getColVal(r, ['NUMERO_IDENTIFICACION_EMPRESA', 'NIT']) || '',
      lineaTematica: getColVal(r, ['NOMBRE_SECTOR_PROGRAMA', 'NOMBRE_NUEVO_SECTOR', 'SECTOR']) || 'SERVICIOS',
      ocupacion: getColVal(r, ['NOMBRE_OCUPACION', 'OCUPACION']) || '',
      estrategiaEspecial: getColVal(r, ['NOMBRE_PROGRAMA_ESPECIAL', 'PROGRAMA_ESPECIAL', 'ESTRATEGIA']) || 'REGULAR',
      convenio: getColVal(r, ['NOMBRE_CONVENIO', 'CONVENIO']) || '',
      cuposProgramados: matriculados || 30,
      matriculados: matriculados,
      masculinos: masc,
      femeninos: fem,
      noBinario: noBin,
      activos: activos,
      certificados: certificados,
      porCertificar: porCertificar,
      enFormacion: estado.toLowerCase().includes('ejecuc') ? (activos || matriculados) : 0,
      desertores: Math.max(0, matriculados - activos),
      cancelados: 0,
      retiroVoluntario: 0
    });
  }

  console.log('Total extracted:', results.length);
  
  const fileContent = `import { FichaComplementaria } from '../types';

export const COMPLEMENTARIA_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y?usp=sharing';
export const COMPLEMENTARIA_DRIVE_FILE_ID = '1f1VxWq-VMKbGHlAWgL6lO4YJoGLNJyOd';

export const INITIAL_COMPLEMENTARIA_DATA: FichaComplementaria[] = ${JSON.stringify(results, null, 2)};
`;

  fs.writeFileSync('src/data/complementariaSampleData.ts', fileContent, 'utf8');
  console.log('Successfully saved src/data/complementariaSampleData.ts with', results.length, 'records');
}

processDriveFile().catch(console.error);
