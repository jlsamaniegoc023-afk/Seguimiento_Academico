/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SofiaRow, FichaMeta } from '../types';
import { getDoc, getNombre, getEstado, getJuicio, getCompetencia, esEtapaPractica } from '../utils';
import { GraduationCap, Search, Award, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface EtapaProductivaViewProps {
  rows: SofiaRow[];
  fichas: { [id: string]: FichaMeta };
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

interface Candidate {
  nombre: string;
  doc: string;
  estado: string;
  ficha: string;
  aprobados: number;
  noAprobados: number;
  pendEtapa: number;
  pendOtros: number;
}

export default function EtapaProductivaView({
  rows,
  fichas,
  selectedFichaId,
  setSelectedFichaId
}: EtapaProductivaViewProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  // Filter candidates who are fully approved academically but have productive stage pending
  const candidates = useMemo(() => {
    const apprentices: { [doc: string]: Candidate } = {};

    const activeRows = selectedFichaId 
      ? rows.filter(r => r._ficha === selectedFichaId) 
      : rows;

    activeRows.forEach(r => {
      const doc = getDoc(r);
      if (!doc) return;

      if (!apprentices[doc]) {
        apprentices[doc] = {
          nombre: getNombre(r),
          doc,
          estado: getEstado(r),
          ficha: r._ficha || 'N/A',
          aprobados: 0,
          noAprobados: 0,
          pendEtapa: 0,
          pendOtros: 0
        };
      }

      const a = apprentices[doc];
      const j = getJuicio(r);
      const comp = getCompetencia(r);

      if (j === 'APROBADO') {
        a.aprobados++;
      } else if (j === 'NO APROBADO') {
        a.noAprobados++;
      } else {
        if (esEtapaPractica(comp)) {
          a.pendEtapa++;
        } else {
          a.pendOtros++;
        }
      }
    });

    // filter candidate rules
    return Object.values(apprentices).filter(a => 
      a.noAprobados === 0 &&
      a.pendOtros === 0 &&
      a.pendEtapa >= 1 &&
      a.aprobados >= 1
    );
  }, [rows, selectedFichaId]);

  // Apply search query filter
  const filteredCandidates = useMemo(() => {
    if (!query) return candidates;
    const q = query.toLowerCase();
    return candidates.filter(a => 
      a.nombre.toLowerCase().includes(q) ||
      a.doc.includes(q) ||
      a.ficha.includes(q)
    );
  }, [candidates, query]);

  // Reset page
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedFichaId]);

  // Pagination
  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredCandidates.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredCandidates, currentPage]);

  return (
    <div className="space-y-6 view-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-sena" />
            Candidatos Etapa Productiva
          </h2>
          <p className="text-sm text-slate-500 font-medium">Aprendices listos para iniciar o certificar su etapa práctica (100% académico aprobado)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <select
            value={selectedFichaId}
            onChange={(e) => setSelectedFichaId(e.target.value)}
            className="w-full sm:w-80 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl py-2 px-3 focus:border-sena outline-none transition-all cursor-pointer shadow-sm animate-fade-in"
          >
            <option value="">Todas las fichas</option>
            {uniqueFichas.map(f => (
              <option key={f} value={f}>Ficha {f} — {fichas[f]?.programa || 'SENA'}</option>
            ))}
          </select>

          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Buscar candidato, documento o ficha..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-sena focus:ring-4 focus:ring-sena/10 outline-none transition-all shadow-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#f0fdf4] border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-sena shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-sena uppercase tracking-wider">Candidatos Aptos</p>
            <p className="text-2xl font-black text-sena leading-tight">{candidates.length}</p>
          </div>
        </div>

        {/* Selected Ficha & Program Denomination */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-sena shadow-sm">
            <GraduationCap className="w-5 h-5 text-sena" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Programa / Ficha Seleccionada</p>
            <p className="text-xs font-extrabold text-slate-800 leading-snug truncate uppercase">
              {selectedFichaId 
                ? `Ficha: ${selectedFichaId} — ${fichas[selectedFichaId]?.programa || 'No especificado'}`
                : 'Todas las Fichas de Caracterización'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Candidates */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <GraduationCap className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 uppercase">No se encontraron candidatos</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            No hay ningún aprendiz que cumpla con los requisitos (100% académico aprobado y únicamente el juicio de la etapa práctica pendiente).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((a, i) => (
            <div 
              key={i} 
              className="bg-white border border-slate-200 border-l-4 border-l-sena rounded-r-2xl rounded-l-md p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                      <GraduationCap className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight leading-tight">
                        {a.nombre}
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{a.doc}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Check className="w-3 h-3 mr-1" />
                    Apto
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mb-4">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ficha</p>
                    <p className="text-xs font-black text-slate-700">{a.ficha}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Estado</p>
                    <p className="text-xs font-black text-slate-700 truncate" title={a.estado}>{a.estado}</p>
                  </div>
                  <div className="p-2.5 bg-[#f0fdf4] rounded-xl border border-emerald-100 text-center">
                    <p className="text-[9px] font-bold text-sena uppercase mb-0.5">Aprobadas</p>
                    <p className="text-xs font-black text-sena">{a.aprobados}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Progreso Académico</span>
                    <span className="text-sena font-extrabold">100% Completado</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-sena" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Único Juicio Pendiente</p>
                  <p className="text-[10px] font-black text-slate-800 uppercase leading-snug">
                    Resultados de Aprendizaje Etapa Práctica / Productiva
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Página {currentPage} de {totalPages} — {filteredCandidates.length} candidatos
          </p>
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
  );
}
