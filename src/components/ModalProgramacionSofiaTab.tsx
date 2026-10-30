import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Upload,
  Download,
  ExternalLink,
  Search,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { FichaCurricularDrive } from '../services/gestionCurricularDriveService';
import {
  PROGRAMACION_SOFIA_DRIVE_FOLDER_URL,
  DriveProgramacionFileItem,
  ProgramacionSofiaParsedReport,
  UnscheduledScopeMode,
  UnscheduledDayRule,
  fetchProgramacionSofiaForFicha,
  parseProgramacionSofiaSpreadsheet,
  computeUnscheduledDaysAnalysis,
  setManualProgramacionReportForFicha,
} from '../services/programacionSofiaDriveService';

interface ModalProgramacionSofiaTabProps {
  fichaRecord: FichaCurricularDrive;
  driveProgramacionFiles: DriveProgramacionFileItem[];
  availableFichaCodesInBoard: Set<string>;
  onOpenOtherFicha?: (fichaCode: string) => void;
  onDriveFilesDiscovered?: (files: DriveProgramacionFileItem[]) => void;
}

type UnscheduledSubView = 'TRAMOS' | 'FECHAS_EXACTAS' | 'MENSUAL';

export default function ModalProgramacionSofiaTab({
  fichaRecord,
  driveProgramacionFiles,
  availableFichaCodesInBoard,
  onOpenOtherFicha,
  onDriveFilesDiscovered,
}: ModalProgramacionSofiaTabProps) {
  const localExcelInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ProgramacionSofiaParsedReport | null>(null);
  const [discoveredFiles, setDiscoveredFiles] = useState<DriveProgramacionFileItem[]>(
    driveProgramacionFiles
  );

  // Controles de análisis de días sin programación
  const [scopeMode, setScopeMode] = useState<UnscheduledScopeMode>('CICLO_FICHA');
  const [dayRule, setDayRule] = useState<UnscheduledDayRule>('HABILES_LV');
  const [unscheduledSubView, setUnscheduledSubView] = useState<UnscheduledSubView>('TRAMOS');
  const [selectedTramoFilter, setSelectedTramoFilter] = useState<number | 'TODOS'>('TODOS');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('TODOS');
  const [unscheduledPage, setUnscheduledPage] = useState<number>(1);
  const unscheduledPageSize = 24;

  // Controles de filtro para la tabla cronológica de programación asignada
  const [progQuery, setProgQuery] = useState<string>('');
  const [selectedInstructorFilter, setSelectedInstructorFilter] = useState<string>('TODOS');

  const loadFromDrive = async (forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    setNotFoundMsg(null);
    try {
      const res = await fetchProgramacionSofiaForFicha(fichaRecord.ficha, forceRefresh);
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
          'No se pudo obtener la programación SOFIA Plus desde la carpeta de Google Drive.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setProgQuery('');
    setSelectedInstructorFilter('TODOS');
    setSelectedTramoFilter('TODOS');
    setSelectedMonthFilter('TODOS');
    setUnscheduledPage(1);
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
        const parsed = parseProgramacionSofiaSpreadsheet(buf, fichaRecord.ficha, {
          fileName: `${file.name} (carga manual)`,
          modifiedTimeIso: new Date(file.lastModified).toISOString(),
        });
        setManualProgramacionReportForFicha(fichaRecord.ficha, parsed);
        setReport(parsed);
      } catch (err: any) {
        setErrorMsg(
          err?.message || 'El archivo Excel seleccionado no tiene un formato válido de programación SOFIA Plus.'
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

  const unscheduledAnalysis = useMemo(() => {
    if (!report) return null;
    return computeUnscheduledDaysAnalysis(report, {
      scope: scopeMode,
      dayRule,
      fallbackFechaInicioFichaIso: fichaRecord.fechaInicioIso,
      fallbackFechaFinFichaIso: fichaRecord.fechaFinIso,
      fechaFinEtapaLectivaIso: fichaRecord.fechaFinEtapaLectivaIso,
    });
  }, [
    report,
    scopeMode,
    dayRule,
    fichaRecord.fechaInicioIso,
    fichaRecord.fechaFinIso,
    fichaRecord.fechaFinEtapaLectivaIso,
  ]);

  useEffect(() => {
    setSelectedTramoFilter('TODOS');
    setSelectedMonthFilter('TODOS');
    setUnscheduledPage(1);
  }, [scopeMode, dayRule]);

  const filteredFechasSinProg = useMemo(() => {
    if (!unscheduledAnalysis) return [];
    return unscheduledAnalysis.fechasSinProgramacion.filter((item) => {
      if (selectedTramoFilter !== 'TODOS' && item.tramoIndex !== selectedTramoFilter) {
        return false;
      }
      if (selectedMonthFilter !== 'TODOS' && item.mesKey !== selectedMonthFilter) {
        return false;
      }
      return true;
    });
  }, [unscheduledAnalysis, selectedTramoFilter, selectedMonthFilter]);

  const totalUnscheduledPages = Math.max(
    1,
    Math.ceil(filteredFechasSinProg.length / unscheduledPageSize)
  );
  const paginatedFechasSinProg = useMemo(() => {
    const start = (unscheduledPage - 1) * unscheduledPageSize;
    return filteredFechasSinProg.slice(start, start + unscheduledPageSize);
  }, [filteredFechasSinProg, unscheduledPage]);

  const filteredEntries = useMemo(() => {
    if (!report) return [];
    const q = progQuery.trim().toLowerCase();
    return report.entries.filter((e) => {
      if (
        selectedInstructorFilter !== 'TODOS' &&
        e.instructor.toUpperCase() !== selectedInstructorFilter.toUpperCase()
      ) {
        return false;
      }
      if (q) {
        const hit =
          e.instructor.toLowerCase().includes(q) ||
          e.competencia.toLowerCase().includes(q) ||
          e.resultadoAprendizaje.toLowerCase().includes(q) ||
          e.ambiente.toLowerCase().includes(q) ||
          e.fechaInicioDisplay.includes(q) ||
          e.fechaFinDisplay.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [report, progQuery, selectedInstructorFilter]);

  const handleExportProgramacionCsv = () => {
    if (!report) return;
    const headers = [
      'Orden',
      'Ficha',
      'Fecha_Inicio_Programacion',
      'Fecha_Fin_Programacion',
      'Dias_Habiles_LV',
      'Dias_Calendario',
      'Instructor',
      'Estado_Instructor',
      'Competencia',
      'Horas_Programadas',
    ];
    const csvRows = [headers.join(';')];
    for (const e of report.entries) {
      csvRows.push(
        [
          e.ordenCronologico,
          report.fichaReporte || fichaRecord.ficha,
          e.fechaInicioDisplay,
          e.fechaFinDisplay,
          e.diasHabilesLVCubiertos,
          e.diasCalendarioCubiertos,
          `"${e.instructor.replace(/"/g, '""')}"`,
          `"${e.estadoInstructor.replace(/"/g, '""')}"`,
          `"${e.competencia.replace(/"/g, '""')}"`,
          String(e.horasProgramadas).replace('.', ','),
        ].join(';')
      );
    }
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Programacion_SOFIA_Ficha_${fichaRecord.ficha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportUnscheduledDaysCsv = () => {
    if (!unscheduledAnalysis) return;
    const headers = [
      'Ficha',
      'Fecha_Sin_Programacion',
      'Dia_Semana',
      'Mes',
      'Tramo',
      'Clasificacion_Brecha',
    ];
    const csvRows = [headers.join(';')];
    for (const d of filteredFechasSinProg) {
      csvRows.push(
        [
          fichaRecord.ficha,
          d.display,
          d.diaSemana,
          d.mesLabel,
          `Tramo #${d.tramoIndex}`,
          `"${d.tipoBrecha}"`,
        ].join(';')
      );
    }
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dias_Sin_Programacion_Ficha_${fichaRecord.ficha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dayRuleLabel =
    dayRule === 'HABILES_LV'
      ? 'días hábiles (Lun–Vie)'
      : dayRule === 'HABILES_LS'
      ? 'días Lun–Sáb'
      : 'días calendario';

  return (
    <div className="space-y-5">
      <input
        ref={localExcelInputRef}
        type="file"
        accept=".xls,.xlsx,.csv"
        onChange={handleLocalUpload}
        className="hidden"
      />

      {/* Barra superior de fuente Google Drive y acciones */}
      <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
            <span className="font-bold text-slate-900">
              Repositorio Drive Programación SOFIA Plus
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-sena font-semibold">
              Patrón: Ficha {fichaRecord.ficha}...
            </span>
            {report && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-800 font-semibold truncate max-w-md" title={report.fileName}>
                  {report.fileName}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
            {report?.modifiedTimeDisplay && (
              <>
                <span className="font-mono tabular-nums">
                  Actualizado en Drive: {report.modifiedTimeDisplay}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {report?.centroReporte && (
              <>
                <span>
                  {report.centroReporte}
                  {report.municipioReporte ? ` (${report.municipioReporte})` : ''}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <a
              href={PROGRAMACION_SOFIA_DRIVE_FOLDER_URL}
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
              onClick={handleExportProgramacionCsv}
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
              Buscando archivo Excel iniciado con «Ficha {fichaRecord.ficha}» en Google Drive y ordenando programación por fechas...
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
            <span>Error al consultar la programación SOFIA Plus</span>
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

      {/* ESTADO 3: NO EXISTE ARCHIVO EXCEL PARA ESTA FICHA EN LA CARPETA DRIVE */}
      {!isLoading && !errorMsg && notFoundMsg && !report && (
        <div className="p-5 rounded-lg border border-amber-200 bg-amber-50/45 space-y-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <CalendarClock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Sin archivo de Programación SOFIA Plus en Drive para la Ficha {fichaRecord.ficha}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {notFoundMsg} Suba a la carpeta compartida un archivo cuyo nombre inicie con{' '}
              <strong className="font-mono text-slate-900">Ficha {fichaRecord.ficha}</strong> (por ejemplo:{' '}
              <span className="font-mono">
                Ficha {fichaRecord.ficha} Reporte de Instructores por Ficha.xls
              </span>
              ) y presione <strong>Actualizar desde Drive</strong>, o cargue el archivo local.
            </p>
          </div>

          {discoveredFiles.length > 0 && (
            <div className="pt-2 border-t border-amber-200/80 space-y-2">
              <span className="block text-[11px] font-bold text-slate-800">
                Archivos Excel detectados actualmente en la carpeta de Google Drive ({discoveredFiles.length}):
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
                      <span className="text-[11px] text-slate-500 truncate max-w-[240px]" title={df.name}>
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

      {/* ESTADO 4: REPORTE ENCONTRADO Y PROCESADO */}
      {!isLoading && !errorMsg && report && unscheduledAnalysis && (
        <>
          {/* 1. RESUMEN EJECUTIVO DE LA PROGRAMACIÓN ASIGNADA */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-900">
                Resumen de la Programación Asignada en SOFIA Plus
              </h4>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Fechas ficha en reporte: {report.fechaInicioFichaDisplay} al {report.fechaFinFichaDisplay} · Cobertura programada: {report.primeraFechaProgramadaDisplay} al {report.ultimaFechaProgramadaDisplay}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* KPI 1: Horas Programadas vs Ejecutadas */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">
                  Horas Programadas Asignadas
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                    {report.horasProgramadasReferencia.toLocaleString('es-CO')} h
                  </span>
                  {report.porcentajeEjecucionHoras !== null && (
                    <span className="text-[11px] font-mono tabular-nums font-bold text-sena">
                      {report.porcentajeEjecucionHoras}% ejec.
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {report.totalHorasEjecutadasHeader !== null ? (
                    <>
                      Ejec.: {report.totalHorasEjecutadasHeader.toLocaleString('es-CO')}h · Pend.:{' '}
                      {(report.totalHorasPendientesHeader ?? 0).toLocaleString('es-CO')}h
                    </>
                  ) : (
                    <>Suma registros: {report.sumaHorasProgramadasFilas.toLocaleString('es-CO')} h</>
                  )}
                </p>
              </div>

              {/* KPI 2: Instructores y Competencias */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">
                  Instructores y Competencias
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                    {report.instructoresResumen.length} inst.
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-600 font-semibold">
                    {report.entries.length} registros
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {report.competenciasResumen.length} competencias programadas
                </p>
              </div>

              {/* KPI 3: Días CON programación */}
              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/35 space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
                  Días con Programación
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold font-mono tabular-nums text-emerald-800">
                    {unscheduledAnalysis.diasConProgramacion.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-emerald-700">
                    {unscheduledAnalysis.porcentajeConProgramacion}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono tabular-nums">
                  De {unscheduledAnalysis.totalDiasEvaluados.toLocaleString('es-CO')} {dayRuleLabel}
                </p>
              </div>

              {/* KPI 4: Días SIN programación */}
              <div
                className={`p-3.5 rounded-lg border space-y-1 ${
                  unscheduledAnalysis.diasSinProgramacion > 0
                    ? 'border-red-200 bg-red-50/45'
                    : 'border-emerald-200 bg-emerald-50/35'
                }`}
              >
                <span className="block text-[11px] font-medium text-slate-600">
                  Días sin Programación
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xl font-extrabold font-mono tabular-nums ${
                      unscheduledAnalysis.diasSinProgramacion > 0
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {unscheduledAnalysis.diasSinProgramacion.toLocaleString('es-CO')}
                  </span>
                  <span
                    className={`text-[11px] font-mono tabular-nums font-bold ${
                      unscheduledAnalysis.diasSinProgramacion > 0
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {unscheduledAnalysis.porcentajeSinProgramacion}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {unscheduledAnalysis.tramosSinProgramacion.length}{' '}
                  {unscheduledAnalysis.tramosSinProgramacion.length === 1
                    ? 'tramo detectado'
                    : 'tramos detectados'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. PANEL DE DÍAS QUE NO TUVO PROGRAMACIÓN ESTA FICHA */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {unscheduledAnalysis.diasSinProgramacion > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <h4 className="text-xs font-bold text-slate-900">
                    Días que No Tuvo Programación esta Ficha ({unscheduledAnalysis.ventanaInicioDisplay} al{' '}
                    {unscheduledAnalysis.ventanaFinDisplay})
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  Identificación cronológica de fechas sin instructor ni competencia asignada dentro del alcance seleccionado.
                </p>
              </div>

              {/* Controles de Periodo y Regla de Días */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setScopeMode('CICLO_FICHA')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      scopeMode === 'CICLO_FICHA'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ciclo Ficha
                  </button>
                  {fichaRecord.aplicaEtapaProductiva && fichaRecord.fechaFinEtapaLectivaIso && (
                    <button
                      type="button"
                      onClick={() => setScopeMode('ETAPA_LECTIVA')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        scopeMode === 'ETAPA_LECTIVA'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Etapa Lectiva
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setScopeMode('ENTRE_PROGRAMACIONES')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      scopeMode === 'ENTRE_PROGRAMACIONES'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Entre 1ª y última prog.
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDayRule('HABILES_LV')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      dayRule === 'HABILES_LV'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lun–Vie
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayRule('HABILES_LS')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      dayRule === 'HABILES_LS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lun–Sáb
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayRule('CALENDARIO')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      dayRule === 'CALENDARIO'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Calendario
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-vistas de días sin programación */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUnscheduledSubView('TRAMOS')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    unscheduledSubView === 'TRAMOS'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tramos sin programación ({unscheduledAnalysis.tramosSinProgramacion.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnscheduledSubView('FECHAS_EXACTAS')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    unscheduledSubView === 'FECHAS_EXACTAS'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fechas exactas sin programación (
                  {unscheduledAnalysis.fechasSinProgramacion.length.toLocaleString('es-CO')})
                </button>
                <button
                  type="button"
                  onClick={() => setUnscheduledSubView('MENSUAL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    unscheduledSubView === 'MENSUAL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cobertura mensual ({unscheduledAnalysis.resumenMensual.length})
                </button>
              </div>

              {unscheduledAnalysis.fechasSinProgramacion.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportUnscheduledDaysCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar días sin programación (.csv)</span>
                </button>
              )}
            </div>

            {unscheduledAnalysis.diasSinProgramacion === 0 ? (
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs text-emerald-900">
                La ficha cuenta con cobertura continua del 100% durante los{' '}
                <strong className="font-mono">{unscheduledAnalysis.totalDiasEvaluados}</strong>{' '}
                {dayRuleLabel} evaluados en este periodo.
              </div>
            ) : unscheduledSubView === 'TRAMOS' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                      <th className="py-2 px-3 whitespace-nowrap">#</th>
                      <th className="py-2 px-3 whitespace-nowrap">Desde</th>
                      <th className="py-2 px-3 whitespace-nowrap">Hasta</th>
                      <th className="py-2 px-3">Clasificación de Brecha</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Hábiles (Lun–Vie)</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Lun–Sáb</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Calendario</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unscheduledAnalysis.tramosSinProgramacion.map((tramo) => (
                      <tr key={tramo.index} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                          {tramo.index}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {tramo.desdeDisplay}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {tramo.hastaDisplay}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{tramo.tipoBrecha}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-red-700">
                          {tramo.diasHabilesLV}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {tramo.diasHabilesLS}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {tramo.diasCalendario}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTramoFilter(tramo.index);
                              setUnscheduledPage(1);
                              setUnscheduledSubView('FECHAS_EXACTAS');
                            }}
                            className="text-sena hover:text-sena-dark font-semibold underline underline-offset-2 cursor-pointer"
                          >
                            Ver días ({tramo.diasSegunRegla})
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : unscheduledSubView === 'FECHAS_EXACTAS' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedMonthFilter}
                      onChange={(e) => {
                        setSelectedMonthFilter(e.target.value);
                        setUnscheduledPage(1);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                    >
                      <option value="TODOS">Todos los meses con días sin prog.</option>
                      {unscheduledAnalysis.resumenMensual
                        .filter((m) => m.diasSinProgramacion > 0)
                        .map((m) => (
                          <option key={m.mesKey} value={m.mesKey}>
                            {m.mesLabel} ({m.diasSinProgramacion} días sin prog.)
                          </option>
                        ))}
                    </select>

                    <select
                      value={selectedTramoFilter === 'TODOS' ? 'TODOS' : String(selectedTramoFilter)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedTramoFilter(v === 'TODOS' ? 'TODOS' : Number(v));
                        setUnscheduledPage(1);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                    >
                      <option value="TODOS">Todos los tramos ({unscheduledAnalysis.tramosSinProgramacion.length})</option>
                      {unscheduledAnalysis.tramosSinProgramacion.map((t) => (
                        <option key={t.index} value={String(t.index)}>
                          Tramo #{t.index}: {t.desdeDisplay} – {t.hastaDisplay} ({t.diasSegunRegla}d)
                        </option>
                      ))}
                    </select>

                    {(selectedMonthFilter !== 'TODOS' || selectedTramoFilter !== 'TODOS') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMonthFilter('TODOS');
                          setSelectedTramoFilter('TODOS');
                          setUnscheduledPage(1);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>

                  <span className="font-mono tabular-nums text-slate-500">
                    {filteredFechasSinProg.length.toLocaleString('es-CO')} fechas listadas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {paginatedFechasSinProg.map((d) => (
                    <div
                      key={d.iso}
                      className="p-2.5 rounded-lg border border-red-200/75 bg-red-50/30 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold font-mono tabular-nums text-slate-900">
                          {d.display}
                        </div>
                        <div className="text-[11px] text-slate-600">{d.diaSemana}</div>
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-red-700 font-semibold">
                        T#{d.tramoIndex}
                      </span>
                    </div>
                  ))}
                </div>

                {totalUnscheduledPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
                    <span className="font-mono tabular-nums">
                      Mostrando {(unscheduledPage - 1) * unscheduledPageSize + 1}–
                      {Math.min(
                        unscheduledPage * unscheduledPageSize,
                        filteredFechasSinProg.length
                      )}{' '}
                      de {filteredFechasSinProg.length.toLocaleString('es-CO')} días
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={unscheduledPage <= 1}
                        onClick={() => setUnscheduledPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Anterior</span>
                      </button>
                      <span className="px-2 font-mono tabular-nums font-semibold text-slate-800">
                        {unscheduledPage} / {totalUnscheduledPages}
                      </span>
                      <button
                        type="button"
                        disabled={unscheduledPage >= totalUnscheduledPages}
                        onClick={() =>
                          setUnscheduledPage((p) => Math.min(totalUnscheduledPages, p + 1))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                      >
                        <span>Siguiente</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Mes</th>
                      <th className="py-2 px-3 text-right">Días Evaluados</th>
                      <th className="py-2 px-3 text-right">Con Programación</th>
                      <th className="py-2 px-3 text-right">Sin Programación</th>
                      <th className="py-2 px-3 w-40">Cobertura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unscheduledAnalysis.resumenMensual.map((m) => (
                      <tr key={m.mesKey} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{m.mesLabel}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {m.diasEvaluados}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {m.diasConProgramacion}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums font-bold ${
                            m.diasSinProgramacion > 0 ? 'text-red-700' : 'text-slate-400'
                          }`}
                        >
                          {m.diasSinProgramacion}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  m.porcentajeCobertura === 100
                                    ? 'bg-emerald-600'
                                    : m.porcentajeCobertura > 0
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${m.porcentajeCobertura}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-slate-700 w-11 text-right">
                              {m.porcentajeCobertura}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. RESUMEN POR INSTRUCTOR ASIGNADO */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sena shrink-0" />
                <span>Resumen por Instructor Asignado ({report.instructoresResumen.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Haga clic sobre un instructor para filtrar su detalle cronológico abajo
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <th className="py-2 px-3">Instructor</th>
                    <th className="py-2 px-3 whitespace-nowrap">Estado</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Competencias</th>
                    <th className="py-2 px-3 whitespace-nowrap">Primera Fecha</th>
                    <th className="py-2 px-3 whitespace-nowrap">Última Fecha</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Horas Prog.</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">% Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.instructoresResumen.map((inst) => {
                    const isSelected =
                      selectedInstructorFilter.toUpperCase() === inst.instructor.toUpperCase();
                    return (
                      <tr
                        key={inst.instructor}
                        onClick={() =>
                          setSelectedInstructorFilter((prev) =>
                            prev.toUpperCase() === inst.instructor.toUpperCase()
                              ? 'TODOS'
                              : inst.instructor
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {inst.instructor}
                          {inst.incluyeEtapaPractica && (
                            <span className="text-[10px] font-normal text-slate-500">
                              {' '}
                              · Etapa Práctica
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {inst.estadoInstructor}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {inst.competenciasCount}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {inst.primeraFechaDisplay}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {inst.ultimaFechaDisplay}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {inst.horasProgramadas.toLocaleString('es-CO')} h
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {inst.porcentajeHoras}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. DETALLE DE PROGRAMACIÓN ORDENADO CRONOLÓGICAMENTE POR LAS FECHAS */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sena shrink-0" />
                  <span>
                    Detalle de Programación Ordenado por Fechas ({filteredEntries.length} de{' '}
                    {report.entries.length})
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Registros ordenados cronológicamente de la primera fecha de inicio a la última fecha de finalización.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedInstructorFilter !== 'TODOS' && (
                  <button
                    type="button"
                    onClick={() => setSelectedInstructorFilter('TODOS')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold cursor-pointer"
                  >
                    <span className="truncate max-w-[180px]">{selectedInstructorFilter}</span>
                    <X className="w-3 h-3 shrink-0" />
                  </button>
                )}

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={progQuery}
                    onChange={(e) => setProgQuery(e.target.value)}
                    placeholder="Filtrar instructor o competencia..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-sena focus:outline-none"
                  />
                  {progQuery && (
                    <button
                      type="button"
                      onClick={() => setProgQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <th className="py-2.5 px-3 whitespace-nowrap">#</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha Inicio</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha Fin</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Días (Háb./Cal.)</th>
                    <th className="py-2.5 px-3 min-w-[170px]">Instructor</th>
                    <th className="py-2.5 px-3 min-w-[260px]">Competencia Programada</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Horas Prog.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 align-top">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                        {item.ordenCronologico}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {item.fechaInicioDisplay}
                        {item.horaInicio && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            {item.horaInicio}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                        {item.fechaFinDisplay}
                        {item.horaFin && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            {item.horaFin}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">
                          {item.diasHabilesLVCubiertos}
                        </span>{' '}
                        / {item.diasCalendarioCubiertos}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.instructor}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.estadoInstructor}
                          {item.ambiente ? ` · Amb: ${item.ambiente}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 leading-snug">
                        <div>{item.competencia}</div>
                        {item.resultadoAprendizaje &&
                          item.resultadoAprendizaje !== item.competencia && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              RAP: {item.resultadoAprendizaje}
                            </div>
                          )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-sena whitespace-nowrap">
                        {item.horasProgramadas.toLocaleString('es-CO')} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
