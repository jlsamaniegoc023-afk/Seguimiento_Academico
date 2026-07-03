/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow } from '../types';
import { getJuicio, getNombre, getDoc, getEstado, getRA, getCompetencia, getInstructor, getFecha } from '../utils';
import { AlertTriangle, Search, Filter, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

interface NoAprobadosViewProps {
  rows: SofiaRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

export default function NoAprobadosView({
  rows,
  selectedFichaId,
  setSelectedFichaId
}: NoAprobadosViewProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter only No Aprobados records
  const noAprobadosRows = useMemo(() => {
    return rows.filter(r => getJuicio(r) === 'NO APROBADO');
  }, [rows]);

  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(noAprobadosRows.map(r => r._ficha))).filter(Boolean);
  }, [noAprobadosRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return noAprobadosRows.filter(r => {
      const q = query.toLowerCase();
      const matchesQuery =
        getNombre(r).toLowerCase().includes(q) ||
        getDoc(r).includes(q) ||
        getRA(r).toLowerCase().includes(q) ||
        getCompetencia(r).toLowerCase().includes(q);

      const matchesFicha = selectedFichaId ? r._ficha === selectedFichaId : true;

      return matchesQuery && matchesFicha;
    });
  }, [noAprobadosRows, query, selectedFichaId]);

  // Total unique students affected
  const uniqueStudentsCount = useMemo(() => {
    return new Set(filteredRows.map(r => getDoc(r) || getNombre(r))).size;
  }, [filteredRows]);

  // Reset paging
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId]);

  // Pagination
  const itemsPerPage = 12;
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRows, currentPage]);

  return (
    <div className="space-y-6 view-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-red-500" />
            Resultados No Aprobados
          </h2>
          <p className="text-sm text-slate-500 font-medium">Identificación de aprendices con deficiencias académicas y juicios no superados</p>
        </div>
      </div>

      {/* Alerta de Rendimiento */}
      <div className="flex items-start gap-4 p-5 bg-red-50/70 border border-red-100 rounded-2xl">
        <div className="p-2 bg-red-100 text-red-600 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-red-800">Alerta Crítica de Desempeño</p>
          <p className="text-xs text-red-600 font-medium mt-0.5 leading-relaxed">
            Se han identificado <strong className="font-bold">{noAprobadosRows.length}</strong> calificaciones de No Aprobado afectando a <strong className="font-bold">{new Set(noAprobadosRows.map(r => getDoc(r) || getNombre(r))).size}</strong> aprendices. Estos estudiantes requieren plan de mejoramiento académico inmediato.
          </p>
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
            placeholder="Buscar por aprendiz, documento o resultado de aprendizaje..."
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

          <div className="text-xs font-bold text-red-600 bg-red-50/50 px-3.5 py-2.5 rounded-xl border border-red-100 uppercase tracking-wider whitespace-nowrap">
            {uniqueStudentsCount} Aprendices Afectados
          </div>
        </div>
      </div>

      {/* Tabla */}
      {filteredRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase">Sin resultados no aprobados</h3>
          <p className="text-xs text-slate-400 mt-1">Felicidades. No se encontraron registros reprobados con los criterios actuales.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-6 py-4">Aprendiz</th>
                  <th className="px-6 py-4">Estado Matrícula</th>
                  <th className="px-6 py-4">Ficha</th>
                  <th className="px-6 py-4">Resultado de Aprendizaje / Competencia</th>
                  <th className="px-6 py-4">Instructor Calificador</th>
                  <th className="px-6 py-4">Juicio</th>
                  <th className="px-6 py-4">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((r, i) => (
                  <tr key={i} className="hover:bg-red-50/5 hover:bg-slate-50/50 transition-colors bg-red-50/10">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 text-xs tracking-tight">{getNombre(r)}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{getDoc(r)}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-500 text-xs uppercase">{getEstado(r)}</td>
                    <td className="px-6 py-4 font-bold text-slate-500 text-xs">{r._ficha}</td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="text-xs text-slate-700 font-medium leading-relaxed" title={getRA(r)}>
                        {getRA(r)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1 truncate" title={getCompetencia(r)}>
                        {getCompetencia(r)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">{getInstructor(r) || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-100">
                        {getJuicio(r)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {getFecha(r) || '—'}
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
      )}
    </div>
  );
}
