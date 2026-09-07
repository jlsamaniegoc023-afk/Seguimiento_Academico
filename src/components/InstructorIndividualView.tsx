import React, { useState, useMemo } from 'react';
import { Search, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { ReporteHorasRecord, cleanInstructorName } from './HorasReportadasView';
import { InstructorTrendChart, InstructorBreakdownChart } from './HorasCharts';
import { generateInstructoresTiemposPDF, getAlertForHours } from '../services/instructorTiemposPdfService';

interface InstructorIndividualViewProps {
  records: ReporteHorasRecord[];
  monthsList: string[];
}

export function InstructorIndividualView({ records, monthsList }: InstructorIndividualViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  const titleCase = (s: string) => {
    return (s || '').toLowerCase().replace(/(^|\s)\S/g, t => t.toUpperCase());
  };

  const handleDownloadInstructorPdf = async (instructorId?: string) => {
    setIsGeneratingPdf(true);
    setPdfMsg(null);
    try {
      await generateInstructoresTiemposPDF({
        records,
        monthsList,
        selectedInstructorId: instructorId || selectedInstructorId || null,
      });
      setPdfMsg('¡PDF generado y descargado correctamente!');
      setTimeout(() => setPdfMsg(null), 4000);
    } catch (err: any) {
      console.error('Error generando PDF individual:', err);
      setPdfMsg('Error al generar el PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderVincPill = (v: string) => {
    const norm = (v || '').toUpperCase();
    if (norm.includes('CONTRATISTA')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EAF7E0] text-[#2C7A00] font-extrabold text-[11px] whitespace-nowrap">Contratista Sena</span>;
    }
    if (norm.includes('CARRERA')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#E4F0FB] text-[#1666BA] font-extrabold text-[11px] whitespace-nowrap">Carrera Administrativa</span>;
    }
    if (norm.includes('PROVISIONAL')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FDEFE0] text-[#E07A00] font-extrabold text-[11px] whitespace-nowrap">Nombramiento Provisional</span>;
    }
    if (norm.includes('ORDINARIO')) {
      return <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F3EBFF] text-[#7A4FBF] font-extrabold text-[11px] whitespace-nowrap">Nombramiento Ordinario</span>;
    }
    return <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-[11px] whitespace-nowrap">{titleCase(v)}</span>;
  };

  // Group unique instructors
  const instructorList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; doc: string; vinculacion: string }>();

    records.forEach(r => {
      const cName = cleanInstructorName(r.instructor || 'INSTRUCTOR SIN NOMBRE');
      const doc = r.documentoInstructor || '';
      const key = doc || cName.toUpperCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: cName.toUpperCase(),
          doc,
          vinculacion: r.vinculacion || 'CONTRATISTA SENA'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  // Filtered list for search box
  const matchingInstructors = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return instructorList.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.doc.includes(q)
    ).slice(0, 15);
  }, [instructorList, searchQuery]);

  // Monthly data for selected instructor
  const selectedInstructorData = useMemo(() => {
    if (!selectedInstructorId) return null;

    const instRecords = records.filter(r => {
      const doc = r.documentoInstructor || '';
      const key = doc || (r.instructor || '').toUpperCase().trim();
      return key === selectedInstructorId || (r.instructor || '').toUpperCase().trim() === selectedInstructorId.toUpperCase().trim();
    });

    if (instRecords.length === 0) return null;

    const first = instRecords[0];
    const instructorName = cleanInstructorName(first.instructor || '');
    const documento = first.documentoInstructor || selectedInstructorId;

    const monthsToUse = monthsList && monthsList.length > 0 
      ? monthsList 
      : ["Febrero", "Marzo", "Abril", "Mayo", "Junio"];

    const monthlyRows = monthsToUse.map(m => {
      const monthName = m.toLowerCase().trim();
      const matchingRecs = instRecords.filter(r => {
        if (!r.hoja) return false;
        const h = r.hoja.toLowerCase().trim();
        return h === monthName || h.includes(monthName) || monthName.includes(h);
      });

      if (matchingRecs.length > 0) {
        const sumFormacion = matchingRecs.reduce((s, r) => s + (r.totalHorasFormacion !== undefined && r.totalHorasFormacion !== null ? r.totalHorasFormacion : ((r.horasTituladaLectiva || 0) + (r.horasComplementaria || 0))), 0);
        const sumAdicionales = matchingRecs.reduce((s, r) => s + (r.horasAdicionales || 0), 0);
        const sumTotal = matchingRecs.reduce((s, r) => s + (r.totalHorasInstructor !== undefined && r.totalHorasInstructor !== null ? r.totalHorasInstructor : (r.horasEjecutadas || 0)), 0);
        const vinc = matchingRecs[0].vinculacion || first.vinculacion || 'CONTRATISTA SENA';

        return {
          MES: m,
          TIPO_VINCULACION: vinc,
          TOTAL_H_FORMACION: sumFormacion,
          TOTAL_H_ADICIONALES: sumAdicionales,
          TOTAL_H_INSTRUCTOR: sumTotal
        };
      }

      return {
        MES: m,
        TIPO_VINCULACION: first.vinculacion || 'CONTRATISTA SENA',
        TOTAL_H_FORMACION: 0,
        TOTAL_H_ADICIONALES: 0,
        TOTAL_H_INSTRUCTOR: 0
      };
    });

    const activeRows = monthlyRows.length > 0 ? monthlyRows : instRecords.map(r => ({
      MES: r.hoja || 'Febrero',
      TIPO_VINCULACION: r.vinculacion || 'CONTRATISTA SENA',
      TOTAL_H_FORMACION: r.totalHorasFormacion || 0,
      TOTAL_H_ADICIONALES: r.horasAdicionales || 0,
      TOTAL_H_INSTRUCTOR: r.totalHorasInstructor || 0
    }));

    const totalHoras = activeRows.reduce((s, r) => s + r.TOTAL_H_INSTRUCTOR, 0);
    const promedioMensual = activeRows.length > 0 ? (totalHoras / activeRows.length) : 0;
    
    let maxMonth = activeRows[0] || { MES: 'N/A', TOTAL_H_INSTRUCTOR: 0 };
    let minMonth = activeRows[0] || { MES: 'N/A', TOTAL_H_INSTRUCTOR: 0 };

    activeRows.forEach(r => {
      if (r.TOTAL_H_INSTRUCTOR > maxMonth.TOTAL_H_INSTRUCTOR) maxMonth = r;
      if (r.TOTAL_H_INSTRUCTOR < minMonth.TOTAL_H_INSTRUCTOR) minMonth = r;
    });

    const trendData = activeRows.map(r => ({
      mes: r.MES,
      total: r.TOTAL_H_INSTRUCTOR
    }));

    const breakdownData = activeRows.map(r => ({
      mes: r.MES,
      formacion: r.TOTAL_H_FORMACION,
      adicionales: r.TOTAL_H_ADICIONALES
    }));

    const lastVinc = activeRows[activeRows.length - 1]?.TIPO_VINCULACION || first.vinculacion || 'CONTRATISTA SENA';

    return {
      instructorName,
      documento,
      vinculacion: lastVinc,
      monthlyRows: activeRows,
      totalHoras,
      promedioMensual,
      maxMonth,
      minMonth,
      trendData,
      breakdownData
    };
  }, [selectedInstructorId, records]);

  return (
    <div className="space-y-6">
      
      {/* CARD: BUSCAR INSTRUCTOR */}
      <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-base font-bold text-[#1F2A24]">Buscar Instructor</h3>
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Escribe un nombre o número de cédula..."
          className="w-full bg-white border border-[#DCE5DC] focus:border-[#39A900] text-sm font-semibold rounded-lg px-4 py-2.5 outline-none transition-all"
        />

        {matchingInstructors.length > 0 && (
          <div className="border border-[#DCE5DC] rounded-lg max-h-[220px] overflow-y-auto divide-y divide-[#DCE5DC]">
            {matchingInstructors.map(inst => (
              <div
                key={inst.id}
                onClick={() => {
                  setSelectedInstructorId(inst.id);
                  setSearchQuery(titleCase(inst.name));
                }}
                className="p-2.5 hover:bg-[#EAF7E0]/40 transition-all cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-slate-800 font-bold uppercase">{titleCase(inst.name)}</strong>
                  {inst.doc && <span className="text-[#5B6B62] ml-2">— {inst.doc}</span>}
                </div>
                {renderVincPill(inst.vinculacion)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETALLE DEL INSTRUCTOR SELECCIONADO */}
      {selectedInstructorData ? (
        <div className="space-y-6">
          
          {/* INSTRUCTOR TOP ACTION BAR */}
          <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                  {titleCase(selectedInstructorData.instructorName)}
                </h2>
                {(() => {
                  const avg = selectedInstructorData.promedioMensual;
                  if (avg < 100) {
                    return (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-xs">
                        🚨 Alerta Baja Carga (&lt; 100h / mes)
                      </span>
                    );
                  }
                  if (avg >= 100 && avg <= 140) {
                    return (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">
                        ⚠️ Alerta Intermedia (100–140h / mes)
                      </span>
                    );
                  }
                  if (avg > 190) {
                    return (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-xs">
                        🔴 Alerta Sobrecarga (&gt; 190h / mes)
                      </span>
                    );
                  }
                  return (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                      🟢 Carga Horaria Óptima (140–190h)
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-[#5B6B62] mt-0.5">
                Centro Minero · Regional Boyacá · Registro de Tiempos Vigencia 2026
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadInstructorPdf(selectedInstructorData.id)}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-[#EAF7E0] hover:bg-[#d5eed0] text-[#2C7A00] font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-[#39A900]/40 cursor-pointer shadow-xs disabled:opacity-50"
                title="Descargar hoja individual de tiempos y alertas en formato PDF oficial"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#2C7A00]" />
                ) : (
                  <FileText className="w-4 h-4 text-[#2C7A00]" />
                )}
                <span>Descargar Hoja PDF</span>
              </button>

              <button
                onClick={() => handleDownloadInstructorPdf()}
                disabled={isGeneratingPdf}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Descargar informe completo con portada de alertas y todas las hojas"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Informe Completo</span>
              </button>
            </div>
          </div>

          {pdfMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>✓</span>
              <span>{pdfMsg}</span>
            </div>
          )}

          {/* KPI GRID INSTRUCTOR */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Vinculación</span>
              <div className="text-sm font-extrabold text-[#1F2A24] mt-1">{titleCase(selectedInstructorData.vinculacion)}</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Horas Acumuladas</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{selectedInstructorData.totalHoras.toLocaleString('es-CO')}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">{selectedInstructorData.monthlyRows.length} meses</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Promedio Mensual</span>
              <div className="text-2xl font-extrabold text-[#1F2A24] mt-1">{selectedInstructorData.promedioMensual.toFixed(1)}</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Mes con más horas</span>
              <div className="text-base font-extrabold text-[#1F2A24] mt-1">{selectedInstructorData.maxMonth.MES}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">{selectedInstructorData.maxMonth.TOTAL_H_INSTRUCTOR.toLocaleString('es-CO')} h</div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-4 shadow-xs">
              <span className="text-[11px] text-[#5B6B62] font-bold uppercase tracking-wider">Mes con menos horas</span>
              <div className="text-base font-extrabold text-[#1F2A24] mt-1">{selectedInstructorData.minMonth.MES}</div>
              <div className="text-xs font-semibold text-[#2C7A00] mt-0.5">{selectedInstructorData.minMonth.TOTAL_H_INSTRUCTOR.toLocaleString('es-CO')} h</div>
            </div>
          </div>

          {/* CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#1F2A24]">Evolución de Horas Totales</h3>
              <p className="text-xs text-[#5B6B62] mb-3">{titleCase(selectedInstructorData.instructorName)}</p>
              <div className="h-64">
                <InstructorTrendChart data={selectedInstructorData.trendData} />
              </div>
            </div>

            <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#1F2A24]">Formación vs Apoyo por Mes</h3>
              <p className="text-xs text-[#5B6B62] mb-3">Desglose mensual del instructor seleccionado</p>
              <div className="h-64">
                <InstructorBreakdownChart data={selectedInstructorData.breakdownData} />
              </div>
            </div>

          </div>

          {/* TABLE: DETALLE MES A MES */}
          <div className="bg-white border border-[#DCE5DC] rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-base font-bold text-[#1F2A24]">Detalle Mes a Mes y Diagnóstico de Alerta</h3>
            
            <div className="border border-[#DCE5DC] rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EAF7E0] text-[#2C7A00] font-extrabold uppercase text-[10.5px] tracking-wider border-b border-[#DCE5DC]">
                    <th className="p-3">Mes</th>
                    <th className="p-3">Vinculación</th>
                    <th className="p-3 text-right">H. Formación</th>
                    <th className="p-3 text-right">H. Apoyo</th>
                    <th className="p-3 text-right">Total Horas</th>
                    <th className="p-3 text-center">Diagnóstico de Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5DC]">
                  {selectedInstructorData.monthlyRows.map(row => {
                    const alertInfo = getAlertForHours(row.TOTAL_H_INSTRUCTOR);
                    let badgeClass = "bg-emerald-100 text-emerald-800";
                    let icon = "🟢";

                    if (alertInfo.type === 'BAJA') {
                      badgeClass = "bg-rose-100 text-rose-800";
                      icon = "🚨";
                    } else if (alertInfo.type === 'INTERMEDIA') {
                      badgeClass = "bg-amber-100 text-amber-800";
                      icon = "⚠️";
                    } else if (alertInfo.type === 'SOBRECARGA') {
                      badgeClass = "bg-purple-100 text-purple-800";
                      icon = "🔴";
                    }

                    return (
                      <tr key={row.MES} className="hover:bg-emerald-50/30">
                        <td className="p-2.5 font-bold text-slate-800">{row.MES}</td>
                        <td className="p-2.5">{renderVincPill(row.TIPO_VINCULACION)}</td>
                        <td className="p-2.5 text-right font-semibold">{row.TOTAL_H_FORMACION.toLocaleString('es-CO')}</td>
                        <td className="p-2.5 text-right font-semibold">{row.TOTAL_H_ADICIONALES.toLocaleString('es-CO')}</td>
                        <td className="p-2.5 text-right font-black text-slate-900 text-sm">{row.TOTAL_H_INSTRUCTOR.toLocaleString('es-CO')}</td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10.5px] whitespace-nowrap ${badgeClass}`}>
                            {icon} {alertInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="p-10 text-center text-[#5B6B62] bg-white border border-[#DCE5DC] rounded-xl text-sm font-semibold">
          Busca un instructor arriba para ver su evolución mes a mes.
        </div>
      )}

    </div>
  );
}
