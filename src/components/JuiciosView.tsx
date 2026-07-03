/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow } from '../types';
import { getJuicio, getNombre, getDoc, getCompetencia, getRA, getFecha } from '../utils';
import { Search, Filter, Layers, ChevronLeft, ChevronRight, Check, AlertTriangle, EyeOff } from 'lucide-react';

interface JuiciosViewProps {
  rows: SofiaRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function JuiciosView({
  rows,
  selectedFichaId,
  setSelectedFichaId
}: JuiciosViewProps) {
  const [query, setQuery] = useState('');
  const [selectedJuicio, setSelectedJuicio] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  const uniqueJuicios = useMemo(() => {
    return Array.from(new Set(rows.map(r => getJuicio(r)))).filter(Boolean);
  }, [rows]);

  // Filters application
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const q = query.toLowerCase();
      const matchesQuery = 
        getNombre(r).toLowerCase().includes(q) ||
        getDoc(r).includes(q) ||
        getCompetencia(r).toLowerCase().includes(q) ||
        getRA(r).toLowerCase().includes(q);

      const matchesFicha = selectedFichaId ? r._ficha === selectedFichaId : true;
      const matchesJuicio = selectedJuicio ? getJuicio(r) === selectedJuicio : true;

      return matchesQuery && matchesFicha && matchesJuicio;
    });
  }, [rows, query, selectedFichaId, selectedJuicio]);

  // Reset paging
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId, selectedJuicio]);

  // Pagination
  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRows, currentPage]);

  const getJuicioBadge = (juicio: 'APROBADO' | 'NO APROBADO' | 'POR EVALUAR') => {
    switch (juicio) {
      case 'APROBADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Check className="w-3 h-3" />
            {juicio}
          </span>
        );
      case 'NO APROBADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-100 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            {juicio}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
            <EyeOff className="w-3 h-3" />
            {juicio}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 view-enter">
      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Juicios de Evaluación</h2>
        <p className="text-sm text-slate-500 font-medium">Revisión detallada e individual de todos los resultados de aprendizaje registrados</p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar por aprendiz, documento, competencia, RA..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
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
            value={selectedJuicio}
            onChange={(e) => setSelectedJuicio(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer"
          >
            <option value="">Todos los juicios</option>
            {uniqueJuicios.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>

          <div className="text-xs font-bold text-slate-400 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 uppercase tracking-widest whitespace-nowrap ml-auto md:ml-0">
            {filteredRows.length.toLocaleString()} Registros
          </div>
        </div>
      </div>

      {/* Tabla */}
      {filteredRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase">Sin registros</h3>
          <p className="text-xs text-slate-400 mt-1">No se encontraron juicios con los criterios de filtrado actuales.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-6 py-4">Aprendiz</th>
                  <th className="px-6 py-4">Ficha</th>
                  <th className="px-6 py-4">Competencia / Resultado de Aprendizaje</th>
                  <th className="px-6 py-4">Juicio</th>
                  <th className="px-6 py-4">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((r, i) => {
                  const j = getJuicio(r);
                  const c = getCompetencia(r);
                  const ra = getRA(r);
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-xs tracking-tight">{getNombre(r)}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{getDoc(r)}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-xs">{r._ficha}</td>
                      <td className="px-6 py-4 max-w-md">
                        <div 
                          className="text-xs font-bold text-slate-700 uppercase truncate" 
                          title={c}
                        >
                          {c}
                        </div>
                        <div 
                          className="text-[10px] text-slate-400 mt-0.5 truncate" 
                          title={ra}
                        >
                          {ra}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getJuicioBadge(j)}</td>
                      <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {getFecha(r) || '—'}
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
