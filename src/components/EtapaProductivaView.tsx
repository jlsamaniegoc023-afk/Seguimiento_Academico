/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { SofiaRow, FichaMeta } from '../types';
import { getDoc, getNombre, getEstado, getJuicio, getCompetencia, esEtapaPractica } from '../utils';
import { GraduationCap, Search, Award, Clock, ChevronLeft, ChevronRight, Check, Upload, FileSpreadsheet, Trash2, Play, Sparkles, X, CheckCircle2, AlertCircle } from 'lucide-react';

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

interface EpDetail {
  alternativa_ep: string;
  nombre_empresa_caprendizaje: string;
  n_contrato_caprendizaje: string;
  fecha_inicio_ep_caprendizaje: string;
  fecha_fin_ep_caprendizaje: string;
  estado_ep_caprendizaje: string;
  
  // Dynamic fields from alternative/group report format
  id_grupo?: string;
  fecha_inicio_lectiva?: string;
  fecha_fin_grupo?: string;
  duracion_pro?: string;
  fecha_inicio_productiva?: string;
  estado_grupo?: string;
  nivel_formacion?: string;
  codigo_programa?: string;
  version_programa?: string;
  nombre_programa?: string;
  tipo_documento?: string;
  celular?: string;
  correo?: string;
}

interface AnalysisDetail {
  doc: string;
  nombre: string;
  alternativa: string;
  empresa: string;
  contrato: string;
  inicio: string;
  fin: string;
  estado: string;
  isCandidate: boolean;
}

interface AnalysisSummary {
  fileName: string;
  totalParsed: number;
  matchedCount: number;
  details: AnalysisDetail[];
}

function normalizeDoc(d: any): string {
  if (d == null) return '';
  let s = String(d).trim();
  if (s.endsWith('.0')) {
    s = s.substring(0, s.length - 2);
  }
  // Strip dots, commas, hyphens, and whitespace to normalize raw digits/letters
  s = s.replace(/[\.,\s-]/g, '');
  return s;
}



