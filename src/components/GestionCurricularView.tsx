import React, { useState, useMemo } from 'react';
import { SofiaRow, FichaMeta, ProgramacionRow } from '../types';
import { getCompetencia, getRA, getJuicio, computeCompetenciaStats } from '../utils';
import { 
  BookOpen, 
  Search, 
  Layers, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  BookmarkCheck,
  ChevronRight,
  FileSpreadsheet,
  Award
} from 'lucide-react';

interface GestionCurricularViewProps {
  rows: SofiaRow[];
  fichas: { [id: string]: FichaMeta };
  programacion: ProgramacionRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function GestionCurricularView({
  rows,
  fichas,
  programacion,
  selectedFichaId,
  setSelectedFichaId
}: GestionCurricularViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComp, setSelectedComp] = useState<string | null>(null);

  // Filter fichas list
  const availableFichas = useMemo(() => {
    return Object.values(fichas);
  }, [fichas]);

  // If no ficha is selected, default to the first one
  React.useEffect(() => {
    if (!selectedFichaId && availableFichas.length > 0) {
      setSelectedFichaId(availableFichas[0].ficha);
    }
  }, [availableFichas, selectedFichaId, setSelectedFichaId]);

  // Filter rows by selected Ficha ID
  const filteredRows = useMemo(() => {
    if (!selectedFichaId) return [];
    return rows.filter(r => r._ficha === selectedFichaId);
  }, [rows, selectedFichaId]);

  // Selected Ficha metadata
  const currentFichaMeta = useMemo(() => {
    return fichas[selectedFichaId] || null;
  }, [fichas, selectedFichaId]);

  // Compute curriculum stats
  const competenciesData = useMemo(() => {
    if (filteredRows.length === 0) return [];
    
    // Map competency name -> Set of RAs
    const competencyRA: { [name: string]: { ras: Set<string>; totalJuicios: number; aprobados: number; noAprobados: number; pendientes: number } } = {};
    
    filteredRows.forEach(r => {
      const comp = getCompetencia(r) || 'Sin Competencia';
      const ra = getRA(r) || 'Sin RA';
      const j = getJuicio(r);

      if (!competencyRA[comp]) {
        competencyRA[comp] = {
          ras: new Set<string>(),
          totalJuicios: 0,
          aprobados: 0,
          noAprobados: 0,
          pendientes: 0
        };
      }
      
      if (ra && ra !== '—') {
        competencyRA[comp].ras.add(ra);
      }
      competencyRA[comp].totalJuicios++;
      if (j === 'APROBADO') competencyRA[comp].aprobados++;
      else if (j === 'NO APROBADO') competencyRA[comp].noAprobados++;
      else competencyRA[comp].pendientes++;
    });

    // Check scheduling coverage for each competency
    return Object.entries(competencyRA).map(([name, data]) => {
      // Find matching scheduled rows in the current ficha's programming
      const sched = programacion.filter(p => 
        String(p.codigoFicha).trim() === String(selectedFichaId).trim() && 
        String(p.competencia).toLowerCase().trim().includes(name.toLowerCase().trim())
      );
      
      const isScheduled = sched.length > 0;
      const hoursScheduled = sched.reduce((sum, s) => sum + Number(s.horasProgramadas || s.totalHorasProgramadas || 0), 0);
      const instructors = Array.from(new Set(sched.map(s => s.instructor).filter(Boolean)));

      return {
        name,
        totalRAs: data.ras.size,
        allRAs: Array.from(data.ras),
        isScheduled,
        hoursScheduled,
        instructores: instructors,
        totalJuicios: data.totalJuicios,
        aprobados: data.aprobados,
        noAprobados: data.noAprobados,
        pendientes: data.pendientes,
        completionPercent: data.totalJuicios > 0 ? Math.round((data.aprobados / data.totalJuicios) * 100) : 0
      };
    }).sort((a, b) => b.totalRAs - a.totalRAs);
  }, [filteredRows, programacion, selectedFichaId]);

