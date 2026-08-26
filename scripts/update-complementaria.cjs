const XLSX = require('xlsx');
const fs = require('fs');

async function buildData() {
  // 1. Download DF-14A (XML) to index Columns AH (POR_CERTIFICAR) and AI (CERTIFICADO)
  const df14FileId = '1Ll1g7SmYMytc5qhmI1llL1l0tBfMqe5X';
  const df14Url = 'https://drive.usercontent.google.com/download?id=' + df14FileId + '&export=download&confirm=t';
  console.log('Downloading live DF-14A from Google Drive...');
  const resDF14 = await fetch(df14Url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const textDF14 = await resDF14.text();
  console.log('Downloaded DF-14A bytes:', textDF14.length);

  const df14Map = new Map();
  const rowMatches = textDF14.match(/<Row[^>]*>[\s\S]*?<\/Row>/gi) || [];
  for (let i = 5; i < rowMatches.length; i++) {
    const r = rowMatches[i];
    const cells = [];
    const cellRegex = /<Cell[^>]*?(?:ss:Index=\"(\d+)\")?[^>]*><Data[^>]*>([\s\S]*?)<\/Data><\/Cell>/gi;
    let match;
    let curIdx = 0;
    while ((match = cellRegex.exec(r)) !== null) {
      if (match[1]) curIdx = parseInt(match[1], 10) - 1;
      cells[curIdx] = match[2].trim();
      curIdx++;
    }
    const ficha = cells[11];
    if (ficha) {
      const nivel = cells[7] || '';
      const programa = cells[6] || '';
      const estado = cells[15] || '';
      const porCertificar = parseInt(cells[33] || '0', 10) || 0; // Columna AH
      const certificado = parseInt(cells[34] || '0', 10) || 0;   // Columna AI
      const formacion = parseInt(cells[26] || '0', 10) || 0;     // Columna AA
      const desertores = parseInt(cells[32] || '0', 10) || 0;
      df14Map.set(ficha.trim(), { ficha: ficha.trim(), nivel, programa, estado, porCertificar, certificado, formacion, desertores });
    }
  }
  console.log('DF-14A rows indexed:', df14Map.size);

  // 2. Download PE-04 from the user-specified Google Drive
  const fileId = '1DXgCIl7sPWS48cVk1S645Ra6qJ1nktDS';
  const url = 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download&confirm=t';
  console.log('Downloading live PE-04 from Google Drive (1DXgCIl7sPWS48cVk1S645Ra6qJ1nktDS)...');
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buf = await res.arrayBuffer();
  console.log('Downloaded bytes PE-04:', buf.byteLength);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  let headerRowIdx = -1;
  const colIndex = {};
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i] || [];
    const strRow = row.map(c => String(c || '').toUpperCase().trim());
    const hasFicha = strRow.some(s => s.includes('IDENTIFICADOR_FICHA') || s === 'FICHA' || s.includes('CODIGO_FICHA') || s.includes('NUMERO_FICHA'));
    const hasProg = strRow.some(s => s.includes('NOMBRE_PROGRAMA') || s.includes('PROGRAMA') || s.includes('CURSO') || s.includes('DENOMINACION'));
    if (hasFicha || (hasProg && strRow.length > 3)) {
      headerRowIdx = i;
      row.forEach((col, idx) => {
        const key = String(col || '').trim().toUpperCase();
        if (key) colIndex[key] = idx;
      });
      break;
    }
  }

  const getColVal = (r, possibleKeys) => {
    for (const key of possibleKeys) {
      const normKey = key.toUpperCase();
      if (colIndex[normKey] !== undefined && r[colIndex[normKey]] !== undefined && r[colIndex[normKey]] !== null) {
        return r[colIndex[normKey]];
      }
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

  const results = [];
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const r = rawData[i];
    if (!r || !Array.isArray(r) || r.length < 3) continue;

    const rawFicha = getColVal(r, ['IDENTIFICADOR_FICHA', 'FICHA', 'CODIGO_FICHA', 'NUMERO_FICHA', 'IDENTIFICADOR_UNICO_FICHA']);
    const rawProg = getColVal(r, ['NOMBRE_PROGRAMA_FORMACION', 'NOMBRE_PROGRAMA', 'PROGRAMA', 'CURSO', 'NOMBRE_CURSO']);
    const ficha = String(rawFicha || '').trim();
    const programa = String(rawProg || '').trim();
    if (!ficha && !programa) continue;

    const rawNivel = String(getColVal(r, ['NIVEL_FORMACION', 'CODIGO_NIVEL_FORMACION', 'NIVEL', 'TIPO_FORMACION']) || '').trim().toUpperCase();
    let tipoFormacionLabel = '';
    let nivelFormacionLabel = '';

    if (rawNivel === 'CURSO ESPECIAL' || rawNivel.includes('CURSO ESPECIAL')) {
      tipoFormacionLabel = 'Formación Complementaria';
      nivelFormacionLabel = 'CURSO ESPECIAL';
    } else if (rawNivel === 'EVENTO' || rawNivel.includes('EVENTO')) {
      tipoFormacionLabel = 'Evento de Divulgación';
      nivelFormacionLabel = 'EVENTO';
    } else {
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

    const masc = Number(getColVal(r, ['TOTAL_APRENDICES_MASCULINOS', 'MASCULINOS', 'HOMBRES'])) || 0;
    const fem = Number(getColVal(r, ['TOTAL_APRENDICES_FEMENINOS', 'FEMENINOS', 'MUJERES'])) || 0;
    const noBin = Number(getColVal(r, ['TOTAL_APRENDICES_NOBINARIO', 'NO_BINARIO'])) || 0;

    function parseSofiaPlusHours(rawVal, fallback = 0) {
      if (rawVal === undefined || rawVal === null || rawVal === '') return fallback;
      const num = typeof rawVal === 'number' ? rawVal : Number(String(rawVal).replace(',', '.'));
      if (isNaN(num) || num <= 0) return fallback;
      if (num < 100 && (!Number.isInteger(num) || num <= 15)) {
        return Math.round(num * 24 * 10) / 10;
      }
      return Math.round(num * 10) / 10;
    }

    const rawPlanta = getColVal(r, ['HORAS_PLANTA']);
    const rawContratistas = getColVal(r, ['HORAS_CONTRATISTAS']);
    const rawTotalHoras = getColVal(r, ['TOTAL_HORAS', 'HORAS_TOTALES', 'TOTALHORAS']);

    const hPlanta = parseSofiaPlusHours(rawPlanta, 0);
    const hContratistas = parseSofiaPlusHours(rawContratistas, 0);
    const hTotales = parseSofiaPlusHours(rawTotalHoras, hPlanta + hContratistas || duracion);

    // Cross-reference with DF-14A:
    // Columna AH: POR_CERTIFICAR
    // Columna AI: CERTIFICADO
    const df14Match = df14Map.get(ficha);
    let certificados = 0;
    let porCertificar = 0;
    let enFormacion = 0;
    let desertores = 0;

    if (df14Match) {
      certificados = df14Match.certificado;
      porCertificar = df14Match.porCertificar;
      enFormacion = df14Match.formacion;
      desertores = df14Match.desertores;
    } else {
      // If not present in DF-14A, fallback to 0 or activos
      certificados = 0;
      porCertificar = 0;
      enFormacion = 0;
      desertores = 0;
    }

    results.push({
      id: `pe04-${ficha || i}-${i}`,
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

  const fileContent = `import { FichaComplementaria } from '../types';

export const COMPLEMENTARIA_DRIVE_FOLDER_URL = 'https://docs.google.com/spreadsheets/d/1DXgCIl7sPWS48cVk1S645Ra6qJ1nktDS/edit?usp=sharing&ouid=115787826880979321096&rtpof=true&sd=true';
export const COMPLEMENTARIA_DRIVE_FILE_ID = '1DXgCIl7sPWS48cVk1S645Ra6qJ1nktDS';

export const INITIAL_COMPLEMENTARIA_DATA: FichaComplementaria[] = ` + JSON.stringify(results, null, 2) + `;\n`;

  fs.writeFileSync('src/data/complementariaSampleData.ts', fileContent, 'utf-8');
  console.log('Successfully wrote', results.length, 'records with DF-14A cross-reference to src/data/complementariaSampleData.ts');
}

buildData().catch(e => {
  console.error(e);
  process.exit(1);
});
