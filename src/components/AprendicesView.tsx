/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow } from '../types';
import { computeAprendizStats } from '../utils';
import { Search, Filter, CircleUser, ChevronLeft, ChevronRight } from 'lucide-react';

interface AprendicesViewProps {
  rows: SofiaRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function AprendicesView({
  rows,
  selectedFichaId,
  setSelectedFichaId
}: AprendicesViewProps) {
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const stats = useMemo(() => computeAprendizStats(rows), [rows]);

  // Extract unique values for filter lists
  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(stats.map(s => s.estado))).filter(Boolean);
  }, [stats]);

  // Filter lists
  const filteredStats = useMemo(() => {
    return stats.filter(a => {
      const matchesQuery = a.nombre.toLowerCase().includes(query.toLowerCase()) || a.doc.includes(query);
      const matchesFicha = selectedFichaId ? a.ficha === selectedFichaId : true;
      const matchesStatus = selectedStatus ? a.estado === selectedStatus : true;
      return matchesQuery && matchesFicha && matchesStatus;
    });
  }, [stats, query, selectedFichaId, selectedStatus]);

  // Reset page on filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId, selectedStatus]);

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredStats.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredStats.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredStats, currentPage]);

  const getStatusBadge = (status: string) => {
    if (status.includes('FORMACION')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
          {status}
        </span>
      );
    }
    if (status.includes('APLAZ')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-100">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 view-enter">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Aprendices</h2>
          <p className="text-sm text-slate-500 font-medium">Gestiona y monitorea el avance individual de cada estudiante</p>
        </div>
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all shadow-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl flex flex-wrap gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por:</span>
        </div>
        
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

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {uniqueStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="ml-auto text-xs font-bold text-slate-400 uppercase tracking-wider">
          {filteredStats.length} {filteredStats.length === 1 ? 'aprendiz encontrado' : 'aprendices encontrados'}
        </div>
      </div>

      {/* Tabla */}
      {filteredStats.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <CircleUser className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase">Sin resultados</h3>
          <p className="text-xs text-slate-400 mt-1">No hay ningún aprendiz que coincida con los filtros de búsqueda.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-6 py-4">Aprendiz</th>
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Ficha</th>
                  <th className="px-6 py-4">Estado Matriculado</th>
                  <th className="px-6 py-4 text-center">Aprobados</th>
                  <th className="px-6 py-4 text-center">No Aprobados</th>
                  <th className="px-6 py-4 text-center">Por Evaluar</th>
                  <th className="px-6 py-4">Progreso Académico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map(a => {
                  const pct = a.total > 0 ? Math.round((a.ap / a.total) * 100) : 0;
                  const barColor = pct >= 70 ? 'bg-sena' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                  const rowBg = a.na > 0 ? 'bg-red-50/20' : '';
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors ${rowBg}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                            <CircleUser className="w-5.5 h-5.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-xs tracking-tight">{a.nombre}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{a.doc}</td>
                      <td className="px-6 py-4 font-semibold text-xs text-slate-600">{a.ficha}</td>
                      <td className="px-6 py-4">{getStatusBadge(a.estado)}</td>
                      <td className="px-6 py-4 text-center font-extrabold text-xs text-sena">{a.ap}</td>
                      <td className={`px-6 py-4 text-center font-extrabold text-xs ${a.na > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                        {a.na}
                      </td>
                      <td className={`px-6 py-4 text-center font-extrabold text-xs ${a.pe > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                        {a.pe}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5 min-w-[120px]">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-extrabold text-slate-600 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      )}
    </div>
  );
}
