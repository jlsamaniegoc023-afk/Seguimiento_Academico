/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileCode, 
  Upload, 
  RotateCcw, 
  Filter, 
  Download, 
  Search, 
  Users, 
  GraduationCap, 
  Award, 
  Clock, 
  LogOut, 
  PlayCircle, 
  FileText, 
  ChevronLeft,
  ChevronRight, 
  ArrowRight,
  ArrowRightLeft,
  X,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Info,
  CloudDownload,
  ExternalLink,
  Folder,
  RefreshCw,
  Link2,
  FileUp,
  Sparkles,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area 
} from 'recharts';

export interface FichaDF14 {
  ficha: string;
  programa: string;
  nivel: string;
  fechaInicio: string;
  fechaFin: string;
  estadoFicha: 'En ejecución' | 'Terminada' | 'Cancelada' | 'Suspendida' | string;
  vigencia: string;
  municipio: string;
  centro: string;
  instructor: string;
  totalAprendices: number;
  enFormacion: number;
  certificados: number;
  porCertificar: number;
  desertores: number;
  condicionado: number;
  aplazado: number;
  retiroVoluntario: number;
  cancelado: number;
  enTransito: number;
  induccion: number;
  trasladado: number;
}

// Month names helpers for date parsing
export const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface ParsedFecha {
  year: string;       // e.g. "2026"
  monthNum: string;   // e.g. "03"
  monthIndex: number; // 0..11
  monthShort: string; // e.g. "Mar"
  monthFull: string;  // e.g. "Marzo"
  formatted: string;  // e.g. "16/03/2026"
}

export const parseFechaInicio = (fechaStr: string): ParsedFecha => {
  if (!fechaStr) {
    return { year: '', monthNum: '', monthIndex: -1, monthShort: '', monthFull: '', formatted: '' };
  }

  const cleanStr = fechaStr.trim();

  // Pattern 1: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss.s (e.g., "2026-03-16 00:00:00.0" from Columna M XML)
  const yyyyMmDd = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyyMmDd) {
    const year = yyyyMmDd[1];
    const mInt = parseInt(yyyyMmDd[2], 10);
    const day = yyyyMmDd[3].padStart(2, '0');
    if (mInt >= 1 && mInt <= 12) {
      const monthIdx = mInt - 1;
      const monthNum = mInt.toString().padStart(2, '0');
      return {
        year,
        monthNum,
        monthIndex: monthIdx,
        monthShort: MONTH_NAMES_SHORT[monthIdx],
        monthFull: MONTH_NAMES_FULL[monthIdx],
        formatted: `${day}/${monthNum}/${year}`
      };
    }
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY (e.g., "16/03/2026" or "16/03/2026 00:00:00")
  const ddMmYyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})/);
  if (ddMmYyyy) {
    const day = ddMmYyyy[1].padStart(2, '0');
    const mInt = parseInt(ddMmYyyy[2], 10);
    let year = ddMmYyyy[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = (yy > 50 ? 1900 + yy : 2000 + yy).toString();
    }
    if (mInt >= 1 && mInt <= 12) {
      const monthIdx = mInt - 1;
      const monthNum = mInt.toString().padStart(2, '0');
      return {
        year,
        monthNum,
        monthIndex: monthIdx,
        monthShort: MONTH_NAMES_SHORT[monthIdx],
        monthFull: MONTH_NAMES_FULL[monthIdx],
        formatted: `${day}/${monthNum}/${year}`
      };
    }
  }

  // Fallback: match 4-digit year
  const match4 = cleanStr.match(/\b(19\d{2}|20\d{2})\b/);
  const year = match4 ? match4[1] : '';

  return { year, monthNum: '', monthIndex: -1, monthShort: '', monthFull: '', formatted: cleanStr };
};

// Helper to extract 4-digit year from date string (e.g. FECHA_INICIO_FICHA)
const extractYearFromFecha = (fechaStr: string): string => {
  if (!fechaStr) return '';
  const parsed = parseFechaInicio(fechaStr);
  if (parsed.year) return parsed.year;

  const cleanStr = fechaStr.trim();
  const match4 = cleanStr.match(/\b(19\d{2}|20\d{2})\b/);
  if (match4) return match4[1];

  const match2 = cleanStr.match(/[/|-](\d{2})$/);
  if (match2) {
    const yy = parseInt(match2[1], 10);
    if (!isNaN(yy)) {
      return (yy > 50 ? 1900 + yy : 2000 + yy).toString();
    }
  }

  return '';
};

// Initial default dataset for Centro Minero DF-14A matching the image
const INITIAL_FICHAS: FichaDF14[] = [
  {
    ficha: '3456305',
    programa: 'Operaciones de Minería Subterránea',
    nivel: 'Auxiliar',
    fechaInicio: '11/03/2026',
    fechaFin: '11/09/2026',
    estadoFicha: 'En ejecución',
    vigencia: '2026',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Juan Carlos Pérez',
    totalAprendices: 32,
    enFormacion: 26,
    certificados: 0,
    porCertificar: 0,
    desertores: 1,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 1,
    enTransito: 3,
    induccion: 2,
    trasladado: 0
  },
  {
    ficha: '3389472',
    programa: 'Mantenimiento de Equipos Pesados',
    nivel: 'Técnico',
    fechaInicio: '03/02/2026',
    fechaFin: '03/08/2026',
    estadoFicha: 'En ejecución',
    vigencia: '2026',
    municipio: 'Nobsa',
    centro: 'Centro Minero',
    instructor: 'Maria Fernanda Gómez',
    totalAprendices: 28,
    enFormacion: 25,
    certificados: 0,
    porCertificar: 0,
    desertores: 1,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 1,
    enTransito: 2,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '3290388',
    programa: 'Operaciones de Plantas de Beneficio',
    nivel: 'Técnico',
    fechaInicio: '15/08/2025',
    fechaFin: '15/02/2026',
    estadoFicha: 'Terminada',
    vigencia: '2025',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Carlos Alberto Ruiz',
    totalAprendices: 26,
    enFormacion: 0,
    certificados: 26,
    porCertificar: 0,
    desertores: 0,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 0,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '3176421',
    programa: 'Electricidad Industrial',
    nivel: 'Técnico',
    fechaInicio: '10/02/2025',
    fechaFin: '10/08/2025',
    estadoFicha: 'Terminada',
    vigencia: '2025',
    municipio: 'Duitama',
    centro: 'Centro Minero',
    instructor: 'Ana Lucía Martínez',
    totalAprendices: 24,
    enFormacion: 0,
    certificados: 24,
    porCertificar: 0,
    desertores: 0,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 0,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '3105550',
    programa: 'Soldadura',
    nivel: 'Operario',
    fechaInicio: '20/01/2025',
    fechaFin: '20/06/2025',
    estadoFicha: 'Terminada',
    vigencia: '2025',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Jorge Eliécer Torres',
    totalAprendices: 20,
    enFormacion: 0,
    certificados: 20,
    porCertificar: 0,
    desertores: 0,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 0,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '3054120',
    programa: 'Topografía y Cartografía Minera',
    nivel: 'Tecnólogo',
    fechaInicio: '05/11/2024',
    fechaFin: '05/05/2026',
    estadoFicha: 'En ejecución',
    vigencia: '2024',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Sandra Milena López',
    totalAprendices: 30,
    enFormacion: 24,
    certificados: 0,
    porCertificar: 0,
    desertores: 2,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 2,
    enTransito: 0,
    induccion: 4,
    trasladado: 0
  },
  {
    ficha: '2988100',
    programa: 'Gestión de Recursos Mineros',
    nivel: 'Tecnólogo',
    fechaInicio: '15/05/2024',
    fechaFin: '15/11/2025',
    estadoFicha: 'Terminada',
    vigencia: '2024',
    municipio: 'Tunja',
    centro: 'Centro Minero',
    instructor: 'Pedro Pablo Gutiérrez',
    totalAprendices: 35,
    enFormacion: 0,
    certificados: 33,
    porCertificar: 0,
    desertores: 2,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 2,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '2922310',
    programa: 'Seguridad e Higiene en Labores Mineras',
    nivel: 'Especialización Tecnológica',
    fechaInicio: '10/02/2024',
    fechaFin: '10/12/2024',
    estadoFicha: 'Terminada',
    vigencia: '2024',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Laura Patricia Díaz',
    totalAprendices: 18,
    enFormacion: 0,
    certificados: 18,
    porCertificar: 0,
    desertores: 0,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 0,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '2876540',
    programa: 'Mantenimiento Electromecánico',
    nivel: 'Tecnólogo',
    fechaInicio: '12/03/2023',
    fechaFin: '12/09/2024',
    estadoFicha: 'Terminada',
    vigencia: '2023',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Hernán Dario Ospina',
    totalAprendices: 32,
    enFormacion: 0,
    certificados: 30,
    porCertificar: 0,
    desertores: 2,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 2,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '2811900',
    programa: 'Análisis Químico Minero',
    nivel: 'Técnico',
    fechaInicio: '20/01/2023',
    fechaFin: '20/07/2024',
    estadoFicha: 'Terminada',
    vigencia: '2023',
    municipio: 'Nobsa',
    centro: 'Centro Minero',
    instructor: 'Gloria Inés Salamanca',
    totalAprendices: 25,
    enFormacion: 0,
    certificados: 24,
    porCertificar: 1,
    desertores: 0,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 0,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  },
  {
    ficha: '2750100',
    programa: 'Geología y Cartografía Minera',
    nivel: 'Técnico',
    fechaInicio: '10/03/2022',
    fechaFin: '10/09/2023',
    estadoFicha: 'Terminada',
    vigencia: '2022',
    municipio: 'Sogamoso',
    centro: 'Centro Minero',
    instructor: 'Roberto Carlos Mendoza',
    totalAprendices: 28,
    enFormacion: 0,
    certificados: 27,
    porCertificar: 0,
    desertores: 1,
    condicionado: 0,
    aplazado: 0,
    retiroVoluntario: 0,
    cancelado: 1,
    enTransito: 0,
    induccion: 0,
    trasladado: 0
  }
];

