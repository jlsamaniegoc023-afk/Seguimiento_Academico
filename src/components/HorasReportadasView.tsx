import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ProgramacionRow, SofiaRow, FichaMeta } from '../types';
import { 
  Clock, 
  UserCheck, 
  Upload, 
  Search, 
  Download, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  TrendingUp, 
  BarChart2, 
  Users, 
  BookOpen, 
  X, 
  Calendar,
  Layers,
  Globe,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { INITIAL_DEMO_RECORDS, DEFAULT_DRIVE_SHEET_URL } from '../data/senaSampleData';
import { ComposicionChart, VinculacionChart } from './HorasCharts';
import { InstructorIndividualView } from './InstructorIndividualView';

export interface ReporteHorasRecord {
  id: string;
  instructor: string;
  nombres?: string;
  apellidos?: string;
  vinculacion?: string;
  documentoInstructor?: string;
  codigoFicha: string;
  nombrePrograma: string;
  competencia: string;
  horasProgramadas: number;
  horasEjecutadas: number;
  
  // Consolidado SENA Fields
  horasTituladaLectiva?: number;
  horasComplementaria?: number;
  totalHorasFormacion?: number;
  horasAdicionales?: number;
  totalHorasInstructor?: number;

  // Actividades Especiales por Mes
  disenoCurricular?: number;
  investigacionAplicada?: number;
  aseguramientoCalidad?: number;
  otrosActividades?: number;

  horasDirectas?: number;
  horasIndirectas?: number;
  fechaInicio?: string;
  fechaFin?: string;
  observaciones?: string;
  hoja?: string;
}

interface HorasReportadasViewProps {
  programacion: ProgramacionRow[];
  rows: SofiaRow[];
  fichas?: { [id: string]: FichaMeta };
  selectedFichaId?: string;
  setSelectedFichaId?: (id: string) => void;
}

export default function HorasReportadasView({
  rows,
  fichas = {},
  selectedFichaId = ''
}: HorasReportadasViewProps) {
  const [query, setQuery] = useState('');
  const [filterVinculacion, setFilterVinculacion] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('GENERAL');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'principal' | 'instructor' | 'fichas'>('principal');
  const [editingRecord, setEditingRecord] = useState<ReporteHorasRecord | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Search inside Special Activities table
  const [searchSpecial, setSearchSpecial] = useState('');

  // Google Drive Connection States
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState(() => localStorage.getItem('sena_horas_reportadas_drive_url') || DEFAULT_DRIVE_SHEET_URL);
  const [connectedDriveUrl, setConnectedDriveUrl] = useState(() => localStorage.getItem('sena_horas_reportadas_drive_url') || DEFAULT_DRIVE_SHEET_URL);
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('sena_horas_reportadas_drive_sync_time') || '');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved custom reports in localStorage
  const [customRecords, setCustomRecords] = useState<ReporteHorasRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sena_horas_reportadas_custom');
      if (saved) {
        const parsed: ReporteHorasRecord[] = JSON.parse(saved);
        const fixed = parsed.map(r => {
          if (r.instructor && r.instructor.startsWith('INSTRUCTOR #')) {
            const joinedName = `${r.nombres || ''} ${r.apellidos || ''}`.trim().toUpperCase();
            if (joinedName) {
              r.instructor = joinedName;
            } else if (r.documentoInstructor) {
              r.instructor = `INSTRUCTOR CC ${r.documentoInstructor}`;
            }
          }
          return r;
        });
        return fixed;
      }
      return INITIAL_DEMO_RECORDS;
    } catch {
      return INITIAL_DEMO_RECORDS;
    }
  });

  const saveCustomRecords = (records: ReporteHorasRecord[]) => {
    setCustomRecords(records);
    try {
      localStorage.setItem('sena_horas_reportadas_custom', JSON.stringify(records));
    } catch (e) {
      console.error('Error saving records to localStorage', e);
    }
  };

  // Convert SOFIA rows into ReporteHorasRecord format
  const sofiaRecords = useMemo<ReporteHorasRecord[]>(() => {
    if (!rows || rows.length === 0) return [];
    
    return rows.map((r, idx) => {
      const hEjec = Number(r.horasImpartidas) || 0;
      return {
        id: `sofia-${r.codigoFicha}-${idx}`,
        instructor: (r.instructor || 'SIN INSTRUCTOR').trim().toUpperCase(),
        codigoFicha: r.codigoFicha || '',
        nombrePrograma: r.programa || (r.codigoFicha && fichas[r.codigoFicha]?.programa) || '',
        competencia: r.competencia || r.resultadoAprendizaje || 'COMPETENCIA / RAP',
        horasProgramadas: Number(r.horasProgramadas) || hEjec,
        horasEjecutadas: hEjec,
        horasDirectas: Math.round(hEjec * 0.8),
        horasIndirectas: Math.round(hEjec * 0.2),
        observaciones: 'Importado de SOFIA Plus',
        hoja: 'SOFIA'
      };
    });
  }, [rows, fichas]);

  // Combine custom records and SOFIA records
  const combinedRecords = useMemo(() => {
    return [...customRecords, ...sofiaRecords];
  }, [customRecords, sofiaRecords]);

  // Months available
  const monthsList = useMemo(() => {
    const monthsSet = new Set<string>();
    combinedRecords.forEach(r => {
      if (r.hoja && r.hoja !== 'SOFIA' && r.hoja !== 'Google Drive') {
        monthsSet.add(r.hoja);
      }
    });

    if (monthsSet.size === 0) {
      return ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
    }

    return Array.from(monthsSet);
  }, [combinedRecords]);

  // Title case helper
  const titleCase = (s: string) => {
    return (s || '').toLowerCase().replace(/(^|\s)\S/g, t => t.toUpperCase());
  };

  // Filter records by Month for Consolidado view
  const monthFilteredRecords = useMemo(() => {
    if (selectedMonth === 'GENERAL' || selectedMonth === 'TODOS') {
      return combinedRecords;
    }
    return combinedRecords.filter(r => (r.hoja || '').toUpperCase() === selectedMonth.toUpperCase());
  }, [combinedRecords, selectedMonth]);

  // Aggregated rows per instructor depending on current sheet (GENERAL or specific month)
  const consolidadoInstructores = useMemo(() => {
    const map = new Map<string, {
      id: string;
      instructor: string;
      documento: string;
      vinculacion: string;
      horasTituladaLectiva: number;
      horasComplementaria: number;
      totalHorasFormacion: number;
      horasAdicionales: number;
      totalHorasInstructor: number;
      disenoCurricular: number;
      investigacionAplicada: number;
      aseguramientoCalidad: number;
      otrosActividades: number;
      fichasCount: number;
    }>();

    monthFilteredRecords.forEach(r => {
      const doc = r.documentoInstructor || '';
      const key = doc || (r.instructor || 'INSTRUCTOR').toUpperCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          instructor: r.instructor || 'INSTRUCTOR SIN NOMBRE',
          documento: doc,
          vinculacion: r.vinculacion || 'CONTRATISTA SENA',
          horasTituladaLectiva: 0,
          horasComplementaria: 0,
          totalHorasFormacion: 0,
          horasAdicionales: 0,
          totalHorasInstructor: 0,
          disenoCurricular: 0,
          investigacionAplicada: 0,
          aseguramientoCalidad: 0,
          otrosActividades: 0,
          fichasCount: 0
        });
      }

      const inst = map.get(key)!;
      if (r.vinculacion) inst.vinculacion = r.vinculacion;
      if (r.instructor && !inst.instructor) inst.instructor = r.instructor;

      const hLect = r.horasTituladaLectiva || r.horasEjecutadas || 0;
      const hComp = r.horasComplementaria || 0;
      const hForm = r.totalHorasFormacion || (hLect + hComp);
      const hAdic = r.horasAdicionales || 0;
      const hTot = r.totalHorasInstructor || (hForm + hAdic);

      inst.horasTituladaLectiva += hLect;
      inst.horasComplementaria += hComp;
      inst.totalHorasFormacion += hForm;
      inst.horasAdicionales += hAdic;
      inst.totalHorasInstructor += hTot;

      inst.disenoCurricular += (r.disenoCurricular || 0);
      inst.investigacionAplicada += (r.investigacionAplicada || 0);
      inst.aseguramientoCalidad += (r.aseguramientoCalidad || 0);
      inst.otrosActividades += (r.otrosActividades || 0);

      if (r.codigoFicha) inst.fichasCount++;
    });

    let result = Array.from(map.values());

    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(i => 
        i.instructor.toLowerCase().includes(q) || 
        i.documento.includes(q)
      );
    }

    if (filterVinculacion) {
      result = result.filter(i => i.vinculacion === filterVinculacion);
    }

    return result.sort((a, b) => b.totalHorasInstructor - a.totalHorasInstructor);
  }, [monthFilteredRecords, query, filterVinculacion]);

  // Overall KPIs for Consolidado
  const consolidadoKPIs = useMemo(() => {
    const totalInstructores = consolidadoInstructores.length;
    let totalFormacion = 0;
    let totalAdicionales = 0;
    let totalHorasInst = 0;

    const vincTotals: { [key: string]: number } = {};

    consolidadoInstructores.forEach(i => {
      totalFormacion += i.totalHorasFormacion;
      totalAdicionales += i.horasAdicionales;
      totalHorasInst += i.totalHorasInstructor;

      vincTotals[i.vinculacion] = (vincTotals[i.vinculacion] || 0) + i.totalHorasInstructor;
    });

    const promedioPorInstructor = totalInstructores > 0 ? (totalHorasInst / totalInstructores) : 0;

    return {
      totalInstructores,
      totalFormacion,
      totalAdicionales,
      totalHorasInst,
      promedioPorInstructor,
      vincTotals
    };
  }, [consolidadoInstructores]);

  // Special Activities instructores (only instructores with special hours > 0)
  const instructoresActividadesEspeciales = useMemo(() => {
    let list = consolidadoInstructores.filter(i => 
      i.disenoCurricular > 0 || 
      i.investigacionAplicada > 0 || 
      i.aseguramientoCalidad > 0 || 
      i.otrosActividades > 0
    );

    if (searchSpecial.trim()) {
      const q = searchSpecial.toLowerCase().trim();
      list = list.filter(i => i.instructor.toLowerCase().includes(q) || i.documento.includes(q));
    }

    return list.sort((a, b) => {
      const sumA = a.disenoCurricular + a.investigacionAplicada + a.aseguramientoCalidad + a.otrosActividades;
      const sumB = b.disenoCurricular + b.investigacionAplicada + b.aseguramientoCalidad + b.otrosActividades;
      return sumB - sumA;
    });
  }, [consolidadoInstructores, searchSpecial]);

  // Helper row background styling based on total hours
  const getRowBgClass = (total: number) => {
    if (total >= 0 && total < 99) return 'bg-[#FDEAEA] hover:bg-[#FADADA] border-b border-rose-200/80';
    if (total >= 99 && total <= 120) return 'bg-[#FEF7DC] hover:bg-[#FCEEB8] border-b border-amber-200/80';
    return 'hover:bg-emerald-50/40 border-b border-slate-100';
  };

  // Helper Vinculación Pill
  const renderVincPill = (v: string) => {
    const norm = (v || '').toUpperCase();
    if (norm.includes('CONTRATISTA')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EAF7E0] text-[#2C7A00] font-extrabold text-[11px] whitespace-nowrap">Contratista Sena</span>;
    }
    if (norm.includes('CARRERA')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E4F0FB] text-[#1666BA] font-extrabold text-[11px] whitespace-nowrap">Carrera Administrativa</span>;
    }
    if (norm.includes('PROVISIONAL')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FDEFE0] text-[#E07A00] font-extrabold text-[11px] whitespace-nowrap">Nombramiento Provisional</span>;
    }
    if (norm.includes('ORDINARIO')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F3EBFF] text-[#7A4FBF] font-extrabold text-[11px] whitespace-nowrap">Nombramiento Ordinario</span>;
    }
    return <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-[11px] whitespace-nowrap">{titleCase(v)}</span>;
  };

  const labelActiveView = selectedMonth === 'GENERAL' || selectedMonth === 'TODOS' ? 'Consolidado General (Feb–Jun 2026)' : selectedMonth;

  // Helper to normalize strings for header matching
  const cleanStr = (s: any) => String(s || '').toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '').trim();

  // File Upload Handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const imported: ReporteHorasRecord[] = [];
        
        wb.SheetNames.forEach((sheetName, sheetIdx) => {
          const ws = wb.Sheets[sheetName];
          if (!ws) return;
          
          const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!rawRows || rawRows.length === 0) return;

          // Find header row by scanning first 25 rows
          let bestHeaderRowIdx = 0;
          let maxScore = -1;
          const headerKeywords = [
            'nombre', 'nombres', 'apellido', 'apellidos', 'instructor', 'documento', 
            'cedula', 'identificacion', 'vinculacion', 'mes', 'titulada', 'complementaria', 'horas'
          ];

          const maxScan = Math.min(25, rawRows.length);
          for (let l = 0; l < maxScan; l++) {
            const lineTokens = (rawRows[l] || []).map(cell => cleanStr(cell));
            let score = 0;
            lineTokens.forEach(token => {
              if (token && headerKeywords.some(kw => token.includes(kw))) {
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

          const headerRow = (rawRows[bestHeaderRowIdx] || []).map(cell => String(cell || '').trim());

          const getValFromRow = (rowCells: any[], targetKeywords: string[]): string => {
            const targetsClean = targetKeywords.map(cleanStr);
            for (const target of targetsClean) {
              if (!target) continue;
              const idx = headerRow.findIndex(h => {
                const cleanH = cleanStr(h);
                return cleanH === target || cleanH.includes(target) || target.includes(cleanH);
              });
              if (idx !== -1 && idx < rowCells.length && rowCells[idx] !== undefined && rowCells[idx] !== null) {
                const val = String(rowCells[idx]).trim();
                if (val !== '') return val;
              }
            }
            return '';
          };

          const getNumFromRow = (rowCells: any[], targetKeywords: string[]): number => {
            const str = getValFromRow(rowCells, targetKeywords);
            const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? 0 : num;
          };

          for (let r = bestHeaderRowIdx + 1; r < rawRows.length; r++) {
            const rowCells = rawRows[r];
            if (!rowCells || rowCells.length === 0 || rowCells.every(c => String(c).trim() === '')) continue;

            const instNames = getValFromRow(rowCells, ['nombres', 'nombre', 'primer_nombre', 'first_name']);
            const apeNames = getValFromRow(rowCells, ['apellido', 'apellidos', 'primer_apellido', 'segundo_apellido', 'last_name']);
            const fullCol = getValFromRow(rowCells, ['instructor', 'nombre_completo', 'nombres_y_apellidos', 'nombre_y_apellidos', 'persona']);

            let fullName = '';
            if (instNames || apeNames) {
              fullName = `${instNames} ${apeNames}`.trim();
            } else if (fullCol) {
              fullName = fullCol.trim();
            }

            const docInst = getValFromRow(rowCells, ['numero_identificacion', 'num_identificacion', 'identificacion', 'cedula', 'documento', 'doc', 'cc', 'id']);

            if (!fullName && docInst) {
              fullName = `INSTRUCTOR CC ${docInst}`;
            }

            if (!fullName) continue;

            const vinc = getValFromRow(rowCells, ['tipo_vinculacion', 'vinculacion', 'contrato', 'tipo_contrato']) || 'CONTRATISTA SENA';
            const hLectiva = getNumFromRow(rowCells, ['h_form_titulada_lectiva', 'titulada_lectiva', 'lectiva', 'h_lectiva']);
            const hComp = getNumFromRow(rowCells, ['h_form_complementaria', 'complementaria', 'h_complementaria']);
            const totalForm = getNumFromRow(rowCells, ['total_h_formacion', 'total_formacion', 'h_formacion']) || (hLectiva + hComp);
            const hAdic = getNumFromRow(rowCells, ['total_h_adicionales', 'total_adicionales', 'h_adicionales']);
            const totalInst = getNumFromRow(rowCells, ['total_h_instructor', 'total_instructor', 'total_horas', 'horas_totales']) || (totalForm + hAdic);

            const diseno = getNumFromRow(rowCells, ['diseno_curricular', 'diseno']);
            const proyInv = getNumFromRow(rowCells, ['proy_investigacion', 'investigacion']);
            const asegCal = getNumFromRow(rowCells, ['aseguramiento_calidad', 'calidad']);
            const otros = getNumFromRow(rowCells, ['otros', 'otras_actividades']);

            imported.push({
              id: `uploaded-${sheetIdx}-${r}`,
              instructor: fullName.toUpperCase(),
              nombres: instNames,
              apellidos: apeNames,
              vinculacion: vinc,
              documentoInstructor: docInst,
              codigoFicha: getValFromRow(rowCells, ['ficha', 'codigo_ficha', 'grupo']) || '2671940',
              nombrePrograma: getValFromRow(rowCells, ['programa', 'nombre_programa']) || 'CENTRO MINERO (9111)',
              competencia: 'ACTIVIDAD IMPARTIDA',
              horasProgramadas: totalInst || 160,
              horasEjecutadas: totalInst || 160,
              horasTituladaLectiva: hLectiva,
              horasComplementaria: hComp,
              totalHorasFormacion: totalForm,
              horasAdicionales: hAdic,
              totalHorasInstructor: totalInst,
              disenoCurricular: diseno,
              investigacionAplicada: proyInv,
              aseguramientoCalidad: asegCal,
              otrosActividades: otros,
              hoja: sheetName
            });
          }
        });

        if (imported.length > 0) {
          saveCustomRecords([...customRecords, ...imported]);
          setImportNotice(`¡Archivo importado con éxito! Se cargaron ${imported.length} registro(s).`);
        } else {
          alert('No se encontraron registros de instructores en el archivo importado.');
        }
      } catch (err) {
        console.error(err);
        alert('Error al leer el archivo Excel.');
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  const handleExportExcel = () => {
    const exportData = combinedRecords.map((r, idx) => ({
      NRO: idx + 1,
      MES: r.hoja || 'REPORTE',
      INSTRUCTOR: r.instructor,
      DOCUMENTO: r.documentoInstructor || '',
      TIPO_VINCULACION: r.vinculacion || '',
      TITULADA_LECTIVA: r.horasTituladaLectiva || 0,
      COMPLEMENTARIA: r.horasComplementaria || 0,
      TOTAL_FORMACION: r.totalHorasFormacion || 0,
      HORAS_ADICIONALES: r.horasAdicionales || 0,
      TOTAL_INSTRUCTOR: r.totalHorasInstructor || 0,
      DISENO_CURRICULAR: r.disenoCurricular || 0,
      INVESTIGACION_APLICADA: r.investigacionAplicada || 0,
      ASEGURAMIENTO_CALIDAD: r.aseguramientoCalidad || 0,
      OTROS: r.otrosActividades || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidado Horas');
    XLSX.writeFile(wb, `SENA_Reporte_Ejecucion_Horas_${selectedMonth}.xlsx`);
  };

  // Google Drive Sync Function
  const handleSyncDriveSheet = async (customUrl?: string) => {
    setIsSyncingDrive(true);
    setDriveError(null);
    const targetUrl = customUrl || connectedDriveUrl || DEFAULT_DRIVE_SHEET_URL;

    let sheetId = '';
    let gid = '';

    const sheetIdMatch = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetIdMatch) sheetId = sheetIdMatch[1];

    const gidMatch = targetUrl.match(/[?&]gid=([0-9]+)/) || targetUrl.match(/#gid=([0-9]+)/);
    if (gidMatch) gid = gidMatch[1];

    if (!sheetId) {
      setDriveError('URL de Google Sheets no válida. Asegúrate de incluir el ID del documento.');
      setIsSyncingDrive(false);
      return;
    }

    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
      const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;

      let csvText = '';
      let response = await fetch(exportUrl);
      if (!response.ok) {
        response = await fetch(fallbackUrl);
      }

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: no se pudo acceder a la hoja de Google Drive.`);
      }

      csvText = await response.text();

      if (!csvText || csvText.includes('<!DOCTYPE html>')) {
        throw new Error('El documento requiere permisos o la respuesta no es un archivo CSV válido. Asegúrate de que el enlace de Google Sheets sea público.');
      }

      const wb = XLSX.read(csvText, { type: 'string' });
      const imported: ReporteHorasRecord[] = [];

      wb.SheetNames.forEach((sheetName, sheetIdx) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;

        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rawRows || rawRows.length === 0) return;

        // Find header row by scanning first 25 rows
        let bestHeaderRowIdx = 0;
        let maxScore = -1;
        const headerKeywords = [
          'nombre', 'nombres', 'apellido', 'apellidos', 'instructor', 'documento', 
          'cedula', 'identificacion', 'vinculacion', 'mes', 'titulada', 'complementaria', 'horas'
        ];

        const maxScan = Math.min(25, rawRows.length);
        for (let l = 0; l < maxScan; l++) {
          const lineTokens = (rawRows[l] || []).map(cell => cleanStr(cell));
          let score = 0;
          lineTokens.forEach(token => {
            if (token && headerKeywords.some(kw => token.includes(kw))) {
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

        const headerRow = (rawRows[bestHeaderRowIdx] || []).map(cell => String(cell || '').trim());

        const getValFromRow = (rowCells: any[], targetKeywords: string[]): string => {
          const targetsClean = targetKeywords.map(cleanStr);
          for (const target of targetsClean) {
            if (!target) continue;
            const idx = headerRow.findIndex(h => {
              const cleanH = cleanStr(h);
              return cleanH === target || cleanH.includes(target) || target.includes(cleanH);
            });
            if (idx !== -1 && idx < rowCells.length && rowCells[idx] !== undefined && rowCells[idx] !== null) {
              const val = String(rowCells[idx]).trim();
              if (val !== '') return val;
            }
          }
          return '';
        };

        const getNumFromRow = (rowCells: any[], targetKeywords: string[]): number => {
          const str = getValFromRow(rowCells, targetKeywords);
          const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? 0 : num;
        };

        for (let r = bestHeaderRowIdx + 1; r < rawRows.length; r++) {
          const rowCells = rawRows[r];
          if (!rowCells || rowCells.length === 0 || rowCells.every(c => String(c).trim() === '')) continue;

          const instNames = getValFromRow(rowCells, ['nombres', 'nombre', 'primer_nombre', 'first_name']);
          const apeNames = getValFromRow(rowCells, ['apellido', 'apellidos', 'primer_apellido', 'segundo_apellido', 'last_name']);
          const fullCol = getValFromRow(rowCells, ['instructor', 'nombre_completo', 'nombres_y_apellidos', 'nombre_y_apellidos', 'persona']);

          let fullName = '';
          if (instNames || apeNames) {
            fullName = `${instNames} ${apeNames}`.trim();
          } else if (fullCol) {
            fullName = fullCol.trim();
          }

          const docInst = getValFromRow(rowCells, ['numero_identificacion', 'num_identificacion', 'identificacion', 'cedula', 'documento', 'doc', 'cc', 'id']);

          if (!fullName && docInst) {
            fullName = `INSTRUCTOR CC ${docInst}`;
          }

          if (!fullName) continue;

          const rowMes = getValFromRow(rowCells, ['mes', 'periodo', 'hoja']);

          const vinc = getValFromRow(rowCells, ['tipo_vinculacion', 'vinculacion', 'contrato', 'tipo_contrato']) || 'CONTRATISTA SENA';
          const hLectiva = getNumFromRow(rowCells, ['h_form_titulada_lectiva', 'titulada_lectiva', 'lectiva', 'h_lectiva']);
          const hComp = getNumFromRow(rowCells, ['h_form_complementaria', 'complementaria', 'h_complementaria']);
          const totalForm = getNumFromRow(rowCells, ['total_h_formacion', 'total_formacion', 'h_formacion']) || (hLectiva + hComp);
          const hAdic = getNumFromRow(rowCells, ['total_h_adicionales', 'total_adicionales', 'h_adicionales']);
          const totalInst = getNumFromRow(rowCells, ['total_h_instructor', 'total_instructor', 'total_horas', 'horas_totales']) || (totalForm + hAdic);

          const diseno = getNumFromRow(rowCells, ['diseno_curricular', 'diseno']);
          const proyInv = getNumFromRow(rowCells, ['proy_investigacion', 'investigacion']);
          const asegCal = getNumFromRow(rowCells, ['aseguramiento_calidad', 'calidad']);
          const otros = getNumFromRow(rowCells, ['otros', 'otras_actividades']);

          imported.push({
            id: `drive-${sheetIdx}-${r}`,
            instructor: fullName.toUpperCase(),
            nombres: instNames,
            apellidos: apeNames,
            vinculacion: vinc,
            documentoInstructor: docInst,
            codigoFicha: getValFromRow(rowCells, ['ficha', 'codigo_ficha', 'grupo']) || '2671940',
            nombrePrograma: getValFromRow(rowCells, ['programa', 'nombre_programa']) || 'CENTRO MINERO (9111)',
            competencia: 'ACTIVIDAD IMPARTIDA',
            horasProgramadas: totalInst || 160,
            horasEjecutadas: totalInst || 160,
            horasTituladaLectiva: hLectiva,
            horasComplementaria: hComp,
            totalHorasFormacion: totalForm,
            horasAdicionales: hAdic,
            totalHorasInstructor: totalInst,
            disenoCurricular: diseno,
            investigacionAplicada: proyInv,
            aseguramientoCalidad: asegCal,
            otrosActividades: otros,
            hoja: rowMes || 'Google Drive'
          });
        }
      });

      if (imported.length > 0) {
        saveCustomRecords(imported);
        setConnectedDriveUrl(targetUrl);
        const syncDate = new Date().toLocaleString('es-CO');
        setLastSyncTime(syncDate);
        localStorage.setItem('sena_horas_reportadas_drive_url', targetUrl);
        localStorage.setItem('sena_horas_reportadas_drive_sync_time', syncDate);
        setImportNotice(`¡Sincronización con Google Drive exitosa! Se procesaron y cargaron ${imported.length} registro(s).`);
        setShowDriveModal(false);
      } else {
        setDriveError('No se encontraron registros válidos de instructores en la hoja de Google Drive.');
      }
    } catch (err: any) {
      console.error('Error syncing Google Drive:', err);
      setDriveError(err.message || 'Error al conectar con Google Drive. Verifica que el enlace sea público.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F8F3] -m-4 md:-m-8 p-4 md:p-8 font-sans text-[#1F2A24]">
      
      {/* HEADER PRINCIPAL SENA CENTRO MINERO */}
      <header className="bg-gradient-to-r from-[#39A900] to-[#2C7A00] text-white rounded-2xl p-6 shadow-md mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <span>📊</span>
            <span>Dashboard Ejecución Horas Instructor</span>
          </h1>
          <p className="text-xs md:text-sm text-white/90 font-medium mt-1">
            REGIONAL BOYACÁ · CENTRO MINERO (9111) · Vigencia 2026
          </p>
        </div>

        {/* Toolbar Header Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => handleSyncDriveSheet()}
            disabled={isSyncingDrive}
            className="px-3.5 py-2 bg-white text-[#2C7A00] hover:bg-emerald-50 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border border-white disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
            <span>{isSyncingDrive ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
          </button>

          <button
            onClick={() => setShowDriveModal(true)}
            className="px-2.5 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border border-white/20"
            title="Configurar enlace de Google Drive"
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border border-white/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Datos</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border border-white/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN */}
      <nav className="bg-white border-b border-[#DCE5DC] rounded-xl shadow-xs mb-6 flex overflow-x-auto sticky top-0 z-20">
        <button
          onClick={() => setActiveTab('principal')}
          className={`px-6 py-3.5 text-sm font-bold transition-all border-b-3 cursor-pointer whitespace-nowrap ${
            activeTab === 'principal'
              ? 'text-[#2C7A00] border-[#39A900] bg-emerald-50/30'
              : 'text-[#5B6B62] border-transparent hover:text-[#2C7A00]'
          }`}
        >
          Ejecución de Horas
        </button>

        <button
          onClick={() => setActiveTab('instructor')}
          className={`px-6 py-3.5 text-sm font-bold transition-all border-b-3 cursor-pointer whitespace-nowrap ${
            activeTab === 'instructor'
              ? 'text-[#2C7A00] border-[#39A900] bg-emerald-50/30'
              : 'text-[#5B6B62] border-transparent hover:text-[#2C7A00]'
          }`}
        >
          Instructor Individual
        </button>
      </nav>

      {/* NOTIFICACIÓN BANNERS */}
      {importNotice && (
        <div className="bg-[#EAF7E0] border border-[#39A900]/30 text-[#2C7A00] p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#39A900] flex-shrink-0" />
            <span>{importNotice}</span>
          </div>
          <button onClick={() => setImportNotice(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VISTA 1: EJECUCIÓN DE HORAS */}
      {activeTab === 'principal' && (
        <div className="space-y-6">

          {/* SHEET SELECTOR BAR */}
          <div className="bg-white border border-[#DCE5DC] rounded-xl p-3 shadow-xs flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-[#5B6B62] uppercase tracking-wider mr-2">Ver:</span>
            
            <button
              onClick={() => setSelectedMonth('GENERAL')}
              className={`px-4 py-2 rounded-full border-2 text-xs font-bold transition-all cursor-pointer ${
                selectedMonth === 'GENERAL' || selectedMonth === 'TODOS'
                  ? 'bg-[#1666BA] border-[#1666BA] text-white shadow-xs'
                  : 'bg-white border-[#1666BA] text-[#1666BA] hover:bg-blue-50'
              }`}
            >
              Consolidado General
            </button>

            {monthsList.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-4 py-2 rounded-full border-2 text-xs font-bold transition-all cursor-pointer ${
                  selectedMonth === m
                    ? 'bg-[#39A900] border-[#39A900] text-white shadow-xs'
                    : 'bg-white border-[#39A900] text-[#2C7A00] hover:bg-[#EAF7E0]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Instructores</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{consolidadoKPIs.totalInstructores}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">{labelActiveView}</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Total Horas de Formación</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{consolidadoKPIs.totalFormacion.toLocaleString('es-CO')}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">
                {consolidadoKPIs.totalHorasInst > 0 ? ((consolidadoKPIs.totalFormacion / consolidadoKPIs.totalHorasInst) * 100).toFixed(1) : 0}% del total
              </div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Total Horas Adicionales</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{consolidadoKPIs.totalAdicionales.toLocaleString('es-CO')}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">
                {consolidadoKPIs.totalHorasInst > 0 ? ((consolidadoKPIs.totalAdicionales / consolidadoKPIs.totalHorasInst) * 100).toFixed(1) : 0}% del total
              </div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Total Horas Instructor</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{consolidadoKPIs.totalHorasInst.toLocaleString('es-CO')}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">suma general</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Promedio / Instructor</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{consolidadoKPIs.promedioPorInstructor.toFixed(1)}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">horas</div>
            </div>
          </div>

          {/* CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#1F2A24] flex items-center gap-2">
                <span>Formación vs. Apoyo —</span>
                <span className="text-[#39A900]">{labelActiveView}</span>
              </h3>
              <p className="text-xs text-[#5B6B62] mb-3">Composición de horas ejecutadas</p>
              <div className="h-64">
                <ComposicionChart 
                  totalFormacion={consolidadoKPIs.totalFormacion}
                  totalAdicionales={consolidadoKPIs.totalAdicionales}
                />
              </div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#1F2A24] flex items-center gap-2">
                <span>Tipo de Vinculación —</span>
                <span className="text-[#39A900]">{labelActiveView}</span>
              </h3>
              <p className="text-xs text-[#5B6B62] mb-3">Desglose por tipo de contrato</p>
              <div className="h-64">
                <VinculacionChart vincTotals={consolidadoKPIs.vincTotals} />
              </div>
            </div>

          </div>

          {/* DETALLE POR INSTRUCTOR TABLE CARD */}
          <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1F2A24] flex items-center gap-2">
                <span>Detalle por Instructor —</span>
                <span className="text-[#39A900]">{labelActiveView}</span>
              </h3>
              <p className="text-xs text-[#5B6B62] mt-0.5">Nombre, tipo de vinculación y horas ejecutadas</p>
            </div>

            {/* COLOR LEGEND ROW */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5B6B62] font-semibold pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-[#FDEAEA] border border-rose-300 inline-block"></span>
                <span>Total Horas Instructor entre 0 y 99</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-[#FEF7DC] border border-amber-300 inline-block"></span>
                <span>Total Horas Instructor entre 99 y 120</span>
              </div>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 Buscar por nombre o cédula..."
                className="w-full bg-white border border-[#DCE5DC] focus:border-[#39A900] text-sm font-semibold rounded-lg px-4 py-2.5 outline-none transition-all"
              />
            </div>

            {/* TABLE SCROLL CONTAINER */}
            <div className="max-h-[520px] overflow-y-auto border border-[#DCE5DC] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EAF7E0] text-[#2C7A00] font-extrabold uppercase text-[10.5px] tracking-wider sticky top-0 z-10 border-b border-[#DCE5DC]">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Tipo de Vinculación</th>
                    <th className="p-3 text-right">H. Form. Titulada Etapa Lectiva</th>
                    <th className="p-3 text-right">H. Formación Complementaria</th>
                    <th className="p-3 text-right">Total Horas de Formación</th>
                    <th className="p-3 text-right">Total Horas Adicionales</th>
                    <th className="p-3 text-right">Total Horas Instructor</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidadoInstructores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#5B6B62]">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    consolidadoInstructores.map((r) => (
                      <tr key={r.id} className={getRowBgClass(r.totalHorasInstructor)}>
                        <td className="p-2.5 font-bold uppercase text-slate-800">
                          {titleCase(r.instructor)}
                        </td>
                        <td className="p-2.5">
                          {renderVincPill(r.vinculacion)}
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {r.horasTituladaLectiva.toLocaleString('es-CO')}
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {r.horasComplementaria.toLocaleString('es-CO')}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-slate-900">
                          {r.totalHorasFormacion.toLocaleString('es-CO')}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#1666BA]">
                          {r.horasAdicionales.toLocaleString('es-CO')}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900 text-sm">
                          {r.totalHorasInstructor.toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* INSTRUCTORES CON HORAS EN CATEGORÍAS ESPECIALES */}
          <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1F2A24] flex items-center gap-2">
                <span>Instructores con Horas en Categorías Especiales</span>
                <span className="bg-[#EAF7E0] text-[#2C7A00] text-xs font-black px-2.5 py-0.5 rounded-full">
                  {instructoresActividadesEspeciales.length}
                </span>
              </h3>
              <p className="text-xs text-[#5B6B62] mt-0.5">
                Únicamente instructores con horas reportadas en: Diseño Curricular, Proyecto de Investigación Aplicada, Aseguramiento de la Calidad u Otros — <span className="font-bold">{labelActiveView}</span>
              </p>
            </div>

            <input
              type="text"
              value={searchSpecial}
              onChange={(e) => setSearchSpecial(e.target.value)}
              placeholder="🔍 Buscar por nombre o cédula..."
              className="w-full bg-white border border-[#DCE5DC] focus:border-[#39A900] text-sm font-semibold rounded-lg px-4 py-2.5 outline-none transition-all"
            />

            <div className="max-h-[520px] overflow-y-auto border border-[#DCE5DC] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EAF7E0] text-[#2C7A00] font-extrabold uppercase text-[10.5px] tracking-wider sticky top-0 z-10 border-b border-[#DCE5DC]">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Tipo de Vinculación</th>
                    <th className="p-3 text-right">Diseño Curricular</th>
                    <th className="p-3 text-right">Proy. Investigación Aplicada</th>
                    <th className="p-3 text-right">Aseguramiento de la Calidad</th>
                    <th className="p-3 text-right">Otros</th>
                    <th className="p-3">Categorías Reportadas</th>
                  </tr>
                </thead>
                <tbody>
                  {instructoresActividadesEspeciales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#5B6B62]">
                        Ningún instructor reporta horas en estas categorías para esta vista.
                      </td>
                    </tr>
                  ) : (
                    instructoresActividadesEspeciales.map((r) => (
                      <tr key={r.id} className={getRowBgClass(r.totalHorasInstructor)}>
                        <td className="p-2.5 font-bold uppercase text-slate-800">
                          {titleCase(r.instructor)}
                        </td>
                        <td className="p-2.5">
                          {renderVincPill(r.vinculacion)}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#1666BA]">
                          {r.disenoCurricular > 0 ? r.disenoCurricular : '—'}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#7A4FBF]">
                          {r.investigacionAplicada > 0 ? r.investigacionAplicada : '—'}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#2C7A00]">
                          {r.aseguramientoCalidad > 0 ? r.aseguramientoCalidad : '—'}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-[#E07A00]">
                          {r.otrosActividades > 0 ? r.otrosActividades : '—'}
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {r.disenoCurricular > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#E4F0FB] text-[#1666BA] text-[10px] font-bold">Diseño Curricular</span>
                            )}
                            {r.investigacionAplicada > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#F3EBFF] text-[#7A4FBF] text-[10px] font-bold">Proy. Investigación</span>
                            )}
                            {r.aseguramientoCalidad > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#EAF7E0] text-[#2C7A00] text-[10px] font-bold">Aseg. Calidad</span>
                            )}
                            {r.otrosActividades > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#FDEFE0] text-[#E07A00] text-[10px] font-bold">Otros</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VISTA 2: INSTRUCTOR INDIVIDUAL */}
      {activeTab === 'instructor' && (
        <InstructorIndividualView 
          records={combinedRecords}
          monthsList={monthsList}
        />
      )}

      <p className="text-center text-[#5B6B62] text-xs mt-8">
        Fuente: Reporte Ejecución Horas Instructor Vigencia 2026 — REGIONAL BOYACÁ / CENTRO MINERO (9111) · {consolidadoInstructores.length} instructores
      </p>

      {/* MODAL CONFIGURACIÓN Y SINCRONIZACIÓN GOOGLE DRIVE */}
      {showDriveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#DCE5DC] pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#2C7A00]" />
                <h3 className="font-extrabold text-[#1F2A24] text-base">Conexión con Google Drive / Sheets</h3>
              </div>
              <button 
                onClick={() => setShowDriveModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5B6B62] leading-relaxed">
              Ingresa el enlace público de tu hoja de cálculo en Google Sheets. El sistema analizará automáticamente las columnas de instructores, nombres, apellidos y métricas de horas.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1F2A24] block">
                URL del Documento Google Sheets:
              </label>
              <input
                type="text"
                value={driveUrlInput}
                onChange={(e) => setDriveUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-[#DCE5DC] focus:border-[#39A900] focus:bg-white rounded-lg outline-none font-mono text-slate-800"
              />
            </div>

            {lastSyncTime && (
              <div className="bg-[#EAF7E0] border border-[#39A900]/20 p-2.5 rounded-lg text-xs text-[#2C7A00] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Última sincronización: <strong>{lastSyncTime}</strong></span>
              </div>
            )}

            {driveError && (
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-xs text-rose-700 font-medium">
                {driveError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE5DC]">
              <button
                onClick={() => setShowDriveModal(false)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSyncDriveSheet(driveUrlInput)}
                disabled={isSyncingDrive}
                className="px-4 py-2 text-xs font-extrabold bg-[#2C7A00] hover:bg-[#39A900] text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                <span>{isSyncingDrive ? 'Analizando...' : 'Sincronizar Ahora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
