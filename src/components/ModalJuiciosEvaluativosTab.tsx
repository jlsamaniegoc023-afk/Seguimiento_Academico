import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Upload,
  Download,
  ExternalLink,
  Search,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Award,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import {
  FichaCurricularDrive,
  formatIsoToDisplay,
} from '../services/gestionCurricularDriveService';
import {
  JUICIOS_EVALUATIVOS_DRIVE_FOLDER_URL,
  DriveJuiciosFileItem,
  JuiciosEvaluativosParsedReport,
  AprendizJuicioResumen,
  fetchJuiciosEvaluativosForFicha,
  parseJuiciosEvaluativosSpreadsheet,
  setManualJuiciosReportForFicha,
  getTodayBogotaIso,
  computeDaysElapsedToCurrentDate,
} from '../services/juiciosEvaluativosDriveService';

interface ModalJuiciosEvaluativosTabProps {
  fichaRecord: FichaCurricularDrive;
  driveJuiciosFiles: DriveJuiciosFileItem[];
  availableFichaCodesInBoard: Set<string>;
  onOpenOtherFicha?: (fichaCode: string) => void;
  onDriveFilesDiscovered?: (files: DriveJuiciosFileItem[]) => void;
}

type AvanceFilterMode = 'TODOS' | 'COMPLETO_100' | 'CON_PENDIENTES' | 'CON_NO_APROBADOS';

