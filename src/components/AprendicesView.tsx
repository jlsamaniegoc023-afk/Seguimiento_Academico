/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow, InasistenciaRecord, ApprenticeStat } from '../types';
import { computeAprendizStats } from '../utils';
import { 
  Search, 
  Filter, 
  CircleUser, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  Info, 
  X, 
  Calendar, 
  UserCheck, 
  FileSpreadsheet, 
  Download,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AprendicesViewProps {
  rows: SofiaRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
  inasistencias?: InasistenciaRecord[];
}

export default function AprendicesView({
  rows,
  selectedFichaId,
  setSelectedFichaId,
  inasistencias = []
}: AprendicesViewProps) {
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInasistenciaFilter, setSelectedInasistenciaFilter] = useState<'ALL' | 'WITH_INAS' | 'RISK_HIGH' | 'NO_INAS'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApprenticeForModal, setSelectedApprenticeForModal] = useState<ApprenticeStat | null>(null);

  // Compute all apprentice stats including inasistencias from Drive / loaded Excel
  const stats = useMemo(() => computeAprendizStats(rows, inasistencias), [rows, inasistencias]);

  // Extract unique values for filter lists
  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(stats.map(s => s.estado))).filter(Boolean);
  }, [stats]);

  // Filter list by query, ficha, status, and inasistencia level
  const filteredStats = useMemo(() => {
    return stats.filter(a => {
      const q = query.toLowerCase().trim();
      const matchesQuery = 
        !q || 
        a.nombre.toLowerCase().includes(q) || 
        a.doc.toLowerCase().includes(q) || 
        a.ficha.toLowerCase().includes(q);

      const matchesFicha = selectedFichaId ? a.ficha === selectedFichaId : true;
      const matchesStatus = selectedStatus ? a.estado === selectedStatus : true;

      let matchesInas = true;
      const horas = a.horasInasistencia || 0;
      if (selectedInasistenciaFilter === 'WITH_INAS') {
        matchesInas = horas > 0;
      } else if (selectedInasistenciaFilter === 'RISK_HIGH') {
        matchesInas = horas >= 24;
      } else if (selectedInasistenciaFilter === 'NO_INAS') {
        matchesInas = horas === 0;
      }

      return matchesQuery && matchesFicha && matchesStatus && matchesInas;
    });
  }, [stats, query, selectedFichaId, selectedStatus, selectedInasistenciaFilter]);

  // Aggregated KPIs for the current selection
  const kpis = useMemo(() => {
    const totalAprendices = filteredStats.length;
    let totalHorasInasistencia = 0;
    let aprendicesConFaltas = 0;
    let aprendicesEnRiesgo = 0;

    filteredStats.forEach(a => {
      const h = a.horasInasistencia || 0;
      totalHorasInasistencia += h;
      if (h > 0) aprendicesConFaltas++;
      if (h >= 24) aprendicesEnRiesgo++;
    });

    return {
      totalAprendices,
      totalHorasInasistencia,
      aprendicesConFaltas,
      aprendicesEnRiesgo
    };
  }, [filteredStats]);

  // Reset page on filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId, selectedStatus, selectedInasistenciaFilter]);

  // Pagination
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredStats.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredStats.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredStats, currentPage]);

  const getStatusBadge = (status: string) => {
    const upper = (status || '').toUpperCase();
    if (upper.includes('FORMACION')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 whitespace-nowrap">
          {status}
        </span>
      );
    }
    if (upper.includes('APLAZ') || upper.includes('CONDICION')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 whitespace-nowrap">
          {status}
        </span>
      );
    }
    if (upper.includes('CANCEL') || upper.includes('DESERT') || upper.includes('RETIRO')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/60 whitespace-nowrap">
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
        {status || 'EN FORMACIÓN'}
      </span>
    );
  };

  const getInasistenciaBadge = (apprentice: ApprenticeStat) => {
    const horas = apprentice.horasInasistencia || 0;
    const reportes = apprentice.totalInasistencias || 0;

    if (horas === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200" title="Sin inasistencias registradas">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>0 hrs</span>
        </span>
      );
    }

    if (horas >= 24) {
      return (
        <button
          onClick={() => setSelectedApprenticeForModal(apprentice)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer shadow-xs"
          title="Haga clic para ver el desglose completo de horas de inasistencia reportadas"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
          <span className="font-extrabold">{horas} hrs total</span>
          <span className="text-[10.5px] bg-red-200/80 text-red-950 px-1.5 py-0.5 rounded-md font-bold">
            {reportes} {reportes === 1 ? 'falta' : 'faltas'}
          </span>
        </button>
      );
    }

    if (horas >= 12) {
      return (
        <button
          onClick={() => setSelectedApprenticeForModal(apprentice)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer shadow-xs"
          title="Haga clic para ver el desglose completo de horas de inasistencia reportadas"
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="font-extrabold">{horas} hrs total</span>
          <span className="text-[10.5px] bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded-md font-bold">
            {reportes} {reportes === 1 ? 'falta' : 'faltas'}
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={() => setSelectedApprenticeForModal(apprentice)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-xs"
        title="Haga clic para ver el desglose completo de horas de inasistencia reportadas"
      >
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="font-extrabold">{horas} hrs total</span>
        <span className="text-[10.5px] bg-blue-200/80 text-blue-950 px-1.5 py-0.5 rounded-md font-bold">
          {reportes} {reportes === 1 ? 'falta' : 'faltas'}
        </span>
      </button>
    );
  };

  const handleExportAprendices = () => {
    const exportData = filteredStats.map((a, idx) => ({
      NRO: idx + 1,
      FICHA: a.ficha,
      APRENDIZ: a.nombre,
      DOCUMENTO: a.doc,
      ESTADO_MATRICULADO: a.estado,
      HORAS_INASISTENCIA_REPORTADAS: a.horasInasistencia || 0,
      REPORTES_INASISTENCIA: a.totalInasistencias || 0,
      JUICIOS_APROBADOS: a.ap,
      JUICIOS_NO_APROBADOS: a.na,
      JUICIOS_POR_EVALUAR: a.pe,
      TOTAL_JUICIOS: a.total,
      PORCENTAJE_AVANCE: a.total > 0 ? `${Math.round((a.ap / a.total) * 100)}%` : '0%'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aprendices e Inasistencias');
    XLSX.writeFile(wb, `SENA_Aprendices_Inasistencias_${selectedFichaId || 'General'}.xlsx`);
  };

  return (
    <div className="space-y-6 view-enter">
      
      {/* Header and Search Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
            <span>Aprendices y Control de Inasistencias</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Monitorea el avance académico e inasistencias reportadas desde el documento de seguimiento
          </p>
        </div>

        {/* Global Search and Export */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Buscar por aprendiz, documento o ficha..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-semibold focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all shadow-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            onClick={handleExportAprendices}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Exportar a Excel"
          >
            <Download className="w-4 h-4 text-sena" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for Quick Inasistencia Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aprendices</span>
            <CircleUser className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{kpis.totalAprendices}</div>
          <div className="text-xs text-slate-400 mt-0.5">en el listado actual</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inasistencias</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {kpis.totalHorasInasistencia.toLocaleString('es-CO')} <span className="text-sm font-bold text-amber-700">hrs</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">acumuladas en Drive/Excel</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Con Inasistencias</span>
            <Info className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-1">{kpis.aprendicesConFaltas}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {kpis.totalAprendices > 0 ? ((kpis.aprendicesConFaltas / kpis.totalAprendices) * 100).toFixed(0) : 0}% de los aprendices
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Riesgo (≥24h)</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">{kpis.aprendicesEnRiesgo}</div>
          <div className="text-xs text-red-500 font-semibold mt-0.5">posible deserción</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl flex flex-wrap gap-3.5 items-center shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-sena" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filtros:</span>
        </div>
        
        {/* Ficha Dropdown */}
        <select
          value={selectedFichaId}
          onChange={(e) => setSelectedFichaId(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer"
        >
          <option value="">Todas las fichas</option>
          {uniqueFichas.map(f => (
            <option key={f} value={f}>Ficha {f}</option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Inasistencias Segmented Filter */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            onClick={() => setSelectedInasistenciaFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedInasistenciaFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setSelectedInasistenciaFilter('WITH_INAS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              selectedInasistenciaFilter === 'WITH_INAS'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Con Faltas</span>
          </button>
          <button
            onClick={() => setSelectedInasistenciaFilter('RISK_HIGH')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              selectedInasistenciaFilter === 'RISK_HIGH'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span>Riesgo (≥24h)</span>
          </button>
          <button
            onClick={() => setSelectedInasistenciaFilter('NO_INAS')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              selectedInasistenciaFilter === 'NO_INAS'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>0 hrs</span>
          </button>
        </div>

        <div className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
          {filteredStats.length} {filteredStats.length === 1 ? 'aprendiz' : 'aprendices'}
        </div>
      </div>

      {/* Main Table View */}
      {filteredStats.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <CircleUser className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase">Sin resultados</h3>
          <p className="text-xs text-slate-400 mt-1">No hay ningún aprendiz que coincida con los filtros de búsqueda o ficha seleccionada.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[10.5px] uppercase tracking-wider">
                  <th className="px-5 py-3.5">Aprendiz</th>
                  <th className="px-4 py-3.5">Documento</th>
                  <th className="px-4 py-3.5">Ficha</th>
                  <th className="px-4 py-3.5">Estado Matriculado</th>
                  <th className="px-4 py-3.5 bg-amber-50/60 border-l border-r border-amber-200/80 text-amber-950 font-black">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <div>
                        <span>Horas Inasistencia Reportadas</span>
                        <span className="block text-[9px] font-bold text-amber-700 normal-case tracking-normal">Total acumulado de horas</span>
                      </div>
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-center font-bold text-sena">Aprobados</th>
                  <th className="px-3 py-3.5 text-center font-bold text-red-600">No Aprob.</th>
                  <th className="px-3 py-3.5 text-center font-bold text-amber-600">Por Eval.</th>
                  <th className="px-5 py-3.5">Progreso Académico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map(a => {
                  const pct = a.total > 0 ? Math.round((a.ap / a.total) * 100) : 0;
                  const barColor = pct >= 70 ? 'bg-sena' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                  const inasHoras = a.horasInasistencia || 0;
                  const isRisk = inasHoras >= 24;

                  return (
                    <tr 
                      key={a.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isRisk ? 'bg-red-50/20' : (a.na > 0 ? 'bg-amber-50/10' : '')
                      }`}
                    >
                      {/* Aprendiz Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 flex-shrink-0">
                            <CircleUser className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-xs tracking-tight">{a.nombre}</span>
                          </div>
                        </div>
                      </td>

                      {/* Document */}
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-600">{a.doc}</td>

                      {/* Ficha */}
                      <td className="px-4 py-3.5 font-bold text-slate-700">{a.ficha}</td>

                      {/* Estado Matriculado */}
                      <td className="px-4 py-3.5">{getStatusBadge(a.estado)}</td>

                      {/* Horas Inasistencia Reportadas (Columna Solicitada) */}
                      <td className="px-4 py-3.5 bg-amber-50/20 border-l border-r border-amber-100/70">
                        {getInasistenciaBadge(a)}
                      </td>

                      {/* Aprobados */}
                      <td className="px-3 py-3.5 text-center font-extrabold text-xs text-sena">{a.ap}</td>

                      {/* No Aprobados */}
                      <td className={`px-3 py-3.5 text-center font-extrabold text-xs ${a.na > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                        {a.na}
                      </td>

                      {/* Por Evaluar */}
                      <td className={`px-3 py-3.5 text-center font-extrabold text-xs ${a.pe > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                        {a.pe}
                      </td>

                      {/* Progreso Académico */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-extrabold text-slate-600 w-7 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Página {currentPage} de {totalPages} ({filteredStats.length} aprendices)
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
      )}

      {/* Modal: Detalle de Inasistencias del Aprendiz */}
      {selectedApprenticeForModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Header Modal */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Reporte Detallado de Inasistencias
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5 flex items-center gap-2">
                  <CircleUser className="w-4 h-4 text-slate-300" />
                  <span>{selectedApprenticeForModal.nombre}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Doc: <span className="font-mono font-bold text-white">{selectedApprenticeForModal.doc}</span> · Ficha: <span className="font-bold text-white">{selectedApprenticeForModal.ficha}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedApprenticeForModal(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary KPI Grid */}
            <div className="bg-amber-50/80 border-b border-amber-100 p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs text-center">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Horas Reportadas</span>
                  <div className="text-xl font-black text-amber-950 mt-0.5">
                    {selectedApprenticeForModal.horasInasistencia || 0} <span className="text-xs font-bold text-amber-700">hrs</span>
                  </div>
                  <span className="text-[10px] text-slate-400">horas acumuladas</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs text-center">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Total Reportes</span>
                  <div className="text-xl font-black text-blue-950 mt-0.5">
                    {selectedApprenticeForModal.totalInasistencias || 0}
                  </div>
                  <span className="text-[10px] text-slate-400">faltas registradas</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs text-center">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Promedio</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {selectedApprenticeForModal.totalInasistencias && selectedApprenticeForModal.totalInasistencias > 0
                      ? ((selectedApprenticeForModal.horasInasistencia || 0) / selectedApprenticeForModal.totalInasistencias).toFixed(1)
                      : 0} <span className="text-xs font-bold text-slate-500">hrs</span>
                  </div>
                  <span className="text-[10px] text-slate-400">por cada reporte</span>
                </div>
              </div>

              {(selectedApprenticeForModal.horasInasistencia || 0) >= 24 && (
                <div className="mt-3 p-2.5 rounded-xl bg-red-100/90 border border-red-200 text-red-900 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse flex-shrink-0" />
                    <span>Aprendiz en Alto Riesgo de Cancelación/Deserción (&ge; 24 horas acumuladas)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inasistencias Table List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {(!selectedApprenticeForModal.detallesInasistencias || selectedApprenticeForModal.detallesInasistencias.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Sin inasistencias registradas</p>
                  <p className="text-xs text-slate-400">El aprendiz tiene una asistencia perfecta en este periodo.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedApprenticeForModal.detallesInasistencias.map((det, idx) => (
                    <div 
                      key={det.id || idx}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-sena" />
                            <span>{det.fechaInicio || 'Fecha no registrada'}</span>
                            {det.fechaFin && det.fechaFin !== det.fechaInicio && (
                              <span className="text-slate-400">al {det.fechaFin}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            <span>Instructor que reportó: <strong className="text-slate-700">{det.instructor || 'No especificado'}</strong></span>
                          </p>
                          <div className="mt-2 text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Motivo / Justificación:</span>
                            <span>{det.justificacion || 'Sin justificación'}</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-lg border border-amber-200">
                            {det.cantHoras} hrs
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {selectedApprenticeForModal.detallesInasistencias && selectedApprenticeForModal.detallesInasistencias.length > 0 && (
                  <button
                    onClick={() => {
                      const dataToExport = selectedApprenticeForModal.detallesInasistencias.map((det, idx) => ({
                        NRO: idx + 1,
                        APRENDIZ: selectedApprenticeForModal.nombre,
                        DOCUMENTO: selectedApprenticeForModal.doc,
                        FICHA: det.ficha || selectedApprenticeForModal.ficha,
                        INSTRUCTOR_REPORTO: det.instructor,
                        FECHA_INICIO: det.fechaInicio,
                        FECHA_FIN: det.fechaFin,
                        HORAS_INASISTENCIA: det.cantHoras,
                        JUSTIFICACION_MOTIVO: det.justificacion
                      }));
                      const ws = XLSX.utils.json_to_sheet(dataToExport);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Detalle Inasistencias');
                      XLSX.writeFile(wb, `Inasistencias_${selectedApprenticeForModal.doc}_${selectedApprenticeForModal.nombre.replace(/\s+/g, '_')}.xlsx`);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sena" />
                    <span>Descargar Reporte del Aprendiz</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedApprenticeForModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
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
