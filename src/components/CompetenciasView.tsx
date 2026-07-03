/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow } from '../types';
import { computeCompetenciaStats, getNombre, getDoc, getRA, getJuicio, getCompetencia } from '../utils';
import { 
  BookOpen, 
  Search, 
  Filter, 
  BookMarked, 
  UserCheck, 
  Flame, 
  ChevronLeft, 
  ChevronRight,
  ArrowLeft,
  Award,
  Users
} from 'lucide-react';

interface CompetenciasViewProps {
  rows: SofiaRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function CompetenciasView({
  rows,
  selectedFichaId,
  setSelectedFichaId
}: CompetenciasViewProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCompName, setSelectedCompName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'ra' | 'aprendices'>('ra');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  // Compute base competency statistics
  const filteredRows = useMemo(() => {
    if (!selectedFichaId) return rows;
    return rows.filter(r => r._ficha === selectedFichaId);
  }, [rows, selectedFichaId]);

  const allStats = useMemo(() => {
    let stats = computeCompetenciaStats(filteredRows);
    if (query) {
      stats = stats.filter(c => c.nombre.toLowerCase().includes(query.toLowerCase()));
    }
    return stats;
  }, [filteredRows, query]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const tot = allStats.length;
    const criticas = allStats.filter(c => c.na > 0).length;
    const ok = allStats.filter(c => c.ap === c.total && c.total > 0).length;
    const avg = allStats.length > 0
      ? (allStats.reduce((acc, c) => acc + (c.ap / c.total), 0) / allStats.length) * 100
      : 0;
    return { tot, criticas, ok, avg };
  }, [allStats]);

