/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ProgramacionRow, SofiaRow, FichaMeta } from '../types';
import { 
  CalendarClock, 
  Upload, 
  Trash2, 
  Clock, 
  BookOpen, 
  Users, 
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ProgramacionViewProps {
  programacion: ProgramacionRow[];
  setProgramacion: React.Dispatch<React.SetStateAction<ProgramacionRow[]>>;
  rows: SofiaRow[];
  fichas?: { [id: string]: FichaMeta };
  showLoading: (show: boolean, msg?: string) => void;
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function ProgramacionView({
  programacion,
  setProgramacion,
  rows,
  fichas,
  showLoading,
  selectedFichaId,
  setSelectedFichaId
}: ProgramacionViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uniqueFichas = useMemo(() => {
    const fSofia = rows.map(r => r._ficha);
    const fProg = programacion.map(p => p.codigoFicha).filter(Boolean) as string[];
    return Array.from(new Set([...fSofia, ...fProg])).filter(Boolean);
  }, [rows, programacion]);

  const getFichaProgramName = (f: string) => {
    if (fichas && fichas[f]?.programa) {
      return fichas[f].programa;
    }
    const progItem = programacion.find(p => p.codigoFicha === f);
    if (progItem?.nombrePrograma) {
      return progItem.nombrePrograma;
    }
    const rowItem = rows.find(r => r._ficha === f);
    if (rowItem?._prog) {
      return rowItem._prog;
    }
    return '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const parseProgramacionFile = (file: File): Promise<ProgramacionRow[]> => {
    return new Promise((resolve, reject) => {
      // Try to extract Ficha from file name (7-8 digits)
      let fileNameFicha = '';
      const nameMatch = file.name.match(/\b\d{7,8}\b/);
      if (nameMatch) {
        fileNameFicha = nameMatch[0];
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, raw: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

          if (!raw || raw.length === 0) {
            resolve([]);
            return;
          }

          // Search worksheet for Ficha number fallback (first 30 rows, first 25 cols)
          let sheetFicha = '';
          for (let r = 0; r < Math.min(raw.length, 30); r++) {
            if (!raw[r]) continue;
            for (let c = 0; c < Math.min(raw[r].length, 25); c++) {
              const val = String(raw[r][c] || '');
              const cellMatch = val.match(/\b\d{7,8}\b/);
              if (cellMatch) {
                sheetFicha = cellMatch[0];
                break;
              }
            }
            if (sheetFicha) break;
          }

          let hRow = -1;
          for (let i = 0; i < Math.min(raw.length, 50); i++) {
            const s = raw[i].join('|').toLowerCase();
            if (s.includes('competencia') || (s.includes('instructor') && s.includes('hora')) || (s.includes('programad') && s.includes('fecha'))) {
              hRow = i; 
              break;
            }
          }
          if (hRow < 0) hRow = 0;

          const hdrs = raw[hRow].map(h => String(h || '').trim());
          const parsed = raw.slice(hRow + 1)
            .filter(r => r.some(c => c !== '' && c != null))
            .map(r => {
              const o: any = {};
              hdrs.forEach((h, i) => { if (h) o[h] = r[i]; });
              
              const getNum = (v: any) => { 
                const s = String(v || '0').replace(/[^0-9.]/g, ''); 
                const n = parseFloat(s); 
                return isNaN(n) ? 0 : n; 
              };
              
              const hp = getNum(o['Horas Programadas'] || o['Horas Programadas por Competencia'] || o['Horas Prog'] || o['Total de Horas Programadas'] || o['Total Horas'] || 0);
              
              const fn = o['Nombre Instructor'] || o['Nombres Instructor'] || o['Nombres'] || o['Nombre'] || o['Primer Nombre'] || '';
              const ln = o['Apellido Instructor'] || o['Apellidos Instructor'] || o['Apellidos'] || o['Apellido'] || o['Primer Apellido'] || '';
              let inst = '';
              
              if (fn || ln) {
                inst = `${fn} ${ln}`.trim();
              } else {
                inst = o['Nombre completo del instructor'] || o['Nombre Completo del Instructor'] || o['Nombre completo'] || o['Nombre Completo'] || o['Instructor'] || o['Nombre Instructor'] || o['Nombre del Instructor'] || o['Funcionario'] || o['Calificado Por'] || '';
              }
              
              if (!inst || !inst.includes(' ')) {
                // look for keys containing 'completo', 'instructor' or 'funcionario'
                const keys = Object.keys(o);
                const instKey = keys.find(k => {
                  const kl = k.toLowerCase();
                  const isInstructorOrCompleto = kl.includes('completo') || kl.includes('instructor') || kl.includes('funcionario');
                  const isId = kl.includes('documento') || kl.includes('cedula') || kl.includes('id') || kl.includes('identificacion') || kl.includes('teléfono') || kl.includes('correo');
                  return isInstructorOrCompleto && !isId;
                });
                if (instKey && String(o[instKey]).length > String(inst).length) {
                  inst = String(o[instKey]).trim();
                }
              }
              
              const comp = o['Competencia'] || o['Competencias Programadas'] || o['Nombre Competencia'] || o['Denominación de la Competencia'] || '';
              const date = o['Fecha'] || o['Fechas'] || o['Fecha Inicio'] || o['Cronograma'] || o['Mes'] || o['Fecha y Hora'] || '';
              
              const findKey = (keywords: string[], exclude: string[] = []) => {
                const keys = Object.keys(o);
                return keys.find(k => {
                  const kl = k.toLowerCase();
                  const matchesAll = keywords.every(kw => kl.includes(kw));
                  const avoidsAll = exclude.every(ex => !kl.includes(ex));
                  return matchesAll && avoidsAll;
                });
              };

              let fichaCode = o['Código Ficha'] || o['Codigo Ficha'] || o['Ficha'] || o['Código de Ficha'] || o['Codigo de Ficha'] || o['Ficha de Caracterización'] || o['Ficha de Caracterizacion'] || o['Id Ficha'] || o['Numero Ficha'] || o['Número Ficha'] || o['Nro Ficha'] || '';
              if (!fichaCode) {
                const k = findKey(['ficha']);
                if (k) fichaCode = o[k];
              }
              const fCodeStr = fichaCode ? String(fichaCode).trim() : '';

              let programaName = o['Nombre Programa'] || o['Programa'] || o['Nombre del Programa'] || o['Programa de Formación'] || o['Programa de Formacion'] || o['Nombre Programa Formación'] || o['Nombre Programa Formacion'] || o['Denominación del Programa'] || o['Denominacion del Programa'] || '';
              if (!programaName) {
                const k = findKey(['programa']);
                if (k) programaName = o[k];
              }
              const pNameStr = programaName ? String(programaName).trim() : '';

              let fechaInicioProg = o['Fecha Inicio Programación'] || o['Fecha Inicio Programacion'] || o['Fecha Inicio'] || o['Fecha de Inicio'] || '';
              if (!fechaInicioProg) {
                const k = findKey(['inicio', 'program']);
                if (k) fechaInicioProg = o[k];
              }
              if (!fechaInicioProg) {
                const k = findKey(['fecha', 'inicio']);
                if (k) fechaInicioProg = o[k];
              }

              let fechaFinProg = o['Fecha Fin Programación'] || o['Fecha Fin Programacion'] || o['Fecha Fin'] || o['Fecha de Fin'] || '';
              if (!fechaFinProg) {
                const k = findKey(['fin', 'program']);
                if (k) fechaFinProg = o[k];
              }
              if (!fechaFinProg) {
                const k = findKey(['fecha', 'fin']);
                if (k) fechaFinProg = o[k];
              }
              if (!fechaFinProg) {
                const k = findKey(['fecha', 'termino']);
                if (k) fechaFinProg = o[k];
              }

              const fInicioStr = fechaInicioProg ? String(fechaInicioProg).trim() : '';
              const fFinStr = fechaFinProg ? String(fechaFinProg).trim() : '';

              let finalFicha = fCodeStr || o._ficha || o.ficha || '';
              if (!finalFicha || finalFicha.length < 4) {
                finalFicha = sheetFicha || fileNameFicha || '';
              }

              return {
                competencia: String(comp).trim(),
                instructor: String(inst || 'Sin asignar').trim(),
                fecha: String(date).trim(),
                horasProgramadas: hp,
                horasEjecutadas: 0,
                horasPendientes: 0,
                totalHorasProgramadas: hp,
                fechaInicioProg: fInicioStr,
                fechaFinProg: fFinStr,
                codigoFicha: finalFicha,
                nombrePrograma: pNameStr,
                ...o
              };
            });

          // Filter out rows where competency is empty or placeholder
          let cleanedRows = parsed.filter(p => p.competencia && p.competencia !== '—' && p.competencia !== '');

          // Keep ONLY the first detected Ficha's data
          const detectedFicha = cleanedRows.find(p => p.codigoFicha)?.codigoFicha || sheetFicha || fileNameFicha || '';
          if (detectedFicha) {
            cleanedRows = cleanedRows.filter(p => String(p.codigoFicha).trim() === String(detectedFicha).trim());
          }

          resolve(cleanedRows);
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const processFile = async (file: File) => {
    showLoading(true, 'Procesando Programación...');
    try {
      showLoading(true, `Procesando Programación de Ficha: ${file.name}`);
      const result = await parseProgramacionFile(file);
      
      // We overwrite programacion state completely: "Deja solo Subir una Sola Ficha"
      setProgramacion(result);
      
      // Set the Ficha filter automatically to this Ficha
      const fileFicha = result[0]?.codigoFicha;
      if (fileFicha) {
        setSelectedFichaId(fileFicha);
      }
      
      showLoading(false);
    } catch (err) {
      console.error('Error procesando programación:', err);
      alert('Error al procesar el archivo de programación.');
      showLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allowed = (Array.from(e.dataTransfer.files) as File[]).filter(f => 
        /\.(xlsx|xls)$/i.test(f.name)
      );
      if (allowed.length > 0) {
        processFile(allowed[0]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const clearProgData = () => {
    setProgramacion([]);
    setShowConfirmClear(false);
  };

  // Filter programacion by selected Ficha ID first with loose and string-safe checks
  const selectedFichaProg = useMemo(() => {
    if (!selectedFichaId) return programacion;
    const cleanSelected = String(selectedFichaId).trim();
    return programacion.filter(p => {
      const cleanFicha = String(p.codigoFicha || '').trim();
      return cleanFicha === cleanSelected || cleanFicha.includes(cleanSelected) || cleanSelected.includes(cleanFicha);
    });
  }, [programacion, selectedFichaId]);

  // Apply query filter for view table
  const filteredProg = useMemo(() => {
    if (!query) return selectedFichaProg;
    const q = query.toLowerCase();
    return selectedFichaProg.filter(p => 
      (p.competencia || '').toLowerCase().includes(q) || 
      (p.instructor || '').toLowerCase().includes(q) ||
      (p.codigoFicha || '').toLowerCase().includes(q) ||
      (p.nombrePrograma || '').toLowerCase().includes(q)
    );
  }, [selectedFichaProg, query]);

  // Reset paging
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId]);

  // Pagination
  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredProg.length / itemsPerPage) || 1;
  const paginatedProg = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredProg.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredProg, currentPage]);

  const totalHoras = useMemo(() => {
    return selectedFichaProg.reduce((acc, p) => acc + Number(p.horasProgramadas || p.totalHorasProgramadas || 0), 0);
  }, [selectedFichaProg]);

  const uniqueInstructors = useMemo(() => {
    return new Set(selectedFichaProg.map(p => p.instructor).filter(Boolean)).size;
  }, [selectedFichaProg]);

  // Rank of instructors by total scheduled hours in selected Ficha
  const instructorAnalysis = useMemo(() => {
    const map: { [name: string]: number } = {};
    selectedFichaProg.forEach(p => {
      const name = p.instructor || 'Sin asignar';
      const hrs = Number(p.horasProgramadas || p.totalHorasProgramadas || 0);
      map[name] = (map[name] || 0) + hrs;
    });

    return Object.entries(map)
      .map(([name, horas]) => ({ name, horas }))
      .sort((a, b) => b.horas - a.horas);
  }, [selectedFichaProg]);

  // Rank of Fichas by total scheduled hours in loaded programming
  const fichaAnalysis = useMemo(() => {
    const map: { [ficha: string]: { horas: number; programa: string } } = {};
    programacion.forEach(p => {
      const f = p.codigoFicha || 'Sin Ficha';
      const hrs = Number(p.horasProgramadas || p.totalHorasProgramadas || 0);
      const prog = p.nombrePrograma || '';
      if (!map[f]) {
        map[f] = { horas: 0, programa: prog };
      }
      map[f].horas += hrs;
      if (prog && !map[f].programa) {
        map[f].programa = prog;
      }
    });

    return Object.entries(map)
      .map(([ficha, data]) => ({ ficha, horas: data.horas, programa: data.programa }))
      .sort((a, b) => b.horas - a.horas);
  }, [programacion]);

  // Parser function to make sure we parse various formats
  const parseDateString = (str: any): Date | null => {
    if (!str) return null;
    if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
    const s = String(str).trim();
    if (!s) return null;

    // DD/MM/YYYY or DD-MM-YYYY
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) { // YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      } else { // DD/MM/YYYY
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const fullYear = year < 100 ? 2000 + year : year;
        const d = new Date(fullYear, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Standard date constructor
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    return null;
  };

  // State to track current calendar month index and selected day details
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Map of programmed dates
  const programmedDaysMap = useMemo(() => {
    const map: { [dateKey: string]: { competencia: string; instructor: string; hours: number }[] } = {};
    if (!selectedFichaId) return map;

    selectedFichaProg.forEach(row => {
      // First, see if we can parse start and end of programming range
      const start = parseDateString(row.fechaInicioProg || row.fecha_inicio);
      const end = parseDateString(row.fechaFinProg || row.fecha_fin);

      if (start && end && start <= end) {
        const current = new Date(start);
        const maxLimit = new Date(start);
        maxLimit.setFullYear(maxLimit.getFullYear() + 2); // safety cap: 2 years max range per row

        while (current <= end && current <= maxLimit) {
          const dateKey = current.toISOString().split('T')[0];
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            competencia: row.competencia || '',
            instructor: row.instructor || '',
            hours: Number(row.horasProgramadas || row.totalHorasProgramadas || 0)
          });
          current.setDate(current.getDate() + 1);
        }
      } else {
        // Try single date row.fecha
        const singleDate = parseDateString(row.fecha);
        if (singleDate) {
          const dateKey = singleDate.toISOString().split('T')[0];
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push({
            competencia: row.competencia || '',
            instructor: row.instructor || '',
            hours: Number(row.horasProgramadas || row.totalHorasProgramadas || 0)
          });
        }
      }
    });

    return map;
  }, [selectedFichaProg, selectedFichaId]);

  // Calendar Range
  const calendarRange = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;

    const currentFichaMeta = fichas?.[selectedFichaId];
    if (currentFichaMeta) {
      start = parseDateString(currentFichaMeta.fechaInicio);
      end = parseDateString(currentFichaMeta.fechaFin);
    }

    // Scan map of programmed keys for fallback
    const keys = Object.keys(programmedDaysMap);
    if ((!start || !end) && keys.length > 0) {
      const sortedKeys = keys.sort();
      if (!start) start = parseDateString(sortedKeys[0]);
      if (!end) end = parseDateString(sortedKeys[sortedKeys.length - 1]);
    }

    if (!start) {
      start = new Date();
      start.setMonth(start.getMonth() - 1);
    }
    if (!end) {
      end = new Date();
      end.setMonth(end.getMonth() + 11); // default 1 year ahead
    }

    // Safety limits
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 1095) { // 3 years safety cap
      const limitEnd = new Date(start);
      limitEnd.setFullYear(limitEnd.getFullYear() + 2);
      end = limitEnd;
    }

    return { start, end };
  }, [fichas, selectedFichaId, programmedDaysMap]);

  // Reset month index on Ficha change
  React.useEffect(() => {
    setCurrentMonthIndex(0);
    setSelectedDateKey(null);
  }, [selectedFichaId]);

  // List of months to render
  const monthsList = useMemo(() => {
    const list: { 
      year: number; 
      month: number; 
      name: string; 
      days: { 
        isPadding: boolean; 
        date?: Date; 
        dateStr?: string; 
        dayNum?: number; 
        isWithinRange?: boolean; 
        isWeekend?: boolean; 
      }[] 
    }[] = [];

    const { start, end } = calendarRange;
    if (!start || !end) return [];

    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const limitDate = new Date(end.getFullYear(), end.getMonth(), 1);

    let count = 0;
    while (current <= limitDate && count < 36) {
      count++;
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthName = current.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days: any[] = [];

      // Monday index alignment: (getDay() + 6) % 7 maps Sunday=0 to 6, Mon=1 to 0, Sat=6 to 5
      const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
      for (let p = 0; p < firstDayIndex; p++) {
        days.push({ isPadding: true });
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(year, month, d);
        const dateStr = dayDate.toISOString().split('T')[0];
        const isWithinRange = dayDate >= start && dayDate <= end;
        const dayOfWeek = dayDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        days.push({
          date: dayDate,
          dateStr,
          dayNum: d,
          isWithinRange,
          isWeekend,
          isPadding: false
        });
      }

      list.push({
        year,
        month,
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        days
      });

      current.setMonth(current.getMonth() + 1);
    }

    return list;
  }, [calendarRange]);

  // Coverage statistics for selected Ficha's duration
  const calendarStats = useMemo(() => {
    const { start, end } = calendarRange;
    if (!start || !end) return { totalDays: 0, programmedDays: 0, unprogrammedDays: 0, percent: 0 };

    let totalDays = 0;
    let programmedDays = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const hasProg = !!programmedDaysMap[dateKey];

      totalDays++;
      if (hasProg) {
        programmedDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    const unprogrammedDays = totalDays - programmedDays;
    const percent = totalDays > 0 ? Math.round((programmedDays / totalDays) * 100) : 0;

    return { totalDays, programmedDays, unprogrammedDays, percent };
  }, [calendarRange, programmedDaysMap]);

  if (programacion.length === 0) {
    return (
      <div className="space-y-6 view-enter">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Programación de Competencias</h2>
          <p className="text-sm text-slate-500 font-medium font-sans">Carga y analiza el cronograma o calendario de programación de clases de la ficha</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <CalendarClock className="w-5 h-5 text-sena" />
            <span className="text-sm font-black text-slate-800 uppercase tracking-wider">Cargar Calendario Académico</span>
          </div>

          <div
            id="prog-dropzone"
            className={`dropzone border-2 border-dashed rounded-[24px] p-12 text-center cursor-pointer transition-all duration-200 ${
              dragOver 
                ? 'border-sena bg-emerald-50/50 scale-[0.99]' 
                : 'border-emerald-100 bg-[#f0fdf4]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md border border-sena/10">
              <Upload className="w-8 h-8 text-sena" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Arrastra el archivo de programación aquí
            </h3>
            <p className="text-sm text-slate-500">
              Formato Excel (.xlsx, .xls). Permite cargar una sola ficha para su análisis.
            </p>
            <input
              ref={fileInputRef}
              id="prog-file-input"
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 view-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Programación de Competencias</h2>
          <p className="text-sm text-slate-500 font-medium">Cronograma de formación y programación de clases de la ficha</p>
        </div>
        <div className="flex gap-2 self-start">
          {showConfirmClear ? (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 px-4 py-2 rounded-xl animate-fade-in shadow-sm">
              <span className="text-xs font-bold text-red-700">¿Borrar programación?</span>
              <button
                onClick={clearProgData}
                className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Sí, borrar
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-2 animate-fade-in"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar Programación
            </button>
          )}
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI: Total Hours */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horas Programadas</p>
              <p className="text-2xl font-black text-slate-900">{totalHoras.toLocaleString()}h</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Total acumuladas</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Total Competencies */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sena" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Competencias</p>
              <p className="text-2xl font-black text-slate-900">{programacion.length}</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">En el plan de estudios</p>
            </div>
            <div className="w-10 h-10 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Instructors count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-500" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Instructores</p>
              <p className="text-2xl font-black text-slate-900">{uniqueInstructors}</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Asignados a programación</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter box */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar por competencia o instructor programado..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3 items-center w-full md:w-auto">
          <select
            value={selectedFichaId}
            onChange={(e) => setSelectedFichaId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer shadow-sm max-w-xs md:max-w-md truncate"
          >
            <option value="">Todas las fichas</option>
            {uniqueFichas.map(f => {
              const progName = getFichaProgramName(f);
              const label = progName ? `Ficha ${f} - ${progName}` : `Ficha ${f}`;
              return (
                <option key={f} value={f} title={label}>
                  {label.length > 55 ? label.slice(0, 55) + '...' : label}
                </option>
              );
            })}
          </select>

          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            {filteredProg.length} Programaciones
          </div>
        </div>
      </div>

      {/* Analysis Section (Tiempos por instructor y por ficha) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time by Instructor analysis */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-sena" />
            <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Análisis de Horas por Instructor ({selectedFichaId ? `Ficha ${selectedFichaId}` : 'Todas las Fichas'})
            </span>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {instructorAnalysis.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">No hay instructores asignados a esta ficha</p>
            ) : (
              instructorAnalysis.map((item, idx) => {
                const maxHoras = Math.max(...instructorAnalysis.map(i => i.horas), 1);
                const percent = Math.min(100, Math.round((item.horas / maxHoras) * 100));
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 uppercase truncate max-w-[240px]" title={item.name}>
                        {item.name}
                      </span>
                      <span className="font-extrabold text-slate-950 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono text-[10px]">
                        {item.horas} h
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sena rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Time by Ficha analysis -> Replaced by Gantt-style Calendar Cobertura */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-sena" />
                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  Calendario Completo y Cobertura (Ficha {selectedFichaId || 'Cargada'})
                </span>
              </div>
              
              {selectedFichaId && (
                <span className="font-extrabold text-[10px] text-white bg-sena px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  Gantt Activo
                </span>
              )}
            </div>

            {!selectedFichaId ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                <p className="text-xs text-slate-400 font-semibold italic">No hay ninguna ficha seleccionada</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                  Selecciona una ficha en el filtro superior para generar su diagrama de Gantt y calendario completo de cobertura académica.
                </p>
              </div>
            ) : monthsList.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic py-8 text-center">No se encontraron fechas de inicio y fin para esta Ficha</p>
            ) : (
              <div className="space-y-4">
                {/* Meta details & stats bar */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between text-xs gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duración de Ficha</p>
                      <p className="font-extrabold text-slate-800">
                        {calendarRange.start ? calendarRange.start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'} al {calendarRange.end ? calendarRange.end.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cobertura Programada</p>
                      <p className="font-extrabold text-sena">{calendarStats.percent}% de los días</p>
                    </div>
                  </div>

                  {/* Micro timeline progress bar */}
                  <div className="space-y-1">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-sena transition-all duration-500" 
                        style={{ width: `${calendarStats.percent}%` }}
                        title={`Programados: ${calendarStats.programmedDays} días`}
                      />
                      <div 
                        className="h-full bg-slate-300/60 transition-all duration-500" 
                        style={{ width: `${100 - calendarStats.percent}%` }}
                        title={`Sin Programación: ${calendarStats.unprogrammedDays} días`}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>{calendarStats.programmedDays} días Programados</span>
                      <span>{calendarStats.unprogrammedDays} días Libres</span>
                    </div>
                  </div>
                </div>

                {/* Calendar monthly view card with navigation */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={currentMonthIndex <= 0}
                      onClick={() => {
                        setCurrentMonthIndex(prev => Math.max(0, prev - 1));
                        setSelectedDateKey(null);
                      }}
                      className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>

                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      {monthsList[currentMonthIndex]?.name || 'Mes'}
                    </span>

                    <button
                      type="button"
                      disabled={currentMonthIndex >= monthsList.length - 1}
                      onClick={() => {
                        setCurrentMonthIndex(prev => Math.min(monthsList.length - 1, prev + 1));
                        setSelectedDateKey(null);
                      }}
                      className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  {/* Day labels (Mon to Sun) */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                      <span key={idx} className="text-[10px] font-black text-slate-400 uppercase">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Grid of Days */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {monthsList[currentMonthIndex]?.days.map((day, idx) => {
                      if (day.isPadding) {
                        return <div key={`pad-${idx}`} className="h-6 w-full" />;
                      }

                      const dateKey = day.dateStr || '';
                      const isProgrammed = !!programmedDaysMap[dateKey];
                      const details = programmedDaysMap[dateKey] || [];
                      const isWithinFicha = day.isWithinRange;
                      const isSelected = selectedDateKey === dateKey;

                      let cellBg = 'bg-slate-50/50 text-slate-300 border border-slate-100'; // Default outside range or invalid
                      let cellBorder = 'border-transparent';
                      let cursorStyle = 'cursor-default';

                      if (isWithinFicha) {
                        cursorStyle = 'cursor-pointer';
                        if (isProgrammed) {
                          cellBg = isSelected 
                            ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/30' 
                            : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs';
                        } else {
                          // Day inside range but NOT programmed
                          cellBg = isSelected
                            ? 'bg-amber-100 text-amber-800 border-2 border-amber-400 font-bold'
                            : day.isWeekend 
                              ? 'bg-slate-100/60 text-slate-400 border border-slate-200/50' 
                              : 'bg-slate-50 text-slate-600 border border-slate-200/80 border-dashed';
                        }
                      }

                      return (
                        <div
                          key={`day-${idx}`}
                          className={`h-7 w-full flex items-center justify-center rounded-md text-[10px] font-bold font-mono transition-all ${cellBg} ${cellBorder} ${cursorStyle}`}
                          title={
                            isProgrammed 
                              ? `${details.length} clase(s) programada(s) para este día` 
                              : isWithinFicha 
                                ? 'Día lectivo sin programación' 
                                : 'Fecha fuera de vigencia de la ficha'
                          }
                          onClick={() => {
                            if (isWithinFicha) {
                              setSelectedDateKey(isSelected ? null : dateKey);
                            }
                          }}
                        >
                          {day.dayNum}
                        </div>
                      );
                    })}
                  </div>

                  {/* Map legends */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[9px] font-bold text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 block" />
                      <span>Programado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-50 border border-slate-200/80 border-dashed block" />
                      <span>Sin Programación</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-100 block" />
                      <span>Fin de Semana</span>
                    </div>
                  </div>
                </div>

                {/* Day Details Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  {selectedDateKey ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                        <span className="font-extrabold text-slate-800 font-mono">
                          {new Date(selectedDateKey + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="font-extrabold text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {programmedDaysMap[selectedDateKey]?.length || 0} asignadas
                        </span>
                      </div>
                      
                      {programmedDaysMap[selectedDateKey] && programmedDaysMap[selectedDateKey].length > 0 ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                          {programmedDaysMap[selectedDateKey].map((det, dIdx) => (
                            <div key={dIdx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs space-y-1 text-[11px]">
                              <p className="font-black text-slate-800 line-clamp-2 uppercase" title={det.competencia}>
                                {det.competencia}
                              </p>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold gap-2">
                                <span className="truncate">👤 {det.instructor}</span>
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-mono whitespace-nowrap">
                                  {det.hours} h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic py-1">No hay ninguna competencia programada para este día académico.</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-slate-400 text-[10px] font-semibold italic">
                      💡 Haz clic sobre cualquier día del calendario para ver el detalle de programación.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main scheduled list table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <CalendarClock className="w-5 h-5 text-sena" />
          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Detalle de Programación</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                <th className="px-6 py-4">Competencia</th>
                <th className="px-6 py-4">Instructor Asignado</th>
                <th className="px-6 py-4">Fechas / Programación</th>
                <th className="px-6 py-4 text-center">Horas Programadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProg.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 max-w-sm">
                    <div 
                      className="text-xs font-bold text-slate-700 uppercase truncate" 
                      title={p.competencia}
                    >
                      {p.competencia || '—'}
                    </div>
                    {/* Código Ficha and Nombre Programa display */}
                    {(p.codigoFicha || p.nombrePrograma) && (
                      <div className="flex flex-col gap-1 mt-1.5 max-w-xs">
                        {p.codigoFicha && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Ficha:</span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                              {p.codigoFicha}
                            </span>
                          </div>
                        )}
                        {p.nombrePrograma && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Programa:</span>
                            <span className="text-[10px] font-bold text-sena bg-sena/5 border border-sena/10 px-1.5 py-0.5 rounded truncate" title={p.nombrePrograma}>
                              {p.nombrePrograma}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-800 uppercase">{p.instructor || '—'}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Instructor</div>
                  </td>
                  <td className="px-6 py-4">
                    {p.fecha && (
                      <div className="text-xs text-slate-700 font-bold whitespace-nowrap mb-1">
                        {p.fecha}
                      </div>
                    )}
                    {(p.fechaInicioProg || p.fechaFinProg) ? (
                      <div className="space-y-1 bg-emerald-50/50 border border-emerald-100/60 p-2 rounded-xl max-w-[190px] shadow-sm">
                        {p.fechaInicioProg && (
                          <div className="text-[10px] text-slate-600 flex items-center gap-1.5 font-semibold">
                            <span className="font-extrabold text-sena text-[9px] uppercase tracking-wider bg-white px-1.5 py-0.5 rounded border border-sena/10">INICIO</span>
                            <span className="font-mono">{p.fechaInicioProg}</span>
                          </div>
                        )}
                        {p.fechaFinProg && (
                          <div className="text-[10px] text-slate-600 flex items-center gap-1.5 font-semibold">
                            <span className="font-extrabold text-amber-600 text-[9px] uppercase tracking-wider bg-white px-1.5 py-0.5 rounded border border-amber-200/40">FIN</span>
                            <span className="font-mono">{p.fechaFinProg}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      !p.fecha && <span className="text-xs text-slate-400 font-bold">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                      {Number(p.horasProgramadas || 0).toLocaleString()}h
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </span>
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
      </div>

    </div>
  );
}
