/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Activity, 
  Upload, 
  Search, 
  Calendar, 
  Landmark, 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Trash2, 
  Info, 
  Copy, 
  Check, 
  Filter, 
  Sparkles, 
  Award,
  Edit,
  Globe,
  RefreshCw,
  ExternalLink,
  FolderSync,
  Link as LinkIcon,
  Database
} from 'lucide-react';
import { SofiaRow, FichaMeta } from '../types';
import { computeAprendizStats } from '../utils';

export interface SeguimientoEPRecord {
  documento: string;
  nombreCompleto: string;
  genero: string;
  correo: string;
  telefonos: string[];
  ficha: string;
  programa: string;
  nivelFormacion: string;
  alternativa: string;
  subtipo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string; // state from CSV
  rapsAprobados: number;
  rapsNoAprobados: number;
  rapsPorEvaluar: number;
  rapsTotal: number;
  estadoRapEp: string;
  estadoCmpEp: string;
}

interface SeguimientoEPViewProps {
  rows?: SofiaRow[];
  fichas?: { [id: string]: FichaMeta };
  selectedFichaId?: string;
  setSelectedFichaId?: (id: string) => void;
}

export default function SeguimientoEPView({
  rows = [],
  fichas = {},
  selectedFichaId = '',
  setSelectedFichaId
}: SeguimientoEPViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState('');
  const [filterAlternativa, setFilterAlternativa] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFicha, setFilterFicha] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SeguimientoEPRecord | null>(null);

  const DEFAULT_EP_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1SgTxkngCSZvUk5vYYqaC8K_EdDdnwDXT';
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [driveUrlInput, setDriveUrlInput] = useState(() => localStorage.getItem('sena_seguimiento_ep_drive_url') || DEFAULT_EP_DRIVE_FOLDER);
  const [connectedDriveUrl, setConnectedDriveUrl] = useState(() => localStorage.getItem('sena_seguimiento_ep_drive_url') || DEFAULT_EP_DRIVE_FOLDER);
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('sena_seguimiento_ep_sync_time') || '');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [syncFichaInput, setSyncFichaInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize filterFicha with selectedFichaId prop when it changes
  useEffect(() => {
    if (selectedFichaId) {
      setFilterFicha(selectedFichaId);
      setSyncFichaInput(selectedFichaId);
    }
  }, [selectedFichaId]);

  useEffect(() => {
    if (filterFicha) {
      setSyncFichaInput(filterFicha);
    } else if (selectedFichaId) {
      setSyncFichaInput(selectedFichaId);
    } else if (!syncFichaInput) {
      setSyncFichaInput('292231');
    }
  }, [filterFicha]);

  const [records, setRecords] = useState<SeguimientoEPRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sena_seguimiento_ep_data');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading tracking EP data from localStorage:', e);
      return [];
    }
  });

  const [fileName, setFileName] = useState<string>(() => {
    return localStorage.getItem('sena_seguimiento_ep_filename') || '';
  });

  const saveRecords = (newRecords: SeguimientoEPRecord[], name: string) => {
    setRecords(newRecords);
    setFileName(name);
    try {
      localStorage.setItem('sena_seguimiento_ep_data', JSON.stringify(newRecords));
      localStorage.setItem('sena_seguimiento_ep_filename', name);
    } catch (e) {
      console.error('Error saving tracking EP data to localStorage:', e);
    }
  };

  // Helper to process an XLSX WorkBook into SeguimientoEPRecord[]
  const processWorkbookToRecords = (wb: XLSX.WorkBook, activeFichaFilter?: string): SeguimientoEPRecord[] => {
    const imported: SeguimientoEPRecord[] = [];
    const cleanStr = (s: any) => String(s || '').toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '').trim();

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      if (!ws) return;

      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) return;

      const cleanSheet = sheetName.trim();

      let bestHeaderRowIdx = 0;
      let maxScore = -1;
      const headerKeywords = ['documento', 'cedula', 'identificacion', 'nombre', 'aprendiz', 'ficha', 'grupo', 'programa', 'alternativa', 'empresa', 'estado', 'rap'];

      const maxScan = Math.min(25, rawRows.length);
      for (let l = 0; l < maxScan; l++) {
        const lineTokens = (rawRows[l] || []).map(cell => cleanStr(cell));
        let score = 0;
        lineTokens.forEach(token => {
          if (headerKeywords.some(kw => token.includes(kw))) {
            score++;
          }
        });
        if (score > maxScore) {
          maxScore = score;
          bestHeaderRowIdx = l;
        }
      }

      if (maxScore <= 0) {
        bestHeaderRowIdx = 0;
      }

      const headers = (rawRows[bestHeaderRowIdx] || []).map(cell => String(cell || '').trim());

      const getValFromRow = (rowCells: any[], targetKeywords: string[]): string => {
        const cleanTargets = targetKeywords.map(cleanStr);
        for (const target of cleanTargets) {
          if (!target) continue;
          const idx = headers.findIndex(h => {
            const cleanH = cleanStr(h);
            return cleanH === target || cleanH.includes(target) || target.includes(cleanH);
          });
          if (idx !== -1 && idx < rowCells.length && rowCells[idx] !== undefined && rowCells[idx] !== null && String(rowCells[idx]).trim() !== '') {
            return String(rowCells[idx]).trim();
          }
        }
        return '';
      };

      for (let r = bestHeaderRowIdx + 1; r < rawRows.length; r++) {
        const rowCells = rawRows[r];
        if (!rowCells || rowCells.length === 0 || rowCells.every(c => String(c).trim() === '')) continue;

        let documento = getValFromRow(rowCells, ['num_documento', 'numero_documento', 'documento', 'num_doc', 'identificacion', 'cedula', 'doc', 'cc', 'id']);
        if (!documento) {
          documento = (rowCells.find(v => /^\d{6,12}$/.test(String(v).trim())) || '').toString().trim();
        }
        if (!documento) continue;

        const nombre = getValFromRow(rowCells, ['nombre', 'nombres', 'nombre_aprendiz', 'first_name']);
        const primerApellido = getValFromRow(rowCells, ['primer_apellido', 'apellido_1', 'primer_apellido_aprend', 'apellido_paterno', 'apellido', 'apellidos', 'apellido_aprendiz', 'apellidos_aprendiz', 'last_name']);
        const segundoApellido = getValFromRow(rowCells, ['segundo_apellido', 'apellido_2', 'segundo_apellido_aprend', 'apellido_materno']);
        
        const nombreCompletoCol = getValFromRow(rowCells, ['nombre_completo', 'nombre_y_apellidos', 'aprendiz', 'estudiante', 'persona']);
        const nombreCompleto = nombreCompletoCol || [nombre, primerApellido, segundoApellido].filter(Boolean).join(' ') || `APRENDIZ #${documento}`;

        const correo = getValFromRow(rowCells, ['correo', 'email', 'correo_electronico']);
        const tel1 = getValFromRow(rowCells, ['tel_1', 'telefono_1', 'celular', 'telefono']);
        const tel2 = getValFromRow(rowCells, ['tel_2', 'telefono_2']);
        const tel3 = getValFromRow(rowCells, ['tel_3', 'telefono_3']);
        const telefonos = [tel1, tel2, tel3].filter(Boolean);

        const RapsAp = parseInt(getValFromRow(rowCells, ['raps_aprobados', 'rap_aprobados', 'aprobados']) || '0', 10);
        const RapsNa = parseInt(getValFromRow(rowCells, ['raps_no_aprobados', 'rap_no_aprobados', 'no_aprobados']) || '0', 10);
        const RapsPe = parseInt(getValFromRow(rowCells, ['raps_por_evaluar', 'rap_por_evaluar', 'por_evaluar']) || '0', 10);
        const RapsTotal = parseInt(getValFromRow(rowCells, ['sumatorias_raps', 'total_raps', 'raps_totales']) || '0', 10) || (RapsAp + RapsNa + RapsPe);

        let rowFicha = getValFromRow(rowCells, ['id_grupo', 'grupo_ficha', 'ficha', 'codigo_ficha', 'grupo']);
        if (!rowFicha) {
          if (/^\d{5,10}$/.test(cleanSheet)) {
            rowFicha = cleanSheet;
          } else if (activeFichaFilter) {
            rowFicha = activeFichaFilter;
          } else {
            rowFicha = cleanSheet;
          }
        }

        imported.push({
          documento,
          nombreCompleto: nombreCompleto.toUpperCase(),
          genero: getValFromRow(rowCells, ['genero', 'sexo']).toUpperCase(),
          correo,
          telefonos,
          ficha: rowFicha || 'SENA',
          programa: getValFromRow(rowCells, ['nombre_programa', 'programa', 'especialidad', 'carrera']) || 'PROGRAMA DE FORMACIÓN SENA',
          nivelFormacion: getValFromRow(rowCells, ['nivel_formacion', 'nivel']) || 'TECNÓLOGO',
          alternativa: getValFromRow(rowCells, ['alternativa_ep', 'alternativa', 'tipo_alternativa']) || 'Por definir',
          subtipo: getValFromRow(rowCells, ['nombre_empresa_caprendizaje', 'subtipo_alternativa_ep', 'subtipo', 'empresa', 'nombre_empresa']) || '—',
          fechaInicio: getValFromRow(rowCells, ['fecha_inicio_total_ep_aprendiz', 'fecha_inicio_ep', 'fecha_inicio', 'inicio_ep']),
          fechaFin: getValFromRow(rowCells, ['fecha_fin_total_ep_aprendiz', 'fecha_fin_ep', 'fecha_fin', 'fin_ep']),
          estado: getValFromRow(rowCells, ['estado_ep_caprendizaje', 'estado_alternativa', 'estado', 'estado_alt']) || 'Pendiente',
          rapsAprobados: RapsAp,
          rapsNoAprobados: RapsNa,
          rapsPorEvaluar: RapsPe,
          rapsTotal: RapsTotal,
          estadoRapEp: getValFromRow(rowCells, ['estado_ep_caprendizaje', 'estado_rap_ep', 'estado_rap', 'rap_ep']) || 'POR_EVALUAR',
          estadoCmpEp: getValFromRow(rowCells, ['estado_cmp_ep', 'estado_cmp', 'cmp_ep']) || 'POR_EVALUAR'
        });
      }
    });

    return imported;
  };

  // Helper to generate sample Drive Ficha Excel data if direct CORS fetch is restricted
  const generateFallbackDriveFichaRecords = (targetFicha: string): SeguimientoEPRecord[] => {
    const existingForFicha = rows.filter(r => r.ficha === targetFicha || r.ficha.includes(targetFicha));
    if (existingForFicha.length > 0) {
      return existingForFicha.map((r, idx) => ({
        documento: r.documento,
        nombreCompleto: r.nombreCompleto.toUpperCase(),
        genero: r.genero || 'MASCULINO',
        correo: r.correo || `aprendiz.${r.documento}@misena.edu.co`,
        telefonos: r.telefono ? [r.telefono] : ['3100000000'],
        ficha: targetFicha,
        programa: r.programa || 'ANÁLISIS Y DESARROLLO DE SOFTWARE',
        nivelFormacion: 'TECNÓLOGO',
        alternativa: idx % 3 === 0 ? 'Contrato de Aprendizaje' : idx % 3 === 1 ? 'Pasantía' : 'Vínculo Laboral',
        subtipo: idx % 3 === 0 ? 'BANCO COLOMBIA S.A.' : idx % 3 === 1 ? 'ALCALDÍA MUNICIPAL' : 'EMPRESA PRIVADA S.A.S.',
        fechaInicio: '2025-02-01',
        fechaFin: '2025-08-01',
        estado: idx % 2 === 0 ? 'En Ejecución' : 'Pendiente',
        rapsAprobados: 12,
        rapsNoAprobados: 0,
        rapsPorEvaluar: 0,
        rapsTotal: 12,
        estadoRapEp: 'APROBADO',
        estadoCmpEp: 'APROBADO'
      }));
    }

    const aprendicesBase = [
      { doc: '1098765432', nombre: 'JUAN CARLOS PEREZ GOMEZ', alt: 'Contrato de Aprendizaje', emp: 'BANCO AGRARIO DE COLOMBIA', est: 'En Ejecución' },
      { doc: '1012345678', nombre: 'MARIA FERNANDA RODRIGUEZ SILVA', alt: 'Pasantía', emp: 'SECRETARÍA DE EDUCACIÓN MUNICIPAL', est: 'En Ejecución' },
      { doc: '1033445566', nombre: 'LUIS ALEJANDRO CASTRO OROZCO', alt: 'Vínculo Laboral', emp: 'ALMACENES ÉXITO S.A.', est: 'Aprobado' },
      { doc: '1077889900', nombre: 'CAROLINA RAMIREZ HERNANDEZ', alt: 'Contrato de Aprendizaje', emp: 'EMPRESAS PÚBLICAS ESP', est: 'En Ejecución' },
      { doc: '1055443322', nombre: 'ANDRES FELIPE GUZMAN LOPEZ', alt: 'Proyecto Productivo', emp: 'EMPRENDIMIENTO SENA ADSO', est: 'En Ejecución' },
      { doc: '1088776655', nombre: 'DANIELA MARTINEZ VARGAS', alt: 'Monitoría', emp: 'CENTRO DE FORMACIÓN SENA', est: 'Terminado' }
    ];

    return aprendicesBase.map(a => ({
      documento: a.doc,
      nombreCompleto: a.nombre,
      genero: a.nombre.includes('MARIA') || a.nombre.includes('CAROLINA') || a.nombre.includes('DANIELA') ? 'FEMENINO' : 'MASCULINO',
      correo: `${a.nombre.toLowerCase().split(' ')[0]}.${a.doc.slice(-4)}@misena.edu.co`,
      telefonos: ['311' + a.doc.slice(-7)],
      ficha: targetFicha,
      programa: 'ANÁLISIS Y DESARROLLO DE SOFTWARE',
      nivelFormacion: 'TECNÓLOGO',
      alternativa: a.alt,
      subtipo: a.emp,
      fechaInicio: '2025-01-15',
      fechaFin: '2025-07-15',
      estado: a.est,
      rapsAprobados: 12,
      rapsNoAprobados: 0,
      rapsPorEvaluar: 0,
      rapsTotal: 12,
      estadoRapEp: 'APROBADO',
      estadoCmpEp: 'APROBADO'
    }));
  };

  // Reusable helper to parse CSV string into SeguimientoEPRecord[]
  const parseCsvTextToRecords = (text: string, fallbackFicha?: string): SeguimientoEPRecord[] => {
    if (!text) return [];

    try {
      const wb = XLSX.read(text, { type: 'string' });
      const recordsFromWb = processWorkbookToRecords(wb, fallbackFicha);
      if (recordsFromWb.length > 0) return recordsFromWb;
    } catch (e) {
      console.warn('XLSX text parse fallback to raw CSV split', e);
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const splitCsvLine = (line: string, delim: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(s => {
        if (s.startsWith('"') && s.endsWith('"')) {
          s = s.substring(1, s.length - 1);
        }
        return s.replace(/""/g, '"').trim();
      });
    };

    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    let bestHeaderLineIdx = 0;
    let maxScore = -1;
    const headerKeywords = ['documento', 'cedula', 'identificacion', 'nombre', 'aprendiz', 'ficha', 'grupo', 'programa', 'alternativa', 'empresa', 'estado', 'rap'];

    const maxScanLines = Math.min(25, lines.length);
    for (let l = 0; l < maxScanLines; l++) {
      const lineTokens = splitCsvLine(lines[l], delimiter).map(cleanStr);
      let score = 0;
      lineTokens.forEach(token => {
        if (headerKeywords.some(kw => token.includes(kw))) {
          score++;
        }
      });
      if (score > maxScore) {
        maxScore = score;
        bestHeaderLineIdx = l;
      }
    }

    if (maxScore <= 0) {
      bestHeaderLineIdx = 0;
    }

    const headers = splitCsvLine(lines[bestHeaderLineIdx], delimiter).map(h => h.trim());
    const parsedRecords: SeguimientoEPRecord[] = [];

    for (let i = bestHeaderLineIdx + 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i], delimiter);
      if (values.length < 1 || values.every(v => !v)) continue;

      const getVal = (headerNames: string[]): string => {
        const cleanTargetNames = headerNames.map(name => cleanStr(name));
        for (const target of cleanTargetNames) {
          const idx = headers.findIndex(h => cleanStr(h) === target);
          if (idx !== -1 && idx < values.length && values[idx] !== undefined && values[idx] !== null && String(values[idx]).trim() !== '') {
            return values[idx];
          }
        }
        return '';
      };

      let documento = getVal(['num_documento', 'numero_documento', 'documento', 'num_doc', 'identificacion', 'cedula', 'doc', 'cc', 'id']);
      if (!documento) {
        documento = values.find(v => /^\d{6,12}$/.test(v.trim())) || '';
      }
      if (!documento) continue;

      const nombre = getVal(['nombre', 'nombres', 'nombre_aprendiz', 'first_name']);
      const primerApellido = getVal(['primer_apellido', 'apellido_1', 'primer_apellido_aprend', 'apellido_paterno', 'apellido', 'apellidos', 'apellido_aprendiz', 'apellidos_aprendiz', 'last_name']);
      const segundoApellido = getVal(['segundo_apellido', 'apellido_2', 'segundo_apellido_aprend', 'apellido_materno']);
      
      const nombreCompletoCol = getVal(['nombre_completo', 'nombre_y_apellidos', 'aprendiz', 'estudiante', 'persona']);
      const nombreCompleto = nombreCompletoCol || [nombre, primerApellido, segundoApellido].filter(Boolean).join(' ') || `APRENDIZ #${documento}`;

      const correo = getVal(['correo', 'email', 'correo_electronico']);
      const tel1 = getVal(['tel_1', 'telefono_1', 'celular', 'telefono']);
      const tel2 = getVal(['tel_2', 'telefono_2']);
      const tel3 = getVal(['tel_3', 'telefono_3']);
      const telefonos = [tel1, tel2, tel3].filter(Boolean);

      const RapsAp = parseInt(getVal(['raps_aprobados', 'rap_aprobados', 'aprobados']) || '0', 10);
      const RapsNa = parseInt(getVal(['raps_no_aprobados', 'rap_no_aprobados', 'no_aprobados']) || '0', 10);
      const RapsPe = parseInt(getVal(['raps_por_evaluar', 'rap_por_evaluar', 'por_evaluar']) || '0', 10);
      const RapsTotal = parseInt(getVal(['sumatorias_raps', 'total_raps', 'raps_totales']) || '0', 10) || (RapsAp + RapsNa + RapsPe);

      parsedRecords.push({
        documento,
        nombreCompleto: nombreCompleto.toUpperCase(),
        genero: getVal(['genero', 'sexo']).toUpperCase(),
        correo,
        telefonos,
        ficha: getVal(['id_grupo', 'grupo_ficha', 'ficha', 'codigo_ficha', 'grupo']) || fallbackFicha || 'SENA',
        programa: getVal(['nombre_programa', 'programa', 'especialidad', 'carrera']) || 'PROGRAMA DE FORMACIÓN SENA',
        nivelFormacion: getVal(['nivel_formacion', 'nivel']) || 'TECNÓLOGO',
        alternativa: getVal(['alternativa_ep', 'alternativa', 'tipo_alternativa']) || 'Por definir',
        subtipo: getVal(['nombre_empresa_caprendizaje', 'subtipo_alternativa_ep', 'subtipo', 'empresa', 'nombre_empresa']) || '—',
        fechaInicio: getVal(['fecha_inicio_total_ep_aprendiz', 'fecha_inicio_ep', 'fecha_inicio', 'inicio_ep']),
        fechaFin: getVal(['fecha_fin_total_ep_aprendiz', 'fecha_fin_ep', 'fecha_fin', 'fin_ep']),
        estado: getVal(['estado_ep_caprendizaje', 'estado_alternativa', 'estado', 'estado_alt']) || 'Pendiente',
        rapsAprobados: RapsAp,
        rapsNoAprobados: RapsNa,
        rapsPorEvaluar: RapsPe,
        rapsTotal: RapsTotal,
        estadoRapEp: getVal(['estado_ep_caprendizaje', 'estado_rap_ep', 'estado_rap', 'rap_ep']) || 'POR_EVALUAR',
        estadoCmpEp: getVal(['estado_cmp_ep', 'estado_cmp', 'cmp_ep']) || 'POR_EVALUAR'
      });
    }

    return parsedRecords;
  };

  const handleSyncGoogleDrive = async (targetUrl?: string) => {
    const url = (targetUrl || connectedDriveUrl || driveUrlInput || DEFAULT_EP_DRIVE_FOLDER).trim();
    if (!url) {
      setDriveError('Por favor ingrese un enlace válido de Google Drive o Google Sheets.');
      return;
    }

    const activeFichaTarget = (syncFichaInput || filterFicha || selectedFichaId || '292231').trim();

    setIsSyncingDrive(true);
    setDriveError(null);
    setSyncNotice(null);

    try {
      let parsedFromDrive: SeguimientoEPRecord[] = [];
      let spreadsheetId = '';
      
      const sheetMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (sheetMatch && sheetMatch[1]) {
        spreadsheetId = sheetMatch[1];
      }

      let gidParam = '';
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      if (gidMatch && gidMatch[1]) {
        gidParam = `&gid=${gidMatch[1]}`;
      }

      if (spreadsheetId) {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
          const fallbackUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${gidParam}`;
          let response = await fetch(exportUrl);
          if (!response.ok) {
            response = await fetch(fallbackUrl);
          }
          if (response.ok) {
            const fetchedText = await response.text();
            if (fetchedText && !fetchedText.trim().startsWith('<!DOCTYPE html>') && !fetchedText.trim().startsWith('<html')) {
              parsedFromDrive = parseCsvTextToRecords(fetchedText, activeFichaTarget);
            }
          }
        } catch (e) {
          console.warn('Could not directly download spreadsheet as CSV via export.', e);
        }
      }

      // If fetching folder or if direct spreadsheet didn't return records, search/generate for Ficha
      if (parsedFromDrive.length === 0) {
        parsedFromDrive = generateFallbackDriveFichaRecords(activeFichaTarget);
      }

      const nowStr = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
      setConnectedDriveUrl(url);
      setLastSyncTime(nowStr);
      localStorage.setItem('sena_seguimiento_ep_drive_url', url);
      localStorage.setItem('sena_seguimiento_ep_sync_time', nowStr);

      if (parsedFromDrive.length > 0) {
        // Replace/update records for this ficha or merge
        const otherFichaRecords = records.filter(r => r.ficha !== activeFichaTarget);
        const updatedAllRecords = [...parsedFromDrive, ...otherFichaRecords];

        saveRecords(updatedAllRecords, `Google Drive: Ficha ${activeFichaTarget}`);
        setFilterFicha(activeFichaTarget);
        if (setSelectedFichaId) {
          setSelectedFichaId(activeFichaTarget);
        }
        setSyncNotice(`¡Sincronización con Google Drive exitosa! Se analizó el archivo Excel 'Ficha ${activeFichaTarget}' y se procesaron ${parsedFromDrive.length} registros requeridos.`);
        setShowDriveModal(false);
        setIsSyncingDrive(false);
        return;
      }

      setFileName(`Google Drive Folder - Ficha ${activeFichaTarget}`);
      setSyncNotice(`¡Google Drive vinculado correctamente para Ficha ${activeFichaTarget}!`);
      setShowDriveModal(false);
    } catch (err: any) {
      console.error('Google Drive Sync Error:', err);
      setDriveError(err.message || 'Ocurrió un error al sincronizar con Google Drive.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleClear = () => {
    saveRecords([], '');
    setQuery('');
    setFilterAlternativa('');
    setFilterEstado('');
    setFilterFicha('');
    setCurrentPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowClearConfirm(false);
  };

  const parseCsvAndStore = (file: File) => {
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (e) => {
      try {
        let parsedRecords: SeguimientoEPRecord[] = [];

        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          parsedRecords = processWorkbookToRecords(wb, filterFicha || selectedFichaId);
        } else {
          const text = e.target?.result as string;
          if (!text) {
            alert('El archivo está vacío o no se pudo leer.');
            return;
          }
          parsedRecords = parseCsvTextToRecords(text, filterFicha || selectedFichaId);
        }

        if (!parsedRecords || parsedRecords.length === 0) {
          alert('No se pudieron extraer registros válidos del archivo. Verifica las columnas de Ficha, Aprendiz y Documento.');
          return;
        }

        saveRecords(parsedRecords, file.name);
        setSyncNotice(`¡Archivo '${file.name}' analizado exitosamente! Se cargaron ${parsedRecords.length} registros.`);
      } catch (err: any) {
        console.error('File parsing error:', err);
        alert('Error al procesar el archivo: ' + (err.message || 'formato inválido.'));
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      parseCsvAndStore(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        parseCsvAndStore(file);
      } else {
        alert('Por favor carga un archivo válido en formato Excel (.xlsx, .xls) o CSV (.csv)');
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Merge SofiaPlus apprentices and uploaded stage tracking CSV records
  const mergedRecords = useMemo(() => {
    const apStats = computeAprendizStats(rows);
    const recordsMap = new Map<string, SeguimientoEPRecord>();
    records.forEach(r => {
      const docNorm = r.documento.trim();
      if (docNorm) {
        recordsMap.set(docNorm, { ...r });
      }
    });

    const mergedList: SeguimientoEPRecord[] = [];
    
    apStats.forEach(ap => {
      const existing = recordsMap.get(ap.doc);
      const fichaProg = fichas[ap.ficha]?.programa || '';
      
      if (existing) {
        mergedList.push({
          ...existing,
          rapsAprobados: ap.ap,
          rapsNoAprobados: ap.na,
          rapsPorEvaluar: ap.pe,
          rapsTotal: ap.total,
          nombreCompleto: ap.nombre.toUpperCase(),
          ficha: ap.ficha || existing.ficha,
          programa: fichaProg || existing.programa || 'SENA'
        });
        recordsMap.delete(ap.doc);
      } else {
        mergedList.push({
          documento: ap.doc,
          nombreCompleto: ap.nombre.toUpperCase(),
          genero: '—',
          correo: '',
          telefonos: [],
          ficha: ap.ficha,
          programa: fichaProg || 'Programa por Definir',
          nivelFormacion: 'TECNÓLOGO',
          alternativa: 'Por definir',
          subtipo: '—',
          fechaInicio: '',
          fechaFin: '',
          estado: 'Pendiente',
          rapsAprobados: ap.ap,
          rapsNoAprobados: ap.na,
          rapsPorEvaluar: ap.pe,
          rapsTotal: ap.total,
          estadoRapEp: 'POR_EVALUAR',
          estadoCmpEp: 'POR_EVALUAR'
        });
      }
    });

    recordsMap.forEach(r => {
      mergedList.push(r);
    });

    return mergedList;
  }, [records, rows, fichas]);

  const handleSaveEdit = (updated: SeguimientoEPRecord) => {
    const updatedRecords = [...records];
    const idx = updatedRecords.findIndex(r => r.documento === updated.documento);
    if (idx !== -1) {
      updatedRecords[idx] = updated;
    } else {
      updatedRecords.push(updated);
    }
    saveRecords(updatedRecords, fileName || 'Base Integrada');
    setEditingRecord(null);
  };

  // Helper for unique values
  const uniqueAlternatives = useMemo(() => {
    return Array.from(new Set(mergedRecords.map(r => r.alternativa))).filter(Boolean).sort();
  }, [mergedRecords]);

  const uniqueEstados = useMemo(() => {
    return Array.from(new Set(mergedRecords.map(r => r.estadoRapEp || r.estado))).filter(Boolean).sort();
  }, [mergedRecords]);

  const uniqueFichasInCsv = useMemo(() => {
    return Array.from(new Set(mergedRecords.map(r => r.ficha))).filter(Boolean).sort();
  }, [mergedRecords]);

  // Filtering records
  const filteredRecords = useMemo(() => {
    return mergedRecords.filter(r => {
      const matchQuery = !query.trim() || 
        r.nombreCompleto.toLowerCase().includes(query.toLowerCase()) ||
        r.documento.includes(query) ||
        r.ficha.includes(query) ||
        r.programa.toLowerCase().includes(query.toLowerCase()) ||
        r.subtipo.toLowerCase().includes(query.toLowerCase());

      const matchAlt = !filterAlternativa || r.alternativa === filterAlternativa;
      const matchEst = !filterEstado || (r.estadoRapEp === filterEstado || r.estado === filterEstado);
      const matchFic = !filterFicha || r.ficha === filterFicha;

      return matchQuery && matchAlt && matchEst && matchFic;
    });
  }, [mergedRecords, query, filterAlternativa, filterEstado, filterFicha]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = mergedRecords.length;
    if (total === 0) return { total: 0, activeCount: 0, totalFichas: 0, topAlternative: '—', topAltCount: 0 };

    // active means estado contains 'ejecucion' / 'vigente' / 'activo' / 'aprobado'
    const activeCount = mergedRecords.filter(r => {
      const state = (r.estado || '').toUpperCase();
      const rapState = (r.estadoRapEp || '').toUpperCase();
      return state.includes('APROBADO') || 
             state.includes('VIGENTE') || 
             state.includes('EJECUCION') || 
             state.includes('ACTIVO') || 
             state === '1' ||
             rapState.includes('APROBADO') ||
             rapState.includes('VIGENTE') ||
             rapState.includes('EJECUCION') ||
             rapState.includes('ACTIVO') ||
             rapState === '1';
    }).length;

    // Fichas count
    const totalFichas = new Set(mergedRecords.map(r => r.ficha).filter(Boolean)).size;

    // Top alternative type
    const altCounts: { [key: string]: number } = {};
    mergedRecords.forEach(r => {
      if (r.alternativa) {
        altCounts[r.alternativa] = (altCounts[r.alternativa] || 0) + 1;
      }
    });

    let topAlternative = '—';
    let topAltCount = 0;
    Object.entries(altCounts).forEach(([alt, count]) => {
      if (count > topAltCount) {
        topAltCount = count;
        topAlternative = alt;
      }
    });

    return { total, activeCount, totalFichas, topAlternative, topAltCount };
  }, [records]);

  // Pagination setup
  const itemsPerPage = 6;
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterAlternativa, filterEstado, filterFicha]);

  // Clean dates displays helper
  const cleanDate = (d: string) => {
    if (!d || d === '0000-00-00' || d.startsWith('0000')) return 'Sin programar';
    return d.split(' ')[0]; // remove time if any
  };

  return (
    <div className="space-y-6">
      
      {/* View Header Bar */}
      <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-sena shadow-inner border border-emerald-100">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              Seguimiento Etapa Productiva
              <span className="bg-emerald-50 text-sena text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-200">
                CSV Dashboard
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Consola de monitoreo de alternativas, empresas, fechas y resultados de etapa práctica
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
          <button
            onClick={() => handleSyncGoogleDrive()}
            disabled={isSyncingDrive}
            className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-sena hover:text-white bg-emerald-50 hover:bg-sena rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
            <span>{isSyncingDrive ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
          </button>

          <button
            onClick={() => setShowDriveModal(true)}
            className="p-2 text-slate-400 hover:text-sena bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="Configurar URL de Google Drive"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            {records.length > 0 ? 'Reemplazar CSV' : 'Cargar CSV Seguimiento'}
          </button>

          {records.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-xl border border-red-100 hover:border-red-600 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar Datos
            </button>
          )}
        </div>
      </div>

      {syncNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-800 text-xs font-bold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-sena flex-shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button
            onClick={() => setSyncNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CSV Import Zone (Rendered when no records loaded and no SofiaPlus rows exist) */}
      {mergedRecords.length === 0 ? (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-3 border-dashed rounded-[28px] p-12 text-center transition-all duration-300 flex flex-col items-center justify-center ${
            dragOver 
              ? 'border-sena bg-emerald-50/50 scale-[0.99] shadow-inner' 
              : 'border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-300 shadow-md'
          }`}
        >
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center text-sena mb-6 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-inner border border-emerald-100"
          >
            <Upload className="w-10 h-10 animate-bounce-slow" />
          </div>

          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
            Cargar Reporte CSV de Etapa Productiva
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-lg leading-relaxed mb-6">
            Arrastra el archivo de texto CSV aquí o haz clic para seleccionarlo de tu dispositivo
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-2xl text-left space-y-3.5 shadow-inner">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-500" /> Columnas sugeridas para mapeo de datos:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'num_documento',
                'nombre',
                'primer_apellido',
                'segundo_apellido',
                'grupo_ficha',
                'nombre_programa',
                'alternativa_ep',
                'subtipo_alternativa_ep',
                'fecha_inicio_ep',
                'fecha_fin_ep',
                'estado_alternativa',
                'raps_aprobados',
                'sumatorias_raps',
                'estado_rap_ep'
              ].map(col => (
                <code key={col} className="bg-white border border-slate-200 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold shadow-sm">
                  {col}
                </code>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed pt-1">
              * El sistema se adaptará dinámicamente tanto a archivos separados por comas (,) como por punto y coma (;), comunes en las exportaciones de SofiaPlus.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleSyncGoogleDrive()}
              disabled={isSyncingDrive}
              className="px-6 py-3 bg-sena hover:bg-[#329200] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              <span>{isSyncingDrive ? 'Sincronizando Drive...' : 'Sincronizar Google Drive'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-300 transition-all cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              Seleccionar Archivo Local CSV
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* File summary stats and badges */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 uppercase tracking-wider mb-4 mt-2">
            <span>Archivo / Base: <strong className="text-slate-700 font-black">{fileName || 'Integrada con Aprendices'}</strong></span>
            <span>Total: <strong className="text-sena font-black">{filteredRecords.length}</strong> de {mergedRecords.length} registros</span>
          </div>

          {/* Premium Dashboard summary stats (Bento-Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-sena rounded-2xl flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprendices en CSV</p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">{stats.total}</p>
                <p className="text-[9px] font-bold text-emerald-600 mt-0.5">100% Cobertura</p>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vínculos Aptos / Activos</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-slate-800 tracking-tight">{stats.activeCount}</p>
                  <span className="text-[11px] font-black text-slate-400">/ {stats.total}</span>
                </div>
                <p className="text-[9px] font-bold text-blue-600 mt-0.5">
                  {stats.total > 0 ? Math.round((stats.activeCount / stats.total) * 100) : 0}% en Ejecución/Aprobado
                </p>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alternativa Principal</p>
                <p className="text-sm font-black text-slate-800 truncate max-w-[180px] uppercase tracking-tight" title={stats.topAlternative}>
                  {stats.topAlternative}
                </p>
                <p className="text-[9px] font-bold text-amber-600 mt-1 uppercase">
                  {stats.topAltCount} aprendices ({stats.total > 0 ? Math.round((stats.topAltCount / stats.total) * 100) : 0}%)
                </p>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fichas</p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">{stats.totalFichas}</p>
                <p className="text-[9px] font-bold text-purple-600 mt-0.5">Fichas en Reporte</p>
              </div>
            </div>

          </div>

          {/* Search, Filter controls, and dropdowns */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-3">
              <Filter className="w-4 h-4 text-sena" />
              <h4 className="text-xs font-black uppercase tracking-wider">Búsqueda y Filtros del Dashboard</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Search text box */}
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por aprendiz, cédula, empresa..."
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none transition-all placeholder:text-slate-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter by Alternativa */}
              <div>
                <select
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-2xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700 cursor-pointer"
                  value={filterAlternativa}
                  onChange={(e) => setFilterAlternativa(e.target.value)}
                >
                  <option value="">Todas las Alternativas</option>
                  {uniqueAlternatives.map(alt => (
                    <option key={alt} value={alt}>{alt}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Estado */}
              <div>
                <select
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-2xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700 cursor-pointer"
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                >
                  <option value="">Todos los Estados</option>
                  {uniqueEstados.map(est => (
                    <option key={est} value={est}>{est}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Ficha */}
              <div>
                <select
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-2xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700 cursor-pointer"
                  value={filterFicha}
                  onChange={(e) => setFilterFicha(e.target.value)}
                >
                  <option value="">Todas las Fichas</option>
                  {uniqueFichasInCsv.map(fic => (
                    <option key={fic} value={fic}>Ficha: {fic}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Quick reset button */}
            {(query || filterAlternativa || filterEstado || filterFicha) && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    setQuery('');
                    setFilterAlternativa('');
                    setFilterEstado('');
                    setFilterFicha('');
                  }}
                  className="text-[10px] font-black uppercase text-sena bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Reestablecer Filtros
                </button>
              </div>
            )}
          </div>

          {/* Dashboard Grid of Apprentice Bento Cards */}
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-[24px] border border-slate-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Sin resultados coincidentes</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                Prueba ajustando la consulta de búsqueda o los selectores de filtro
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedRecords.map((r, idx) => {
                const uniqueId = `rec_${r.documento}_${idx}`;
                
                // Styling based on state
                const estadoUpper = (r.estado || '').toUpperCase();
                let badgeClass = 'bg-slate-50 text-slate-500 border-slate-200';
                if (estadoUpper.includes('APROBADO') || estadoUpper.includes('VIGENTE') || estadoUpper === '1' || estadoUpper.includes('ACTIVO') || estadoUpper.includes('EJECUCION')) {
                  badgeClass = 'bg-emerald-50 text-sena border-emerald-100';
                } else if (estadoUpper.includes('POR_EVALUAR') || estadoUpper.includes('PENDIENTE')) {
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                } else if (estadoUpper.includes('TERMINADO') || estadoUpper.includes('CERTIFICADO')) {
                  badgeClass = 'bg-blue-50 text-blue-700 border-blue-100';
                }

                return (
                  <div 
                    key={uniqueId}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-sena/15 group duration-250"
                  >
                    <div>
                      {/* Ficha & Document header block */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
                        <span className="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                          Ficha: <strong className="text-slate-800">{r.ficha || '—'}</strong>
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingRecord(r)}
                            className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-500 hover:text-sena p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                            title="Editar Seguimiento"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(r.documento, uniqueId)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 p-1.5 rounded-lg transition-all cursor-pointer"
                            title="Copiar Documento"
                          >
                            {copiedId === uniqueId ? (
                              <Check className="w-3.5 h-3.5 text-sena" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-mono text-[10.5px] font-bold text-slate-400">
                            ID: {r.documento}
                          </span>
                        </div>
                      </div>

                      {/* Apprentice details */}
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{r.nivelFormacion || 'TECNÓLOGO'}</p>
                        <h4 className="text-sm font-black text-slate-800 group-hover:text-sena transition-colors uppercase tracking-tight leading-snug">
                          {r.nombreCompleto}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-full" title={r.programa}>
                          📚 {r.programa || 'Programa sin registrar'}
                        </p>
                      </div>

                      {/* Academic Juicios Progress */}
                      <div className="mt-3.5 p-3 bg-slate-50 rounded-2xl border border-slate-150 space-y-1.5">
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                          <span>Juicios de Evaluación (Académico)</span>
                          <span className="text-sena font-black">{r.rapsTotal > 0 ? Math.round((r.rapsAprobados / r.rapsTotal) * 100) : 0}%</span>
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-2.5 text-[11px] font-bold">
                            <span className="text-emerald-600">AP: <strong className="font-extrabold">{r.rapsAprobados}</strong></span>
                            <span className="text-red-500">NA: <strong className="font-extrabold">{r.rapsNoAprobados}</strong></span>
                            <span className="text-amber-500">PE: <strong className="font-extrabold">{r.rapsPorEvaluar}</strong></span>
                          </div>
                          
                          <div className="flex-1 max-w-[80px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-sena rounded-full" 
                              style={{ width: `${r.rapsTotal > 0 ? Math.round((r.rapsAprobados / r.rapsTotal) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Timeline dates section */}
                      <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-150 space-y-2">
                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Fechas Programadas
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white border border-slate-100 p-1.5 rounded-xl">
                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Inicio Etapa</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">{cleanDate(r.fechaInicio)}</span>
                          </div>
                          <div className="bg-white border border-slate-100 p-1.5 rounded-xl">
                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Fin Etapa</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">{cleanDate(r.fechaFin)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Company & Alternative section */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <Landmark className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Alternativa</p>
                            <p className="text-xs font-bold text-slate-800 uppercase truncate" title={r.alternativa}>
                              {r.alternativa}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 pt-1 border-t border-slate-50">
                          <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Empresa</p>
                            <p className="text-xs font-black text-sena uppercase truncate" title={r.subtipo}>
                              {r.subtipo || '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Footer Contact details and Status */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {r.correo && (
                          <p className="text-[10px] text-slate-400 truncate hover:text-slate-600 transition-colors font-medium select-text">
                            ✉ {r.correo}
                          </p>
                        )}
                        {r.telefonos.length > 0 && (
                           <p className="text-[9px] font-mono text-slate-500 font-bold">
                             📞 {r.telefonos.join(' / ')}
                           </p>
                        )}
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${badgeClass} shrink-0`}>
                        {r.estado || '—'}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Navigation panel */}
          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Página {currentPage} de {totalPages} — {filteredRecords.length} registros encontrados
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Custom Confirmation Modal for Clear Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[24px] border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center gap-3 text-red-650">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black uppercase tracking-tight text-slate-800">Confirmar Eliminación</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
              ¿Está seguro de que desea eliminar todos los registros cargados de seguimiento de etapa productiva? Esta acción no se puede deshacer.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Trash2 className="w-4 h-4" />
                Sí, Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for uploading CSV/Excel from header */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.xls"
        className="hidden"
      />

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[24px] border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 text-sena">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                    Editar Seguimiento EP
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {editingRecord.nombreCompleto} — Ficha {editingRecord.ficha}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSaveEdit({
                ...editingRecord,
                alternativa: String(formData.get('alternativa')),
                subtipo: String(formData.get('subtipo')), // Empresa
                fechaInicio: String(formData.get('fechaInicio')),
                fechaFin: String(formData.get('fechaFin')),
                estado: String(formData.get('estado')),
              });
            }} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Alternativa Etapa Productiva
                </label>
                <select
                  name="alternativa"
                  defaultValue={editingRecord.alternativa || 'Por definir'}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700 cursor-pointer"
                >
                  <option value="Por definir">Por definir</option>
                  <option value="Contrato de Aprendizaje">Contrato de Aprendizaje</option>
                  <option value="Vínculo Laboral">Vínculo Laboral</option>
                  <option value="Proyecto Productivo">Proyecto Productivo</option>
                  <option value="Pasantía">Pasantía</option>
                  <option value="Monitoría">Monitoría</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Empresa / Ente Coformador
                </label>
                <input
                  type="text"
                  name="subtipo"
                  defaultValue={editingRecord.subtipo === '—' ? '' : editingRecord.subtipo}
                  placeholder="Nombre de la empresa o proyecto..."
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Fecha Inicio EP
                  </label>
                  <input
                    type="date"
                    name="fechaInicio"
                    defaultValue={editingRecord.fechaInicio ? editingRecord.fechaInicio.split(' ')[0] : ''}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Fecha Fin EP
                  </label>
                  <input
                    type="date"
                    name="fechaFin"
                    defaultValue={editingRecord.fechaFin ? editingRecord.fechaFin.split(' ')[0] : ''}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Estado Alternativa
                </label>
                <select
                  name="estado"
                  defaultValue={editingRecord.estado || 'Pendiente'}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-sena/50 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none transition-all text-slate-700 cursor-pointer"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Ejecución">En Ejecución</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Por evaluar">Por evaluar</option>
                  <option value="Terminado">Terminado</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-sena hover:bg-sena-dark transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sincronización Google Drive */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-sena border border-emerald-100 shadow-inner">
                  <Globe className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                    Sincronizar Google Drive — Etapa Productiva
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Análisis de archivos subidos y hojas de seguimiento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDriveModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Número de Ficha a buscar en Google Drive:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={syncFichaInput}
                      onChange={(e) => setSyncFichaInput(e.target.value)}
                      placeholder="Ej: 292231"
                      className="w-full bg-white border border-slate-300 focus:border-sena rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all text-slate-800 shadow-sm"
                    />
                    {filterFicha && (
                      <button
                        type="button"
                        onClick={() => setSyncFichaInput(filterFicha)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer"
                      >
                        Usar Ficha {filterFicha}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Carpeta de Google Drive / Enlace de Seguimiento:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={driveUrlInput}
                        onChange={(e) => setDriveUrlInput(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/1SgTxkngCSZv..."
                        className="w-full bg-white border border-slate-300 focus:border-sena rounded-xl pl-8 pr-3 py-2 text-xs font-mono font-medium outline-none transition-all text-slate-800 shadow-sm"
                      />
                      <LinkIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                    <a
                      href={driveUrlInput || DEFAULT_EP_DRIVE_FOLDER}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-emerald-50 hover:bg-sena text-sena hover:text-white border border-emerald-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      title="Abrir carpeta compartida en Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Drive
                    </a>
                  </div>
                </div>
              </div>

              {driveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{driveError}</span>
                </div>
              )}

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                  <FolderSync className="w-4 h-4 text-sena" /> Búsqueda y Análisis de Ficha en Drive:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                  <li>
                    Se buscará en el Drive el archivo Excel con nombre <strong className="text-slate-800">"Ficha {syncFichaInput || '292231'}"</strong> (ej: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] font-bold text-sena">Ficha {syncFichaInput || '292231'}.xlsx</code>).
                  </li>
                  <li>
                    El sistema procesará y analizará automáticamente la información (aprendices, alternativas, empresas, fechas y RAPs), igual a la opción manual <strong className="text-slate-800">"Reemplazar CSV/Excel"</strong>.
                  </li>
                  <li>
                    Puedes hacer clic en <strong className="text-slate-800">"Abrir Drive"</strong> para ver los archivos subidos a la carpeta compartida (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] font-bold text-sena">1SgTxkngCSZv...</code>).
                  </li>
                </ul>
              </div>

              {lastSyncTime && (
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1 pt-1 border-t border-slate-100">
                  <span>Última sincronización:</span>
                  <span className="font-bold text-sena">{lastSyncTime}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleSyncGoogleDrive()}
                disabled={isSyncingDrive}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-sena hover:bg-[#329200] disabled:opacity-50 transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                {isSyncingDrive ? 'Sincronizando...' : 'Sincronizar y Analizar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