  // Reset page
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId]);

  // Pagination
  const itemsPerPage = 6;
  const totalPages = Math.ceil(allStats.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return allStats.slice(startIdx, startIdx + itemsPerPage);
  }, [allStats, currentPage]);

  // Compute rows for the selected competency
  const compRows = useMemo(() => {
    if (!selectedCompName) return [];
    return rows.filter(r => {
      const matchesComp = getCompetencia(r) === selectedCompName;
      const matchesFicha = !selectedFichaId || r._ficha === selectedFichaId;
      return matchesComp && matchesFicha;
    });
  }, [rows, selectedCompName, selectedFichaId]);

  // Compute apprentice-level stats within the selected competency
  const apprenticeStats = useMemo(() => {
    const map: { [doc: string]: { nombre: string; doc: string; ap: number; na: number; pe: number; total: number; ficha: string } } = {};
    compRows.forEach(r => {
      const doc = getDoc(r) || 'unknown';
      const nombre = getNombre(r);
      const j = getJuicio(r);
      const ficha = r._ficha || '';
      if (!map[doc]) {
        map[doc] = { nombre, doc, ap: 0, na: 0, pe: 0, total: 0, ficha };
      }
      map[doc].total++;
      if (j === 'APROBADO') map[doc].ap++;
      else if (j === 'NO APROBADO') map[doc].na++;
      else map[doc].pe++;
    });
    let result = Object.values(map);
    if (detailSearchQuery && detailTab === 'aprendices') {
      const q = detailSearchQuery.toLowerCase();
      result = result.filter(a => a.nombre.toLowerCase().includes(q) || a.doc.includes(q));
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [compRows, detailSearchQuery, detailTab]);

  // Compute Learning Outcome (RA) stats within the selected competency
  const raStats = useMemo(() => {
    const map: { [ra: string]: { ra: string; ap: number; na: number; pe: number; total: number } } = {};
    compRows.forEach(r => {
      const ra = getRA(r) || 'Resultado Sin Nombre';
      const j = getJuicio(r);
      if (!map[ra]) {
        map[ra] = { ra, ap: 0, na: 0, pe: 0, total: 0 };
      }
      map[ra].total++;
      if (j === 'APROBADO') map[ra].ap++;
      else if (j === 'NO APROBADO') map[ra].na++;
      else map[ra].pe++;
    });
    let result = Object.values(map);
    if (detailSearchQuery && detailTab === 'ra') {
      const q = detailSearchQuery.toLowerCase();
      result = result.filter(r => r.ra.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.total - a.total);
  }, [compRows, detailSearchQuery, detailTab]);

  // Handle detailed view early return
  if (selectedCompName) {
    const selectedCompStats = allStats.find(c => c.nombre === selectedCompName);
    const totalRowEval = compRows.length;
    const totalApprentices = Object.keys(compRows.reduce((acc, r) => {
      const doc = getDoc(r);
      if (doc) acc[doc] = true;
      return acc;
    }, {} as { [key: string]: boolean })).length;

    const apTotal = compRows.filter(r => getJuicio(r) === 'APROBADO').length;
    const naTotal = compRows.filter(r => getJuicio(r) === 'NO APROBADO').length;
    const peTotal = compRows.filter(r => getJuicio(r) === 'POR EVALUAR').length;
    
    const pctAp = totalRowEval > 0 ? Math.round((apTotal / totalRowEval) * 100) : 0;
    const pctNa = totalRowEval > 0 ? Math.round((naTotal / totalRowEval) * 100) : 0;
    const pctPe = totalRowEval > 0 ? Math.round((peTotal / totalRowEval) * 100) : 0;

    return (
      <div className="space-y-6 view-enter animate-fadeIn">
        {/* Navigation breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedCompName(null);
              setDetailSearchQuery('');
            }}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sena bg-white border border-slate-200 hover:border-sena/20 px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al listado
          </button>
          
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-widest">
            Ficha: {selectedFichaId || 'Todas'}
          </span>
        </div>

        {/* Competency Main Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-sena" />
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-sena bg-sena/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                Competencia de Formación
              </span>
              <h2 className="text-sm font-black text-slate-900 leading-tight uppercase max-w-4xl">
                {selectedCompName}
              </h2>
              {selectedCompStats?.instructores && selectedCompStats.instructores.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Instructores:</span>
                  {selectedCompStats.instructores.map((ins, idx) => (
                    <span key={idx} className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {ins}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* General Approval progress meter */}
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl shrink-0">
              <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-full border border-slate-200 shadow-sm">
                <span className="text-xs font-black text-sena leading-none">{pctAp}%</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aprobación General</p>
                <p className="text-base font-black text-slate-800 mt-1">{apTotal} de {totalRowEval}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Juicios evaluados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Micro KPI Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Juicios Totales</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalRowEval}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">En esta competencia</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aprendices Únicos</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{totalApprentices}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Asociados a ficha</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm border-l-4 border-l-red-500">
            <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider">No Aprobados</p>
            <p className="text-xl font-black text-red-600 mt-0.5">{naTotal}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Requieren atención ({pctNa}%)</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm border-l-4 border-l-amber-500">
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Por Evaluar</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{peTotal}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Calificaciones pendientes ({pctPe}%)</p>
          </div>
        </div>

        {/* Detailed Tabs & Search */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            {/* Tabs */}
            <div className="flex bg-slate-200/60 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => {
                  setDetailTab('ra');
                  setDetailSearchQuery('');
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                  detailTab === 'ra' 
                    ? 'bg-white text-sena shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Avance por Competencia (RA)
              </button>
              <button
                onClick={() => {
                  setDetailTab('aprendices');
                  setDetailSearchQuery('');
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                  detailTab === 'aprendices' 
                    ? 'bg-white text-sena shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Avance por Aprendiz
              </button>
            </div>

            {/* Local Search Input */}
            <div className="relative w-full sm:w-72 shrink-0">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={detailTab === 'ra' ? "Buscar por Resultado (RA)..." : "Buscar por aprendiz o cédula..."}
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-sena outline-none transition-all"
              />
            </div>
          </div>

          {/* Sub-tab Content */}
          <div className="p-5">
            {detailTab === 'ra' ? (
              // RESULTS OF LEARNING
              <div className="space-y-4">
                {raStats.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <p className="text-xs font-bold uppercase tracking-wider">No se encontraron Resultados de Aprendizaje (RA)</p>
                  </div>
                ) : (
                  raStats.map((raStat, idx) => {
                    const apPct = raStat.total > 0 ? (raStat.ap / raStat.total) * 100 : 0;
                    const naPct = raStat.total > 0 ? (raStat.na / raStat.total) * 100 : 0;
                    const pePct = raStat.total > 0 ? (raStat.pe / raStat.total) * 100 : 0;

                    return (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                          <div className="max-w-2xl">
                            <h4 className="text-xs font-extrabold text-slate-800 leading-normal uppercase">
                              {raStat.ra}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[9px] font-black tracking-wider uppercase shrink-0">
                            <span className="text-sena bg-sena/10 px-2 py-0.5 rounded-md">
                              AP: {raStat.ap} ({Math.round(apPct)}%)
                            </span>
                            <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                              NA: {raStat.na} ({Math.round(naPct)}%)
                            </span>
                            <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                              PE: {raStat.pe} ({Math.round(pePct)}%)
                            </span>
                            <span className="text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md">
                              EVAL: {raStat.total}
                            </span>
                          </div>
                        </div>

                        <div className="h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                          {raStat.ap > 0 && (
                            <div className="bg-sena h-full transition-all duration-500" style={{ width: `${apPct}%` }} title={`Aprobados: ${raStat.ap}`} />
                          )}
                          {raStat.na > 0 && (
                            <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${naPct}%` }} title={`No Aprobados: ${raStat.na}`} />
                          )}
                          {raStat.pe > 0 && (
                            <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${pePct}%` }} title={`Por Evaluar: ${raStat.pe}`} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              // APPRENTICES LIST
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                      <th className="py-3 px-4">Aprendiz</th>
                      <th className="py-3 px-4">Documento / Cédula</th>
                      <th className="py-3 px-4 text-center">Estado General</th>
                      <th className="py-3 px-4 text-right">Juicios Aprobados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {apprenticeStats.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">
                          <p className="font-bold uppercase tracking-wider">No se encontraron aprendices para esta competencia</p>
                        </td>
                      </tr>
                    ) : (
                      apprenticeStats.map((ap, idx) => {
                        const pctAppAp = ap.total > 0 ? Math.round((ap.ap / ap.total) * 100) : 0;
                        let statusColor = 'text-sena bg-sena/10';
                        let statusText = 'Excelente (100%)';
                        
                        if (ap.na > 0) {
                          statusColor = 'text-red-600 bg-red-50 border border-red-100';
                          statusText = `Atención (${ap.na} No Aprobados)`;
                        } else if (ap.pe > 0) {
                          statusColor = 'text-amber-600 bg-amber-50 border border-amber-100';
                          statusText = `Pendiente (${ap.pe} RAs)`;
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 font-extrabold text-slate-800 uppercase">
                              {ap.nombre}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-500 font-mono">
                              {ap.doc}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${statusColor}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-black text-slate-800">{ap.ap} / {ap.total} RAs</span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 shadow-inner">
                                  <div 
                                    className={`h-full rounded-full ${ap.na > 0 ? 'bg-red-500' : ap.pe > 0 ? 'bg-amber-500' : 'bg-sena'}`} 
                                    style={{ width: `${pctAppAp}%` }} 
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 view-enter">
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Análisis por Competencia</h2>
        <p className="text-sm text-slate-500 font-medium">Evalúa de forma agrupada el desempeño de las competencias y resultados de aprendizaje</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Competencias */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sena" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Competencias</p>
              <p className="text-2xl font-black text-slate-900">{kpis.tot}</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Analizadas</p>
            </div>
            <div className="w-10 h-10 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Promedio Aprobación */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prom. Aprobación</p>
              <p className="text-2xl font-black text-slate-900">{kpis.avg.toFixed(1)}%</p>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">De cumplimiento</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <BookMarked className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Competencias Críticas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Competencias Críticas</p>
              <p className="text-2xl font-black text-slate-900">{kpis.criticas}</p>
              <p className="text-xs font-semibold text-red-500 mt-0.5">Con reprobaciones</p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI: Completas 100% */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sena" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Superadas al 100%</p>
              <p className="text-2xl font-black text-slate-900">{kpis.ok}</p>
              <p className="text-xs font-semibold text-sena mt-0.5">Plenamente aprobadas</p>
            </div>
            <div className="w-10 h-10 bg-sena/10 rounded-xl flex items-center justify-center text-sena">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre de competencia..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-3 items-center w-full md:w-auto">
          <select
            value={selectedFichaId}
            onChange={(e) => setSelectedFichaId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer"
          >
            <option value="">Todas las fichas</option>
            {uniqueFichas.map(f => (
              <option key={f} value={f}>Ficha {f}</option>
            ))}
          </select>

          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ml-auto">
            {allStats.length} Competencias encontradas
          </div>
        </div>
      </div>

      {/* Cards de Competencias */}
      {allStats.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase">Sin competencias</h3>
          <p className="text-xs text-slate-400 mt-1">No se encontraron competencias que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((c, i) => {
            const apPct = c.total > 0 ? Math.round((c.ap / c.total) * 100) : 0;
            const naPct = c.total > 0 ? Math.round((c.na / c.total) * 100) : 0;
            const pePct = c.total > 0 ? Math.round((c.pe / c.total) * 100) : 0;
            const statusColor = apPct >= 70 ? 'bg-sena' : apPct >= 50 ? 'bg-amber-500' : 'bg-red-500';
            const statusText = apPct >= 70 ? 'text-sena' : apPct >= 50 ? 'text-amber-500' : 'text-red-500';
            
            return (
              <div 
                key={i} 
                onClick={() => setSelectedCompName(c.nombre)}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sena/40 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <h4 
                    className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-tight mb-4 min-h-[38px] line-clamp-2 group-hover:text-sena transition-colors" 
                    title={c.nombre}
                  >
                    {c.nombre}
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Aprobados */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-sena">Aprobados</span>
                        <span className="text-slate-600">{c.ap} / {c.total}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-sena" style={{ width: `${apPct}%` }} />
                      </div>
                    </div>

                    {/* No Aprobados */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-red-500">No Aprobados</span>
                        <span className="text-slate-600">{c.na} / {c.total}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${naPct}%` }} />
                      </div>
                    </div>

                    {/* Por Evaluar */}
                    <div>
                      <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-amber-500">Por Evaluar</span>
                        <span className="text-slate-600">{c.pe} / {c.total}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pePct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Instructores */}
                  {c.instructores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        Instructores Calificadores:
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto custom-scrollbar">
                        {c.instructores.map((ins, idx) => (
                          <span 
                            key={idx} 
                            className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            {ins}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-[11px] font-extrabold flex items-center gap-1.5 ${statusText}`}>
                    <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                    {apPct}% Aprobado
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCompName(c.nombre);
                    }}
                    className="text-[10px] font-black text-sena uppercase tracking-wider hover:underline flex items-center gap-1 transition-all cursor-pointer"
                  >
                    Ver Avance →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-slate-600 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