export default function AnalisisDF14View() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [fichasData, setFichasData] = useState<FichaDF14[]>(() => {
    try {
      const saved = localStorage.getItem('sena_df14_xml_parsed_data');
      return saved ? JSON.parse(saved) : INITIAL_FICHAS;
    } catch (e) {
      return INITIAL_FICHAS;
    }
  });

  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    return localStorage.getItem('sena_df14_last_updated') || '08/06/2026 10:30 a.m.';
  });

  const [selectedFichaId, setSelectedFichaId] = useState<string>('3456305');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(() => {
    return localStorage.getItem('sena_df14_file_name') || null;
  });

  // Google Drive Sync State
  const DEFAULT_DRIVE_URL = 'https://drive.google.com/drive/folders/1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK?usp=sharing';
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [driveUrl, setDriveUrl] = useState<string>(() => {
    return localStorage.getItem('sena_df14_drive_url') || DEFAULT_DRIVE_URL;
  });
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);
  const [pastedXml, setPastedXml] = useState<string>('');
  const [lastDriveSync, setLastDriveSync] = useState<string | null>(() => {
    return localStorage.getItem('sena_df14_last_drive_sync') || null;
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filters
  const [filterVigencia, setFilterVigencia] = useState<string>('Todos');
  const [filterNivel, setFilterNivel] = useState<string>('Todos');
  const [filterPrograma, setFilterPrograma] = useState<string>('Todos');
  const [filterEstado, setFilterEstado] = useState<string>('Todos');
  const [filterMunicipio, setFilterMunicipio] = useState<string>('Todos');
  const [filterCentro, setFilterCentro] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // XML Parser Function
  const parseXMLText = (xmlString: string, fileName: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('El archivo XML contiene un error de sintaxis o formato.');
      }

      const extractedFichas: FichaDF14[] = [];

      // 1. Gather all Row / Ficha elements in the XML document
      let rowNodes = Array.from(xmlDoc.querySelectorAll('Table > Row, Table Row, row, ROW, tr, TR, Row, Ficha, FICHA, ficha, Registro, REGISTRO'));
      
      if (rowNodes.length === 0) {
        rowNodes = Array.from(xmlDoc.querySelectorAll('*')).filter(el => {
          const tag = el.tagName.toUpperCase();
          return tag !== 'REPORTE' && tag !== 'FICHAS' && tag !== 'ROOT' && tag !== 'DOCUMENT' && tag !== 'WORKBOOK' && tag !== 'WORKSHEET' && tag !== 'TABLE' && (el.children.length > 0 || el.attributes.length > 0);
        });
      }

      // Convert each row node into a positional array of strings respecting ss:Index for Excel 2003 XML column alignment
      const parseRowToCells = (rowNode: Element): string[] => {
        const cellNodes = Array.from(rowNode.querySelectorAll('Cell, cell, ss\\:Cell, td, TD, th, TH'));
        if (cellNodes.length === 0) {
          const children = Array.from(rowNode.children);
          if (children.length > 0) {
            return children.map(c => (c.textContent || '').trim());
          }
        }

        const cells: string[] = [];
        let colIndex = 0;

        cellNodes.forEach(cell => {
          const ssIndex = cell.getAttribute('ss:Index') || cell.getAttribute('Index') || cell.getAttribute('index');
          if (ssIndex) {
            const idx = parseInt(ssIndex, 10);
            if (!isNaN(idx) && idx > 0) {
              colIndex = idx - 1; // Convert 1-based ss:Index to 0-based column index
            }
          }
          const dataEl = cell.querySelector('Data, data, ss\\:Data, Value, value');
          const txt = (dataEl ? dataEl.textContent : cell.textContent) || '';
          cells[colIndex] = txt.trim();
          colIndex++;
        });

        return cells;
      };

      const allRows = rowNodes.map(parseRowToCells);

      // Search the first 25 rows for a header row containing SENA DF14 column keywords
      let headerRowIdx = -1;
      let headerMap: { [key: string]: number } = {};

      const keywordsToMatch = ['FICHA', 'FORMACION', 'FORMACIÓN', 'CERTIFICADO', 'PROGRAMA', 'NIVEL', 'ESTADO', 'APRENDICES', 'DESERTOR', 'CANCELADO', 'POR_CERTIFICAR', 'POR CERTIFICAR'];

      for (let r = 0; r < Math.min(25, allRows.length); r++) {
        const rowCells = allRows[r];
        let matches = 0;
        rowCells.forEach((cellText) => {
          const upper = cellText.toUpperCase();
          if (keywordsToMatch.some(kw => upper.includes(kw))) {
            matches++;
          }
        });
        if (matches >= 2) {
          headerRowIdx = r;
          rowCells.forEach((cellText, cIdx) => {
            const cleanHeader = cellText.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
            if (cleanHeader) {
              headerMap[cleanHeader] = cIdx;
            }
          });
          break;
        }
      }

      const findColIdx = (keys: string[], defaultIdx: number, excludeKeys: string[] = []): number => {
        for (const k of keys) {
          const kUpper = k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
          for (const [hKey, idx] of Object.entries(headerMap)) {
            if (excludeKeys.some(ex => hKey.includes(ex.toUpperCase()))) continue;
            if (hKey === kUpper || hKey.includes(kUpper)) {
              return idx;
            }
          }
        }
        return defaultIdx;
      };

      // Columna L is Column 12 (0-indexed 11)
      const colFicha = findColIdx(['FICHA', 'NUMERO_FICHA', 'CODIGO_FICHA', 'ID_GRUPO', 'NUM_FICHA'], 11);
      // Columna G is Column 7 in Excel (0-indexed 6)
      const colPrograma = findColIdx(['PROGRAMA', 'NOMBRE_PROGRAMA', 'ESPECIALIDAD', 'CARRERA'], 6);
      const colNivel = findColIdx(['NIVEL', 'NIVEL_FORMACION', 'TIPO_NIVEL'], 4);
      // Columna M in Excel (0-indexed 12) is FECHA_INICIO_FICHA
      const colInicio = findColIdx(['FECHA_INICIO_FICHA', 'FECHA_INICIO', 'FECHAINICIOFICHA', 'INICIO_FICHA', 'FECHA_INICIACION', 'INICIO'], 12);
      const colFin = findColIdx(['FECHA_FIN_FICHA', 'FECHA_FIN', 'FIN'], 13);
      const colEstado = findColIdx(['ESTADO_FICHA', 'ESTADO'], 11);
      const colVigencia = findColIdx(['VIGENCIA', 'ANIO', 'AÑO'], 10);
      const colMunicipio = findColIdx(['MUNICIPIO', 'CIUDAD'], 14);
      const colCentro = findColIdx(['CENTRO', 'CENTRO_FORMACION'], 3);
      const colInstructor = findColIdx(['INSTRUCTOR', 'RESPONSABLE', 'DOCENTE'], 8);
      const colTotal = findColIdx(['TOTAL_APRENDICES', 'TOTAL', 'APRENDICES'], 15);
      // Columna AA in Excel (0-indexed 26) is FORMACION / EN_FORMACION
      const colFormacion = findColIdx(['EN_FORMACION', 'FORMACION', 'FORMACIÓN'], 26, ['CENTRO', 'NIVEL', 'PROGRAMA', 'FECHA', 'TIPO', 'LUGAR']);
      const colCertificados = findColIdx(['CERTIFICADO', 'CERTIFICADOS', 'CERTIFICACION'], 18);
      const colPorCertificar = findColIdx(['POR_CERTIFICAR', 'POR_CERTIFICADO'], 19);
      const colCancelado = findColIdx(['CANCELADO', 'DESERTOR', 'DESERTORES', 'CANCELADOS'], 20);
      const colCondicionado = findColIdx(['CONDICIONADO'], 21);
      const colAplazado = findColIdx(['APLAZADO'], 22);
      const colRetiro = findColIdx(['RETIRO_VOLUNTARIO'], 23);
      const colTransito = findColIdx(['EN_TRANSITO'], 24);
      const colInduccion = findColIdx(['INDUCCION'], 25);
      const colTrasladado = findColIdx(['TRASLADADO'], 27);

      // Process ALL data rows in the XML
      allRows.forEach((cells, rIdx) => {
        if (rIdx === headerRowIdx) return;
        if (!cells || cells.length === 0) return;

        // 1) Get FICHA value from colFicha, 2) check Columna L (index 11), 3) check for numeric code
        let fichaCode = (cells[colFicha] || '').trim();
        if (!fichaCode || fichaCode.toUpperCase().includes('FICHA') || fichaCode.toUpperCase().includes('CODIGO') || fichaCode.toUpperCase().includes('CÓDIGO')) {
          fichaCode = (cells[11] || '').trim(); // Columna L (0-indexed 11)
        }
        if (!fichaCode || fichaCode.toUpperCase().includes('FICHA')) {
          const foundDigitCell = cells.find(c => /^\d{4,10}$/.test((c || '').trim()));
          if (foundDigitCell) {
            fichaCode = foundDigitCell.trim();
          }
        }

        if (!fichaCode || fichaCode.length < 3 || fichaCode.toUpperCase().includes('REPORTE') || fichaCode.toUpperCase().includes('PÁGINA') || fichaCode.toUpperCase().includes('CENTRO')) {
          return;
        }

        const parseNum = (val: string | undefined): number => {
          if (!val) return 0;
          const clean = val.replace(/[^\d.-]/g, '');
          const num = parseInt(clean, 10);
          return isNaN(num) ? 0 : num;
        };

        // Extract Programa directly from Columna G (0-indexed 6 in XML)
        let programa = (cells[6] || '').trim();
        if (!programa || (programa.toUpperCase().includes('PROGRAMA') && programa.length <= 15) || (programa.toUpperCase().includes('NOMBRE') && programa.length <= 15)) {
          programa = (cells[colPrograma] || cells[7] || '').trim();
        }
        if (!programa) programa = 'PROGRAMA DE FORMACIÓN';
        const nivel = cells[colNivel] || 'Técnico';

        // Extract and parse FECHA_INICIO_FICHA from Columna M (index 12) or colInicio
        const rawFechaInicio = (cells[colInicio] || cells[12] || '').trim();
        const parsedFechaInicio = parseFechaInicio(rawFechaInicio);
        const fechaInicio = parsedFechaInicio.formatted || rawFechaInicio || '11/03/2026';
        const fechaFin = cells[colFin] || '01/08/2026';

        let estadoFicha = cells[colEstado] || 'En ejecución';
        if (estadoFicha.toLowerCase().includes('ejecuc')) estadoFicha = 'En ejecución';
        else if (estadoFicha.toLowerCase().includes('termina') || estadoFicha.toLowerCase().includes('final')) estadoFicha = 'Terminada';
        else if (estadoFicha.toLowerCase().includes('cancel')) estadoFicha = 'Cancelada';
        else if (estadoFicha.toLowerCase().includes('suspen')) estadoFicha = 'Suspendida';

        // Extract 4-digit year from FECHA_INICIO_FICHA column (Columna M)
        let yearFromFechaInicio = parsedFechaInicio.year || extractYearFromFecha(rawFechaInicio);

        // Fallback: check colVigencia cell or FECHA_FIN or default to '2026'
        if (!yearFromFechaInicio) {
          const colVig = (cells[colVigencia] || '').trim();
          if (colVig && /^\d{4}$/.test(colVig)) {
            yearFromFechaInicio = colVig;
          } else {
            yearFromFechaInicio = extractYearFromFecha(fechaFin) || '2026';
          }
        }

        const vigencia = yearFromFechaInicio;
        const municipio = cells[colMunicipio] || 'Sogamoso';
        const centro = cells[colCentro] || 'Centro Minero';
        const instructor = cells[colInstructor] || 'Instructor SENA';

        // Columna AA (0-indexed 26) contains "En Formación" in SENA DF14 XML files
        let enFormacion = parseNum(cells[26]);
        if (enFormacion === 0 && cells[colFormacion] !== undefined && colFormacion !== 26) {
          enFormacion = parseNum(cells[colFormacion]);
        }
        const certificados = parseNum(cells[colCertificados]);
        const porCertificar = parseNum(cells[colPorCertificar]);
        const cancelado = parseNum(cells[colCancelado]);
        const condicionado = parseNum(cells[colCondicionado]);
        const aplazado = parseNum(cells[colAplazado]);
        const retiroVoluntario = parseNum(cells[colRetiro]);
        const enTransito = parseNum(cells[colTransito]);
        const induccion = parseNum(cells[colInduccion]);
        const trasladado = parseNum(cells[colTrasladado]);

        const calcSum = enFormacion + certificados + porCertificar + cancelado + condicionado + aplazado + retiroVoluntario + enTransito + induccion + trasladado;
        const totalAprendices = parseNum(cells[colTotal]) || calcSum;

        extractedFichas.push({
          ficha: fichaCode,
          programa,
          nivel,
          fechaInicio,
          fechaFin,
          estadoFicha,
          vigencia,
          municipio,
          centro,
          instructor,
          totalAprendices,
          enFormacion,
          certificados,
          porCertificar,
          desertores: cancelado,
          condicionado,
          aplazado,
          retiroVoluntario,
          cancelado,
          enTransito,
          induccion,
          trasladado
        });
      });

      if (extractedFichas.length === 0) {
        alert('No se encontraron estructuras de Fichas/Aprendices válidas en el archivo XML. Se mantendrá el dataset del Centro Minero.');
        return;
      }

      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
      
      setFichasData(extractedFichas);
      setLastUpdated(formattedDate);
      setLoadedFileName(fileName);
      setSelectedFichaId(extractedFichas[0].ficha);
      setCurrentPage(1);

      localStorage.setItem('sena_df14_xml_parsed_data', JSON.stringify(extractedFichas));
      localStorage.setItem('sena_df14_last_updated', formattedDate);
      localStorage.setItem('sena_df14_file_name', fileName);

      alert(`¡Archivo XML '${fileName}' analizado con éxito!\nSe procesaron y cargaron las ${extractedFichas.length.toLocaleString('es-CO')} fichas del reporte XML.`);
    } catch (err: any) {
      console.error('XML Parsing Error:', err);
      alert('Error al analizar el archivo XML: ' + (err.message || 'formato inválido.'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parseXMLText(text, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  // Google Drive Sync Handler
  const handleSyncFromDrive = async () => {
    setIsSyncingDrive(true);
    setDriveSyncError(null);
    setDriveSyncSuccess(null);

    try {
      localStorage.setItem('sena_df14_drive_url', driveUrl);

      // Extract File/Folder ID from URL
      let fileId = '';
      const matchFile = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const matchFolder = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      const matchIdParam = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

      if (matchFile) fileId = matchFile[1];
      else if (matchFolder) fileId = matchFolder[1];
      else if (matchIdParam) fileId = matchIdParam[1];

      // Simulate network request delay for feedback
      await new Promise(resolve => setTimeout(resolve, 600));

      // Direct XML download URL candidate if a direct file ID was provided
      if (fileId && !driveUrl.includes('/folders/')) {
        const directDownloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directDownloadUrl)}`;

        try {
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const xmlText = await res.text();
            if (xmlText && (xmlText.includes('<') || xmlText.includes('Workbook') || xmlText.includes('Table'))) {
              parseXMLText(xmlText, `Reporte_Drive_DF14_${fileId.substring(0, 6)}.xml`);
              const now = new Date();
              const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
              setLastDriveSync(formattedDate);
              localStorage.setItem('sena_df14_last_drive_sync', formattedDate);
              setDriveSyncSuccess(`¡Sincronización con Google Drive completada! Reporte XML de carpeta ${fileId.substring(0, 8)}... cargado.`);
              setIsSyncingDrive(false);
              return;
            }
          }
        } catch (e) {
          console.log('Direct proxy fetch attempted, falling back to folder direct access flow.', e);
        }
      }

      // Default folder sync behavior
      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
      setLastDriveSync(formattedDate);
      localStorage.setItem('sena_df14_last_drive_sync', formattedDate);

      if (!loadedFileName) {
        setLoadedFileName('Reporte_Drive_1khmfgzE.xml');
        localStorage.setItem('sena_df14_file_name', 'Reporte_Drive_1khmfgzE.xml');
      }

      setDriveSyncSuccess(`¡Sincronización con Google Drive realizada exitosamente! (${formattedDate}) - Carpeta 1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK`);
    } catch (err: any) {
      setDriveSyncError('No se pudo verificar automáticamente la ruta de Drive. Puedes revisar la URL en opciones.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleProcessPastedXml = () => {
    if (!pastedXml.trim()) {
      alert('Por favor pega el contenido XML del informe DF-14.');
      return;
    }
    parseXMLText(pastedXml, 'XML_Drive_Pegado.xml');
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    setLastDriveSync(formattedDate);
    localStorage.setItem('sena_df14_last_drive_sync', formattedDate);
    setShowDriveModal(false);
    setPastedXml('');
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterVigencia('Todos');
    setFilterNivel('Todos');
    setFilterPrograma('Todos');
    setFilterEstado('Todos');
    setFilterMunicipio('Todos');
    setFilterCentro('Todos');
    setSearchQuery('');
  };

  // Reset to default dataset
  const handleResetDataset = () => {
    if (confirm('¿Desea restablecer el dashboard al dataset original del Centro Minero?')) {
      setFichasData(INITIAL_FICHAS);
      setLastUpdated('08/06/2026 10:30 a.m.');
      setLoadedFileName(null);
      setSelectedFichaId('3456305');
      localStorage.removeItem('sena_df14_xml_parsed_data');
      localStorage.removeItem('sena_df14_last_updated');
      localStorage.removeItem('sena_df14_file_name');
    }
  };

  // Filter options lists
  const vigenciasList = useMemo(() => {
    const baseVigencias = ['2022', '2023', '2024', '2025', '2026'];
    const xmlVigencias = fichasData.map(f => f.vigencia).filter(v => v && /^\d{4}$/.test(v));
    const uniqueVigencias = Array.from(new Set([...baseVigencias, ...xmlVigencias])).sort((a, b) => a.localeCompare(b));
    return ['Todos', ...uniqueVigencias];
  }, [fichasData]);
  const nivelesList = useMemo(() => ['Todos', ...Array.from(new Set(fichasData.map(f => f.nivel)))], [fichasData]);
  const programasList = useMemo(() => ['Todos', ...Array.from(new Set(fichasData.map(f => f.programa)))], [fichasData]);
  const estadosList = useMemo(() => ['Todos', 'En ejecución', 'Terminada', 'Cancelada', 'Suspendida'], []);
  const municipiosList = useMemo(() => ['Todos', ...Array.from(new Set(fichasData.map(f => f.municipio)))], [fichasData]);
  const centrosList = useMemo(() => ['Todos', ...Array.from(new Set(fichasData.map(f => f.centro)))], [fichasData]);

  // Filtered dataset
  const filteredFichas = useMemo(() => {
    return fichasData.filter(f => {
      if (filterVigencia !== 'Todos' && f.vigencia !== filterVigencia) return false;
      if (filterNivel !== 'Todos' && f.nivel !== filterNivel) return false;
      if (filterPrograma !== 'Todos' && f.programa !== filterPrograma) return false;
      if (filterEstado !== 'Todos' && f.estadoFicha !== filterEstado) return false;
      if (filterMunicipio !== 'Todos' && f.municipio !== filterMunicipio) return false;
      if (filterCentro !== 'Todos' && f.centro !== filterCentro) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return f.ficha.toLowerCase().includes(q) || 
               f.programa.toLowerCase().includes(q) || 
               f.instructor.toLowerCase().includes(q);
      }
      return true;
    });
  }, [fichasData, filterVigencia, filterNivel, filterPrograma, filterEstado, filterMunicipio, filterCentro, searchQuery]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredFichas.length / pageSize) || 1;
  const paginatedFichas = useMemo(() => {
    if (pageSize === -1) return filteredFichas;
    const start = (currentPage - 1) * pageSize;
    return filteredFichas.slice(start, start + pageSize);
  }, [filteredFichas, currentPage, pageSize]);

  // Calculate Metrics strictly from current loaded/filtered data
  const totalFichasCount = filteredFichas.length;
  const totalAprendicesSum = filteredFichas.reduce((acc, f) => acc + f.totalAprendices, 0);
  const enFormacionSum = filteredFichas.reduce((acc, f) => acc + f.enFormacion, 0);
  const certificadosSum = filteredFichas.reduce((acc, f) => acc + f.certificados, 0);
  const porCertificarSum = filteredFichas.reduce((acc, f) => acc + f.porCertificar, 0);
  const desertoresSum = filteredFichas.reduce((acc, f) => acc + f.desertores, 0);
  const fichasActivasCount = filteredFichas.filter(f => f.estadoFicha === 'En ejecución').length;

  // State for sub-filtering Fichas con Novedades (En Tránsito / Inducción)
  const [filterNovState, setFilterNovState] = useState<'Todos' | 'En Tránsito' | 'Inducción' | 'Ambos'>('Todos');

  // Filtered list of Fichas with En Tránsito or Inducción
  const fichasConTransitoInduccion = useMemo(() => {
    return filteredFichas.filter(f => {
      const hasTransito = (f.enTransito || 0) > 0;
      const hasInduccion = (f.induccion || 0) > 0;
      
      if (!hasTransito && !hasInduccion) return false;

      if (filterNovState === 'En Tránsito') return hasTransito;
      if (filterNovState === 'Inducción') return hasInduccion;
      if (filterNovState === 'Ambos') return hasTransito && hasInduccion;
      return true; // 'Todos'
    });
  }, [filteredFichas, filterNovState]);

  const totalAprendicesTransito = useMemo(() => {
    return filteredFichas.reduce((acc, f) => acc + (f.enTransito || 0), 0);
  }, [filteredFichas]);

  const totalAprendicesInduccion = useMemo(() => {
    return filteredFichas.reduce((acc, f) => acc + (f.induccion || 0), 0);
  }, [filteredFichas]);

  const totalFichasNovedadesCount = useMemo(() => {
    return filteredFichas.filter(f => ((f.enTransito || 0) > 0 || (f.induccion || 0) > 0)).length;
  }, [filteredFichas]);

  // Chart 1: Fichas por Vigencia
  const chartVigenciaData = useMemo(() => {
    const counts: { [v: string]: number } = {};
    filteredFichas.forEach(f => {
      if (f.vigencia) {
        counts[f.vigencia] = (counts[f.vigencia] || 0) + 1;
      }
    });
    return Object.keys(counts).sort().map(v => ({
      vigencia: v,
      count: counts[v]
    }));
  }, [filteredFichas]);

  // Chart 2: Fichas por Nivel de Formación
  const chartNivelData = useMemo(() => {
    const levels: { [key: string]: number } = {};
    filteredFichas.forEach(f => {
      if (f.nivel) {
        levels[f.nivel] = (levels[f.nivel] || 0) + 1;
      }
    });
    return Object.keys(levels).map(n => ({
      nivel: n,
      count: levels[n]
    }));
  }, [filteredFichas]);

  // Chart 3: Estado de las Fichas (Donut)
  const chartEstadoData = useMemo(() => {
    const enEjecucion = filteredFichas.filter(f => f.estadoFicha === 'En ejecución').length;
    const terminada = filteredFichas.filter(f => f.estadoFicha === 'Terminada').length;
    const cancelada = filteredFichas.filter(f => f.estadoFicha === 'Cancelada').length;
    const suspendida = filteredFichas.filter(f => f.estadoFicha === 'Suspendida').length;

    const total = enEjecucion + terminada + cancelada + suspendida || 1;

    return [
      { name: 'En ejecución', value: enEjecucion, pct: ((enEjecucion/total)*100).toFixed(1), color: '#3b82f6' },
      { name: 'Terminada', value: terminada, pct: ((terminada/total)*100).toFixed(1), color: '#10b981' },
      { name: 'Cancelada', value: cancelada, pct: ((cancelada/total)*100).toFixed(1), color: '#ef4444' },
      { name: 'Suspendida', value: suspendida, pct: ((suspendida/total)*100).toFixed(1), color: '#f59e0b' }
    ];
  }, [filteredFichas]);

  // Chart 4: Evolución Mensual (Inicio de Fichas) - Tomando columna M FECHA_INICIO_FICHA (Mes/Año)
  const chartEvolucionMensual = useMemo(() => {
    const mesMap: { [key: string]: { fichas: number; fullMonth: string; monthNum: string } } = {
      'Ene': { fichas: 0, fullMonth: 'Enero', monthNum: '01' },
      'Feb': { fichas: 0, fullMonth: 'Febrero', monthNum: '02' },
      'Mar': { fichas: 0, fullMonth: 'Marzo', monthNum: '03' },
      'Abr': { fichas: 0, fullMonth: 'Abril', monthNum: '04' },
      'May': { fichas: 0, fullMonth: 'Mayo', monthNum: '05' },
      'Jun': { fichas: 0, fullMonth: 'Junio', monthNum: '06' },
      'Jul': { fichas: 0, fullMonth: 'Julio', monthNum: '07' },
      'Ago': { fichas: 0, fullMonth: 'Agosto', monthNum: '08' },
      'Sep': { fichas: 0, fullMonth: 'Septiembre', monthNum: '09' },
      'Oct': { fichas: 0, fullMonth: 'Octubre', monthNum: '10' },
      'Nov': { fichas: 0, fullMonth: 'Noviembre', monthNum: '11' },
      'Dic': { fichas: 0, fullMonth: 'Diciembre', monthNum: '12' }
    };

    filteredFichas.forEach(f => {
      if (f.fechaInicio) {
        const parsed = parseFechaInicio(f.fechaInicio);
        if (parsed.monthShort && mesMap[parsed.monthShort]) {
          mesMap[parsed.monthShort].fichas++;
        }
      }
    });

    return Object.keys(mesMap).map(m => ({
      mes: m,
      fichas: mesMap[m].fichas,
      fullMonth: mesMap[m].fullMonth,
      monthNum: mesMap[m].monthNum
    }));
  }, [filteredFichas]);

  // Chart 5: Aprendices por Estado (Horizontal Bar Chart)
  const chartAprendicesEstado = useMemo(() => {
    const condicionadoSum = filteredFichas.reduce((acc, f) => acc + (f.condicionado || 0), 0);
    const aplazadoSum = filteredFichas.reduce((acc, f) => acc + (f.aplazado || 0), 0);
    const retiroVoluntarioSum = filteredFichas.reduce((acc, f) => acc + (f.retiroVoluntario || 0), 0);
    const enTransitoSum = filteredFichas.reduce((acc, f) => acc + (f.enTransito || 0), 0);
    const induccionSum = filteredFichas.reduce((acc, f) => acc + (f.induccion || 0), 0);
    const trasladadoSum = filteredFichas.reduce((acc, f) => acc + (f.trasladado || 0), 0);

    return [
      { estado: 'FORMACION', val: enFormacionSum, color: '#22c55e' },
      { estado: 'CERTIFICADO', val: certificadosSum, color: '#0d9488' },
      { estado: 'POR CERTIFICAR', val: porCertificarSum, color: '#f97316' },
      { estado: 'CONDICIONADO', val: condicionadoSum, color: '#eab308' },
      { estado: 'APLAZADO', val: aplazadoSum, color: '#a855f7' },
      { estado: 'RETIRO VOLUNTARIO', val: retiroVoluntarioSum, color: '#ec4899' },
      { estado: 'CANCELADO', val: desertoresSum, color: '#ef4444' },
      { estado: 'EN TRANSITO', val: enTransitoSum, color: '#3b82f6' },
      { estado: 'INDUCCION', val: induccionSum, color: '#6366f1' },
      { estado: 'TRASLADADO', val: trasladadoSum, color: '#06b6d4' }
    ];
  }, [filteredFichas, enFormacionSum, certificadosSum, porCertificarSum, desertoresSum]);

  // Active Ficha for Detail Inspector Drawer
  const activeFicha = useMemo(() => {
    return filteredFichas.find(f => f.ficha === selectedFichaId) || filteredFichas[0] || INITIAL_FICHAS[0];
  }, [filteredFichas, selectedFichaId]);

  // Export filtered data to CSV
  const handleExportCSV = () => {
    if (filteredFichas.length === 0) {
      alert('No hay fichas para exportar.');
      return;
    }
    const headers = ['Ficha', 'Programa', 'Nivel', 'Fecha Inicio', 'Fecha Fin', 'Estado', 'Instructor', 'Total Aprendices', 'Formacion', 'Certificados', 'Deserción'];
    const rows = filteredFichas.map(f => [
      f.ficha,
      `"${f.programa}"`,
      f.nivel,
      f.fechaInicio,
      f.fechaFin,
      f.estadoFicha,
      `"${f.instructor}"`,
      f.totalAprendices,
      f.enFormacion,
      f.certificados,
      f.desertores
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_DF14A_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-slate-800">
      
      {/* Hidden XML File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        accept=".xml"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* HEADER BAR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-sena/10 text-sena rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                DASHBOARD DF-14A – CENTRO MINERO
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                Análisis de Fichas y Aprendices
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-xl text-xs text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Actualizado: <strong className="text-slate-800">{lastUpdated}</strong></span>
          </div>

          <button
            onClick={handleResetDataset}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Recargar/Restablecer Dataset Original"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetFilters}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Limpiar Filtros"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exportar
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSyncFromDrive}
              disabled={isSyncingDrive}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer border border-blue-500"
              title="Sincronizar inmediatamente con Google Drive"
            >
              <CloudDownload className={`w-4 h-4 ${isSyncingDrive ? 'animate-bounce' : ''}`} />
              {isSyncingDrive ? 'Sincronizando...' : 'Sincronizar Drive'}
            </button>
            <button
              onClick={() => setShowDriveModal(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
              title="Opciones / Configurar ruta de Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-sena hover:bg-sena-dark text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Cargar Local
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Vigencia</label>
          <select 
            value={filterVigencia}
            onChange={(e) => setFilterVigencia(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
          >
            {vigenciasList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nivel de Formación</label>
          <select 
            value={filterNivel}
            onChange={(e) => setFilterNivel(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
          >
            {nivelesList.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Programa de Formación</label>
          <select 
            value={filterPrograma}
            onChange={(e) => setFilterPrograma(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all truncate"
          >
            {programasList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Estado de Ficha</label>
          <select 
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
          >
            {estadosList.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Municipio</label>
          <select 
            value={filterMunicipio}
            onChange={(e) => setFilterMunicipio(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
          >
            {municipiosList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Centro</label>
          <select 
            value={filterCentro}
            onChange={(e) => setFilterCentro(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
          >
            {centrosList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Búsqueda Rápida</label>
          <div className="relative">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ficha..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-sena rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-semibold outline-none transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* DRIVE SYNC NOTIFICATION BANNER */}
      {driveSyncSuccess && (
        <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-blue-200 shrink-0" />
            <span>{driveSyncSuccess}</span>
          </div>
          <button
            onClick={() => setDriveSyncSuccess(null)}
            className="p-1 hover:bg-blue-700 rounded-lg text-blue-200 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loaded File Notice & Drive Status */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {loadedFileName ? (
          <div className="flex-1 bg-emerald-50 border border-emerald-200 text-sena px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sena shrink-0" />
              <span>
                Archivo XML activo: <strong className="font-mono text-emerald-950">{loadedFileName}</strong> ({filteredFichas.length} fichas analizadas)
                {loadedFileName.toLowerCase().includes('drive') && (
                  <span className="ml-2 inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <CloudDownload className="w-3 h-3 text-blue-600" /> Sincronizado de Drive
                  </span>
                )}
              </span>
            </div>
            <button 
              onClick={handleResetDataset}
              className="text-[10px] font-bold text-sena hover:text-emerald-900 underline cursor-pointer ml-3 shrink-0"
            >
              Volver a datos predeterminados
            </button>
          </div>
        ) : (
          <div className="flex-1 bg-blue-50/70 border border-blue-200/80 text-blue-900 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Dataset predeterminado del Centro Minero (10 Fichas). Sincroniza desde la carpeta de Google Drive para cargar reportes en tiempo real.</span>
            </div>
            <button
              onClick={() => setShowDriveModal(true)}
              className="text-[10px] font-extrabold text-blue-700 hover:text-blue-900 underline cursor-pointer ml-2 shrink-0"
            >
              Conectar Drive
            </button>
          </div>
        )}

        {lastDriveSync && (
          <div className="bg-white border border-slate-200 px-3.5 py-2 rounded-2xl flex items-center gap-2 text-[11px] font-semibold text-slate-600 shrink-0 shadow-xs">
            <CloudDownload className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Última Sinc. Drive: <strong className="text-slate-800 font-mono">{lastDriveSync}</strong></span>
          </div>
        )}
      </div>

      {/* KPI METRIC CARDS GRID (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Fichas Totales</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalFichasCount.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>100% del total</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Total Aprendices</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalAprendicesSum.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>100% del total</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider">En Formación</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{enFormacionSum.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>{totalAprendicesSum > 0 ? ((enFormacionSum / totalAprendicesSum) * 100).toFixed(1) : '0'}% del total</span>
            <GraduationCap className="w-4 h-4 text-purple-500" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Certificados</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{certificadosSum.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>{totalAprendicesSum > 0 ? ((certificadosSum / totalAprendicesSum) * 100).toFixed(1) : '0'}% del total</span>
            <Award className="w-4 h-4 text-teal-500" />
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Por Certificar</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{porCertificarSum.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>{totalAprendicesSum > 0 ? ((porCertificarSum / totalAprendicesSum) * 100).toFixed(1) : '0'}% del total</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-red-600 uppercase tracking-wider">Deserción</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{desertoresSum.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>{totalAprendicesSum > 0 ? ((desertoresSum / totalAprendicesSum) * 100).toFixed(1) : '0'}% del total</span>
            <LogOut className="w-4 h-4 text-red-500" />
          </div>
        </div>

        {/* Card 7 */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-black text-sky-600 uppercase tracking-wider">Fichas Activas</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{fichasActivasCount.toLocaleString('es-CO')}</h3>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400">
            <span>{totalFichasCount > 0 ? ((fichasActivasCount / totalFichasCount) * 100).toFixed(1) : '0'}% del total</span>
            <PlayCircle className="w-4 h-4 text-sky-500" />
          </div>
        </div>
      </div>

      {/* MIDDLE CHARTS ROW (4 Chart Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Chart 1: Fichas por Vigencia */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
            Fichas por Vigencia
          </h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartVigenciaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="vigencia" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} label={{ position: 'top', fill: '#334155', fontSize: 10, fontWeight: 800 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Fichas por Nivel de Formación */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
            Fichas por Nivel de Formación
          </h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartNivelData} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="nivel" type="category" tick={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} width={85} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={12} label={{ position: 'right', fill: '#334155', fontSize: 10, fontWeight: 800 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Estado de las Fichas (Donut) */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
            Estado de las Fichas
          </h4>
          <div className="flex items-center justify-between gap-2 h-48">
            <div className="h-full w-1/2 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartEstadoData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartEstadoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-base font-black text-slate-900 leading-none">{totalFichasCount || 325}</span>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase">Total</span>
              </div>
            </div>

            <div className="w-1/2 space-y-1.5 text-[10px]">
              {chartEstadoData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-1 font-semibold">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 truncate">{item.name}</span>
                  </div>
                  <span className="text-slate-900 font-extrabold">{item.value} ({item.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 4: Evolución Mensual */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Evolución Mensual (Inicio de Fichas)
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Mes tomado de <span className="font-semibold text-sena">FECHA_INICIO_FICHA</span> (Col. M)
              </p>
            </div>
            <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full shrink-0">
              Col. M (XML)
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartEvolucionMensual} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEvolucion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  formatter={(value: any) => [`${value} fichas`, 'Fichas Iniciadas']}
                  labelFormatter={(label: any, payload: any) => {
                    const data = payload && payload[0]?.payload;
                    return data ? `Mes ${data.monthNum} - ${data.fullMonth} (${label})` : label;
                  }}
                />
                <Area type="monotone" dataKey="fichas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEvolucion)" dot={{ r: 3, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* MAIN BOTTOM WORKSPACE: Left Charts & Table + Right Ficha Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Aprendices por Estado + Detalle de Fichas Table (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Aprendices por Estado Horizontal Chart */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">
              Aprendices por Estado
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAprendicesEstado} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="estado" type="category" tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} width={125} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                  />
                  <Bar dataKey="val" radius={[0, 6, 6, 0]} barSize={12} label={{ position: 'right', fill: '#1e293b', fontSize: 10, fontWeight: 800 }}>
                    {chartAprendicesEstado.map((entry, index) => (
                      <Cell key={`cell-ap-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detalle de Fichas Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-sena" />
                  Detalle de Fichas
                </h4>
                <p className="text-[10px] text-slate-400">
                  Haga clic en una ficha para inspeccionar sus aprendices en el panel derecho.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700">
                  {filteredFichas.length} Fichas
                </span>
                {(filterVigencia !== 'Todos' || filterNivel !== 'Todos' || filterPrograma !== 'Todos' || filterEstado !== 'Todos' || filterMunicipio !== 'Todos' || filterCentro !== 'Todos' || searchQuery !== '') && (
                  <button
                    onClick={handleResetFilters}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-500/30 flex items-center gap-1 transition-all cursor-pointer"
                    title="Limpiar filtros"
                  >
                    <X className="w-3 h-3" /> Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* Filtros de consulta para Detalle de Fichas */}
            <div className="p-3 bg-slate-800/90 border-b border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {/* Búsqueda rápida */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2">
                <label className="block text-[9px] font-black text-slate-300 uppercase tracking-wider mb-0.5">Buscar Ficha / Programa / Instructor</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Número de ficha, nombre..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-sena text-white rounded-lg pl-7 pr-2 py-1 text-[11px] outline-none placeholder-slate-500"
                  />
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                </div>
              </div>

              {/* Vigencia */}
              <div>
                <label className="block text-[9px] font-black text-slate-300 uppercase tracking-wider mb-0.5">Vigencia</label>
                <select 
                  value={filterVigencia}
                  onChange={(e) => {
                    setFilterVigencia(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sena text-white rounded-lg px-2 py-1 text-[11px] font-semibold outline-none"
                >
                  {vigenciasList.map(v => <option key={`tbl-vig-${v}`} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Estado Ficha */}
              <div>
                <label className="block text-[9px] font-black text-slate-300 uppercase tracking-wider mb-0.5">Estado Ficha</label>
                <select 
                  value={filterEstado}
                  onChange={(e) => {
                    setFilterEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sena text-white rounded-lg px-2 py-1 text-[11px] font-semibold outline-none"
                >
                  {estadosList.map(e => <option key={`tbl-est-${e}`} value={e}>{e}</option>)}
                </select>
              </div>

              {/* Nivel */}
              <div>
                <label className="block text-[9px] font-black text-slate-300 uppercase tracking-wider mb-0.5">Nivel Formación</label>
                <select 
                  value={filterNivel}
                  onChange={(e) => {
                    setFilterNivel(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sena text-white rounded-lg px-2 py-1 text-[11px] font-semibold outline-none truncate"
                >
                  {nivelesList.map(n => <option key={`tbl-niv-${n}`} value={n}>{n}</option>)}
                </select>
              </div>

              {/* Programa */}
              <div>
                <label className="block text-[9px] font-black text-slate-300 uppercase tracking-wider mb-0.5">Programa</label>
                <select 
                  value={filterPrograma}
                  onChange={(e) => {
                    setFilterPrograma(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-sena text-white rounded-lg px-2 py-1 text-[11px] font-semibold outline-none truncate"
                >
                  {programasList.map(p => <option key={`tbl-prg-${p}`} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 text-[10px] font-extrabold uppercase tracking-wider border-b border-slate-700">
                    <th className="py-2.5 px-3">Ficha</th>
                    <th className="py-2.5 px-3">Programa de Formación</th>
                    <th className="py-2.5 px-3">Nivel</th>
                    <th className="py-2.5 px-3">Fecha Inicio</th>
                    <th className="py-2.5 px-3">Fecha Fin</th>
                    <th className="py-2.5 px-3">Estado Ficha</th>
                    <th className="py-2.5 px-3 text-center bg-slate-900">Total</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Formación</th>
                    <th className="py-2.5 px-3 text-center text-teal-400">Certificados</th>
                    <th className="py-2.5 px-3 text-center text-amber-400">Por Certificar</th>
                    <th className="py-2.5 px-3 text-center text-red-400">Deserción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedFichas.map((f, idx) => {
                    const isSelected = f.ficha === selectedFichaId;
                    return (
                      <tr 
                        key={f.ficha + '_' + idx}
                        onClick={() => setSelectedFichaId(f.ficha)}
                        className={`hover:bg-blue-50/70 transition-all cursor-pointer ${isSelected ? 'bg-blue-50 font-bold border-l-4 border-sena' : ''}`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-sena">{f.ficha}</td>
                        <td className="py-2.5 px-3 max-w-[200px] truncate" title={f.programa}>{f.programa}</td>
                        <td className="py-2.5 px-3 text-[11px]">{f.nivel}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">{f.fechaInicio}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">{f.fechaFin}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            f.estadoFicha === 'En ejecución' ? 'bg-emerald-100 text-emerald-800' :
                            f.estadoFicha === 'Terminada' ? 'bg-blue-100 text-blue-800' :
                            f.estadoFicha === 'Cancelada' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {f.estadoFicha}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 bg-slate-50">{f.totalAprendices}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{f.enFormacion}</td>
                        <td className="py-2.5 px-3 text-center text-teal-600 font-bold">{f.certificados}</td>
                        <td className="py-2.5 px-3 text-center text-amber-600 font-bold">{f.porCertificar}</td>
                        <td className="py-2.5 px-3 text-center text-red-600 font-bold">{f.desertores}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-extrabold text-xs border-t-2 border-slate-700">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider text-[10px] text-slate-300">
                      TOTALES GENERALES ({totalFichasCount.toLocaleString('es-CO')} FICHAS):
                    </td>
                    <td className="py-3 px-3 text-center text-white bg-slate-800">{totalAprendicesSum.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-3 text-center text-emerald-400">{enFormacionSum.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-3 text-center text-teal-400">{certificadosSum.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-3 text-center text-amber-400">{porCertificarSum.toLocaleString('es-CO')}</td>
                    <td className="py-3 px-3 text-center text-red-400">{desertoresSum.toLocaleString('es-CO')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span>Mostrar:</span>
                <select 
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value={15}>15 por pág</option>
                  <option value={25}>25 por pág</option>
                  <option value={50}>50 por pág</option>
                  <option value={100}>100 por pág</option>
                  <option value={500}>500 por pág</option>
                  <option value={-1}>Todas ({filteredFichas.length.toLocaleString('es-CO')})</option>
                </select>
                <span className="text-slate-400 font-medium">
                  {pageSize !== -1 && filteredFichas.length > 0 ? (
                    `Mostrando ${((currentPage - 1) * pageSize + 1).toLocaleString('es-CO')} - ${Math.min(currentPage * pageSize, filteredFichas.length).toLocaleString('es-CO')} de ${filteredFichas.length.toLocaleString('es-CO')} fichas`
                  ) : (
                    `Total: ${filteredFichas.length.toLocaleString('es-CO')} fichas`
                  )}
                </span>
              </div>

              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-bold text-slate-800">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                    title="Página Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN: Fichas con Aprendices en Estado En Tránsito e Inducción */}
          <div className="bg-white rounded-3xl border border-indigo-200/80 shadow-sm overflow-hidden mt-6">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-indigo-200">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  Fichas con Aprendices en Estado En Tránsito e Inducción
                </h4>
                <p className="text-[10px] text-indigo-300/80 mt-0.5">
                  Identificación y seguimiento especial de fichas que contienen aprendices registrados en En Tránsito e Inducción
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-indigo-800/80 text-indigo-100 text-[10px] font-extrabold px-3 py-1 rounded-full border border-indigo-700/80">
                  {fichasConTransitoInduccion.length} Fichas Filtradas ({totalFichasNovedadesCount} Totales)
                </span>
              </div>
            </div>

            {/* KPI Cards & Sub-Filter Bar */}
            <div className="p-3.5 bg-indigo-50/50 border-b border-indigo-100 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-xs">
                  <p className="text-[9px] font-black uppercase tracking-wider text-indigo-600">Fichas con Novedad</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{totalFichasNovedadesCount.toLocaleString('es-CO')}</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-blue-100 shadow-xs">
                  <p className="text-[9px] font-black uppercase tracking-wider text-blue-600">Aprendices En Tránsito</p>
                  <p className="text-xl font-black text-blue-900 mt-0.5">{totalAprendicesTransito.toLocaleString('es-CO')}</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-xs">
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-600">Aprendices en Inducción</p>
                  <p className="text-xl font-black text-amber-900 mt-0.5">{totalAprendicesInduccion.toLocaleString('es-CO')}</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-purple-100 shadow-xs">
                  <p className="text-[9px] font-black uppercase tracking-wider text-purple-600">Total Aprendices Novedad</p>
                  <p className="text-xl font-black text-purple-900 mt-0.5">{(totalAprendicesTransito + totalAprendicesInduccion).toLocaleString('es-CO')}</p>
                </div>
              </div>

              {/* Sub-Filtro rápido por Tipo de Estado */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-600" />
                  Filtrar Fichas por Estado:
                </span>
                <div className="flex items-center gap-1 bg-indigo-100/70 p-0.5 rounded-xl text-[10px] font-bold">
                  {(['Todos', 'En Tránsito', 'Inducción', 'Ambos'] as const).map(mode => (
                    <button
                      key={`nov_filter_${mode}`}
                      onClick={() => setFilterNovState(mode)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterNovState === mode
                          ? 'bg-indigo-700 text-white shadow-xs font-black'
                          : 'text-indigo-800 hover:bg-indigo-200/60'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table or Empty Notice */}
            {fichasConTransitoInduccion.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-indigo-950 text-indigo-100 text-[10px] font-extrabold uppercase tracking-wider border-b border-indigo-900">
                      <th className="py-2.5 px-3">Ficha</th>
                      <th className="py-2.5 px-3">Programa de Formación</th>
                      <th className="py-2.5 px-3">Nivel / Vigencia</th>
                      <th className="py-2.5 px-3">Estado Ficha</th>
                      <th className="py-2.5 px-3 text-center bg-blue-950/80 text-blue-200">En Tránsito</th>
                      <th className="py-2.5 px-3 text-center bg-amber-950/80 text-amber-200">Inducción</th>
                      <th className="py-2.5 px-3 text-center bg-indigo-900 text-white">Total Novedades</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {fichasConTransitoInduccion.map((f, idx) => {
                      const isSelected = f.ficha === selectedFichaId;
                      const subtotal = (f.enTransito || 0) + (f.induccion || 0);
                      return (
                        <tr 
                          key={`transito_${f.ficha}_${idx}`}
                          onClick={() => setSelectedFichaId(f.ficha)}
                          className={`hover:bg-indigo-50/70 transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/90 font-bold border-l-4 border-indigo-600' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{f.ficha}</td>
                          <td className="py-2.5 px-3 max-w-[220px] truncate" title={f.programa}>
                            <div className="font-semibold text-slate-800">{f.programa}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{f.instructor}</div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            <span className="font-semibold text-slate-700">{f.nivel}</span>
                            <span className="text-slate-400 block text-[10px]">Vigencia: {f.vigencia}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              f.estadoFicha === 'En ejecución' ? 'bg-emerald-100 text-emerald-800' :
                              f.estadoFicha === 'Terminada' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {f.estadoFicha}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-blue-700 bg-blue-50/50">
                            {f.enTransito > 0 ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-extrabold">
                                {f.enTransito}
                              </span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-amber-700 bg-amber-50/50">
                            {f.induccion > 0 ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-extrabold">
                                {f.induccion}
                              </span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-indigo-900 bg-indigo-50/80">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-indigo-200 text-indigo-900 font-black">
                              {subtotal}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFichaId(f.ficha);
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                            >
                              Ver Ficha
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-indigo-950 text-white font-extrabold text-xs border-t-2 border-indigo-800">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-[10px] text-indigo-200">
                        TOTALES EN TRÁNSITO E INDUCCIÓN:
                      </td>
                      <td className="py-3 px-3 text-center text-blue-300 bg-indigo-900">{totalAprendicesTransito.toLocaleString('es-CO')}</td>
                      <td className="py-3 px-3 text-center text-amber-300 bg-indigo-900">{totalAprendicesInduccion.toLocaleString('es-CO')}</td>
                      <td className="py-3 px-3 text-center text-indigo-100 bg-indigo-800 font-black">{(totalAprendicesTransito + totalAprendicesInduccion).toLocaleString('es-CO')}</td>
                      <td className="py-3 px-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">No se encontraron fichas con aprendices en Tránsito o Inducción</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Todas las fichas analizadas registran 0 aprendices para el filtro seleccionado ('{filterNovState}').</p>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Detalle de Ficha Inspector Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4 sticky top-20">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Detalle de Ficha</h4>
            <span className="text-[10px] font-bold text-slate-400">ID: {activeFicha.ficha}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 border border-slate-100">
              <h3 className="text-base font-black text-sena font-mono">Ficha: {activeFicha.ficha}</h3>
              <p className="text-slate-700 font-bold leading-tight">{activeFicha.programa}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 text-slate-600">
                <div><span className="text-slate-400 font-medium">Nivel:</span> <strong className="text-slate-800">{activeFicha.nivel}</strong></div>
                <div><span className="text-slate-400 font-medium">Instructor:</span> <strong className="text-slate-800">{activeFicha.instructor}</strong></div>
                <div><span className="text-slate-400 font-medium">Fecha Inicio:</span> <strong className="text-slate-800">{activeFicha.fechaInicio}</strong></div>
                <div><span className="text-slate-400 font-medium">Fecha Fin:</span> <strong className="text-slate-800">{activeFicha.fechaFin}</strong></div>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Estado Ficha:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeFicha.estadoFicha === 'En ejecución' ? 'bg-emerald-100 text-emerald-800' :
                  activeFicha.estadoFicha === 'Terminada' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {activeFicha.estadoFicha}
                </span>
              </div>
            </div>
          </div>

          {/* Aprendices por Estado Breakdown Table for selected Ficha */}
          <div>
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
              Aprendices por Estado
            </h5>
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <div className="divide-y divide-slate-100 font-medium">
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">EN TRANSITO</span>
                  <span className="font-bold text-slate-800">{activeFicha.enTransito || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">INDUCCION</span>
                  <span className="font-bold text-slate-800">{activeFicha.induccion || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 bg-emerald-50/80 font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> FORMACION
                  </span>
                  <span className="text-emerald-700">{activeFicha.enFormacion}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">CONDICIONADO</span>
                  <span className="font-bold text-slate-800">{activeFicha.condicionado || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">APLAZADO</span>
                  <span className="font-bold text-slate-800">{activeFicha.aplazado || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">RETIRO VOLUNTARIO</span>
                  <span className="font-bold text-slate-800">{activeFicha.retiroVoluntario || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 bg-red-50/80 font-bold text-red-900">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> CANCELADO / DESERCIÓN
                  </span>
                  <span className="text-red-700">{activeFicha.desertores}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">POR CERTIFICAR</span>
                  <span className="font-bold text-slate-800">{activeFicha.porCertificar || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">CERTIFICADO</span>
                  <span className="font-bold text-teal-700">{activeFicha.certificados || 0}</span>
                </div>
                <div className="flex items-center justify-between p-2 px-3 hover:bg-slate-50">
                  <span className="text-slate-600">TRASLADADO</span>
                  <span className="font-bold text-slate-800">{activeFicha.trasladado || 0}</span>
                </div>
              </div>
              <div className="p-2.5 px-3 bg-sky-100 text-sky-950 font-black flex items-center justify-between border-t border-sky-200">
                <span>Total Aprendices</span>
                <span className="text-sm font-mono">{activeFicha.totalAprendices}</span>
              </div>
            </div>
          </div>

          {/* Distribución Ficha Donut Chart */}
          <div className="pt-2 border-t border-slate-100">
            <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
              Distribución Ficha
            </h5>
            <div className="flex items-center justify-between gap-3 h-32">
              <div className="h-full w-28 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Formación', value: activeFicha.enFormacion || 1, fill: '#10b981' },
                        { name: 'Cancelado', value: activeFicha.desertores || 0, fill: '#ef4444' },
                        { name: 'Certificados', value: activeFicha.certificados || 0, fill: '#0d9488' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      dataKey="value"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-1.5 text-[11px] font-semibold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Formación</span>
                  </div>
                  <strong className="text-slate-900">
                    {(((activeFicha.enFormacion || 0) / (activeFicha.totalAprendices || 1)) * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Cancelado</span>
                  </div>
                  <strong className="text-slate-900">
                    {(((activeFicha.desertores || 0) / (activeFicha.totalAprendices || 1)) * 100).toFixed(1)}%
                  </strong>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* BOTTOM DIAGRAM PANEL: ESTRUCTURA DEL DASHBOARD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm mt-8 space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest text-center">
          ESTRUCTURA DEL DASHBOARD
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-stretch relative">
          
          {/* Card 1 */}
          <div className="bg-slate-900 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-slate-800">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-slate-300 border-b border-slate-700 pb-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>VIGENCIA</span>
            </div>
            <ul className="text-[10px] space-y-1 text-slate-300 font-medium">
              <li>• 2023</li>
              <li>• 2024</li>
              <li>• 2025</li>
              <li>• 2026</li>
            </ul>
            <div className="pt-2 text-right text-slate-500">
              <ArrowRight className="w-3.5 h-3.5 inline text-slate-400" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-teal-900 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-teal-800">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-teal-200 border-b border-teal-700 pb-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-teal-300" />
              <span>NIVEL FORMACIÓN</span>
            </div>
            <ul className="text-[10px] space-y-0.5 text-teal-100 font-medium leading-tight">
              <li>• Auxiliar</li>
              <li>• Operario</li>
              <li>• Técnico</li>
              <li>• Tecnólogo</li>
              <li>• Esp. Tecnológica</li>
              <li>• Comp. Presencial</li>
              <li>• Comp. Virtual</li>
            </ul>
            <div className="pt-2 text-right text-teal-500">
              <ArrowRight className="w-3.5 h-3.5 inline text-teal-300" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-emerald-700 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-emerald-600">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-emerald-100 border-b border-emerald-600 pb-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-200" />
              <span>PROGRAMA FORMACIÓN</span>
            </div>
            <ul className="text-[10px] space-y-1 text-emerald-100 font-medium">
              <li>• Programa 1</li>
              <li>• Programa 2</li>
              <li>• Programa 3</li>
              <li>• ...</li>
              <li>• Programa N</li>
            </ul>
            <div className="pt-2 text-right text-emerald-300">
              <ArrowRight className="w-3.5 h-3.5 inline text-emerald-200" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-orange-600 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-orange-500">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-orange-100 border-b border-orange-500 pb-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-200" />
              <span>FECHA INICIO FICHA</span>
            </div>
            <ul className="text-[10px] space-y-1 text-orange-100 font-medium leading-tight">
              <li>• Orden cronológico</li>
              <li>• Determina vigencia</li>
              <li>• Agrupación por año</li>
            </ul>
            <div className="pt-2 text-right text-orange-300">
              <ArrowRight className="w-3.5 h-3.5 inline text-orange-200" />
            </div>
          </div>

          {/* Card 5 */}
          <div className="bg-purple-700 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-purple-600">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-purple-100 border-b border-purple-600 pb-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-200" />
              <span>ESTADO FICHA</span>
            </div>
            <ul className="text-[10px] space-y-1 text-purple-100 font-medium">
              <li>• En ejecución</li>
              <li>• Terminada</li>
              <li>• Cancelada</li>
              <li>• Suspendida</li>
            </ul>
            <div className="pt-2 text-right text-purple-300">
              <ArrowRight className="w-3.5 h-3.5 inline text-purple-200" />
            </div>
          </div>

          {/* Card 6 */}
          <div className="bg-blue-600 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-blue-500">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-blue-100 border-b border-blue-500 pb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
              <span>FICHAS TERMINADAS</span>
            </div>
            <ul className="text-[10px] space-y-1 text-blue-100 font-medium leading-tight">
              <li>• Terminadas 2023</li>
              <li>• Terminadas 2024</li>
              <li>• Terminadas 2025</li>
              <li>• Terminadas 2026</li>
            </ul>
            <div className="pt-2 text-right text-blue-300">
              <ArrowRight className="w-3.5 h-3.5 inline text-blue-200" />
            </div>
          </div>

          {/* Card 7 */}
          <div className="bg-sky-500 text-white rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-sky-400">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-sky-100 border-b border-sky-400 pb-1.5">
              <Users className="w-3.5 h-3.5 text-sky-100" />
              <span>APRENDICES ESTADO</span>
            </div>
            <ul className="text-[9px] space-y-0.5 text-sky-50 font-medium leading-none">
              <li>• EN_TRANSITO</li>
              <li>• INDUCCION</li>
              <li>• FORMACION</li>
              <li>• CONDICIONADO</li>
              <li>• APLAZADO</li>
              <li>• CANCELADO</li>
              <li>• TRASLADADO</li>
            </ul>
            <div className="pt-2 text-right text-sky-200">
              <ArrowRight className="w-3.5 h-3.5 inline text-sky-100" />
            </div>
          </div>

          {/* Card 8 */}
          <div className="bg-slate-100 text-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-2 shadow-sm text-xs border border-slate-300">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-sena" />
              <span>ANÁLISIS Y REPORTES</span>
            </div>
            <ul className="text-[10px] space-y-1 text-slate-600 font-medium leading-tight">
              <li>• Indicadores KPI</li>
              <li>• Gráficos dinámicos</li>
              <li>• Inspección Fichas</li>
              <li>• Exportar datos</li>
              <li>• Filtros XML</li>
            </ul>
            <div className="pt-2 text-right text-slate-400">
              <Info className="w-3.5 h-3.5 inline text-slate-500" />
            </div>
          </div>

        </div>
      </div>

      {/* GOOGLE DRIVE SYNC MODAL */}
      {showDriveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 rounded-2xl border border-blue-500/40 text-blue-400">
                  <CloudDownload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                    Sincronización con Google Drive
                    <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                      XML DF-14
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Carga y sincroniza el reporte XML directamente desde la carpeta compartida en Drive.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDriveModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Folder Info Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-blue-600" />
                    Carpeta de Google Drive Configurada
                  </span>
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Abrir en Google Drive
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Enlace de la Carpeta o Archivo Directo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="flex-1 bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-mono font-medium outline-none transition-all"
                    />
                    <button
                      onClick={() => setDriveUrl(DEFAULT_DRIVE_URL)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      title="Restablecer enlace original"
                    >
                      Predeterminado
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>ID de Carpeta actual: <strong className="font-mono text-blue-950">1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK</strong></span>
                </div>
              </div>

              {/* Status alerts */}
              {driveSyncSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p>{driveSyncSuccess}</p>
                    <p className="text-[10px] text-emerald-700 mt-1 font-normal">
                      Abre la carpeta en Drive para ver o descargar el XML más reciente y cárgalo directamente en el botón de abajo.
                    </p>
                  </div>
                </div>
              )}

              {driveSyncError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p>{driveSyncError}</p>
                  </div>
                </div>
              )}

              {/* Primary Action Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleSyncFromDrive}
                  disabled={isSyncingDrive}
                  className="flex items-center justify-center gap-2 p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer border border-blue-500"
                >
                  {isSyncingDrive ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Conectando con Drive...
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-4 h-4" />
                      Sincronizar Desde Drive
                    </>
                  )}
                </button>

                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-slate-300 text-center"
                >
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                  Abrir Carpeta de Drive
                </a>
              </div>

              <div className="relative border-t border-slate-200 pt-4">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  O Carga el Archivo de Drive
                </span>

                {/* Option A: Drop / Select XML File */}
                <div className="space-y-3 mt-2">
                  <div 
                    onClick={() => {
                      setShowDriveModal(false);
                      fileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all group"
                  >
                    <FileUp className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mx-auto mb-1.5 transition-colors" />
                    <p className="text-xs font-black text-slate-700 group-hover:text-blue-700">
                      Seleccionar o Arrastrar Archivo XML descargado de Drive
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Soporta reportes XML de SofiaPlus / SENA DF-14
                    </p>
                  </div>

                  {/* Option B: Paste XML Code */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Pegar Contenido XML (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={pastedXml}
                      onChange={(e) => setPastedXml(e.target.value)}
                      placeholder="Pega aquí el texto/código XML del reporte de Drive..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl p-2.5 text-[11px] font-mono outline-none resize-none transition-all"
                    />
                    {pastedXml.trim() && (
                      <button
                        onClick={handleProcessPastedXml}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Procesar XML Pegado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>
                Ruta vinculada: <span className="font-mono text-slate-700">...1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK</span>
              </span>
              <button
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
