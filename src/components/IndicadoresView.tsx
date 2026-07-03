import React, { useState, useMemo } from 'react';
import { SofiaRow, FichaMeta, ProgramacionRow } from '../types';
import { 
  getJuicio, 
  getNombre, 
  getDoc, 
  getCompetencia, 
  computeAprendizStats, 
  computeCompetenciaStats 
} from '../utils';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle, 
  Award, 
  Clock, 
  BookOpen, 
  Briefcase,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';

interface IndicadoresViewProps {
  rows: SofiaRow[];
  fichas: { [id: string]: FichaMeta };
  programacion: ProgramacionRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function IndicadoresView({
  rows,
  fichas,
  programacion,
  selectedFichaId,
  setSelectedFichaId
}: IndicadoresViewProps) {

  // Filter available fichas
  const availableFichas = useMemo(() => {
    return Object.values(fichas);
  }, [fichas]);

  // Handle selected Ficha defaults
  React.useEffect(() => {
    if (!selectedFichaId && availableFichas.length > 0) {
      setSelectedFichaId(availableFichas[0].ficha);
    }
  }, [availableFichas, selectedFichaId, setSelectedFichaId]);

  // Row selection based on selected Ficha
  const filteredRows = useMemo(() => {
    if (!selectedFichaId) return [];
    return rows.filter(r => r._ficha === selectedFichaId);
  }, [rows, selectedFichaId]);

  // Core statistical calculations for indicators
  const indicators = useMemo(() => {
    if (filteredRows.length === 0) {
      return {
        totalAprendices: 0,
        totalJuicios: 0,
        aprobados: 0,
        noAprobados: 0,
        pendientes: 0,
        tasaAprobacion: 0,
        deserciónAlerta: 0,
        competenciasCriticas: []
      };
    }

    const aprendices = computeAprendizStats(filteredRows);
    const totalAprendices = aprendices.length;
    
    let totalJuicios = 0;
    let aprobados = 0;
    let noAprobados = 0;
    let pendientes = 0;

    filteredRows.forEach(r => {
      totalJuicios++;
      const j = getJuicio(r);
      if (j === 'APROBADO') aprobados++;
      else if (j === 'NO APROBADO') noAprobados++;
      else pendientes++;
    });

    const tasaAprobacion = totalJuicios > 0 ? Math.round((aprobados / totalJuicios) * 100) : 0;

    // Desertion alert risk: Apprentices with more than 3 "NO APROBADO" or more than 40% Pending/No Aprobados
    const deserciónAlerta = aprendices.filter(ap => {
      const pendingAndFailed = ap.na + ap.pe;
      const totalForAp = ap.total || 1;
      return ap.na > 2 || (pendingAndFailed / totalForAp) > 0.45;
    }).length;

    // Competency failure rates (Competencias Críticas - high NO APROBADO count)
    const compStats = computeCompetenciaStats(filteredRows);
    const competenciasCriticas = compStats
      .map(c => {
        const failureRate = c.total > 0 ? Math.round((c.na / c.total) * 100) : 0;
        const pendingRate = c.total > 0 ? Math.round((c.pe / c.total) * 100) : 0;
        return {
          ...c,
          failureRate,
          pendingRate
        };
      })
      .filter(c => c.failureRate > 5 || c.pendingRate > 35)
      .slice(0, 5);

    return {
      totalAprendices,
      totalJuicios,
      aprobados,
      noAprobados,
      pendientes,
      tasaAprobacion,
      deserciónAlerta,
      competenciasCriticas
    };
  }, [filteredRows]);

  // Instructor metrics from schedule
  const instructorStats = useMemo(() => {
    // Filter programming for this Ficha
    const sched = programacion.filter(p => String(p.codigoFicha).trim() === String(selectedFichaId).trim());
    
    const instructorHours: { [name: string]: number } = {};
    sched.forEach(s => {
      const name = s.instructor || 'Sin asignar';
      const hrs = Number(s.horasProgramadas || s.totalHorasProgramadas || 0);
      instructorHours[name] = (instructorHours[name] || 0) + hrs;
    });

    const totalInstructores = Object.keys(instructorHours).length;
    const totalHoras = Object.values(instructorHours).reduce((sum, h) => sum + h, 0);
    const promedioHoras = totalInstructores > 0 ? Math.round(totalHoras / totalInstructores) : 0;

    return {
      totalInstructores,
      totalHoras,
      promedioHoras,
      list: Object.entries(instructorHours).map(([name, horas]) => ({ name, horas })).sort((a,b) => b.horas - a.horas)
    };
  }, [programacion, selectedFichaId]);

  if (availableFichas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-200 mx-auto mb-6 border border-slate-100">
          <Activity className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">Sin Fichas Cargadas</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          Para ver los Indicadores de Gestión Académica, primero debes subir un archivo Excel de Ficha en la pestaña "Cargar Fichas".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 view-enter">
      
      {/* Header and selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-sena" />
            <span className="text-[10px] uppercase font-black text-sena tracking-widest">Estadísticas & Reportes</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">Indicadores de Gestión Académica</h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">Métricas clave sobre aprobación de aprendices, retención, programación y competencias críticas.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Ficha Activa:</span>
          <select
            value={selectedFichaId}
            onChange={(e) => setSelectedFichaId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 focus:outline-none focus:border-sena/40 focus:ring-4 focus:ring-sena/5 transition-all cursor-pointer"
          >
            {availableFichas.map(f => (
              <option key={f.ficha} value={f.ficha}>Ficha {f.ficha} - {f.programa.substring(0, 30)}...</option>
            ))}
          </select>
        </div>
      </div>

      {/* High level visual widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Tasa Aprobación */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Tasa de Aprobación</span>
              <span className="text-3xl font-black text-slate-950 font-mono mt-1 block">
                {indicators.tasaAprobacion}%
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Award className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <span className="text-emerald-600">{indicators.aprobados}</span>
            <span>juicios aprobados de</span>
            <span className="font-mono">{indicators.totalJuicios}</span>
          </div>
        </div>

        {/* Alerta de Deserción / Retención */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Riesgo de Deserción / Alerta</span>
              <span className={`text-3xl font-black font-mono mt-1 block ${indicators.deserciónAlerta > 0 ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                {indicators.deserciónAlerta}
              </span>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${indicators.deserciónAlerta > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-semibold">
            {indicators.deserciónAlerta > 0 
              ? `${indicators.deserciónAlerta} aprendices con bajo rendimiento crítico`
              : 'Excelente retención. Ningún aprendiz en riesgo crítico.'
            }
          </div>
        </div>

        {/* Eficiencia de Programación */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Horas de Formación</span>
              <span className="text-3xl font-black text-slate-950 font-mono mt-1 block">
                {instructorStats.totalHoras} h
              </span>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Clock className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Programado con <span className="font-bold text-slate-800">{instructorStats.totalInstructores} instructores</span>
          </div>
        </div>

        {/* Aprendices Activos */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between h-[140px]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Aprendices Registrados</span>
              <span className="text-3xl font-black text-slate-950 font-mono mt-1 block">
                {indicators.totalAprendices}
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Users className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            Matriculados en esta Ficha de formación
          </div>
        </div>

      </div>

      {/* Detail Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Critical Competencies Alert List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="w-5 h-5 text-red-500" />
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Análisis de Competencias Críticas (Bajo Rendimiento o Pendientes)
            </span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {indicators.competenciasCriticas.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic font-semibold">
                No hay alertas de competencias críticas en esta ficha. Rendimiento estable.
              </div>
            ) : (
              indicators.competenciasCriticas.map((comp, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between items-start gap-2 text-xs">
                    <p className="font-bold text-slate-800 uppercase leading-snug truncate max-w-[280px]" title={comp.nombre}>
                      {comp.nombre}
                    </p>
                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-black font-mono">
                      {comp.failureRate}% No Aprobados
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    <div className="bg-white border border-slate-100 p-1.5 rounded">
                      <span className="text-slate-400 block uppercase">Total Juicios</span>
                      <span className="text-slate-800 font-mono">{comp.total}</span>
                    </div>
                    <div className="bg-white border border-slate-100 p-1.5 rounded">
                      <span className="text-amber-600 block uppercase">Por Evaluar</span>
                      <span className="text-amber-800 font-mono">{comp.pe} ({comp.pendingRate}%)</span>
                    </div>
                    <div className="bg-white border border-slate-100 p-1.5 rounded">
                      <span className="text-red-500 block uppercase">Insatisfechos</span>
                      <span className="text-red-700 font-mono">{comp.na}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructor Load distribution indicators */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Distribución y Carga Horaria por Instructor
            </span>
          </div>

          <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
            {instructorStats.list.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic font-semibold">
                No hay programación de instructores cargada para esta ficha.
              </div>
            ) : (
              instructorStats.list.map((item, idx) => {
                const maxHoras = Math.max(...instructorStats.list.map(l => l.horas), 1);
                const percent = Math.round((item.horas / maxHoras) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 uppercase truncate max-w-[280px]" title={item.name}>
                        {item.name}
                      </span>
                      <span className="bg-slate-100 text-slate-800 border border-slate-200 font-extrabold px-2 py-0.5 rounded-full font-mono text-[10px]">
                        {item.horas} h ({Math.round(item.horas / (instructorStats.totalHoras || 1) * 100)}%)
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

      </div>

    </div>
  );
}
