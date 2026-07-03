/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SofiaRow, FichaMeta, ProgramacionRow } from '../types';
import { getJuicio, computeAprendizStats, computeCompetenciaStats } from '../utils';
import { 
  FolderGit, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react';

interface DashboardViewProps {
  rows: SofiaRow[];
  fichas: { [id: string]: FichaMeta };
  programacion: ProgramacionRow[];
  onNavigate: (tabId: string) => void;
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function DashboardView({
  rows,
  fichas,
  programacion,
  onNavigate,
  selectedFichaId,
  setSelectedFichaId
}: DashboardViewProps) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  
  // Local states for competency progress section
  const [compFichaFilter, setCompFichaFilter] = useState<string>('');
  const [compSearchQuery, setCompSearchQuery] = useState('');
  const [showAllComps, setShowAllComps] = useState(false);

  // Keep the local filter in sync with the main sidebar selected Ficha
  React.useEffect(() => {
    setCompFichaFilter(selectedFichaId || '');
  }, [selectedFichaId]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-200 mx-auto mb-6 border border-slate-100">
          <Layers className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Sin datos cargados</h3>
        <p className="text-sm text-slate-400 max-w-xs">
          Carga los archivos Excel de SofiaPlus en la pestaña <strong className="text-sena font-bold">Cargar Fichas</strong> para comenzar el análisis.
        </p>
      </div>
    );
  }

  const fichaIds = Object.keys(fichas);
  const totalExcels = Object.values(fichas).reduce((sum, f) => sum + (f.archivos?.length || 1), 0);
  const displayedRows = selectedFichaId 
    ? rows.filter(r => r._ficha === selectedFichaId) 
    : rows;

  const na = displayedRows.filter(r => getJuicio(r) === 'NO APROBADO').length;
  const ap = displayedRows.filter(r => getJuicio(r) === 'APROBADO').length;
  const pe = displayedRows.filter(r => getJuicio(r) === 'POR EVALUAR').length;
  
  const aprs = computeAprendizStats(displayedRows);
  const enFormacion = aprs.filter(a => a.estado.includes('FORMACION')).length;
  const aplazado = aprs.filter(a => a.estado.includes('APLAZ')).length;
  const otros = aprs.length - enFormacion - aplazado;
  
  const efficiency = displayedRows.length > 0 ? Math.round((ap / displayedRows.length) * 100) : 0;
  
  const activeFichaMeta = selectedFichaId 
    ? fichas[selectedFichaId] 
    : (fichaIds.length === 1 ? fichas[fichaIds[0]] : null);
  const activeFichaId = selectedFichaId 
    ? selectedFichaId 
    : (fichaIds.length === 1 ? fichaIds[0] : null);

  // Compute progress of each ficha
  const fichaData = fichaIds.map(id => {
    const frows = rows.filter(r => r._ficha === id);
    const fap = frows.filter(r => getJuicio(r).includes('APROBADO')).length;
    return { 
      name: id, 
      pct: frows.length > 0 ? Math.round((fap / frows.length) * 100) : 0,
      total: frows.length
    };
  }).sort((a, b) => b.pct - a.pct);

  const totalProgHoras = programacion.reduce((acc, p) => acc + Number(p.horasProgramadas || 0), 0);

  // Filter rows for competency computation based on the local card selector
  const compFilteredRows = React.useMemo(() => {
    return compFichaFilter 
      ? rows.filter(r => r._ficha === compFichaFilter) 
      : rows;
  }, [rows, compFichaFilter]);

  const compStats = React.useMemo(() => {
    return computeCompetenciaStats(compFilteredRows);
  }, [compFilteredRows]);

  const displayedCompStats = React.useMemo(() => {
    let stats = compStats;
    if (compSearchQuery.trim()) {
      const q = compSearchQuery.toLowerCase();
      stats = stats.filter(c => c.nombre.toLowerCase().includes(q));
    }
    return stats;
  }, [compStats, compSearchQuery]);

  // High-fidelity custom SVG donut chart calculation helpers
  const makeDonutSlices = (data: { value: number; color: string; label: string }[]) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];
    
    let accumulatedAngle = 0;
    return data.map(item => {
      const percentage = item.value / total;
      const angle = percentage * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      // Translate polar coordinates to Cartesian
      const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
          x: centerX + (radius * Math.cos(angleInRadians)),
          y: centerY + (radius * Math.sin(angleInRadians))
        };
      };

      const x = 100;
      const y = 100;
      const radius = 70;
      
      const start = polarToCartesian(x, y, radius, startAngle);
      const end = polarToCartesian(x, y, radius, endAngle);
      const largeArcFlag = angle > 180 ? 1 : 0;

      // SVG path for ring slice
      const pathData = [
        `M`, start.x, start.y,
        `A`, radius, radius, 0, largeArcFlag, 1, end.x, end.y
      ].join(' ');

      return {
        pathData,
        color: item.color,
        label: item.label,
        value: item.value,
        percentage: Math.round(percentage * 100)
      };
    });
  };

  const donutJuicios = makeDonutSlices([
    { value: ap, color: '#39A900', label: 'Aprobado' },
    { value: na, color: '#ef4444', label: 'No Aprobado' },
    { value: pe, color: '#f59e0b', label: 'Por Evaluar' }
  ]);

  const donutEstados = makeDonutSlices([
    { value: enFormacion, color: '#2563eb', label: 'En Formación' },
    { value: aplazado, color: '#f59e0b', label: 'Aplazado' },
    { value: otros, color: '#94a3b8', label: 'Otros' }
  ]);

  // Top 10 Apprentices for preview
  const topAprendices = [...aprs]
    .sort((a, b) => (b.ap / b.total) - (a.ap / a.total))
    .slice(0, 10);

  return (
    <div className="space-y-6 view-enter">
      {/* Banner Principal */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <FolderGit className="w-6 h-6 text-sena" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {activeFichaMeta ? `${activeFichaMeta.programa} — FICHA DE CARACTERIZACIÓN: ${activeFichaId}` : `Análisis Multi-Ficha (${fichaIds.length} Fichas)`}
              </h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {activeFichaMeta ? `${activeFichaMeta.regional || 'Regional Boyacá'} — ${activeFichaMeta.centro || 'Centro de Formación Minero'}` : `${fichaIds.length} Fichas Activas — Regional Boyacá`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registros</p>
              <p className="text-lg font-black text-slate-900">{displayedRows.length.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eficiencia de Aprobación</p>
              <p className="text-lg font-black text-sena">{efficiency}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Fichas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sena" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fichas Cargadas</p>
              <p className="text-2xl font-black text-slate-900">{fichaIds.length}</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Fichas de Caracterización</p>
            </div>
            <div className="w-10 h-10 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <FolderGit className="w-5 h-5" />
            </div>
          </div>
          
          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Ficha de Caracterización:</label>
            <select
              value={selectedFichaId}
              onChange={(e) => setSelectedFichaId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg py-1.5 px-2 focus:border-sena outline-none transition-all cursor-pointer"
            >
              <option value="">Todas las Fichas ({fichaIds.length})</option>
              {fichaIds.map(id => (
                <option key={id} value={id}>
                  Ficha de Caracterización: {id} — {fichas[id]?.programa || 'SENA'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI: Aprendices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Aprendices</p>
              <p className="text-2xl font-black text-slate-900">{aprs.length}</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Con registros académicos</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Aprobados */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sena" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Resultados Aprobados</p>
              <p className="text-2xl font-black text-slate-900">{ap.toLocaleString()}</p>
              <p className="text-xs font-semibold text-sena mt-0.5">{((ap / displayedRows.length) * 100 || 0).toFixed(1)}% del total</p>
            </div>
            <div className="w-10 h-10 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Pendientes/NA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">No Aprobados / Pendientes</p>
              <p className="text-2xl font-black text-slate-900">{(na + pe).toLocaleString()}</p>
              <p className="text-xs font-semibold text-red-500 mt-0.5">{(((na + pe) / displayedRows.length) * 100 || 0).toFixed(1)}% por superar</p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Línea de tiempo y progreso de cada Ficha */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-sena" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Línea de Tiempo y Progreso por Ficha
          </span>
        </div>
        
        <div className="space-y-4">
          {(selectedFichaId ? [selectedFichaId] : fichaIds).map(id => {
            const f = fichas[id];
            const frows = rows.filter(r => r._ficha === id);
            const fap = frows.filter(r => getJuicio(r).includes('APROBADO')).length;
            const fna = frows.filter(r => getJuicio(r).includes('NO AP')).length;
            const fpe = frows.length - fap - fna;
            const pct = frows.length > 0 ? Math.round((fap / frows.length) * 100) : 0;
            const barColor = pct >= 70 ? 'bg-sena' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
            const barColorHex = pct >= 70 ? '#39A900' : pct >= 50 ? '#f59e0b' : '#ef4444';
            
            return (
              <div 
                key={id} 
                className="p-5 bg-slate-50 rounded-2xl border border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                      {f.programa || id}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-extrabold tracking-widest mt-0.5">
                      FICHA {id} — {f.estadoFicha || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-white/80 px-4 py-1.5 rounded-xl border border-slate-100 text-xs font-semibold shadow-sm">
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Aprobados</p>
                      <p className="font-extrabold text-sena">{fap}</p>
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">No Aprobados</p>
                      <p className="font-extrabold text-red-500">{fna}</p>
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Por Evaluar</p>
                      <p className="font-extrabold text-amber-500">{fpe}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Avance General Académico</span>
                    <span style={{ color: barColorHex }}>{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {(f.fechaInicio || f.fechaFin || f.centro) && (
                  <div className="mt-3.5 pt-3 border-t border-slate-200/50 flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {f.fechaInicio && (
                      <span>Inicio: <span className="text-slate-600">{f.fechaInicio}</span></span>
                    )}
                    {f.fechaFin && (
                      <span>Fin: <span className="text-slate-600">{f.fechaFin}</span></span>
                    )}
                    {f.centro && (
                      <span>Centro: <span className="text-slate-600 truncate max-w-xs">{f.centro}</span></span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Visualizations row: custom SVGs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* State of grades and state of apprentices - side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Donut State Juicios */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-sena" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado Juicios</span>
              </div>
              <div className="relative flex justify-center py-4">
                <svg width="160" height="160" viewBox="0 0 200 200" className="transform -rotate-90">
                  {donutJuicios.map((slice, i) => (
                    <circle
                      key={i}
                      cx="100"
                      cy="100"
                      r="70"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="24"
                      strokeDasharray={`${slice.value * 2 * Math.PI * 70 / displayedRows.length} ${2 * Math.PI * 70}`}
                      strokeDashoffset={-donutJuicios.slice(0, i).reduce((sum, s) => sum + s.value, 0) * 2 * Math.PI * 70 / displayedRows.length}
                      className="transition-all duration-300 cursor-pointer hover:stroke-[28px]"
                      onMouseEnter={() => setHoveredSlice(`juicio-${i}`)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  ))}
                  {/* Center punchout with total text */}
                  <circle cx="100" cy="100" r="58" fill="white" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800">{displayedRows.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Juicios</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
              {donutJuicios.map((slice, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="font-semibold text-slate-600">{slice.label}</span>
                  </div>
                  <span className="font-bold text-slate-900">{slice.value} ({slice.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Donut State Aprendices */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado Aprendices</span>
              </div>
              <div className="relative flex justify-center py-4">
                <svg width="160" height="160" viewBox="0 0 200 200" className="transform -rotate-90">
                  {donutEstados.map((slice, i) => (
                    <circle
                      key={i}
                      cx="100"
                      cy="100"
                      r="70"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="24"
                      strokeDasharray={`${slice.value * 2 * Math.PI * 70 / aprs.length} ${2 * Math.PI * 70}`}
                      strokeDashoffset={-donutEstados.slice(0, i).reduce((sum, s) => sum + s.value, 0) * 2 * Math.PI * 70 / aprs.length}
                      className="transition-all duration-300 cursor-pointer hover:stroke-[28px]"
                    />
                  ))}
                  <circle cx="100" cy="100" r="58" fill="white" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800">{aprs.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Matrícula</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
              {donutEstados.map((slice, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="font-semibold text-slate-600">{slice.label}</span>
                  </div>
                  <span className="font-bold text-slate-900">{slice.value} ({slice.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bar chart of progress/pct of loaded Fichas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-sena" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aprobación por Ficha</span>
            </div>
            
            <div className="space-y-4 py-2">
              {fichaData.slice(0, 5).map(f => {
                const colorHex = f.pct >= 70 ? '#39A900' : f.pct >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={f.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className="truncate max-w-[200px]">FICHA {f.name}</span>
                      <span style={{ color: colorHex }}>{f.pct}% Aprobación</span>
                    </div>
                    <div className="h-3.5 bg-slate-100 rounded-lg overflow-hidden relative border border-slate-200/50">
                      <div 
                        className="h-full rounded-lg transition-all duration-300" 
                        style={{ width: `${f.pct}%`, backgroundColor: colorHex }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Consulte y filtre los juicios de evaluación en la pestaña correspondiente.
            </p>
          </div>
        </div>

      </div>

      {/* SECCIÓN: Avance por Competencia con Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sena" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Avance General por Competencia
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
              Estado de juicios agrupados por competencia y ficha de caracterización
            </p>
          </div>

          {/* Leyenda del gráfico */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-sena rounded" />
              <span className="text-slate-600">Aprobado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span className="text-slate-600">No Aprobado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span className="text-slate-600">Por Evaluar</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Filtro de Ficha y Buscador de Competencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-5">
          {/* Selector de Ficha Local */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Filtrar por Ficha:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Filter className="w-4 h-4" />
              </span>
              <select
                value={compFichaFilter}
                onChange={(e) => setCompFichaFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl focus:border-sena outline-none transition-all cursor-pointer"
              >
                <option value="">Todas las Fichas ({fichaIds.length})</option>
                {fichaIds.map(id => (
                  <option key={id} value={id}>
                    Ficha de Caracterización: {id} — {fichas[id]?.programa || 'SENA'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador de Competencia Local */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Buscar Competencia:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar competencia por nombre o código..."
                value={compSearchQuery}
                onChange={(e) => setCompSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl focus:bg-white focus:border-sena outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Listado de Competencias con barras de progreso acumuladas */}
        {displayedCompStats.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              No se encontraron competencias que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedCompStats.slice(0, showAllComps ? undefined : 6).map((c) => {
              const pctAp = c.total > 0 ? (c.ap / c.total) * 100 : 0;
              const pctNa = c.total > 0 ? (c.na / c.total) * 100 : 0;
              const pctPe = c.total > 0 ? (c.pe / c.total) * 100 : 0;

              return (
                <div key={c.nombre} className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl hover:bg-slate-50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2.5">
                    <div className="max-w-xl">
                      <h4 className="text-xs font-extrabold text-slate-800 leading-normal uppercase">
                        {c.nombre}
                      </h4>
                      {/* Subtitle with Ficha info if shown for all */}
                      {!compFichaFilter && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200/60 rounded text-[9px] font-black text-slate-500 tracking-wider">
                          FICHA: {c.ficha}
                        </span>
                      )}
                    </div>

                    {/* Counts block */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black tracking-wider uppercase shrink-0">
                      <span className="text-sena bg-sena/10 px-2 py-0.5 rounded-md">
                        AP: {c.ap} ({Math.round(pctAp)}%)
                      </span>
                      <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                        NA: {c.na} ({Math.round(pctNa)}%)
                      </span>
                      <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                        PE: {c.pe} ({Math.round(pctPe)}%)
                      </span>
                      <span className="text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md">
                        Total: {c.total}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Stacked Bar */}
                  <div className="h-4 bg-slate-200/80 rounded-full overflow-hidden flex shadow-inner border border-slate-200/30">
                    {c.ap > 0 && (
                      <div
                        className="bg-sena h-full transition-all duration-500 relative cursor-pointer"
                        style={{ width: `${pctAp}%` }}
                        title={`Aprobados: ${c.ap} (${Math.round(pctAp)}%)`}
                      />
                    )}
                    {c.na > 0 && (
                      <div
                        className="bg-red-500 h-full transition-all duration-500 relative cursor-pointer"
                        style={{ width: `${pctNa}%` }}
                        title={`No Aprobados: ${c.na} (${Math.round(pctNa)}%)`}
                      />
                    )}
                    {c.pe > 0 && (
                      <div
                        className="bg-amber-500 h-full transition-all duration-500 relative cursor-pointer"
                        style={{ width: `${pctPe}%` }}
                        title={`Por Evaluar: ${c.pe} (${Math.round(pctPe)}%)`}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Expand / Collapse trigger button */}
            {displayedCompStats.length > 6 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllComps(!showAllComps)}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer shadow-sm"
                >
                  {showAllComps ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Mostrar menos competencias
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Mostrar las {displayedCompStats.length - 6} competencias restantes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress of judgments by apprentice - Horizontal Stacked preview list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sena" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Avance de Juicios por Aprendiz (Top 10 Rendimiento)
            </span>
          </div>
          <button 
            onClick={() => onNavigate('aprendices')}
            className="text-xs font-bold text-sena hover:text-sena-dark uppercase tracking-wider"
          >
            Ver todos
          </button>
        </div>

        <div className="space-y-4">
          {topAprendices.map(a => {
            const pct = a.total > 0 ? Math.round((a.ap / a.total) * 100) : 0;
            const barColor = pct >= 70 ? '#39A900' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div key={a.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="font-bold text-slate-800 text-sm">{a.nombre}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">[{a.doc}]</span>
                  </div>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="text-sena">AP: {a.ap}</span>
                    <span className="text-red-500">NA: {a.na}</span>
                    <span className="text-amber-500">PE: {a.pe}</span>
                    <span className="text-slate-500 ml-1" style={{ color: barColor }}>{pct}%</span>
                  </div>
                </div>

                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-sena h-full" 
                    style={{ width: `${(a.ap / a.total) * 100}%` }} 
                    title="Aprobados"
                  />
                  <div 
                    className="bg-red-500 h-full" 
                    style={{ width: `${(a.na / a.total) * 100}%` }} 
                    title="No Aprobados"
                  />
                  <div 
                    className="bg-amber-500 h-full" 
                    style={{ width: `${(a.pe / a.total) * 100}%` }} 
                    title="Por Evaluar"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