export default function EtapaProductivaView({
  rows,
  fichas,
  selectedFichaId,
  setSelectedFichaId
}: EtapaProductivaViewProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllApprentices, setShowAllApprentices] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [analysisQuery, setAnalysisQuery] = useState('');

  const [epData, setEpData] = useState<{ [doc: string]: EpDetail[] }>(() => {
    try {
      const saved = localStorage.getItem('sena_ep_details');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error(e);
      return {};
    }
  });

  const getEpDetailsForDoc = useCallback((doc: string): EpDetail[] => {
    const target = normalizeDoc(doc);
    if (!target) return [];
    
    // Direct match
    if (epData[target]) return epData[target];
    
    // Fallback match of normalized keys
    const foundKey = Object.keys(epData).find(k => normalizeDoc(k) === target);
    if (foundKey) return epData[foundKey];
    
    return [];
  }, [epData]);

  const uniqueFichas = useMemo(() => {
    return Array.from(new Set(rows.map(r => r._ficha))).filter(Boolean);
  }, [rows]);

  // Compute all apprentices first
  const allApprentices = useMemo(() => {
    const apprentices: { [doc: string]: Candidate } = {};

    const activeRows = selectedFichaId 
      ? rows.filter(r => r._ficha === selectedFichaId) 
      : rows;

    activeRows.forEach(r => {
      const doc = normalizeDoc(getDoc(r));
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

    return Object.values(apprentices);
  }, [rows, selectedFichaId]);

  // Filter candidates who are fully approved academically but have productive stage pending
  const candidates = useMemo(() => {
    return allApprentices.filter(a => 
      a.noAprobados === 0 &&
      a.pendOtros === 0 &&
      a.pendEtapa >= 1 &&
      a.aprobados >= 1
    );
  }, [allApprentices]);

  // Apply search query filter and toggle
  const filteredCandidates = useMemo(() => {
    const baseList = showAllApprentices ? allApprentices : candidates;
    if (!query) return baseList;
    const q = query.toLowerCase();
    return baseList.filter(a => 
      a.nombre.toLowerCase().includes(q) ||
      a.doc.includes(q) ||
      a.ficha.includes(q)
    );
  }, [allApprentices, candidates, showAllApprentices, query]);

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

  const formatEpDate = (d: string) => {
    if (!d || d === '0000-00-00') return '—';
    return d;
  };

  const parseEpFileAndAnalyze = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let raw: any[][] = [];

        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        if (!raw || raw.length === 0) {
          alert('El archivo de Excel está vacío.');
          return;
        }

        // Find header row
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(raw.length, 30); i++) {
          const r = raw[i];
          if (r && r.some(cell => {
            const s = String(cell || '').toLowerCase().trim();
            return s.includes('numero_documento') || s.includes('documento') || s.includes('identificacion') || s.includes('numero de documento');
          })) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0;
        }

        const headers = (raw[headerRowIdx] || []).map(h => String(h || '').trim());

        const findColumnIndex = (hdrs: string[], keywords: string[]) => {
          return hdrs.findIndex(h => {
            const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return keywords.some(k => {
              const normK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return norm.includes(normK);
            });
          });
        };

        const docIdx = findColumnIndex(headers, ['numero_documento', 'documento', 'cedula', 'identificacion', 'num_doc', 'numero documento', 'id', 'num doc', 'nro documento', 'nro_documento']);
        const altIdx = findColumnIndex(headers, ['alternativa_ep', 'alternativa', 'modalidad', 'alternativa ep', 'tipo_alternativa', 'tipo alternativa']);
        const empIdx = findColumnIndex(headers, ['nombre_empresa_caprendizaje', 'nombre_empresa', 'empresa', 'razon_social', 'nombre de empresa', 'nombre empresa', 'razon social']);
        const conIdx = findColumnIndex(headers, ['n_contrato_caprendizaje', 'n_contrato', 'contrato', 'numero_contrato', 'numero de contrato', 'num contrato', 'num_contrato', 'nro contrato', 'nro_contrato']);
        const iniIdx = findColumnIndex(headers, ['fecha_inicio_ep_caprendizaje', 'fecha_inicio_ep_sofia', 'inicio_ep', 'inicio ep', 'fecha_inicio_total_ep_aprendiz', 'fecha inicio', 'fecha_inicio', 'fecha_inicio_ep', 'fecha inicio ep']);
        const finIdx = findColumnIndex(headers, ['fecha_fin_ep_caprendizaje', 'fecha_fin_ep_sofia', 'fin_ep', 'fin ep', 'fecha_fin_total_ep_aprendiz', 'fecha fin', 'fecha_fin', 'fecha_fin_ep', 'fecha fin ep']);
        const estIdx = findColumnIndex(headers, ['estado_ep_caprendizaje', 'estado_ep', 'estado ep', 'estado_aprendiz', 'estado', 'estado ep aprendiz']);

        // Group-alternative report columns (specific mapping for the new layout)
        let idGrupoIdx = -1;
        let fechaInicioLectivaIdx = -1;
        let fechaFinGrupoIdx = -1;
        let duracionProIdx = -1;
        let fechaInicioProductivaIdx = -1;
        let estadoGrupoIdx = -1;
        let nivelFormacionIdx = -1;
        let codigoProgramaIdx = -1;
        let versionProgramaIdx = -1;
        let nombreProgramaIdx = -1;
        let celularIdx = -1;
        let correoIdx = -1;

        headers.forEach((h, idx) => {
          const norm = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          
          if (norm === 'id_grupo' || norm === 'id grupo' || norm === 'grupo') {
            idGrupoIdx = idx;
          } else if (norm.startsWith('fecha_inicio') || norm.startsWith('fecha inicio') || norm === 'fecha_inicio_' || norm === 'fecha_inicio') {
            if (fechaInicioLectivaIdx === -1) {
              fechaInicioLectivaIdx = idx;
            } else {
              fechaInicioProductivaIdx = idx;
            }
          } else if (norm.includes('fecha_fin_gru') || norm.includes('fecha_fin_grupo') || norm.includes('fecha fin') || norm.includes('fecha_fin')) {
            fechaFinGrupoIdx = idx;
          } else if (norm.includes('duracion_pro') || norm.includes('duracion_programa') || norm.includes('duracion')) {
            duracionProIdx = idx;
          } else if (norm.includes('estado_grupo') || norm.includes('estado_grupc') || norm.includes('estado grupo')) {
            estadoGrupoIdx = idx;
          } else if (norm.includes('nivel_formacion') || norm.includes('nivel_formaci') || norm.includes('nivel formacion')) {
            nivelFormacionIdx = idx;
          } else if (norm.includes('codigo_programa') || norm.includes('codigo_progr') || norm.includes('codigo programa')) {
            codigoProgramaIdx = idx;
          } else if (norm.includes('version_programa') || norm.includes('version_progr') || norm.includes('version programa')) {
            versionProgramaIdx = idx;
          } else if (norm.includes('nombre_programa') || norm.includes('nombre_progr') || norm.includes('nombre programa') || norm.includes('programa')) {
            nombreProgramaIdx = idx;
          } else if (norm === 'celular' || norm === 'telefono' || norm === 'movil') {
            celularIdx = idx;
          } else if (norm === 'correo' || norm === 'corre' || norm === 'email') {
            correoIdx = idx;
          }
        });

        if (docIdx === -1) {
          alert('No se encontró la columna de documento (numero_documento) en el archivo.');
          return;
        }

        const newEpData = { ...epData };
        let countNew = 0;
        const detailsList: AnalysisDetail[] = [];

        // Pre-build set of candidate docs for O(1) checks
        const allCandidateDocs = new Set(candidates.map(c => normalizeDoc(c.doc)));

        raw.slice(headerRowIdx + 1).forEach(r => {
          if (!r || r.length <= docIdx) return;
          const doc = normalizeDoc(r[docIdx]);
          if (!doc) return;

          const detail: EpDetail = {
            alternativa_ep: altIdx !== -1 ? String(r[altIdx] || '').trim() : '',
            nombre_empresa_caprendizaje: empIdx !== -1 ? String(r[empIdx] || '').trim() : '',
            n_contrato_caprendizaje: conIdx !== -1 ? String(r[conIdx] || '').trim() : '',
            fecha_inicio_ep_caprendizaje: iniIdx !== -1 ? String(r[iniIdx] || '').trim() : '',
            fecha_fin_ep_caprendizaje: finIdx !== -1 ? String(r[finIdx] || '').trim() : '',
            estado_ep_caprendizaje: estIdx !== -1 ? String(r[estIdx] || '').trim() : '',

            id_grupo: idGrupoIdx !== -1 ? String(r[idGrupoIdx] || '').trim() : '',
            fecha_inicio_lectiva: fechaInicioLectivaIdx !== -1 ? String(r[fechaInicioLectivaIdx] || '').trim() : '',
            fecha_fin_grupo: fechaFinGrupoIdx !== -1 ? String(r[fechaFinGrupoIdx] || '').trim() : '',
            duracion_pro: duracionProIdx !== -1 ? String(r[duracionProIdx] || '').trim() : '',
            fecha_inicio_productiva: fechaInicioProductivaIdx !== -1 ? String(r[fechaInicioProductivaIdx] || '').trim() : '',
            estado_grupo: estadoGrupoIdx !== -1 ? String(r[estadoGrupoIdx] || '').trim() : '',
            nivel_formacion: nivelFormacionIdx !== -1 ? String(r[nivelFormacionIdx] || '').trim() : '',
            codigo_programa: codigoProgramaIdx !== -1 ? String(r[codigoProgramaIdx] || '').trim() : '',
            version_programa: versionProgramaIdx !== -1 ? String(r[versionProgramaIdx] || '').trim() : '',
            nombre_programa: nombreProgramaIdx !== -1 ? String(r[nombreProgramaIdx] || '').trim() : '',
            celular: celularIdx !== -1 ? String(r[celularIdx] || '').trim() : '',
            correo: correoIdx !== -1 ? String(r[correoIdx] || '').trim() : ''
          };

          const apprenticeRow = rows.find(x => normalizeDoc(getDoc(x)) === doc);
          const apprenticeName = apprenticeRow ? getNombre(apprenticeRow) : 'No en Base de Datos';
          const isCandidate = allCandidateDocs.has(doc);

          const hasData = 
            detail.alternativa_ep || 
            detail.nombre_empresa_caprendizaje || 
            detail.estado_ep_caprendizaje ||
            detail.id_grupo ||
            detail.nombre_programa ||
            detail.fecha_inicio_productiva ||
            detail.celular ||
            detail.correo;

          if (hasData) {
            if (!newEpData[doc]) {
              newEpData[doc] = [];
            }
            
            const exists = newEpData[doc].some(existing => 
              normalizeDoc(existing.alternativa_ep) === normalizeDoc(detail.alternativa_ep) &&
              normalizeDoc(existing.nombre_empresa_caprendizaje) === normalizeDoc(detail.nombre_empresa_caprendizaje) &&
              normalizeDoc(existing.n_contrato_caprendizaje) === normalizeDoc(detail.n_contrato_caprendizaje) &&
              normalizeDoc(existing.fecha_inicio_ep_caprendizaje) === normalizeDoc(detail.fecha_inicio_ep_caprendizaje) &&
              normalizeDoc(existing.fecha_fin_ep_caprendizaje) === normalizeDoc(detail.fecha_fin_ep_caprendizaje) &&
              normalizeDoc(existing.estado_ep_caprendizaje) === normalizeDoc(detail.estado_ep_caprendizaje) &&
              normalizeDoc(existing.id_grupo) === normalizeDoc(detail.id_grupo) &&
              normalizeDoc(existing.nombre_programa) === normalizeDoc(detail.nombre_programa)
            );

            if (!exists) {
              newEpData[doc].push(detail);
              countNew++;
            }

            detailsList.push({
              doc,
              nombre: apprenticeName,
              alternativa: detail.alternativa_ep || detail.nombre_programa || 'Sin alternativa',
              empresa: detail.nombre_empresa_caprendizaje || detail.id_grupo || '—',
              contrato: detail.n_contrato_caprendizaje || (detail.codigo_programa ? `Prog: ${detail.codigo_programa}` : ''),
              inicio: detail.fecha_inicio_productiva || detail.fecha_inicio_ep_caprendizaje || '',
              fin: detail.fecha_fin_grupo || detail.fecha_fin_ep_caprendizaje || '',
              estado: detail.estado_ep_caprendizaje || detail.estado_grupo || '',
              isCandidate
            });
          }
        });

        setEpData(newEpData);
        localStorage.setItem('sena_ep_details', JSON.stringify(newEpData));

        setAnalysisSummary({
          fileName: file.name,
          totalParsed: detailsList.length,
          matchedCount: detailsList.filter(d => d.isCandidate).length,
          details: detailsList
        });

        alert(`¡Análisis completado con éxito!\nSe procesaron ${detailsList.length} registros.\nSe actualizaron los datos en el dashboard de forma persistente.`);
      } catch (err) {
        console.error(err);
        alert('Error al analizar el archivo de Excel.');
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        setPendingFile(file);
        setAnalysisSummary(null);
      } else {
        alert('Por favor carga un archivo de Excel (.xlsx, .xls)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFile(e.target.files[0]);
      setAnalysisSummary(null);
    }
  };

  const executeAnalysis = () => {
    if (!pendingFile) {
      alert('Por favor selecciona o arrastra primero un archivo.');
      return;
    }
    parseEpFileAndAnalyze(pendingFile);
  };

  const filteredAnalysisDetails = useMemo(() => {
    if (!analysisSummary) return [];
    if (!analysisQuery) return analysisSummary.details;
    const q = analysisQuery.toLowerCase();
    return analysisSummary.details.filter(d => 
      d.nombre.toLowerCase().includes(q) ||
      d.doc.includes(q) ||
      d.alternativa.toLowerCase().includes(q) ||
      d.empresa.toLowerCase().includes(q)
    );
  }, [analysisSummary, analysisQuery]);

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

      {/* Selector de Filtro de Aprendices */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl flex gap-1.5 max-w-lg shadow-inner">
        <button
          type="button"
          onClick={() => setShowAllApprentices(false)}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            !showAllApprentices
              ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          🎓 Solo Candidatos Aptos ({candidates.length})
        </button>
        <button
          type="button"
          onClick={() => setShowAllApprentices(true)}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            showAllApprentices
              ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          }`}
        >
          👥 Todos los Aprendices ({allApprentices.length})
        </button>
      </div>

      {/* Grid of Candidates */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <GraduationCap className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 uppercase">
            {showAllApprentices ? 'No se encontraron aprendices' : 'No se encontraron candidatos'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            {showAllApprentices 
              ? 'No hay ningún aprendiz que coincida con los filtros de búsqueda o la ficha seleccionada.'
              : 'No hay ningún aprendiz que cumpla con los requisitos (100% académico aprobado y únicamente el juicio de la etapa práctica pendiente).'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((a, i) => {
            const totalJuicios = a.aprobados + a.noAprobados + a.pendEtapa + a.pendOtros;
            const progressPercent = totalJuicios > 0 ? Math.round((a.aprobados / totalJuicios) * 100) : 0;
            const isApto = a.noAprobados === 0 && a.pendOtros === 0 && a.pendEtapa >= 1 && a.aprobados >= 1;

            return (
              <div 
                key={i} 
                className={`bg-white border border-slate-200 border-l-4 rounded-r-2xl rounded-l-md p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  isApto ? 'border-l-sena' : 'border-l-amber-500'
                }`}
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
                    {isApto ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Check className="w-3 h-3 mr-1" />
                        Apto
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                        <Clock className="w-3 h-3 mr-1" />
                        En Progreso
                      </span>
                    )}
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
                      <span className={`${isApto ? 'text-sena' : 'text-amber-600'} font-extrabold`}>
                        {progressPercent}% Completado
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${isApto ? 'bg-sena' : 'bg-amber-500'}`} 
                        style={{ width: `${progressPercent}%` }} 
                      />
                    </div>
                  </div>

                  {/* EP Details Container inside apprentice card */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Seguimiento Etapa Productiva:</p>
                    {(() => {
                      const epList = getEpDetailsForDoc(a.doc);
                      return epList.length > 0 ? (
                        <div className="space-y-2">
                          {epList.map((ep, epIdx) => {
                            const statusVal = ep.estado_ep_caprendizaje || ep.estado_grupo || '';
                            const isGreen = statusVal.toUpperCase().includes('VIGENTE') || 
                                            statusVal.toUpperCase().includes('ACTIVO') || 
                                            statusVal.toUpperCase().includes('EJECUCION');
                            const isBlue = statusVal.toUpperCase().includes('TERMINADO') || 
                                           statusVal.toUpperCase().includes('CONCLUIDO');
                            
                            return (
                              <div key={epIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-extrabold text-slate-800 uppercase text-[10.5px] leading-tight">
                                    {ep.alternativa_ep || ep.nombre_programa || 'Sin alternativa registrada'}
                                  </span>
                                  {statusVal && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                      isGreen
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : isBlue
                                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                                          : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                      {statusVal}
                                    </span>
                                  )}
                                </div>
                                
                                {ep.nombre_empresa_caprendizaje && (
                                  <p className="text-[11px] font-bold text-slate-700 uppercase leading-snug">
                                    <span className="text-slate-400 font-semibold normal-case">Empresa:</span> {ep.nombre_empresa_caprendizaje}
                                  </p>
                                )}

                                {ep.n_contrato_caprendizaje && (
                                  <p className="text-[11px] font-mono font-bold text-slate-600 leading-snug">
                                    <span className="text-slate-400 font-sans font-semibold normal-case">Contrato:</span> {ep.n_contrato_caprendizaje}
                                  </p>
                                )}

                                {ep.id_grupo && (
                                  <p className="text-[11px] font-bold text-slate-700 uppercase leading-snug">
                                    <span className="text-slate-400 font-semibold normal-case">Ficha Grupo:</span> {ep.id_grupo}
                                    {ep.nivel_formacion && <span className="text-[10px] text-slate-500 font-normal normal-case"> ({ep.nivel_formacion})</span>}
                                  </p>
                                )}

                                {ep.codigo_programa && (
                                  <p className="text-[11px] font-mono text-slate-600 leading-snug">
                                    <span className="text-slate-400 font-sans font-semibold normal-case">Código Prog:</span> {ep.codigo_programa} {ep.version_programa ? `(v${ep.version_programa})` : ''}
                                  </p>
                                )}

                                {(ep.celular || ep.correo) && (
                                  <p className="text-[11.5px] text-slate-700 leading-snug">
                                    <span className="text-slate-400 font-semibold">Contacto:</span> {ep.celular || '—'} | <span className="lowercase text-slate-500 font-semibold">{ep.correo || '—'}</span>
                                  </p>
                                )}

                                {(() => {
                                  const start = ep.fecha_inicio_productiva || ep.fecha_inicio_ep_caprendizaje;
                                  const fin = ep.fecha_fin_grupo || ep.fecha_fin_ep_caprendizaje;
                                  if (start || fin) {
                                    return (
                                      <div className="pt-0.5 border-t border-slate-100/50 mt-1">
                                        <p className="text-[10px] font-bold text-slate-600">
                                          <span className="text-slate-400 font-semibold normal-case">Fechas EP:</span> {formatEpDate(start)} — {formatEpDate(fin)}
                                        </p>
                                        {ep.fecha_inicio_lectiva && (
                                          <p className="text-[9px] text-slate-400 font-medium normal-case mt-0.5">
                                            Inicio Lectiva: {formatEpDate(ep.fecha_inicio_lectiva)} {ep.duracion_pro ? `· Duración: ${ep.duracion_pro} meses` : ''}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Sin registros cargados. Sube el Excel arriba.
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {isApto ? (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center gap-2 p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Único Juicio Pendiente</p>
                      <p className="text-[10px] font-black text-slate-800 uppercase leading-snug">
                        Resultados de Aprendizaje Etapa Práctica / Productiva
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Detalles de Pendientes</p>
                        <p className="text-[10px] font-black text-slate-700 uppercase leading-snug">
                          {a.pendOtros > 0 ? `${a.pendOtros} RAs Académicos Pendientes` : ''}
                          {a.pendOtros > 0 && a.noAprobados > 0 ? ' y ' : ''}
                          {a.noAprobados > 0 ? `${a.noAprobados} Juicios No Aprobados` : ''}
                          {a.pendOtros === 0 && a.noAprobados === 0 && a.pendEtapa === 0 ? 'Sin juicios pendientes cargados' : ''}
                          {a.pendOtros === 0 && a.noAprobados === 0 && a.pendEtapa > 0 ? 'Etapa Práctica/Productiva Pendiente' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Página {currentPage} de {totalPages} — {filteredCandidates.length} {showAllApprentices ? 'aprendices' : 'candidatos'}
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