export default function ModalJuiciosEvaluativosTab({
  fichaRecord,
  driveJuiciosFiles,
  availableFichaCodesInBoard,
  onOpenOtherFicha,
  onDriveFilesDiscovered,
}: ModalJuiciosEvaluativosTabProps) {
  const localExcelInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);
  const [report, setReport] = useState<JuiciosEvaluativosParsedReport | null>(null);
  const [discoveredFiles, setDiscoveredFiles] =
    useState<DriveJuiciosFileItem[]>(driveJuiciosFiles);

  // Filtros interactivos de la tabla de resumen por aprendiz
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>('TODOS');
  const [avanceFilter, setAvanceFilter] = useState<AvanceFilterMode>('TODOS');
  const [expandedAprendizKey, setExpandedAprendizKey] = useState<string | null>(null);
  const [detailFilterJuicio, setDetailFilterJuicio] = useState<
    'TODOS' | 'APROBADO' | 'POR EVALUAR' | 'NO APROBADO'
  >('TODOS');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Fecha actual en tiempo real (America/Bogota) para calcular los días transcurridos en estado Por Certificar
  const todayBogotaIso = useMemo(() => getTodayBogotaIso(), []);
  const todayBogotaDisplay = useMemo(
    () => formatIsoToDisplay(todayBogotaIso),
    [todayBogotaIso]
  );

  const loadFromDrive = async (forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    setNotFoundMsg(null);
    try {
      const res = await fetchJuiciosEvaluativosForFicha(fichaRecord.ficha, forceRefresh);
      if (res.availableFiles && res.availableFiles.length > 0) {
        setDiscoveredFiles(res.availableFiles);
        onDriveFilesDiscovered?.(res.availableFiles);
      }
      if (res.status === 'not_found') {
        setReport(null);
        setNotFoundMsg(res.message);
      } else {
        setReport(res.report);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'No se pudo obtener el reporte de Juicios Evaluativos desde la carpeta de Google Drive.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery('');
    setSelectedEstadoFilter('TODOS');
    setAvanceFilter('TODOS');
    setExpandedAprendizKey(null);
    setDetailFilterJuicio('TODOS');
    setCurrentPage(1);
    loadFromDrive(false);
  }, [fichaRecord.ficha]);

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    setNotFoundMsg(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buf = ev.target?.result as ArrayBuffer;
        const parsed = parseJuiciosEvaluativosSpreadsheet(buf, fichaRecord.ficha, {
          fileName: `${file.name} (carga manual)`,
          modifiedTimeIso: new Date(file.lastModified).toISOString(),
        });
        setManualJuiciosReportForFicha(fichaRecord.ficha, parsed);
        setReport(parsed);
      } catch (err: any) {
        setErrorMsg(
          err?.message ||
            'El archivo Excel seleccionado no tiene un formato válido de Reporte de Juicios Evaluativos.'
        );
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo local.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Enriquecer cada aprendiz con los días exactos transcurridos a la fecha actual desde el cambio a Por Certificar
  const enrichedAprendices = useMemo(() => {
    if (!report) return [];
    return report.aprendices.map((ap) => {
      const diasTranscurridosPorCertificar = ap.esPorCertificar
        ? computeDaysElapsedToCurrentDate(
            ap.fechaCambioEstadoPorCertificarIso || ap.fechaInstructorAproboIso,
            todayBogotaIso
          )
        : null;
      return {
        ...ap,
        diasTranscurridosPorCertificar,
      };
    });
  }, [report, todayBogotaIso]);

  const aprendicesPorCertificar = useMemo(
    () => enrichedAprendices.filter((a) => a.esPorCertificar),
    [enrichedAprendices]
  );

  const porCertificarStats = useMemo(() => {
    const validDays = aprendicesPorCertificar
      .map((a) => a.diasTranscurridosPorCertificar)
      .filter((d): d is number => d !== null);
    if (validDays.length === 0) {
      return { maxDias: null, promedioDias: null, minDias: null, mayor30Count: 0 };
    }
    const maxDias = Math.max(...validDays);
    const minDias = Math.min(...validDays);
    const sum = validDays.reduce((acc, v) => acc + v, 0);
    const promedioDias = Math.round((sum / validDays.length) * 10) / 10;
    const mayor30Count = validDays.filter((d) => d > 30).length;
    return { maxDias, promedioDias, minDias, mayor30Count };
  }, [aprendicesPorCertificar]);

  const filteredAprendices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedAprendices.filter((ap) => {
      if (selectedEstadoFilter !== 'TODOS' && ap.estadoAprendiz !== selectedEstadoFilter) {
        return false;
      }
      if (avanceFilter === 'COMPLETO_100' && ap.porEvaluar + ap.noAprobados > 0) {
        return false;
      }
      if (avanceFilter === 'CON_PENDIENTES' && ap.porEvaluar <= 0) {
        return false;
      }
      if (avanceFilter === 'CON_NO_APROBADOS' && ap.noAprobados <= 0) {
        return false;
      }
      if (q) {
        const hit =
          ap.nombreCompleto.toLowerCase().includes(q) ||
          ap.numeroDocumento.toLowerCase().includes(q) ||
          ap.estadoAprendiz.toLowerCase().includes(q) ||
          ap.instructorAproboNombre.toLowerCase().includes(q) ||
          ap.instructorAproboDocumento.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [enrichedAprendices, selectedEstadoFilter, avanceFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedEstadoFilter, avanceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAprendices.length / pageSize));
  const paginatedAprendices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAprendices.slice(start, start + pageSize);
  }, [filteredAprendices, currentPage]);

  const handleExportResumenCsv = () => {
    if (!report) return;
    const headers = [
      'Ficha',
      'Tipo_Documento',
      'Numero_Documento',
      'Aprendiz',
      'Estado_Aprendiz',
      'Total_Resultados_Aprendizaje',
      'Aprobados',
      'Por_Evaluar',
      'No_Aprobados',
      'Porcentaje_Avance',
      'Fecha_Instructor_Aprobo_Juicio_Evaluativo',
      'Nombre_Instructor_Aprobo',
      'Documento_Instructor',
      'Fecha_Actual_Corte',
      'Dias_Transcurridos_Por_Certificar',
    ];
    const rowsCsv = [headers.join(';')];
    for (const ap of filteredAprendices) {
      rowsCsv.push(
        [
          report.fichaReporte || fichaRecord.ficha,
          ap.tipoDocumento,
          ap.numeroDocumento,
          `"${ap.nombreCompleto.replace(/"/g, '""')}"`,
          `"${ap.estadoAprendiz.replace(/"/g, '""')}"`,
          ap.totalResultados,
          ap.aprobados,
          ap.porEvaluar,
          ap.noAprobados,
          String(ap.porcentajeAvance).replace('.', ','),
          ap.esPorCertificar
            ? ap.fechaHoraInstructorAproboDisplay
            : ap.fechaInstructorAproboDisplay,
          `"${(ap.instructorAproboNombre || '—').replace(/"/g, '""')}"`,
          `"${ap.instructorAproboDocumento.replace(/"/g, '""')}"`,
          todayBogotaDisplay,
          ap.esPorCertificar && ap.diasTranscurridosPorCertificar !== null
            ? ap.diasTranscurridosPorCertificar
            : '',
        ].join(';')
      );
    }
    const blob = new Blob(['\uFEFF' + rowsCsv.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Resumen_Juicios_Evaluativos_Ficha_${fichaRecord.ficha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderAgingBadge = (dias: number | null) => {
    if (dias === null) {
      return <span className="text-xs font-mono tabular-nums text-slate-400">Sin fecha</span>;
    }
    const isCritical = dias > 30;
    const isWarning = dias > 15 && dias <= 30;

    return (
      <div className="inline-flex flex-col items-end">
        <span
          className={`text-xs font-mono tabular-nums font-extrabold whitespace-nowrap ${
            isCritical
              ? 'text-red-700'
              : isWarning
              ? 'text-amber-800'
              : 'text-emerald-800'
          }`}
        >
          {dias.toLocaleString('es-CO')} {dias === 1 ? 'día' : 'días'}
        </span>
        <span
          className={`text-[10px] font-semibold whitespace-nowrap ${
            isCritical
              ? 'text-red-600'
              : isWarning
              ? 'text-amber-700'
              : 'text-emerald-700'
          }`}
        >
          {isCritical ? 'Prioritario (>30d)' : isWarning ? 'Atención (16–30d)' : 'En término (≤15d)'}
        </span>
      </div>
    );
  };

  const renderEstadoAprendizText = (ap: AprendizJuicioResumen) => {
    const est = ap.estadoAprendiz;
    if (ap.esPorCertificar) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-teal-300 bg-teal-50 text-teal-900 text-[11px] font-bold whitespace-nowrap">
          <Award className="w-3 h-3 text-teal-700 shrink-0" />
          <span>{est}</span>
        </span>
      );
    }
    if (est.startsWith('CERTIFICAD')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-semibold whitespace-nowrap">
          {est}
        </span>
      );
    }
    if (est.includes('FORMACION') || est.includes('INDUCCION') || est.includes('TRANSITO')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-900 text-[11px] font-semibold whitespace-nowrap">
          {est}
        </span>
      );
    }
    if (est.includes('CANCEL') || est.includes('RETIRO') || est.includes('DESERC')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-red-200 bg-red-50/70 text-red-800 text-[11px] font-semibold whitespace-nowrap">
          {est}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-900 text-[11px] font-semibold whitespace-nowrap">
        {est}
      </span>
    );
  };

  const inspectAprendizRAs = (aprendizKey: string) => {
    setExpandedAprendizKey((prev) => (prev === aprendizKey ? null : aprendizKey));
    setDetailFilterJuicio('TODOS');
  };

  return (
    <div className="space-y-5">
      <input
        ref={localExcelInputRef}
        type="file"
        accept=".xls,.xlsx,.csv"
        onChange={handleLocalUpload}
        className="hidden"
      />

      {/* Barra superior de conexión con Google Drive y acciones */}
      <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span className="font-bold text-slate-900">
              Repositorio Drive Juicios Evaluativos
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-sena font-semibold">
              Patrón: Ficha {fichaRecord.ficha}...
            </span>
            {report && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="text-emerald-800 font-semibold truncate max-w-md"
                  title={report.fileName}
                >
                  {report.fileName}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
            <span className="font-mono tabular-nums text-slate-700 font-semibold">
              Fecha actual cálculo: {todayBogotaDisplay}
            </span>
            {report?.fechaReporteDisplay && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Fecha reporte SOFIA: {report.fechaReporteDisplay}
                </span>
              </>
            )}
            {report?.modifiedTimeDisplay && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Modificado en Drive: {report.modifiedTimeDisplay}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <a
              href={JUICIOS_EVALUATIVOS_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sena hover:text-sena-dark font-semibold underline decoration-sena/40 underline-offset-2 whitespace-nowrap"
            >
              <span>Abrir carpeta Google Drive</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadFromDrive(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar desde Drive</span>
          </button>

          <button
            type="button"
            onClick={() => localExcelInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Excel local</span>
          </button>

          {report && (
            <button
              type="button"
              onClick={handleExportResumenCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* ESTADO 1: CARGANDO DESDE GOOGLE DRIVE */}
      {isLoading && (
        <div className="p-6 rounded-lg border border-slate-200 bg-white space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <RefreshCw className="w-4 h-4 text-sena animate-spin shrink-0" />
            <span>
              Buscando archivo Excel iniciado con «Ficha {fichaRecord.ficha}» en Google Drive y consolidando juicios evaluativos por aprendiz...
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
          <div className="h-36 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      )}

      {/* ESTADO 2: ERROR DE RED / DESCARGA */}
      {!isLoading && errorMsg && (
        <div className="p-5 rounded-lg border border-red-200 bg-red-50/50 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Error al consultar los Juicios Evaluativos de la Ficha</span>
          </div>
          <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => loadFromDrive(true)}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Reintentar conexión con Drive
            </button>
            <button
              type="button"
              onClick={() => localExcelInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cargar Excel manualmente
            </button>
          </div>
        </div>
      )}

      {/* ESTADO 3: SIN ARCHIVO EXCEL EN DRIVE PARA ESTA FICHA */}
      {!isLoading && !errorMsg && notFoundMsg && !report && (
        <div className="p-5 rounded-lg border border-amber-200 bg-amber-50/45 space-y-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <ClipboardCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Sin archivo de Juicios Evaluativos en Drive para la Ficha {fichaRecord.ficha}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {notFoundMsg} Suba a la carpeta compartida un archivo Excel cuyo nombre inicie con{' '}
              <strong className="font-mono text-slate-900">Ficha {fichaRecord.ficha}</strong> (por
              ejemplo:{' '}
              <span className="font-mono">
                Ficha {fichaRecord.ficha} Reporte de Juicios Evaluativos.xls
              </span>
              ) y presione <strong>Actualizar desde Drive</strong>, o cargue el archivo local.
            </p>
          </div>

          {discoveredFiles.length > 0 && (
            <div className="pt-2 border-t border-amber-200/80 space-y-2">
              <span className="block text-[11px] font-bold text-slate-800">
                Archivos Excel de Juicios Evaluativos detectados actualmente en Google Drive (
                {discoveredFiles.length}):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {discoveredFiles.map((df) => {
                  const canSwitch =
                    Boolean(df.ficha) &&
                    Boolean(onOpenOtherFicha) &&
                    availableFichaCodesInBoard.has(df.ficha);
                  return (
                    <div
                      key={df.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                    >
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {df.ficha ? `Ficha ${df.ficha}` : df.name}
                      </span>
                      <span
                        className="text-[11px] text-slate-500 truncate max-w-[260px]"
                        title={df.name}
                      >
                        {df.name}
                      </span>
                      {canSwitch && (
                        <button
                          type="button"
                          onClick={() => onOpenOtherFicha?.(df.ficha)}
                          className="text-sena hover:text-sena-dark font-bold underline underline-offset-2 cursor-pointer whitespace-nowrap"
                        >
                          Inspeccionar Ficha
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ESTADO 4: REPORTE DE JUICIOS EVALUATIVOS PROCESADO */}
      {!isLoading && !errorMsg && report && (
        <>
          {/* 1. TARJETAS EJECUTIVAS DEL REPORTE DE JUICIOS DE LA FICHA */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-900">
                Consolidado de Juicios Evaluativos de la Ficha {report.fichaReporte}
              </h4>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                {report.modalidadFormacion ? `Modalidad: ${report.modalidadFormacion} · ` : ''}
                Estado ficha en reporte: {report.estadoFichaReporte || fichaRecord.estadoFicha} ·{' '}
                {report.totalRegistrosJuicios.toLocaleString('es-CO')} juicios evaluados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* KPI 1: Aprendices en Reporte */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">
                  Aprendices en Reporte de Juicios
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                    {report.totalAprendices.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-600 font-semibold">
                    {report.totalResultadosReferencia} RAs / aprendiz
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  En Form.: {report.aprendicesEnFormacionCount} · Certif.:{' '}
                  {report.aprendicesCertificadosCount} · Bajas/Nov.:{' '}
                  {report.aprendicesBajasNovedadesCount}
                </p>
              </div>

              {/* KPI 2: Balance Global de Juicios */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">
                  Balance Total de Juicios Evaluativos
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-emerald-700">
                    {report.totalJuiciosAprobados.toLocaleString('es-CO')} aprob.
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-slate-700">
                    {report.porcentajeGlobalAprobacion}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Por Evaluar: {report.totalJuiciosPorEvaluar.toLocaleString('es-CO')} · No Aprob.:{' '}
                  {report.totalJuiciosNoAprobados.toLocaleString('es-CO')}
                </p>
              </div>

              {/* KPI 3: Aprendices en Estado Por Certificar */}
              <button
                type="button"
                onClick={() =>
                  setSelectedEstadoFilter((prev) =>
                    prev === 'POR CERTIFICAR' ? 'TODOS' : 'POR CERTIFICAR'
                  )
                }
                className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                  selectedEstadoFilter === 'POR CERTIFICAR'
                    ? 'border-teal-600 bg-teal-50/75 ring-1 ring-teal-500/30'
                    : 'border-teal-200 bg-teal-50/35 hover:bg-teal-50/60'
                }`}
              >
                <span className="block text-[11px] font-medium text-teal-900">
                  Aprendices en Estado «Por Certificar»
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-teal-900">
                    {report.aprendicesPorCertificarCount.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[11px] font-semibold text-teal-800 underline underline-offset-2">
                    {selectedEstadoFilter === 'POR CERTIFICAR'
                      ? 'Quitar filtro'
                      : 'Filtrar listado'}
                  </span>
                </div>
                <p className="text-[11px] text-teal-800/80 font-mono tabular-nums">
                  Con fecha de aprobación e instructor verificados
                </p>
              </button>

              {/* KPI 4: Días Transcurridos en Estado Por Certificar a la Fecha Actual */}
              <div
                className={`p-3.5 rounded-lg border space-y-1 ${
                  porCertificarStats.mayor30Count > 0
                    ? 'border-red-200 bg-red-50/40'
                    : report.aprendicesPorCertificarCount > 0
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="block text-[11px] font-medium text-slate-600">
                  Días en «Por Certificar» (al {todayBogotaDisplay})
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xl font-extrabold font-mono tabular-nums ${
                      porCertificarStats.mayor30Count > 0
                        ? 'text-red-700'
                        : porCertificarStats.maxDias !== null
                        ? 'text-amber-800'
                        : 'text-slate-700'
                    }`}
                  >
                    {porCertificarStats.maxDias !== null
                      ? `Máx: ${porCertificarStats.maxDias}d`
                      : '0 días'}
                  </span>
                  {porCertificarStats.promedioDias !== null && (
                    <span className="text-[11px] font-mono tabular-nums font-bold text-slate-700">
                      Prom: {porCertificarStats.promedioDias}d
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {porCertificarStats.mayor30Count > 0
                    ? `${porCertificarStats.mayor30Count} apr. superan 30 días sin certificar`
                    : report.aprendicesPorCertificarCount > 0
                    ? 'Dentro de ventana de gestión ≤30 días'
                    : 'Sin aprendices pendientes en este estado'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. BLOQUE ESPECIAL OBLIGATORIO: SEGUIMIENTO DE APRENDICES EN ESTADO "POR CERTIFICAR" */}
          <div className="p-4 rounded-xl border border-teal-200 bg-white space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Seguimiento de Aprendices en Estado «Por Certificar» ({aprendicesPorCertificar.length})
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600">
                  Detalle de la fecha en que el instructor aprobó el juicio evaluativo final, nombre del instructor evaluador y días transcurridos hasta la fecha actual ({todayBogotaDisplay}).
                </p>
              </div>

              <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                Corte de cálculo: {todayBogotaDisplay}
              </span>
            </div>

            {aprendicesPorCertificar.length === 0 ? (
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center gap-2 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Esta ficha no registra actualmente aprendices en estado{' '}
                  <strong>POR CERTIFICAR</strong> dentro del reporte de juicios evaluativos.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-teal-50/60 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                      <th className="py-2.5 px-3 whitespace-nowrap">Aprendiz / Documento</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Juicios Aprobados</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        Fecha Instructor Aprobó Juicio Evaluativo
                      </th>
                      <th className="py-2.5 px-3 min-w-[220px]">
                        Nombre del Instructor que Aprobó
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        Días desde Cambio a «Por Certificar»
                        <span className="block text-[9px] font-normal text-slate-500">
                          A la fecha actual ({todayBogotaDisplay})
                        </span>
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aprendicesPorCertificar.map((ap) => (
                      <tr key={`pc-${ap.key}`} className="hover:bg-teal-50/30">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{ap.nombreCompleto}</div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500">
                            {ap.tipoDocumento} {ap.numeroDocumento}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderEstadoAprendizText(ap)}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-emerald-700">
                            {ap.aprobados} / {ap.totalResultados} ({ap.porcentajeAvance}%)
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Por eval.: {ap.porEvaluar} · No aprob.: {ap.noAprobados}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-mono tabular-nums font-bold text-slate-900">
                            {ap.fechaHoraInstructorAproboDisplay}
                          </div>
                          <div
                            className="text-[10px] text-slate-500 truncate max-w-[230px]"
                            title={ap.competenciaUltimoJuicioAprobado}
                          >
                            {ap.esEtapaPracticaUltimoJuicio
                              ? 'Cierre en RA Etapa Práctica'
                              : ap.competenciaUltimoJuicioAprobado || 'Último juicio aprobado'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">
                            {ap.instructorAproboNombre || 'Sin instructor registrado'}
                          </div>
                          {ap.instructorAproboDocumento && (
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              {ap.instructorAproboDocumento}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {renderAgingBadge(ap.diasTranscurridosPorCertificar)}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEstadoFilter('POR CERTIFICAR');
                              inspectAprendizRAs(ap.key);
                            }}
                            className="text-sena hover:text-sena-dark font-semibold underline underline-offset-2 cursor-pointer"
                          >
                            {expandedAprendizKey === ap.key ? 'Ocultar RAs' : 'Ver RAs'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. RESUMEN COMPLETO POR APRENDIZ DE LOS JUICIOS EVALUATIVOS */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Resumen por Aprendiz de los Juicios Evaluativos ({filteredAprendices.length} de{' '}
                  {report.totalAprendices})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Consolidado individual de resultados aprobados, pendientes por evaluar, no aprobados, instructor del último juicio y días en estado Por Certificar.
                </p>
              </div>

              {/* Píldoras rápidas por Estado del Aprendiz */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedEstadoFilter('TODOS')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    selectedEstadoFilter === 'TODOS'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Todos ({report.totalAprendices})
                </button>
                {report.distribucionEstados.map((st) => {
                  const active = selectedEstadoFilter === st.estado;
                  return (
                    <button
                      key={st.estado}
                      type="button"
                      onClick={() =>
                        setSelectedEstadoFilter((prev) =>
                          prev === st.estado ? 'TODOS' : st.estado
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : st.esPorCertificar
                          ? 'bg-teal-50 hover:bg-teal-100/80 text-teal-900 border-teal-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st.estado} ({st.cantidad})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buscador y filtro de avance */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar aprendiz, documento o nombre de instructor..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-sena focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { key: 'TODOS' as AvanceFilterMode, label: 'Todo avance' },
                      { key: 'COMPLETO_100' as AvanceFilterMode, label: '100% Aprobados' },
                      { key: 'CON_PENDIENTES' as AvanceFilterMode, label: 'Con Por Evaluar' },
                      { key: 'CON_NO_APROBADOS' as AvanceFilterMode, label: 'Con No Aprobados' },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAvanceFilter(opt.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        avanceFilter === opt.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {(searchQuery ||
                  selectedEstadoFilter !== 'TODOS' ||
                  avanceFilter !== 'TODOS') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedEstadoFilter('TODOS');
                      setAvanceFilter('TODOS');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Tabla principal por aprendiz */}
            {filteredAprendices.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-lg border border-slate-200 bg-slate-50/40">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  No se encontraron aprendices con los criterios de búsqueda actuales.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3 whitespace-nowrap">Aprendiz / Documento</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Estado Aprendiz</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Total RAs</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Aprobados</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Por Evaluar</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">No Aprob.</th>
                        <th className="py-2.5 px-3 w-36 whitespace-nowrap">% Avance</th>
                        <th className="py-2.5 px-3 min-w-[230px]">
                          Último Juicio Aprobado / Instructor
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">
                          Días «Por Certificar»
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Juicios</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {paginatedAprendices.map((ap) => {
                        const isExpanded = expandedAprendizKey === ap.key;
                        const detallesFiltrados = ap.detalles.filter((d) =>
                          detailFilterJuicio === 'TODOS' ? true : d.juicio === detailFilterJuicio
                        );

                        return (
                          <React.Fragment key={ap.key}>
                            <tr
                              className={`transition-colors ${
                                ap.esPorCertificar
                                  ? 'bg-teal-50/25 hover:bg-teal-50/50'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{ap.nombreCompleto}</div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                                  {ap.tipoDocumento} {ap.numeroDocumento}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {renderEstadoAprendizText(ap)}
                              </td>

                              <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-700">
                                {ap.totalResultados}
                              </td>

                              <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                                {ap.aprobados}
                              </td>

                              <td
                                className={`py-2.5 px-2.5 text-right font-mono tabular-nums font-bold ${
                                  ap.porEvaluar > 0 ? 'text-amber-700' : 'text-slate-300'
                                }`}
                              >
                                {ap.porEvaluar}
                              </td>

                              <td
                                className={`py-2.5 px-2.5 text-right font-mono tabular-nums font-bold ${
                                  ap.noAprobados > 0 ? 'text-red-700' : 'text-slate-300'
                                }`}
                              >
                                {ap.noAprobados}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1">
                                  <span className="font-bold text-slate-900">
                                    {ap.porcentajeAvance}%
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {ap.competenciasCount} comp.
                                  </span>
                                </div>
                                <svg
                                  viewBox="0 0 100 6"
                                  preserveAspectRatio="none"
                                  className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden block"
                                  aria-hidden="true"
                                >
                                  <rect
                                    x={0}
                                    y={0}
                                    width={Math.min(100, Math.max(0, ap.porcentajeAvance))}
                                    height={6}
                                    className={
                                      ap.porcentajeAvance >= 100
                                        ? 'fill-emerald-600'
                                        : ap.porcentajeAvance >= 70
                                        ? 'fill-sena'
                                        : 'fill-amber-500'
                                    }
                                  />
                                </svg>
                              </td>

                              <td className="py-2.5 px-3">
                                {ap.fechaInstructorAproboIso || ap.instructorAproboNombre ? (
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {ap.instructorAproboNombre || 'Sin nombre de instructor'}
                                    </div>
                                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                                      {ap.esPorCertificar
                                        ? `Aprobó: ${ap.fechaHoraInstructorAproboDisplay}`
                                        : `Últ. aprob.: ${ap.fechaInstructorAproboDisplay}`}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    Sin juicios aprobados
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {ap.esPorCertificar ? (
                                  renderAgingBadge(ap.diasTranscurridosPorCertificar)
                                ) : (
                                  <span className="text-slate-300 font-mono">—</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => inspectAprendizRAs(ap.key)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Ocultar' : 'Detalle'}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Fila desplegable con todos los Resultados de Aprendizaje del aprendiz */}
                            {isExpanded && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={10} className="p-3.5 border-t border-slate-200">
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-xs font-bold text-slate-900">
                                        Detalle de Resultados de Aprendizaje — {ap.nombreCompleto} (
                                        {detallesFiltrados.length} de {ap.detalles.length})
                                      </div>

                                      <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                                        {(
                                          [
                                            { key: 'TODOS', label: `Todos (${ap.detalles.length})` },
                                            {
                                              key: 'APROBADO',
                                              label: `Aprobados (${ap.aprobados})`,
                                            },
                                            {
                                              key: 'POR EVALUAR',
                                              label: `Por Evaluar (${ap.porEvaluar})`,
                                            },
                                            {
                                              key: 'NO APROBADO',
                                              label: `No Aprobados (${ap.noAprobados})`,
                                            },
                                          ] as const
                                        ).map((tab) => (
                                          <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setDetailFilterJuicio(tab.key)}
                                            className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums font-semibold cursor-pointer whitespace-nowrap ${
                                              detailFilterJuicio === tab.key
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                          >
                                            {tab.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                      <table className="w-full text-left border-collapse text-[11px]">
                                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                                          <tr>
                                            <th className="py-2 px-2.5">Competencia</th>
                                            <th className="py-2 px-2.5">
                                              Resultado de Aprendizaje
                                            </th>
                                            <th className="py-2 px-2.5 whitespace-nowrap">
                                              Juicio
                                            </th>
                                            <th className="py-2 px-2.5 whitespace-nowrap">
                                              Fecha y Hora
                                            </th>
                                            <th className="py-2 px-2.5">
                                              Instructor que Registró el Juicio
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {detallesFiltrados.map((d) => (
                                            <tr key={d.id} className="hover:bg-slate-50/70">
                                              <td className="py-2 px-2.5 max-w-[260px]">
                                                <div
                                                  className="line-clamp-2 text-slate-800 font-medium"
                                                  title={d.competencia}
                                                >
                                                  {d.competencia}
                                                </div>
                                              </td>
                                              <td className="py-2 px-2.5 max-w-[300px]">
                                                <div
                                                  className="line-clamp-2 text-slate-600"
                                                  title={d.resultadoAprendizaje}
                                                >
                                                  {d.resultadoAprendizaje}
                                                </div>
                                              </td>
                                              <td className="py-2 px-2.5 whitespace-nowrap font-bold">
                                                <span
                                                  className={
                                                    d.juicio === 'APROBADO'
                                                      ? 'text-emerald-700'
                                                      : d.juicio === 'NO APROBADO'
                                                      ? 'text-red-700'
                                                      : 'text-amber-700'
                                                  }
                                                >
                                                  {d.juicio}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2.5 whitespace-nowrap font-mono tabular-nums text-slate-700">
                                                {d.fechaHoraDisplay}
                                              </td>
                                              <td className="py-2 px-2.5 text-slate-700">
                                                {d.instructorNombre ? (
                                                  <div>
                                                    <span className="font-semibold text-slate-900">
                                                      {d.instructorNombre}
                                                    </span>
                                                    {d.instructorDocumento && (
                                                      <span className="text-[10px] font-mono text-slate-500 ml-1.5">
                                                        ({d.instructorDocumento})
                                                      </span>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 text-xs text-slate-600">
                    <span className="font-mono tabular-nums">
                      Mostrando {(currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, filteredAprendices.length)} de{' '}
                      {filteredAprendices.length.toLocaleString('es-CO')} aprendices
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>
                      <span className="px-2.5 font-mono tabular-nums font-semibold text-slate-800">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