  // Filter competencies based on query
  const searchedCompetencies = useMemo(() => {
    if (!searchQuery.trim()) return competenciesData;
    const query = searchQuery.toLowerCase();
    return competenciesData.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.instructores.some(i => i.toLowerCase().includes(query))
    );
  }, [competenciesData, searchQuery]);

  // Overall Coverage and Alignment percentages
  const curriculumMetrics = useMemo(() => {
    if (competenciesData.length === 0) return { total: 0, scheduled: 0, percent: 0, totalHours: 0 };
    const scheduledCount = competenciesData.filter(c => c.isScheduled).length;
    const totalHours = competenciesData.reduce((sum, c) => sum + c.hoursScheduled, 0);
    return {
      total: competenciesData.length,
      scheduled: scheduledCount,
      percent: Math.round((scheduledCount / competenciesData.length) * 100),
      totalHours
    };
  }, [competenciesData]);

  const selectedCompetencyData = useMemo(() => {
    if (!selectedComp) return null;
    return competenciesData.find(c => c.name === selectedComp) || null;
  }, [selectedComp, competenciesData]);

  if (availableFichas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-200 mx-auto mb-6 border border-slate-100">
          <BookOpen className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">Sin Fichas Cargadas</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          Para ver el análisis de Gestión Curricular, primero debes subir un archivo Excel de Ficha en la pestaña "Cargar Fichas".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 view-enter">
      
      {/* Title & Ficha Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-sena" />
            <span className="text-[10px] uppercase font-black text-sena tracking-widest">Módulo de Coordinación</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">Gestión Curricular</h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">Análisis de contenidos curriculares, competencias, resultados de aprendizaje y su cobertura de programación.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Ficha Activa:</span>
          <select
            value={selectedFichaId}
            onChange={(e) => {
              setSelectedFichaId(e.target.value);
              setSelectedComp(null);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-sena/40 focus:ring-4 focus:ring-sena/5 transition-all cursor-pointer"
          >
            {availableFichas.map(f => (
              <option key={f.ficha} value={f.ficha}>Ficha {f.ficha} - {f.programa.substring(0, 30)}...</option>
            ))}
          </select>
        </div>
      </div>

      {/* Program Details Card */}
      {currentFichaMeta && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sena/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="md:col-span-2 space-y-3">
            <span className="px-2.5 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-wider text-sena">
              Programa de Formación
            </span>
            <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug uppercase">
              {currentFichaMeta.programa}
            </h3>
            <div className="grid grid-cols-2 gap-4 pt-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[9px] block">Regional / Centro</span>
                <span className="font-semibold text-slate-200">{currentFichaMeta.regional || 'Boyacá'} / {currentFichaMeta.centro || 'Minero'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[9px] block">Periodo Académico</span>
                <span className="font-semibold text-slate-200">{currentFichaMeta.fechaInicio} — {currentFichaMeta.fechaFin}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between backdrop-blur-xs">
            <span className="text-[10px] text-slate-300 uppercase font-black tracking-wider block">Eficiencia de Cobertura</span>
            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl font-black text-sena">{curriculumMetrics.percent}%</span>
              <span className="text-xs text-slate-400">programado</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-300 font-semibold">
              <div className="flex justify-between">
                <span>Total de Competencias:</span>
                <span className="font-bold text-white">{curriculumMetrics.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Con Instructor Asignado:</span>
                <span className="font-bold text-white">{curriculumMetrics.scheduled}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Horas Planificadas:</span>
                <span className="font-bold text-sena font-mono">{curriculumMetrics.totalHours} h</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Competencies list - 7 Cols */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
              <span className="text-xs uppercase font-extrabold text-slate-800 tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Matriz de Competencias del Diseño Curricular
              </span>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar competencia o instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold placeholder-slate-400 text-slate-700 w-full sm:w-56 focus:outline-none focus:border-sena/40 transition-all"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {searchedCompetencies.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic font-semibold">
                  No se encontraron competencias registradas con ese término de búsqueda.
                </div>
              ) : (
                searchedCompetencies.map((comp, idx) => {
                  const isSelected = selectedComp === comp.name;
                  return (
                    <div 
                      key={idx}
                      onClick={() => setSelectedComp(comp.name)}
                      className={`p-4 transition-all cursor-pointer flex justify-between items-start gap-4 ${
                        isSelected ? 'bg-slate-50 border-l-4 border-sena' : 'hover:bg-slate-50/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono">
                            {comp.totalRAs} Resultados de Aprendizaje (RAs)
                          </span>
                          
                          {comp.isScheduled ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Programada ({comp.hoursScheduled} h)
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Sin Programación en Excel
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-slate-800 uppercase leading-snug line-clamp-2" title={comp.name}>
                          {comp.name}
                        </p>

                        {comp.instructores.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span className="uppercase truncate max-w-[280px]">
                              {comp.instructores.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0 self-center">
                        <span className="text-[10px] font-extrabold text-slate-900 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                          {comp.completionPercent}% Aprobación
                        </span>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'translate-x-1 text-sena' : ''}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Selected Competency Detail Panel - 5 Cols */}
        <div className="lg:col-span-5 space-y-4">
          {selectedCompetencyData ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-5 animate-fade-in">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-black text-sena tracking-widest block mb-1">Detalle de Competencia</span>
                  <h3 className="text-xs font-black text-slate-900 uppercase leading-snug">
                    {selectedCompetencyData.name}
                  </h3>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-slate-400 text-[9px] font-bold block uppercase mb-1">Resultados</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{selectedCompetencyData.totalRAs}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-slate-400 text-[9px] font-bold block uppercase mb-1">Horas Programadas</span>
                  <span className="text-sm font-black text-sena font-mono">{selectedCompetencyData.hoursScheduled} h</span>
                </div>
              </div>

              {/* RAs scroll list */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                  Resultados de Aprendizaje Vinculados (SofiaPlus)
                </span>
                
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {selectedCompetencyData.allRAs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay resultados de aprendizaje detallados para esta competencia</p>
                  ) : (
                    selectedCompetencyData.allRAs.map((ra, rIdx) => (
                      <div key={rIdx} className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-start gap-2.5">
                        <BookmarkCheck className="w-4 h-4 text-sena flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-700 leading-normal uppercase">
                            {ra}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Evaluative judgments alignment */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                  Estado de Juicios de Evaluación de Aprendices
                </span>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                    <span className="text-emerald-700 text-[10px] font-bold block mb-0.5">Aprobados</span>
                    <span className="text-xs font-black text-emerald-950 font-mono">{selectedCompetencyData.aprobados}</span>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl">
                    <span className="text-red-700 text-[10px] font-bold block mb-0.5">Por Mejorar</span>
                    <span className="text-xs font-black text-red-950 font-mono">{selectedCompetencyData.noAprobados}</span>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
                    <span className="text-slate-600 text-[10px] font-bold block mb-0.5">Pendientes</span>
                    <span className="text-xs font-black text-slate-950 font-mono">{selectedCompetencyData.pendientes}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-400 h-[380px] flex flex-col justify-center items-center">
              <Award className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Selecciona una competencia</p>
              <p className="text-[11px] text-slate-400 max-w-[200px] mt-1 leading-normal">
                Haz clic en cualquier competencia de la lista de la izquierda para ver su desglose de resultados de aprendizaje, horas y juicios.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
