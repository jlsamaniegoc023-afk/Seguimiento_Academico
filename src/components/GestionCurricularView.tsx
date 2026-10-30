import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  RefreshCw,
  Upload,
  Download,
  Search,
  RotateCcw,
  ExternalLink,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  Award,
  ChevronLeft,
  ChevronRight,
  BookmarkCheck,
  SlidersHorizontal,
  CalendarClock,
  ClipboardCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  GraduationCap,
  Briefcase,
  UserCheck,
  UserMinus,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SofiaRow, FichaMeta, ProgramacionRow } from '../types';
import { getCompetencia, getRA, getJuicio } from '../utils';
import {
  GESTION_DRIVE_FOLDER_URL,
  FichaCurricularDrive,
  CurricularSyncMeta,
  COLUMNS_Y_TO_AK_META,
  DesempenoYtoAK,
  fetchCurricularFromDrive,
  getCachedCurricularDrive,
  setCachedCurricularDrive,
  parseCurricularXml,
  parseCurricularSpreadsheetBuffer,
  formatDriveModifiedDate,
  formatIsoToDisplay,
  parseRawDateToIso,
} from '../services/gestionCurricularDriveService';
import {
  DriveProgramacionFileItem,
  getCachedProgramacionDriveFiles,
  listProgramacionSofiaDriveFiles,
} from '../services/programacionSofiaDriveService';
import {
  DriveJuiciosFileItem,
  getCachedJuiciosDriveFiles,
  listJuiciosEvaluativosDriveFiles,
} from '../services/juiciosEvaluativosDriveService';
import ModalProgramacionSofiaTab from './ModalProgramacionSofiaTab';
import ModalJuiciosEvaluativosTab from './ModalJuiciosEvaluativosTab';

interface GestionCurricularViewProps {
  rows: SofiaRow[];
  fichas: { [id: string]: FichaMeta };
  programacion: ProgramacionRow[];
  selectedFichaId: string;
  setSelectedFichaId: (id: string) => void;
}

type MacroColHFilter = 'TODOS' | 'NO_NIVELES' | 'NIVELES_TITULADOS';
type TableViewMode = 'COMPACTA' | 'COMPLETA_Y_AK';
type ChartDimension = 'COL_H' | 'COL_G' | 'COL_R';
type ProgramSortBy = 'fichas' | 'aprendices' | 'certificacion' | 'retencion' | 'bajas';

type DecisionQueueKey =
  | 'LECTIVA_PROXIMA'
  | 'PRODUCTIVA_TODAS'
  | 'PRODUCTIVA_SEGUIMIENTO_CIERRE'
  | 'PRODUCTIVA_PLAZO_1_ANIO'
  | 'PRODUCTIVA_PLAZO_VENCIDO'
  | 'CERTIFICACION_TODAS'
  | 'CERT_POR_CERTIFICAR'
  | 'CERT_NOVEDADES_ADMIN'
  | 'VALIDACION_CRITICA'
  | 'VAL_SOBRECUPO'
  | 'VAL_CUPO_DIFERENTE'
  | 'VAL_FECHAS_INCONSISTENTES'
  | 'VAL_FICHAS_DUPLICADAS'
  | 'CON_PROG_SOFIA'
  | 'CON_JUICIOS_DRIVE'
  | 'TODAS_EVALUADAS';

type ModalFichaTab = 'RESUMEN' | 'PROGRAMACION_SOFIA' | 'JUICIOS_EVALUATIVOS';

type RefDateMode = 'FECHA_ACTUAL' | 'CORTE_DRIVE';
type AlertHorizonDays = 30 | 60 | 90;

interface DecisionFichaEvaluation {
  fichaRecord: FichaCurricularDrive;
  diasParaFinLectiva: number | null;
  diasParaCierreProductiva: number | null;
  diasParaLimite1AnioProductiva: number | null;
  isLectivaProxima: boolean;
  isProductivaSeguimientoCierre: boolean;
  isProductivaCierreProximo: boolean;
  isProductivaPlazo1AnioActivo: boolean;
  isProductivaPlazo1AnioVencido: boolean;
  isPorCertificar: boolean;
  isNovedadesAdmin: boolean;
  isSobrecupo: boolean;
  isCupoDiferente: boolean;
  isFechasInconsistentes: boolean;
  isFichaDuplicada: boolean;
  prioridad: 'Crítica' | 'Alta' | 'Media' | 'Normal';
  etapaActualLabel: string;
  hallazgosDecision: string[];
  hallazgosValidacion: string[];
}

type StageKpiFilterKey =
  | 'FICHAS_LECTIVA'
  | 'FICHAS_PRODUCTIVA'
  | 'APRENDICES_LECTIVA'
  | 'APRENDICES_PRODUCTIVA'
  | 'PENDIENTES_CERTIFICAR'
  | 'CERTIFICADOS'
  | 'RETIROS_CANCELACIONES';

const STAGE_KPI_FILTER_LABELS: Record<StageKpiFilterKey, string> = {
  FICHAS_LECTIVA: 'Fichas activas en desarrollo de Etapa Lectiva',
  FICHAS_PRODUCTIVA: 'Fichas activas en desarrollo de Etapa Productiva',
  APRENDICES_LECTIVA: 'Aprendices en formación — desarrollo Etapa Lectiva',
  APRENDICES_PRODUCTIVA: 'Aprendices en formación — desarrollo Etapa Productiva',
  PENDIENTES_CERTIFICAR: 'Aprendices pendientes por certificar',
  CERTIFICADOS: 'Aprendices certificados registrados',
  RETIROS_CANCELACIONES: 'Aprendices retiros y cancelaciones',
};

function isFichaActivaEnEjecucion(f: FichaCurricularDrive): boolean {
  return f.estadoFicha.toLowerCase().includes('ejecuci');
}

function isFichaActivaDesarrolloLectiva(f: FichaCurricularDrive, refIso: string): boolean {
  if (!isFichaActivaEnEjecucion(f)) return false;
  if (!f.aplicaEtapaProductiva) return true;
  if (!f.fechaFinEtapaLectivaIso || !refIso) return true;
  return refIso <= f.fechaFinEtapaLectivaIso;
}

function isFichaActivaDesarrolloProductiva(f: FichaCurricularDrive, refIso: string): boolean {
  if (!isFichaActivaEnEjecucion(f)) return false;
  if (!f.aplicaEtapaProductiva) return false;
  if (!f.fechaFinEtapaLectivaIso || !refIso) return false;
  return refIso > f.fechaFinEtapaLectivaIso;
}

function diffDaysBetweenIso(targetIso: string, refIso: string): number | null {
  if (!targetIso || !refIso) return null;
  const tp = targetIso.split('-').map(Number);
  const rp = refIso.split('-').map(Number);
  if (tp.length !== 3 || rp.length !== 3 || tp.some(isNaN) || rp.some(isNaN)) return null;
  const tUtc = Date.UTC(tp[0], tp[1] - 1, tp[2]);
  const rUtc = Date.UTC(rp[0], rp[1] - 1, rp[2]);
  return Math.round((tUtc - rUtc) / 86400000);
}

function getTodayBogotaIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

interface ProgramPerformanceItem extends DesempenoYtoAK {
  programa: string;
  codigosPrograma: string[];
  niveles: string[];
  categoriaPrincipal: 'NO_NIVEL' | 'NIVEL_TITULADO';
  programasEspeciales: string[];
  fichasCount: number;
  enEjecucionFichas: number;
  terminadasFichas: number;
  abiertasFichas: number;
  cerradasFichas: number;
  cupoTotal: number;
  totalAprendicesYtoAK: number;
  activosEjecucion: number;
  logroCertificacion: number;
  novedadesAcademicas: number;
  bajasTotales: number;
  tasaOcupacionCupo: number;
  tasaCertificacion: number;
  tasaCulminacion: number;
  tasaBajas: number;
  tasaRetencion: number;
  diagnostico: 'Óptimo' | 'En Seguimiento' | 'Alerta de Retención' | 'Sin Aprendices';
}

export default function GestionCurricularView({
  rows,
  fichas,
  programacion,
  selectedFichaId,
  setSelectedFichaId,
}: GestionCurricularViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sub-vista opcional si el usuario también cargó archivos de juicios SofiaPlus
  const [workspaceMode, setWorkspaceMode] = useState<'drive-df14' | 'sofiaplus'>('drive-df14');

  // Datos sincronizados desde Google Drive (DF-14A_1.xml)
  const [driveRecords, setDriveRecords] = useState<FichaCurricularDrive[]>(() => {
    return getCachedCurricularDrive().records || [];
  });
  const [syncMeta, setSyncMeta] = useState<CurricularSyncMeta | null>(() => {
    return getCachedCurricularDrive().meta;
  });
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(() => {
    return !getCachedCurricularDrive().records;
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Filtros requeridos:
  // 1) Agrupación Columna H: NIVEL_FORMACION (Macro: Todos / No Niveles / Niveles Titulados + Valor exacto)
  const [macroColH, setMacroColH] = useState<MacroColHFilter>('TODOS');
  const [filterColH_Nivel, setFilterColH_Nivel] = useState<string>('TODOS');
  // 2) Columna G: PROGRAMA (Filtro oficial para analizar el desempeño de cada programa de formación)
  const [filterColG_Programa, setFilterColG_Programa] = useState<string>('TODOS');
  // 3) Columna L: FICHA (Buscador / Selector directo)
  const [filterColL_Ficha, setFilterColL_Ficha] = useState<string>('');
  // 4) Columna P: ESTADO_FICHA
  const [filterColP_Estado, setFilterColP_Estado] = useState<string>('TODOS');
  // 5) Columna Q: TIPO_RESPUESTA
  const [filterColQ_TipoRespuesta, setFilterColQ_TipoRespuesta] = useState<string>('TODOS');
  // 6) Columna R: PROGRAMA_ESPECIAL
  const [filterColR_ProgramaEspecial, setFilterColR_ProgramaEspecial] = useState<string>('TODOS');

  // Filtro interactivo opcional al hacer clic en una columna Y..AK (> 0 aprendices en ese estado)
  const [activeColYtoAKFilter, setActiveColYtoAKFilter] = useState<keyof DesempenoYtoAK | null>(null);
  // Búsqueda complementaria por texto libre (programa, código, convenio o empresa)
  const [programaQuery, setProgramaQuery] = useState<string>('');

  // Estados del Panel de Desempeño por Programa de Formación (Columna G)
  const [selectedPanelProgram, setSelectedPanelProgram] = useState<string>('');
  const [programPanelSearch, setProgramPanelSearch] = useState<string>('');
  const [programSortBy, setProgramSortBy] = useState<ProgramSortBy>('fichas');
  const [programTableMode, setProgramTableMode] = useState<TableViewMode>('COMPLETA_Y_AK');
  const [programPage, setProgramPage] = useState<number>(1);
  const programPageSize = 12;

  // Ficha activa para el panel de análisis individual (Columna L + Columnas Y..AK)
  const [inspectedFichaCode, setInspectedFichaCode] = useState<string>('');

  // Configuración de visualización de tabla maestra y gráficas
  const [tableMode, setTableMode] = useState<TableViewMode>('COMPLETA_Y_AK');
  const [chartDimension, setChartDimension] = useState<ChartDimension>('COL_H');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Estados del Centro de Indicadores Ejecutivos (7 KPIs por Etapa) y Decisiones / Validación
  const [activeStageKpiFilter, setActiveStageKpiFilter] = useState<StageKpiFilterKey | null>(null);
  const [activeDecisionQueue, setActiveDecisionQueue] = useState<DecisionQueueKey>('LECTIVA_PROXIMA');
  const [applyDecisionToGlobalBoard, setApplyDecisionToGlobalBoard] = useState<boolean>(false);
  const [alertHorizonDays, setAlertHorizonDays] = useState<AlertHorizonDays>(90);
  const [refDateMode, setRefDateMode] = useState<RefDateMode>('CORTE_DRIVE');
  const [decisionSearch, setDecisionSearch] = useState<string>('');
  const [decisionPage, setDecisionPage] = useState<number>(1);
  const decisionPageSize = 10;
  // Estado de la ventana emergente al hacer clic sobre una Ficha en 03. Indicadores
  const [modalDecisionFichaKey, setModalDecisionFichaKey] = useState<string | null>(null);
  const [modalFichaTab, setModalFichaTab] = useState<ModalFichaTab>('RESUMEN');
  const [driveProgramacionFiles, setDriveProgramacionFiles] = useState<
    DriveProgramacionFileItem[]
  >(() => getCachedProgramacionDriveFiles() || []);
  const [driveJuiciosFiles, setDriveJuiciosFiles] = useState<DriveJuiciosFileItem[]>(
    () => getCachedJuiciosDriveFiles() || []
  );

  const fichasWithSofiaProgSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of driveProgramacionFiles) {
      if (item.ficha) s.add(item.ficha);
    }
    return s;
  }, [driveProgramacionFiles]);

  const fichasWithJuiciosDriveSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of driveJuiciosFiles) {
      if (item.ficha) s.add(item.ficha);
    }
    return s;
  }, [driveJuiciosFiles]);

  // Sincronización automática inicial con la carpeta oficial de Google Drive
  const handleSyncDrive = async (silent: boolean = false) => {
    setIsLoadingDrive(true);
    setSyncError(null);
    if (!silent) setSyncNotice(null);

    try {
      const { records, meta } = await fetchCurricularFromDrive(GESTION_DRIVE_FOLDER_URL);
      setDriveRecords(records);
      setSyncMeta(meta);
      listProgramacionSofiaDriveFiles(true)
        .then((files) => setDriveProgramacionFiles(files))
        .catch(() => {});
      listJuiciosEvaluativosDriveFiles(true)
        .then((files) => setDriveJuiciosFiles(files))
        .catch(() => {});
      if (records.length > 0 && !inspectedFichaCode) {
        setInspectedFichaCode(records[0].ficha);
      }
      if (!silent) {
        setSyncNotice(
          `Archivo ${meta.fileName} sincronizado — Fecha de modificación en Google Drive: ${meta.driveModifiedAt} (${records.length.toLocaleString('es-CO')} fichas analizadas).`
        );
      }
    } catch (err: any) {
      setSyncError(
        err?.message ||
          'No fue posible sincronizar automáticamente desde Google Drive. Puede intentar nuevamente o cargar el archivo XML/XLSX local.'
      );
    } finally {
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    const cached = getCachedCurricularDrive();
    if (!cached.records || cached.records.length === 0) {
      handleSyncDrive(true);
    } else if (!inspectedFichaCode && cached.records.length > 0) {
      setInspectedFichaCode(cached.records[0].ficha);
    }
    listProgramacionSofiaDriveFiles(false)
      .then((files) => setDriveProgramacionFiles(files))
      .catch(() => {});
    listJuiciosEvaluativosDriveFiles(false)
      .then((files) => setDriveJuiciosFiles(files))
      .catch(() => {});
  }, []);

  // Carga local alternativa (.xml / .xlsx / .csv)
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSyncError(null);
    setSyncNotice(null);
    setIsLoadingDrive(true);

    const isXml = file.name.toLowerCase().endsWith('.xml');
    const reader = new FileReader();

    reader.onload = (ev) => {
      try {
        let parsed: FichaCurricularDrive[] = [];
        if (isXml) {
          const text = String(ev.target?.result || '');
          parsed = parseCurricularXml(text);
        } else {
          const buf = ev.target?.result as ArrayBuffer;
          parsed = parseCurricularSpreadsheetBuffer(buf);
        }

        if (parsed.length === 0) {
          throw new Error('No se encontraron registros válidos con estructura de reporte DF-14.');
        }

        const fileModAt =
          formatDriveModifiedDate(file.lastModified) || formatDriveModifiedDate(new Date());
        const fileModIso = parseRawDateToIso(new Date(file.lastModified || Date.now()).toISOString());
        const meta: CurricularSyncMeta = {
          fileName: file.name,
          fileId: 'local',
          folderId: 'local',
          driveModifiedAt: fileModAt,
          driveModifiedIso: fileModIso,
          syncedAt: formatDriveModifiedDate(new Date()),
          totalRows: parsed.length,
        };

        setCachedCurricularDrive(parsed, meta);
        setDriveRecords(parsed);
        setSyncMeta(meta);
        setInspectedFichaCode(parsed[0].ficha);
        setCurrentPage(1);
        setSyncNotice(
          `Archivo local "${file.name}" procesado correctamente con ${parsed.length.toLocaleString('es-CO')} fichas.`
        );
      } catch (err: any) {
        setSyncError(err?.message || 'Error al procesar el archivo seleccionado.');
      } finally {
        setIsLoadingDrive(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (isXml) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Agrupación completa de la Columna H (NIVEL_FORMACION): No Niveles vs Niveles Titulados
  const colHGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        nivel: string;
        categoria: 'NO_NIVEL' | 'NIVEL_TITULADO';
        fichasCount: number;
        cupoTotal: number;
        totalAprendices: number;
        enFormacion: number;
        certificados: number;
        porCertificar: number;
        bajas: number;
      }
    >();

    for (const r of driveRecords) {
      const existing = map.get(r.nivelFormacion);
      if (existing) {
        existing.fichasCount += 1;
        existing.cupoTotal += r.cupo;
        existing.totalAprendices += r.totalAprendicesYtoAK;
        existing.enFormacion += r.colAA_formacion;
        existing.certificados += r.colAI_certificado;
        existing.porCertificar += r.colAH_porCertificar;
        existing.bajas += r.bajasTotales;
      } else {
        map.set(r.nivelFormacion, {
          nivel: r.nivelFormacion,
          categoria: r.categoriaColH,
          fichasCount: 1,
          cupoTotal: r.cupo,
          totalAprendices: r.totalAprendicesYtoAK,
          enFormacion: r.colAA_formacion,
          certificados: r.colAI_certificado,
          porCertificar: r.colAH_porCertificar,
          bajas: r.bajasTotales,
        });
      }
    }

    // Ordenar: primero los "No Niveles" agrupados por volumen, luego los Niveles Titulados por volumen
    return Array.from(map.values()).sort((a, b) => {
      if (a.categoria !== b.categoria) {
        return a.categoria === 'NO_NIVEL' ? -1 : 1;
      }
      return b.fichasCount - a.fichasCount;
    });
  }, [driveRecords]);

  const macroColHCounts = useMemo(() => {
    let noNivelesFichas = 0;
    let nivelesTituladosFichas = 0;
    let noNivelesAprendices = 0;
    let nivelesTituladosAprendices = 0;

    for (const g of colHGroups) {
      if (g.categoria === 'NO_NIVEL') {
        noNivelesFichas += g.fichasCount;
        noNivelesAprendices += g.totalAprendices;
      } else {
        nivelesTituladosFichas += g.fichasCount;
        nivelesTituladosAprendices += g.totalAprendices;
      }
    }

    return {
      totalFichas: driveRecords.length,
      noNivelesFichas,
      nivelesTituladosFichas,
      noNivelesAprendices,
      nivelesTituladosAprendices,
    };
  }, [colHGroups, driveRecords.length]);

  // Opciones dinámicas en cascada para los filtros H, P, Q, R
  const optionsColH = useMemo(() => {
    const base = colHGroups.filter((g) => {
      if (macroColH === 'NO_NIVELES') return g.categoria === 'NO_NIVEL';
      if (macroColH === 'NIVELES_TITULADOS') return g.categoria === 'NIVEL_TITULADO';
      return true;
    });
    return base;
  }, [colHGroups, macroColH]);

  const baseFilteredForFacets = useMemo(() => {
    return driveRecords.filter((r) => {
      if (macroColH === 'NO_NIVELES' && r.categoriaColH !== 'NO_NIVEL') return false;
      if (macroColH === 'NIVELES_TITULADOS' && r.categoriaColH !== 'NIVEL_TITULADO') return false;
      if (filterColH_Nivel !== 'TODOS' && r.nivelFormacion !== filterColH_Nivel) return false;
      return true;
    });
  }, [driveRecords, macroColH, filterColH_Nivel]);

  const optionsColG_Programa = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of baseFilteredForFacets) {
      if (filterColP_Estado !== 'TODOS' && r.estadoFicha !== filterColP_Estado) continue;
      if (filterColQ_TipoRespuesta !== 'TODOS' && r.tipoRespuesta !== filterColQ_TipoRespuesta) continue;
      if (filterColR_ProgramaEspecial !== 'TODOS' && r.programaEspecial !== filterColR_ProgramaEspecial) continue;
      counts.set(r.programa, (counts.get(r.programa) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [baseFilteredForFacets, filterColP_Estado, filterColQ_TipoRespuesta, filterColR_ProgramaEspecial]);

  const optionsColP_Estado = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of baseFilteredForFacets) {
      if (filterColG_Programa !== 'TODOS' && r.programa !== filterColG_Programa) continue;
      if (filterColQ_TipoRespuesta !== 'TODOS' && r.tipoRespuesta !== filterColQ_TipoRespuesta) continue;
      if (filterColR_ProgramaEspecial !== 'TODOS' && r.programaEspecial !== filterColR_ProgramaEspecial) continue;
      counts.set(r.estadoFicha, (counts.get(r.estadoFicha) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [baseFilteredForFacets, filterColG_Programa, filterColQ_TipoRespuesta, filterColR_ProgramaEspecial]);

  const optionsColQ_Respuesta = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of baseFilteredForFacets) {
      if (filterColG_Programa !== 'TODOS' && r.programa !== filterColG_Programa) continue;
      if (filterColP_Estado !== 'TODOS' && r.estadoFicha !== filterColP_Estado) continue;
      if (filterColR_ProgramaEspecial !== 'TODOS' && r.programaEspecial !== filterColR_ProgramaEspecial) continue;
      counts.set(r.tipoRespuesta, (counts.get(r.tipoRespuesta) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [baseFilteredForFacets, filterColG_Programa, filterColP_Estado, filterColR_ProgramaEspecial]);

  const optionsColR_ProgEspecial = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of baseFilteredForFacets) {
      if (filterColG_Programa !== 'TODOS' && r.programa !== filterColG_Programa) continue;
      if (filterColP_Estado !== 'TODOS' && r.estadoFicha !== filterColP_Estado) continue;
      if (filterColQ_TipoRespuesta !== 'TODOS' && r.tipoRespuesta !== filterColQ_TipoRespuesta) continue;
      counts.set(r.programaEspecial, (counts.get(r.programaEspecial) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [baseFilteredForFacets, filterColG_Programa, filterColP_Estado, filterColQ_TipoRespuesta]);

  // Conjunto base filtrado por los filtros curriculares oficiales (H, G, L, P, Q, R + columna Y..AK + búsqueda texto)
  const baseCurricularFichas = useMemo(() => {
    const fichaClean = filterColL_Ficha.trim().toLowerCase();
    const progClean = programaQuery.trim().toLowerCase();

    return driveRecords.filter((r) => {
      if (macroColH === 'NO_NIVELES' && r.categoriaColH !== 'NO_NIVEL') return false;
      if (macroColH === 'NIVELES_TITULADOS' && r.categoriaColH !== 'NIVEL_TITULADO') return false;
      if (filterColH_Nivel !== 'TODOS' && r.nivelFormacion !== filterColH_Nivel) return false;
      if (filterColG_Programa !== 'TODOS' && r.programa !== filterColG_Programa) return false;
      if (fichaClean && !r.ficha.toLowerCase().includes(fichaClean)) return false;
      if (filterColP_Estado !== 'TODOS' && r.estadoFicha !== filterColP_Estado) return false;
      if (filterColQ_TipoRespuesta !== 'TODOS' && r.tipoRespuesta !== filterColQ_TipoRespuesta) return false;
      if (filterColR_ProgramaEspecial !== 'TODOS' && r.programaEspecial !== filterColR_ProgramaEspecial) return false;
      if (activeColYtoAKFilter && r[activeColYtoAKFilter] <= 0) return false;
      if (progClean) {
        const matchProg =
          r.programa.toLowerCase().includes(progClean) ||
          r.codigoPrograma.toLowerCase().includes(progClean) ||
          r.empresa.toLowerCase().includes(progClean) ||
          r.convenio.toLowerCase().includes(progClean);
        if (!matchProg) return false;
      }
      return true;
    });
  }, [
    driveRecords,
    macroColH,
    filterColH_Nivel,
    filterColG_Programa,
    filterColL_Ficha,
    filterColP_Estado,
    filterColQ_TipoRespuesta,
    filterColR_ProgramaEspecial,
    activeColYtoAKFilter,
    programaQuery,
  ]);

  // Fecha de corte activa para los cálculos de vencimientos (Fecha Actual vs Fecha Modificación Archivo Drive)
  const activeReferenceIso = useMemo(() => {
    const todayIso = getTodayBogotaIso();
    if (refDateMode === 'CORTE_DRIVE' && syncMeta?.driveModifiedIso) {
      return syncMeta.driveModifiedIso;
    }
    return todayIso;
  }, [refDateMode, syncMeta]);

  // Motor Integral de Evaluación: Fichas de Atención que Requieren Decisión y Datos que Requieren Validación
  const decisionEvaluations = useMemo(() => {
    const evaluations: DecisionFichaEvaluation[] = [];
    const byKey = new Map<string, DecisionFichaEvaluation>();

    for (const f of baseCurricularFichas) {
      const estLower = f.estadoFicha.toLowerCase();
      const esEnEjecucion = estLower.includes('ejecuci') || estLower.includes('matricula');
      const esTerminada = estLower.includes('terminada');

      const diasParaFinLectiva = diffDaysBetweenIso(f.fechaFinEtapaLectivaIso, activeReferenceIso);
      const diasParaCierreProductiva = f.aplicaEtapaProductiva
        ? diffDaysBetweenIso(f.fechaCierreEtapaProductivaIso, activeReferenceIso)
        : null;
      const diasParaLimite1AnioProductiva = f.aplicaEtapaProductiva
        ? diffDaysBetweenIso(f.fechaLimitePresentacionProductivaIso, activeReferenceIso)
        : null;

      // 1) Fichas próximas a finalizar Etapa Lectiva:
      // Col N FECHA_FIN_FICHA menos 6 meses ÚNICAMENTE para TÉCNICO y TECNÓLOGO, y menos 3 meses para AUXILIAR y OPERARIO
      const isLectivaProxima =
        f.aplicaEtapaProductiva &&
        esEnEjecucion &&
        diasParaFinLectiva !== null &&
        diasParaFinLectiva >= 0 &&
        diasParaFinLectiva <= alertHorizonDays;

      // 2) Preparación de cierre, evaluación o seguimiento de Etapa Productiva:
      // Cierre Etapa Productiva = Col N FECHA_FIN_FICHA; y +1 año posterior para presentar etapa productiva como aprendiz
      const pendientesCierreProductiva =
        f.colAA_formacion + f.colAH_porCertificar + f.colAB_condicionado + f.colAC_aplazado;

      const isProductivaSeguimientoCierre =
        f.aplicaEtapaProductiva &&
        esEnEjecucion &&
        diasParaFinLectiva !== null &&
        diasParaFinLectiva < 0 &&
        diasParaCierreProductiva !== null &&
        diasParaCierreProductiva >= 0;

      const isProductivaCierreProximo =
        isProductivaSeguimientoCierre &&
        diasParaCierreProductiva !== null &&
        diasParaCierreProductiva <= alertHorizonDays;

      const isProductivaPlazo1AnioActivo =
        f.aplicaEtapaProductiva &&
        diasParaCierreProductiva !== null &&
        diasParaCierreProductiva < 0 &&
        diasParaLimite1AnioProductiva !== null &&
        diasParaLimite1AnioProductiva >= 0 &&
        (pendientesCierreProductiva > 0 || esEnEjecucion);

      const isProductivaPlazo1AnioVencido =
        f.aplicaEtapaProductiva &&
        diasParaLimite1AnioProductiva !== null &&
        diasParaLimite1AnioProductiva < 0 &&
        (pendientesCierreProductiva > 0 || esEnEjecucion);

      // 3) Pendientes de certificación y novedades administrativas
      const rezagadosTransitoInduccion =
        (esTerminada || (diasParaFinLectiva !== null && diasParaFinLectiva < 0)) &&
        f.colY_enTransito + f.colZ_induccion > 0;

      const isPorCertificar = f.colAH_porCertificar > 0;
      const isNovedadesAdmin = f.novedadesAcademicas > 0 || rezagadosTransitoInduccion;

      // 4) Datos que requieren validación (Cupos vs Estados Y-AK, Fechas inconsistentes, Fichas duplicadas)
      const isSobrecupo = f.cupo <= 0 || f.totalAprendicesYtoAK > f.cupo;
      const isCupoDiferente = f.cupo !== f.totalAprendicesYtoAK || f.totalAprendicesYtoAK === 0;

      const hallazgosValidacion: string[] = [];
      if (f.ocurrenciasFicha > 1) {
        hallazgosValidacion.push(`Ficha duplicada (${f.ocurrenciasFicha} registros en el archivo)`);
      }
      if (!f.fechaInicioIso || !f.fechaFinIso) {
        hallazgosValidacion.push('Fecha de Inicio o Fecha Final ausente o con formato inválido');
      } else {
        if (f.fechaFinIso < f.fechaInicioIso) {
          hallazgosValidacion.push('La Fecha Final de la ficha es anterior a la Fecha de Inicio');
        }
        if (f.aplicaEtapaProductiva && f.fechaFinEtapaLectivaIso <= f.fechaInicioIso) {
          hallazgosValidacion.push(
            `Fecha Fin Etapa Lectiva (${f.fechaFinEtapaLectiva}) es menor o igual a Fecha Inicio (${f.fechaInicio})`
          );
        }
        if (esEnEjecucion && f.fechaFinIso < activeReferenceIso) {
          hallazgosValidacion.push(
            `Estado "${f.estadoFicha}" registrado pero la Fecha Final (${f.fechaFin}) ya venció`
          );
        }
        if (esTerminada && f.fechaFinIso > activeReferenceIso) {
          hallazgosValidacion.push(
            `Estado "${f.estadoFicha}" registrado pero la Fecha Final (${f.fechaFin}) es futura`
          );
        }
        if (estLower.includes('ejecuci') && f.fechaInicioIso > activeReferenceIso) {
          hallazgosValidacion.push(
            `Estado "En ejecución" registrado pero la Fecha de Inicio (${f.fechaInicio}) es futura`
          );
        }
      }

      const isFechasInconsistentes =
        !f.fechaInicioIso ||
        !f.fechaFinIso ||
        f.fechaFinIso < f.fechaInicioIso ||
        (f.aplicaEtapaProductiva && f.fechaFinEtapaLectivaIso <= f.fechaInicioIso) ||
        (esEnEjecucion && f.fechaFinIso < activeReferenceIso) ||
        (esTerminada && f.fechaFinIso > activeReferenceIso) ||
        (estLower.includes('ejecuci') && f.fechaInicioIso > activeReferenceIso);

      const isFichaDuplicada = f.ocurrenciasFicha > 1;

      if (f.cupo <= 0) {
        hallazgosValidacion.push('Cupo autorizado registrado en 0 o negativo');
      } else if (f.totalAprendicesYtoAK > f.cupo) {
        hallazgosValidacion.push(
          `Sobrecupo: ${f.totalAprendicesYtoAK} aprendices registrados frente a cupo ${f.cupo} (+${f.diferenciaCupoEstados})`
        );
      } else if (f.totalAprendicesYtoAK === 0) {
        hallazgosValidacion.push(`Sin aprendices reportados en estados de formación (Cupo autorizado: ${f.cupo})`);
      } else if (f.totalAprendicesYtoAK < f.cupo) {
        hallazgosValidacion.push(
          `Diferencia cupo vs estados: ${f.totalAprendicesYtoAK} aprendices reportados frente a cupo ${f.cupo} (${f.diferenciaCupoEstados})`
        );
      }

      const hallazgosDecision: string[] = [];
      if (isLectivaProxima && diasParaFinLectiva !== null) {
        hallazgosDecision.push(
          `Etapa Lectiva finaliza en ${diasParaFinLectiva} días (${f.fechaFinEtapaLectiva}, ${
            f.mesesRestadosEtapaLectiva === 6 ? 'Fecha Final − 6m' : 'Fecha Final − 3m'
          }) — Preparar evaluación de RAs y paso a productiva`
        );
      }
      if (isProductivaSeguimientoCierre && diasParaCierreProductiva !== null) {
        hallazgosDecision.push(
          isProductivaCierreProximo
            ? `Próxima a cierre de Etapa Productiva en ${diasParaCierreProductiva} días (Fecha cierre: ${f.fechaCierreEtapaProductiva}) — Preparar cierre y evaluación`
            : `En seguimiento de Etapa Productiva (${f.colAA_formacion} en formación; cierre: ${f.fechaCierreEtapaProductiva})`
        );
      }
      if (isProductivaPlazo1AnioActivo && diasParaLimite1AnioProductiva !== null) {
        hallazgosDecision.push(
          `En año posterior de Etapa Productiva: restan ${diasParaLimite1AnioProductiva} días hasta límite ${f.fechaLimitePresentacionProductiva} (${pendientesCierreProductiva} apr. por cerrar/certificar)`
        );
      }
      if (isProductivaPlazo1AnioVencido && diasParaLimite1AnioProductiva !== null) {
        hallazgosDecision.push(
          `Plazo de +1 año de Etapa Productiva vencido hace ${Math.abs(
            diasParaLimite1AnioProductiva
          )} días (límite ${f.fechaLimitePresentacionProductiva}) con ${pendientesCierreProductiva} apr. sin cierre`
        );
      }
      if (isPorCertificar) {
        hallazgosDecision.push(
          `${f.colAH_porCertificar} aprendices Por Certificar — Priorizar revisión de requisitos`
        );
      }
      if (isNovedadesAdmin) {
        const partesNov: string[] = [];
        if (f.colAB_condicionado > 0) partesNov.push(`Condicionado: ${f.colAB_condicionado}`);
        if (f.colAC_aplazado > 0) partesNov.push(`Aplazado: ${f.colAC_aplazado}`);
        if (f.colAJ_trasladado > 0) partesNov.push(`Trasladado: ${f.colAJ_trasladado}`);
        if (f.colAK_otro > 0) partesNov.push(`Otro: ${f.colAK_otro}`);
        if (rezagadosTransitoInduccion) {
          partesNov.push(`Tránsito/Inducción rezagados: ${f.colY_enTransito + f.colZ_induccion}`);
        }
        hallazgosDecision.push(`Novedades administrativas por resolver (${partesNov.join(', ')})`);
      }

      let etapaActualLabel = 'Formación Complementaria / Única';
      if (f.aplicaEtapaProductiva) {
        if (diasParaFinLectiva !== null && diasParaFinLectiva >= 0) {
          etapaActualLabel =
            diasParaFinLectiva <= alertHorizonDays
              ? `Lectiva por cerrar (${diasParaFinLectiva}d)`
              : 'En Etapa Lectiva';
        } else if (diasParaCierreProductiva !== null && diasParaCierreProductiva >= 0) {
          etapaActualLabel =
            diasParaCierreProductiva <= alertHorizonDays
              ? `Productiva por cerrar (${diasParaCierreProductiva}d)`
              : 'En Etapa Productiva';
        } else if (diasParaLimite1AnioProductiva !== null && diasParaLimite1AnioProductiva >= 0) {
          etapaActualLabel = `Plazo +1 Año Productiva (${diasParaLimite1AnioProductiva}d)`;
        } else {
          etapaActualLabel = 'Post-Plazo +1 Año Productiva';
        }
      } else if (esTerminada) {
        etapaActualLabel = 'Complementaria Terminada';
      } else {
        etapaActualLabel = 'Complementaria en Ejecución';
      }

      let prioridad: DecisionFichaEvaluation['prioridad'] = 'Normal';
      if (
        isProductivaPlazo1AnioVencido ||
        isFichaDuplicada ||
        isSobrecupo ||
        isFechasInconsistentes ||
        (isLectivaProxima && diasParaFinLectiva !== null && diasParaFinLectiva <= 30) ||
        (isProductivaCierreProximo && diasParaCierreProductiva !== null && diasParaCierreProductiva <= 30) ||
        (esTerminada && (isPorCertificar || isNovedadesAdmin))
      ) {
        prioridad = 'Crítica';
      } else if (
        isLectivaProxima ||
        isProductivaCierreProximo ||
        (isProductivaPlazo1AnioActivo &&
          diasParaLimite1AnioProductiva !== null &&
          diasParaLimite1AnioProductiva <= alertHorizonDays) ||
        isPorCertificar
      ) {
        prioridad = 'Alta';
      } else if (isProductivaSeguimientoCierre || isProductivaPlazo1AnioActivo || isNovedadesAdmin) {
        prioridad = 'Media';
      }

      const evObj: DecisionFichaEvaluation = {
        fichaRecord: f,
        diasParaFinLectiva,
        diasParaCierreProductiva,
        diasParaLimite1AnioProductiva,
        isLectivaProxima,
        isProductivaSeguimientoCierre,
        isProductivaCierreProximo,
        isProductivaPlazo1AnioActivo,
        isProductivaPlazo1AnioVencido,
        isPorCertificar,
        isNovedadesAdmin,
        isSobrecupo,
        isCupoDiferente,
        isFechasInconsistentes,
        isFichaDuplicada,
        prioridad,
        etapaActualLabel,
        hallazgosDecision,
        hallazgosValidacion,
      };

      evaluations.push(evObj);
      byKey.set(`${f.ficha}__${f.filaReporte}`, evObj);
    }

    return { evaluations, byKey };
  }, [baseCurricularFichas, activeReferenceIso, alertHorizonDays]);

  const matchesDecisionQueue = (ev: DecisionFichaEvaluation, queue: DecisionQueueKey): boolean => {
    switch (queue) {
      case 'LECTIVA_PROXIMA':
        return ev.isLectivaProxima;
      case 'PRODUCTIVA_TODAS':
        return (
          ev.isProductivaSeguimientoCierre ||
          ev.isProductivaPlazo1AnioActivo ||
          ev.isProductivaPlazo1AnioVencido
        );
      case 'PRODUCTIVA_SEGUIMIENTO_CIERRE':
        return ev.isProductivaSeguimientoCierre;
      case 'PRODUCTIVA_PLAZO_1_ANIO':
        return ev.isProductivaPlazo1AnioActivo;
      case 'PRODUCTIVA_PLAZO_VENCIDO':
        return ev.isProductivaPlazo1AnioVencido;
      case 'CERTIFICACION_TODAS':
        return ev.isPorCertificar || ev.isNovedadesAdmin;
      case 'CERT_POR_CERTIFICAR':
        return ev.isPorCertificar;
      case 'CERT_NOVEDADES_ADMIN':
        return ev.isNovedadesAdmin;
      case 'VALIDACION_CRITICA':
        return ev.isSobrecupo || ev.isFechasInconsistentes || ev.isFichaDuplicada;
      case 'VAL_SOBRECUPO':
        return ev.isSobrecupo;
      case 'VAL_CUPO_DIFERENTE':
        return ev.isCupoDiferente;
      case 'VAL_FECHAS_INCONSISTENTES':
        return ev.isFechasInconsistentes;
      case 'VAL_FICHAS_DUPLICADAS':
        return ev.isFichaDuplicada;
      case 'CON_PROG_SOFIA':
        return fichasWithSofiaProgSet.has(ev.fichaRecord.ficha);
      case 'CON_JUICIOS_DRIVE':
        return fichasWithJuiciosDriveSet.has(ev.fichaRecord.ficha);
      case 'TODAS_EVALUADAS':
        return true;
      default:
        return false;
    }
  };

  // Resumen consolidado de los 4 Indicadores de Atención que Requieren Decisión y Validación
  const decisionSummary = useMemo(() => {
    let lectivaProximaTotal = 0;
    let lectivaTecTecnologo6m = 0;
    let lectivaAuxOperario3m = 0;
    let lectivaAprendicesActivos = 0;

    let productivaTotal = 0;
    let productivaSeguimiento = 0;
    let productivaCierreProximo = 0;
    let productivaPlazo1Anio = 0;
    let productivaPlazoVencido = 0;

    let certYNovedadesTotal = 0;
    let fichasPorCertificar = 0;
    let aprendicesPorCertificar = 0;
    let fichasConNovedadesAdmin = 0;
    let aprendicesConNovedades = 0;

    let validacionCriticaTotal = 0;
    let sobrecupoCount = 0;
    let cupoDiferenteTotal = 0;
    let fechasInconsistentesCount = 0;
    let duplicadasRowsCount = 0;
    let conProgSofiaCount = 0;
    let conJuiciosDriveCount = 0;

    for (const ev of decisionEvaluations.evaluations) {
      const f = ev.fichaRecord;
      if (fichasWithSofiaProgSet.has(f.ficha)) {
        conProgSofiaCount++;
      }
      if (fichasWithJuiciosDriveSet.has(f.ficha)) {
        conJuiciosDriveCount++;
      }
      if (ev.isLectivaProxima) {
        lectivaProximaTotal++;
        lectivaAprendicesActivos += f.activosEjecucion;
        if (f.mesesRestadosEtapaLectiva === 6) lectivaTecTecnologo6m++;
        else if (f.mesesRestadosEtapaLectiva === 3) lectivaAuxOperario3m++;
      }

      if (
        ev.isProductivaSeguimientoCierre ||
        ev.isProductivaPlazo1AnioActivo ||
        ev.isProductivaPlazo1AnioVencido
      ) {
        productivaTotal++;
      }
      if (ev.isProductivaSeguimientoCierre) productivaSeguimiento++;
      if (ev.isProductivaCierreProximo) productivaCierreProximo++;
      if (ev.isProductivaPlazo1AnioActivo) productivaPlazo1Anio++;
      if (ev.isProductivaPlazo1AnioVencido) productivaPlazoVencido++;

      if (ev.isPorCertificar || ev.isNovedadesAdmin) certYNovedadesTotal++;
      if (ev.isPorCertificar) {
        fichasPorCertificar++;
        aprendicesPorCertificar += f.colAH_porCertificar;
      }
      if (ev.isNovedadesAdmin) {
        fichasConNovedadesAdmin++;
        aprendicesConNovedades += f.novedadesAcademicas;
      }

      if (ev.isSobrecupo || ev.isFechasInconsistentes || ev.isFichaDuplicada) {
        validacionCriticaTotal++;
      }
      if (ev.isSobrecupo) sobrecupoCount++;
      if (ev.isCupoDiferente) cupoDiferenteTotal++;
      if (ev.isFechasInconsistentes) fechasInconsistentesCount++;
      if (ev.isFichaDuplicada) duplicadasRowsCount++;
    }

    return {
      lectivaProximaTotal,
      lectivaTecTecnologo6m,
      lectivaAuxOperario3m,
      lectivaAprendicesActivos,
      productivaTotal,
      productivaSeguimiento,
      productivaCierreProximo,
      productivaPlazo1Anio,
      productivaPlazoVencido,
      certYNovedadesTotal,
      fichasPorCertificar,
      aprendicesPorCertificar,
      fichasConNovedadesAdmin,
      aprendicesConNovedades,
      validacionCriticaTotal,
      sobrecupoCount,
      cupoDiferenteTotal,
      fechasInconsistentesCount,
      duplicadasRowsCount,
      conProgSofiaCount,
      conJuiciosDriveCount,
    };
  }, [decisionEvaluations, fichasWithSofiaProgSet, fichasWithJuiciosDriveSet]);

  const availableFichaCodesInBoard = useMemo(() => {
    const s = new Set<string>();
    for (const ev of decisionEvaluations.evaluations) {
      s.add(ev.fichaRecord.ficha);
    }
    return s;
  }, [decisionEvaluations]);

  // Lista activa en la tabla del Panel de Decisiones y Validación
  const activeDecisionQueueItems = useMemo(() => {
    const q = decisionSearch.trim().toLowerCase();
    const priorityRank: Record<DecisionFichaEvaluation['prioridad'], number> = {
      Crítica: 0,
      Alta: 1,
      Media: 2,
      Normal: 3,
    };

    return decisionEvaluations.evaluations
      .filter((ev) => {
        if (!matchesDecisionQueue(ev, activeDecisionQueue)) return false;
        if (q) {
          const f = ev.fichaRecord;
          const match =
            f.ficha.toLowerCase().includes(q) ||
            f.programa.toLowerCase().includes(q) ||
            f.nivelFormacion.toLowerCase().includes(q) ||
            f.estadoFicha.toLowerCase().includes(q) ||
            ev.hallazgosDecision.some((h) => h.toLowerCase().includes(q)) ||
            ev.hallazgosValidacion.some((h) => h.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (activeDecisionQueue === 'LECTIVA_PROXIMA') {
          return (a.diasParaFinLectiva ?? 9999) - (b.diasParaFinLectiva ?? 9999);
        }
        if (activeDecisionQueue === 'PRODUCTIVA_SEGUIMIENTO_CIERRE') {
          return (a.diasParaCierreProductiva ?? 9999) - (b.diasParaCierreProductiva ?? 9999);
        }
        if (activeDecisionQueue === 'PRODUCTIVA_PLAZO_1_ANIO') {
          return (a.diasParaLimite1AnioProductiva ?? 9999) - (b.diasParaLimite1AnioProductiva ?? 9999);
        }
        if (activeDecisionQueue === 'CERT_POR_CERTIFICAR') {
          return b.fichaRecord.colAH_porCertificar - a.fichaRecord.colAH_porCertificar;
        }
        if (priorityRank[a.prioridad] !== priorityRank[b.prioridad]) {
          return priorityRank[a.prioridad] - priorityRank[b.prioridad];
        }
        return b.fichaRecord.totalAprendicesYtoAK - a.fichaRecord.totalAprendicesYtoAK;
      });
  }, [
    decisionEvaluations,
    activeDecisionQueue,
    decisionSearch,
    fichasWithSofiaProgSet,
    fichasWithJuiciosDriveSet,
  ]);

  const totalDecisionPages = Math.max(1, Math.ceil(activeDecisionQueueItems.length / decisionPageSize));
  const paginatedDecisionItems = useMemo(() => {
    const start = (decisionPage - 1) * decisionPageSize;
    return activeDecisionQueueItems.slice(start, start + decisionPageSize);
  }, [activeDecisionQueueItems, decisionPage]);

  useEffect(() => {
    setDecisionPage(1);
  }, [activeDecisionQueue, decisionSearch, alertHorizonDays, refDateMode]);

  // Cálculo de los 7 Indicadores Ejecutivos Solicitados (sobre baseCurricularFichas para mantener visibilidad comparativa al hacer clic)
  const stageKpiMetrics = useMemo(() => {
    let fichasActivasLectiva = 0;
    let fichasLectivaTitulada = 0;
    let fichasLectivaComplementaria = 0;

    let fichasActivasProductiva = 0;
    let fichasProductivaTecTecnologo = 0;
    let fichasProductivaAuxOperario = 0;
    let fichasPostFechaConFormacion = 0;

    let aprendicesFormacionLectiva = 0;
    let aprLectivaTitulada = 0;
    let aprLectivaComplementaria = 0;
    let aprTransitoInduccionLectiva = 0;

    let aprendicesFormacionProductiva = 0;
    let aprProductivaPostFechaPlazo1Anio = 0;

    let aprendicesPendientesCertificar = 0;
    let fichasConPendientesCertificar = 0;

    let aprendicesCertificadosRegistrados = 0;
    let fichasConCertificados = 0;

    let aprendicesRetirosYCancelaciones = 0;
    let retirosVoluntariosColAD = 0;
    let cancelacionesYDesercionesAEaAG = 0;
    let fichasConRetirosOCancelaciones = 0;

    let totalAprendicesBase = 0;

    for (const f of baseCurricularFichas) {
      totalAprendicesBase += f.totalAprendicesYtoAK;

      const enLectiva = isFichaActivaDesarrolloLectiva(f, activeReferenceIso);
      const enProductiva = isFichaActivaDesarrolloProductiva(f, activeReferenceIso);

      if (enLectiva) {
        fichasActivasLectiva += 1;
        aprendicesFormacionLectiva += f.colAA_formacion;
        aprTransitoInduccionLectiva += f.colY_enTransito + f.colZ_induccion;
        if (f.categoriaColH === 'NIVEL_TITULADO') {
          fichasLectivaTitulada += 1;
          aprLectivaTitulada += f.colAA_formacion;
        } else {
          fichasLectivaComplementaria += 1;
          aprLectivaComplementaria += f.colAA_formacion;
        }
      } else if (enProductiva) {
        fichasActivasProductiva += 1;
        aprendicesFormacionProductiva += f.colAA_formacion;
        if (f.mesesRestadosEtapaLectiva === 6) fichasProductivaTecTecnologo += 1;
        else if (f.mesesRestadosEtapaLectiva === 3) fichasProductivaAuxOperario += 1;
      } else if (!isFichaActivaEnEjecucion(f) && f.aplicaEtapaProductiva && f.colAA_formacion > 0) {
        fichasPostFechaConFormacion += 1;
        aprProductivaPostFechaPlazo1Anio += f.colAA_formacion;
      }

      if (f.colAH_porCertificar > 0) {
        aprendicesPendientesCertificar += f.colAH_porCertificar;
        fichasConPendientesCertificar += 1;
      }

      if (f.colAI_certificado > 0) {
        aprendicesCertificadosRegistrados += f.colAI_certificado;
        fichasConCertificados += 1;
      }

      if (f.bajasTotales > 0) {
        aprendicesRetirosYCancelaciones += f.bajasTotales;
        retirosVoluntariosColAD += f.colAD_retiroVoluntario;
        cancelacionesYDesercionesAEaAG +=
          f.colAE_cancelamientoVirtComp + f.colAF_desercionVirtComp + f.colAG_cancelado;
        fichasConRetirosOCancelaciones += 1;
      }
    }

    const pctCertificados =
      totalAprendicesBase > 0
        ? Math.round((aprendicesCertificadosRegistrados / totalAprendicesBase) * 1000) / 10
        : 0;
    const pctPendientesCertificar =
      totalAprendicesBase > 0
        ? Math.round((aprendicesPendientesCertificar / totalAprendicesBase) * 1000) / 10
        : 0;
    const pctRetirosCancelaciones =
      totalAprendicesBase > 0
        ? Math.round((aprendicesRetirosYCancelaciones / totalAprendicesBase) * 1000) / 10
        : 0;

    return {
      fichasActivasLectiva,
      fichasLectivaTitulada,
      fichasLectivaComplementaria,
      fichasActivasProductiva,
      fichasProductivaTecTecnologo,
      fichasProductivaAuxOperario,
      fichasPostFechaConFormacion,
      aprendicesFormacionLectiva,
      aprLectivaTitulada,
      aprLectivaComplementaria,
      aprTransitoInduccionLectiva,
      aprendicesFormacionProductiva,
      aprProductivaPostFechaPlazo1Anio,
      aprendicesPendientesCertificar,
      fichasConPendientesCertificar,
      aprendicesCertificadosRegistrados,
      fichasConCertificados,
      aprendicesRetirosYCancelaciones,
      retirosVoluntariosColAD,
      cancelacionesYDesercionesAEaAG,
      fichasConRetirosOCancelaciones,
      totalAprendicesBase,
      pctCertificados,
      pctPendientesCertificar,
      pctRetirosCancelaciones,
    };
  }, [baseCurricularFichas, activeReferenceIso]);

  const matchesStageKpiFilter = (f: FichaCurricularDrive, filterKey: StageKpiFilterKey): boolean => {
    switch (filterKey) {
      case 'FICHAS_LECTIVA':
        return isFichaActivaDesarrolloLectiva(f, activeReferenceIso);
      case 'FICHAS_PRODUCTIVA':
        return isFichaActivaDesarrolloProductiva(f, activeReferenceIso);
      case 'APRENDICES_LECTIVA':
        return isFichaActivaDesarrolloLectiva(f, activeReferenceIso) && f.colAA_formacion > 0;
      case 'APRENDICES_PRODUCTIVA':
        return isFichaActivaDesarrolloProductiva(f, activeReferenceIso) && f.colAA_formacion > 0;
      case 'PENDIENTES_CERTIFICAR':
        return f.colAH_porCertificar > 0;
      case 'CERTIFICADOS':
        return f.colAI_certificado > 0;
      case 'RETIROS_CANCELACIONES':
        return f.bajasTotales > 0;
      default:
        return true;
    }
  };

  // Conjunto final de fichas: aplica opcionalmente el indicador ejecutivo seleccionado (7 KPIs) y/o la cola de decisión activa
  const filteredFichas = useMemo(() => {
    return baseCurricularFichas.filter((f) => {
      if (activeStageKpiFilter && !matchesStageKpiFilter(f, activeStageKpiFilter)) {
        return false;
      }
      if (applyDecisionToGlobalBoard) {
        const ev = decisionEvaluations.byKey.get(`${f.ficha}__${f.filaReporte}`);
        if (!ev || !matchesDecisionQueue(ev, activeDecisionQueue)) return false;
      }
      return true;
    });
  }, [
    baseCurricularFichas,
    activeStageKpiFilter,
    activeReferenceIso,
    applyDecisionToGlobalBoard,
    decisionEvaluations,
    activeDecisionQueue,
    fichasWithSofiaProgSet,
    fichasWithJuiciosDriveSet,
  ]);

  // Reset página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
    setProgramPage(1);
    setDecisionPage(1);
  }, [
    macroColH,
    filterColH_Nivel,
    filterColG_Programa,
    filterColL_Ficha,
    filterColP_Estado,
    filterColQ_TipoRespuesta,
    filterColR_ProgramaEspecial,
    activeColYtoAKFilter,
    programaQuery,
    activeStageKpiFilter,
    applyDecisionToGlobalBoard,
    activeDecisionQueue,
  ]);

  // Mantener sincronizada la ficha inspeccionada con los resultados filtrados
  const inspectedFicha = useMemo(() => {
    if (filteredFichas.length === 0) return null;
    if (filterColL_Ficha.trim()) {
      const exact = filteredFichas.find((f) => f.ficha === filterColL_Ficha.trim());
      if (exact) return exact;
    }
    const found = filteredFichas.find((f) => f.ficha === inspectedFichaCode);
    return found || filteredFichas[0];
  }, [filteredFichas, inspectedFichaCode, filterColL_Ficha]);

  // Cerrar ventana emergente de Ficha con tecla Escape y bloquear scroll de fondo
  useEffect(() => {
    if (!modalDecisionFichaKey) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalDecisionFichaKey(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalDecisionFichaKey]);

  // Evaluación y análisis de aprendices fuera de tiempo para la Ficha abierta en la ventana emergente
  const activeModalData = useMemo(() => {
    if (!modalDecisionFichaKey) return null;
    let ev = decisionEvaluations.byKey.get(modalDecisionFichaKey) || null;
    if (!ev) {
      const fichaCode = modalDecisionFichaKey.split('__')[0];
      ev = decisionEvaluations.evaluations.find((item) => item.fichaRecord.ficha === fichaCode) || null;
    }
    if (!ev) return null;

    const f = ev.fichaRecord;
    const estLower = f.estadoFicha.toLowerCase();
    const esTerminada = estLower.includes('terminada');
    const diasDesdeInicio = f.fechaInicioIso
      ? diffDaysBetweenIso(activeReferenceIso, f.fechaInicioIso)
      : null;
    const diasDesdeFechaFin = f.fechaFinIso
      ? diffDaysBetweenIso(f.fechaFinIso, activeReferenceIso)
      : null;

    interface OutOfTimeAlert {
      severidad: 'CRITICA' | 'PREVENTIVA' | 'SEGUIMIENTO';
      titulo: string;
      cantidadAprendices: number;
      detalle: string;
      accion: string;
    }

    const alertasFueraDeTiempo: OutOfTimeAlert[] = [];
    let totalAprendicesFueraDeTiempo = 0;
    const transitoInduccion = f.colY_enTransito + f.colZ_induccion;
    const condicionadoAplazado = f.colAB_condicionado + f.colAC_aplazado;

    // 1. Plazo máximo de +1 año posterior a Fecha Final vencido (Programas con Etapa Productiva)
    if (
      f.aplicaEtapaProductiva &&
      ev.diasParaLimite1AnioProductiva !== null &&
      ev.diasParaLimite1AnioProductiva < 0
    ) {
      const diasVencidos = Math.abs(ev.diasParaLimite1AnioProductiva);
      totalAprendicesFueraDeTiempo =
        f.colAA_formacion + f.colAH_porCertificar + condicionadoAplazado + transitoInduccion;

      if (f.colAA_formacion > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices en formación con plazo máximo (+1 año) vencido',
          cantidadAprendices: f.colAA_formacion,
          detalle: `La fecha límite reglamentaria para presentar etapa productiva (${f.fechaLimitePresentacionProductiva}) venció hace ${diasVencidos} días y aún continúan ${f.colAA_formacion} aprendices activos en formación.`,
          accion:
            'Convocar comité de evaluación y seguimiento para definir cierre evaluativo o cancelación por vencimiento de términos.',
        });
      }
      if (f.colAH_porCertificar > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices pendientes por certificar fuera del plazo reglamentario',
          cantidadAprendices: f.colAH_porCertificar,
          detalle: `El plazo máximo cerró hace ${diasVencidos} días (${f.fechaLimitePresentacionProductiva}) y permanecen ${f.colAH_porCertificar} aprendices sin expedición de certificado.`,
          accion:
            'Priorizar validación documental de requisitos de certificación y emitir cierre administrativo inmediato.',
        });
      }
      if (condicionadoAplazado > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices condicionados o aplazados con tiempo reglamentario vencido',
          cantidadAprendices: condicionadoAplazado,
          detalle: `Persisten ${f.colAB_condicionado} condicionados y ${f.colAC_aplazado} aplazados pese a haber superado la fecha límite (${f.fechaLimitePresentacionProductiva}).`,
          accion: 'Legalizar novedad definitiva en acta y depurar registros extemporáneos.',
        });
      }
      if (transitoInduccion > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices rezagados en tránsito o inducción con ficha vencida',
          cantidadAprendices: transitoInduccion,
          detalle: `Se registran ${f.colY_enTransito} en tránsito y ${f.colZ_induccion} en inducción con el plazo máximo ya vencido.`,
          accion: 'Depurar estado de matrícula de aprendices que no cursaron la formación.',
        });
      }
    }
    // 2. Formación Complementaria / Sin Etapa Productiva con Fecha Final ya vencida
    else if (!f.aplicaEtapaProductiva && diasDesdeFechaFin !== null && diasDesdeFechaFin < 0) {
      const diasVencidos = Math.abs(diasDesdeFechaFin);
      totalAprendicesFueraDeTiempo =
        f.colAA_formacion + f.colAH_porCertificar + condicionadoAplazado + transitoInduccion;

      if (f.colAA_formacion + transitoInduccion > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices activos fuera de tiempo tras cierre de Fecha Final',
          cantidadAprendices: f.colAA_formacion + transitoInduccion,
          detalle: `La Fecha Final de la ficha (${f.fechaFin}) venció hace ${diasVencidos} días y aún figuran ${f.colAA_formacion} aprendices en formación y ${transitoInduccion} en tránsito/inducción.`,
          accion: 'Registrar juicios evaluativos faltantes y ejecutar el cierre de la ficha.',
        });
      }
      if (f.colAH_porCertificar > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'PREVENTIVA',
          titulo: 'Aprendices pendientes por certificar tras vencimiento de ficha',
          cantidadAprendices: f.colAH_porCertificar,
          detalle: `La ficha culminó hace ${diasVencidos} días (${f.fechaFin}) y mantiene ${f.colAH_porCertificar} aprendices en estado Por Certificar.`,
          accion: 'Culminar verificación de requisitos y expedición de certificados.',
        });
      }
      if (condicionadoAplazado > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices condicionados o aplazados fuera de tiempo',
          cantidadAprendices: condicionadoAplazado,
          detalle: `La ficha venció hace ${diasVencidos} días con ${condicionadoAplazado} aprendices en novedad académica sin resolver.`,
          accion: 'Definir situación académica final de los aprendices con novedad.',
        });
      }
    }
    // 3. Ficha en ventana extraordinaria de +1 año posterior a Fecha Final (post-cierre ordinario)
    else if (
      f.aplicaEtapaProductiva &&
      ev.diasParaCierreProductiva !== null &&
      ev.diasParaCierreProductiva < 0 &&
      ev.diasParaLimite1AnioProductiva !== null &&
      ev.diasParaLimite1AnioProductiva >= 0
    ) {
      const diasDesdeCierre = Math.abs(ev.diasParaCierreProductiva);
      const diasRestantes1Anio = ev.diasParaLimite1AnioProductiva;
      totalAprendicesFueraDeTiempo =
        f.colAA_formacion + condicionadoAplazado + transitoInduccion;

      if (f.colAA_formacion > 0) {
        alertasFueraDeTiempo.push({
          severidad: diasRestantes1Anio <= 60 ? 'CRITICA' : 'PREVENTIVA',
          titulo: 'Aprendices fuera de Fecha Final ordinaria (en año límite de Etapa Productiva)',
          cantidadAprendices: f.colAA_formacion,
          detalle: `La Fecha Final de la ficha (${f.fechaCierreEtapaProductiva}) cerró hace ${diasDesdeCierre} días. Permanecen ${f.colAA_formacion} aprendices en formación dentro del año reglamentario posterior (restan ${diasRestantes1Anio} días hasta ${f.fechaLimitePresentacionProductiva}).`,
          accion:
            'Realizar seguimiento nominal de alternativa productiva y evaluar antes de que venza el año límite.',
        });
      }
      if (condicionadoAplazado > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'PREVENTIVA',
          titulo: 'Aprendices condicionados o aplazados en periodo post-cierre',
          cantidadAprendices: condicionadoAplazado,
          detalle: `Se reportan ${f.colAB_condicionado} condicionados y ${f.colAC_aplazado} aplazados tras la Fecha Final (${f.fechaCierreEtapaProductiva}); restan ${diasRestantes1Anio} días para el límite máximo.`,
          accion: 'Verificar planes de mejoramiento o vencimiento de aplazamientos vigentes.',
        });
      }
      if (transitoInduccion > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices en tránsito o inducción fuera de tiempo',
          cantidadAprendices: transitoInduccion,
          detalle: `La ficha ya superó su Fecha Final (${f.fechaCierreEtapaProductiva}) pero conserva ${transitoInduccion} aprendices en tránsito/inducción.`,
          accion: 'Corregir estado de formación o tramitar novedad administrativa.',
        });
      }
      if (f.colAH_porCertificar > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'SEGUIMIENTO',
          titulo: 'Aprendices listos por certificar en ventana post-cierre',
          cantidadAprendices: f.colAH_porCertificar,
          detalle: `${f.colAH_porCertificar} aprendices ya aprobaron requisitos y aguardan trámite de certificación.`,
          accion: 'Priorizar revisión documental para certificar sin demora.',
        });
      }
    }
    // 4. Ficha vigente (en Etapa Lectiva o Etapa Productiva ordinaria): detectar rezagos internos de etapa
    else {
      const lectivaCerrada = ev.diasParaFinLectiva !== null && ev.diasParaFinLectiva < 0;

      if (transitoInduccion > 0 && (lectivaCerrada || esTerminada)) {
        totalAprendicesFueraDeTiempo += transitoInduccion;
        alertasFueraDeTiempo.push({
          severidad: 'CRITICA',
          titulo: 'Aprendices rezagados en Tránsito o Inducción con Etapa Lectiva finalizada',
          cantidadAprendices: transitoInduccion,
          detalle: `La Etapa Lectiva finalizó el ${f.fechaFinEtapaLectiva} y aún figuran ${f.colY_enTransito} en tránsito y ${f.colZ_induccion} en inducción.`,
          accion: 'Actualizar estado a En Formación o gestionar novedad de retiro/cancelación.',
        });
      } else if (transitoInduccion > 0 && diasDesdeInicio !== null && diasDesdeInicio > 45) {
        totalAprendicesFueraDeTiempo += transitoInduccion;
        alertasFueraDeTiempo.push({
          severidad: 'PREVENTIVA',
          titulo: 'Aprendices que superan el tiempo habitual de Inducción / Tránsito',
          cantidadAprendices: transitoInduccion,
          detalle: `Han transcurrido ${diasDesdeInicio} días desde la Fecha de Inicio (${f.fechaInicio}) y continúan ${f.colY_enTransito} en tránsito y ${f.colZ_induccion} en inducción.`,
          accion: 'Evaluar resultados de inducción para promover a estado En Formación.',
        });
      }

      if (condicionadoAplazado > 0 && lectivaCerrada) {
        totalAprendicesFueraDeTiempo += condicionadoAplazado;
        alertasFueraDeTiempo.push({
          severidad: 'PREVENTIVA',
          titulo: 'Aprendices condicionados o aplazados tras cierre de Etapa Lectiva',
          cantidadAprendices: condicionadoAplazado,
          detalle: `La Etapa Lectiva cerró el ${f.fechaFinEtapaLectiva} y permanecen ${f.colAB_condicionado} condicionados y ${f.colAC_aplazado} aplazados durante la Etapa Productiva.`,
          accion: 'Verificar cumplimiento de plan de mejoramiento o reintegro antes del cierre productivo.',
        });
      }

      if (
        ev.isLectivaProxima &&
        ev.diasParaFinLectiva !== null &&
        f.colAA_formacion > 0
      ) {
        alertasFueraDeTiempo.push({
          severidad: 'SEGUIMIENTO',
          titulo: 'Aprendices en formación próximos al cierre de Etapa Lectiva',
          cantidadAprendices: f.colAA_formacion,
          detalle: `La Etapa Lectiva finaliza en ${ev.diasParaFinLectiva} días (${f.fechaFinEtapaLectiva}) con ${f.colAA_formacion} aprendices activos en formación.`,
          accion: 'Asegurar evaluación oportuna de todos los Resultados de Aprendizaje lectivos.',
        });
      }

      if (
        ev.isProductivaCierreProximo &&
        ev.diasParaCierreProductiva !== null &&
        f.colAA_formacion > 0
      ) {
        alertasFueraDeTiempo.push({
          severidad: 'SEGUIMIENTO',
          titulo: 'Aprendices en formación próximos a Fecha Final de Etapa Productiva',
          cantidadAprendices: f.colAA_formacion,
          detalle: `Restan ${ev.diasParaCierreProductiva} días para el cierre de Etapa Productiva (${f.fechaCierreEtapaProductiva}) con ${f.colAA_formacion} aprendices en formación.`,
          accion: 'Programar visita final y aval de etapa productiva para evitar paso a extemporaneidad.',
        });
      }

      if (f.colAH_porCertificar > 0) {
        alertasFueraDeTiempo.push({
          severidad: 'SEGUIMIENTO',
          titulo: 'Aprendices pendientes de trámite de certificación',
          cantidadAprendices: f.colAH_porCertificar,
          detalle: `Se registran ${f.colAH_porCertificar} aprendices en estado Por Certificar.`,
          accion: 'Adelantar revisión de requisitos administrativos de certificación.',
        });
      }
    }

    // Cruce opcional con registros nominales de juicios evaluativos (si existen cargados para esta ficha)
    let nominalPendientesEvaluar = 0;
    if (rows && rows.length > 0) {
      const docsConPendientes = new Set<string>();
      for (const r of rows) {
        if (String(r._ficha || '').trim() === f.ficha) {
          const j = getJuicio(r);
          if (j === 'POR EVALUAR') {
            const docId = String(
              r['Número de Documento'] || r['Numero de Documento'] || r['Documento'] || ''
            ).trim();
            if (docId) docsConPendientes.add(docId);
          }
        }
      }
      nominalPendientesEvaluar = docsConPendientes.size;
    }

    const pctFueraDeTiempo =
      f.totalAprendicesYtoAK > 0
        ? Math.round((totalAprendicesFueraDeTiempo / f.totalAprendicesYtoAK) * 1000) / 10
        : 0;

    return {
      ev,
      f,
      diasDesdeInicio,
      diasDesdeFechaFin,
      totalAprendicesFueraDeTiempo,
      pctFueraDeTiempo,
      alertasFueraDeTiempo,
      nominalPendientesEvaluar,
    };
  }, [modalDecisionFichaKey, decisionEvaluations, activeReferenceIso, rows]);

  // Totales agregados de desempeño de Columnas Y a AK sobre las fichas filtradas
  const consolidatedYtoAK = useMemo(() => {
    const sums: DesempenoYtoAK = {
      colY_enTransito: 0,
      colZ_induccion: 0,
      colAA_formacion: 0,
      colAB_condicionado: 0,
      colAC_aplazado: 0,
      colAD_retiroVoluntario: 0,
      colAE_cancelamientoVirtComp: 0,
      colAF_desercionVirtComp: 0,
      colAG_cancelado: 0,
      colAH_porCertificar: 0,
      colAI_certificado: 0,
      colAJ_trasladado: 0,
      colAK_otro: 0,
    };

    let cupoTotal = 0;
    let totalAprendices = 0;
    let abiertasCount = 0;
    let cerradasCount = 0;
    let enEjecucionFichas = 0;

    for (const f of filteredFichas) {
      cupoTotal += f.cupo;
      totalAprendices += f.totalAprendicesYtoAK;
      if (f.tipoRespuesta === 'ABIERTA') abiertasCount++;
      else if (f.tipoRespuesta === 'CERRADA') cerradasCount++;
      if (f.estadoFicha.toLowerCase().includes('ejecuci')) enEjecucionFichas++;

      sums.colY_enTransito += f.colY_enTransito;
      sums.colZ_induccion += f.colZ_induccion;
      sums.colAA_formacion += f.colAA_formacion;
      sums.colAB_condicionado += f.colAB_condicionado;
      sums.colAC_aplazado += f.colAC_aplazado;
      sums.colAD_retiroVoluntario += f.colAD_retiroVoluntario;
      sums.colAE_cancelamientoVirtComp += f.colAE_cancelamientoVirtComp;
      sums.colAF_desercionVirtComp += f.colAF_desercionVirtComp;
      sums.colAG_cancelado += f.colAG_cancelado;
      sums.colAH_porCertificar += f.colAH_porCertificar;
      sums.colAI_certificado += f.colAI_certificado;
      sums.colAJ_trasladado += f.colAJ_trasladado;
      sums.colAK_otro += f.colAK_otro;
    }

    const activosEjecucion = sums.colY_enTransito + sums.colZ_induccion + sums.colAA_formacion;
    const logroCertificacion = sums.colAH_porCertificar + sums.colAI_certificado;
    const novedades = sums.colAB_condicionado + sums.colAC_aplazado + sums.colAJ_trasladado + sums.colAK_otro;
    const bajas =
      sums.colAD_retiroVoluntario +
      sums.colAE_cancelamientoVirtComp +
      sums.colAF_desercionVirtComp +
      sums.colAG_cancelado;

    const tasaOcupacion = cupoTotal > 0 ? Math.round((totalAprendices / cupoTotal) * 1000) / 10 : 0;
    const tasaCertificacion = totalAprendices > 0 ? Math.round((sums.colAI_certificado / totalAprendices) * 1000) / 10 : 0;
    const tasaCulminacion = totalAprendices > 0 ? Math.round((logroCertificacion / totalAprendices) * 1000) / 10 : 0;
    const tasaBajas = totalAprendices > 0 ? Math.round((bajas / totalAprendices) * 1000) / 10 : 0;
    const tasaRetencion = totalAprendices > 0 ? Math.round((100 - tasaBajas) * 10) / 10 : 0;

    return {
      sums,
      cupoTotal,
      totalAprendices,
      abiertasCount,
      cerradasCount,
      enEjecucionFichas,
      activosEjecucion,
      logroCertificacion,
      novedades,
      bajas,
      tasaOcupacion,
      tasaCertificacion,
      tasaCulminacion,
      tasaBajas,
      tasaRetencion,
    };
  }, [filteredFichas]);

  // Datos para gráfica 1: Distribución Columnas Y a AK
  const chartStatesData = useMemo(() => {
    return COLUMNS_Y_TO_AK_META.map((col) => {
      const value = consolidatedYtoAK.sums[col.key];
      const pct =
        consolidatedYtoAK.totalAprendices > 0
          ? Math.round((value / consolidatedYtoAK.totalAprendices) * 1000) / 10
          : 0;
      return {
        colLetter: col.colLetter,
        name: col.shortLabel,
        xmlHeader: col.xmlHeader,
        value,
        pct,
        color: col.barColor,
      };
    });
  }, [consolidatedYtoAK]);

  // Datos para gráfica 2: Desempeño comparativo por Col H, Col G o Col R
  const chartComparativeData = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        label: string;
        Certificados: number;
        EnFormacion: number;
        PorCertificar: number;
        Bajas: number;
        total: number;
      }
    >();

    for (const f of filteredFichas) {
      const key =
        chartDimension === 'COL_H'
          ? f.nivelFormacion
          : chartDimension === 'COL_G'
          ? f.programa
          : f.programaEspecial;
      const cur = groupMap.get(key) || {
        label: key.length > 26 ? `${key.slice(0, 24)}…` : key,
        Certificados: 0,
        EnFormacion: 0,
        PorCertificar: 0,
        Bajas: 0,
        total: 0,
      };
      cur.Certificados += f.colAI_certificado;
      cur.EnFormacion += f.colAA_formacion + f.colY_enTransito + f.colZ_induccion;
      cur.PorCertificar += f.colAH_porCertificar;
      cur.Bajas += f.bajasTotales;
      cur.total += f.totalAprendicesYtoAK;
      groupMap.set(key, cur);
    }

    return Array.from(groupMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredFichas, chartDimension]);

  // Motor de consolidación de Desempeño por Programa de Formación (Columna G PROGRAMA)
  const programsPerformance = useMemo<ProgramPerformanceItem[]>(() => {
    const map = new Map<
      string,
      {
        programa: string;
        codigos: Set<string>;
        niveles: Set<string>;
        categoriaPrincipal: 'NO_NIVEL' | 'NIVEL_TITULADO';
        programasEspeciales: Set<string>;
        fichasCount: number;
        enEjecucionFichas: number;
        terminadasFichas: number;
        abiertasFichas: number;
        cerradasFichas: number;
        cupoTotal: number;
        sums: DesempenoYtoAK;
      }
    >();

    for (const f of filteredFichas) {
      let entry = map.get(f.programa);
      if (!entry) {
        entry = {
          programa: f.programa,
          codigos: new Set<string>(),
          niveles: new Set<string>(),
          categoriaPrincipal: f.categoriaColH,
          programasEspeciales: new Set<string>(),
          fichasCount: 0,
          enEjecucionFichas: 0,
          terminadasFichas: 0,
          abiertasFichas: 0,
          cerradasFichas: 0,
          cupoTotal: 0,
          sums: {
            colY_enTransito: 0,
            colZ_induccion: 0,
            colAA_formacion: 0,
            colAB_condicionado: 0,
            colAC_aplazado: 0,
            colAD_retiroVoluntario: 0,
            colAE_cancelamientoVirtComp: 0,
            colAF_desercionVirtComp: 0,
            colAG_cancelado: 0,
            colAH_porCertificar: 0,
            colAI_certificado: 0,
            colAJ_trasladado: 0,
            colAK_otro: 0,
          },
        };
        map.set(f.programa, entry);
      }

      if (f.codigoPrograma) entry.codigos.add(f.codigoPrograma);
      if (f.nivelFormacion) entry.niveles.add(f.nivelFormacion);
      if (f.categoriaColH === 'NIVEL_TITULADO') entry.categoriaPrincipal = 'NIVEL_TITULADO';
      if (f.programaEspecial && f.programaEspecial !== 'SIN PROGRAMA ESPECIAL') {
        entry.programasEspeciales.add(f.programaEspecial);
      }

      entry.fichasCount += 1;
      if (f.estadoFicha.toLowerCase().includes('ejecuci')) entry.enEjecucionFichas += 1;
      if (f.estadoFicha.toLowerCase().includes('terminad')) entry.terminadasFichas += 1;
      if (f.tipoRespuesta === 'ABIERTA') entry.abiertasFichas += 1;
      else if (f.tipoRespuesta === 'CERRADA') entry.cerradasFichas += 1;
      entry.cupoTotal += f.cupo;

      entry.sums.colY_enTransito += f.colY_enTransito;
      entry.sums.colZ_induccion += f.colZ_induccion;
      entry.sums.colAA_formacion += f.colAA_formacion;
      entry.sums.colAB_condicionado += f.colAB_condicionado;
      entry.sums.colAC_aplazado += f.colAC_aplazado;
      entry.sums.colAD_retiroVoluntario += f.colAD_retiroVoluntario;
      entry.sums.colAE_cancelamientoVirtComp += f.colAE_cancelamientoVirtComp;
      entry.sums.colAF_desercionVirtComp += f.colAF_desercionVirtComp;
      entry.sums.colAG_cancelado += f.colAG_cancelado;
      entry.sums.colAH_porCertificar += f.colAH_porCertificar;
      entry.sums.colAI_certificado += f.colAI_certificado;
      entry.sums.colAJ_trasladado += f.colAJ_trasladado;
      entry.sums.colAK_otro += f.colAK_otro;
    }

    return Array.from(map.values()).map((e) => {
      const activosEjecucion =
        e.sums.colY_enTransito + e.sums.colZ_induccion + e.sums.colAA_formacion;
      const logroCertificacion = e.sums.colAH_porCertificar + e.sums.colAI_certificado;
      const novedadesAcademicas =
        e.sums.colAB_condicionado +
        e.sums.colAC_aplazado +
        e.sums.colAJ_trasladado +
        e.sums.colAK_otro;
      const bajasTotales =
        e.sums.colAD_retiroVoluntario +
        e.sums.colAE_cancelamientoVirtComp +
        e.sums.colAF_desercionVirtComp +
        e.sums.colAG_cancelado;
      const totalAprendicesYtoAK =
        activosEjecucion + logroCertificacion + novedadesAcademicas + bajasTotales;

      const tasaOcupacionCupo =
        e.cupoTotal > 0 ? Math.round((totalAprendicesYtoAK / e.cupoTotal) * 1000) / 10 : 0;
      const tasaCertificacion =
        totalAprendicesYtoAK > 0
          ? Math.round((e.sums.colAI_certificado / totalAprendicesYtoAK) * 1000) / 10
          : 0;
      const tasaCulminacion =
        totalAprendicesYtoAK > 0
          ? Math.round((logroCertificacion / totalAprendicesYtoAK) * 1000) / 10
          : 0;
      const tasaBajas =
        totalAprendicesYtoAK > 0
          ? Math.round((bajasTotales / totalAprendicesYtoAK) * 1000) / 10
          : 0;
      const tasaRetencion =
        totalAprendicesYtoAK > 0 ? Math.round((100 - tasaBajas) * 10) / 10 : 0;

      let diagnostico: ProgramPerformanceItem['diagnostico'] = 'En Seguimiento';
      if (totalAprendicesYtoAK === 0) {
        diagnostico = 'Sin Aprendices';
      } else if (tasaBajas >= 35) {
        diagnostico = 'Alerta de Retención';
      } else if (tasaRetencion >= 85 && (tasaCulminacion >= 70 || activosEjecucion > 0)) {
        diagnostico = 'Óptimo';
      }

      return {
        programa: e.programa,
        codigosPrograma: Array.from(e.codigos),
        niveles: Array.from(e.niveles),
        categoriaPrincipal: e.categoriaPrincipal,
        programasEspeciales: Array.from(e.programasEspeciales),
        fichasCount: e.fichasCount,
        enEjecucionFichas: e.enEjecucionFichas,
        terminadasFichas: e.terminadasFichas,
        abiertasFichas: e.abiertasFichas,
        cerradasFichas: e.cerradasFichas,
        cupoTotal: e.cupoTotal,
        ...e.sums,
        totalAprendicesYtoAK,
        activosEjecucion,
        logroCertificacion,
        novedadesAcademicas,
        bajasTotales,
        tasaOcupacionCupo,
        tasaCertificacion,
        tasaCulminacion,
        tasaBajas,
        tasaRetencion,
        diagnostico,
      };
    });
  }, [filteredFichas]);

  const sortedFilteredPrograms = useMemo(() => {
    const q = programPanelSearch.trim().toLowerCase();
    const list = q
      ? programsPerformance.filter(
          (p) =>
            p.programa.toLowerCase().includes(q) ||
            p.codigosPrograma.some((c) => c.toLowerCase().includes(q)) ||
            p.niveles.some((n) => n.toLowerCase().includes(q))
        )
      : [...programsPerformance];

    list.sort((a, b) => {
      if (programSortBy === 'aprendices') return b.totalAprendicesYtoAK - a.totalAprendicesYtoAK;
      if (programSortBy === 'certificacion') return b.tasaCertificacion - a.tasaCertificacion || b.totalAprendicesYtoAK - a.totalAprendicesYtoAK;
      if (programSortBy === 'retencion') return b.tasaRetencion - a.tasaRetencion || b.totalAprendicesYtoAK - a.totalAprendicesYtoAK;
      if (programSortBy === 'bajas') return b.tasaBajas - a.tasaBajas || b.bajasTotales - a.bajasTotales;
      return b.fichasCount - a.fichasCount || b.totalAprendicesYtoAK - a.totalAprendicesYtoAK;
    });

    return list;
  }, [programsPerformance, programPanelSearch, programSortBy]);

  const totalProgramPages = Math.max(1, Math.ceil(sortedFilteredPrograms.length / programPageSize));
  const paginatedPrograms = useMemo(() => {
    const start = (programPage - 1) * programPageSize;
    return sortedFilteredPrograms.slice(start, start + programPageSize);
  }, [sortedFilteredPrograms, programPage]);

  // Programa activo inspeccionado en el Panel de Desempeño por Programa
  const activeProgramDetail = useMemo<ProgramPerformanceItem | null>(() => {
    if (programsPerformance.length === 0) return null;
    if (filterColG_Programa !== 'TODOS') {
      const exact = programsPerformance.find((p) => p.programa === filterColG_Programa);
      if (exact) return exact;
    }
    if (selectedPanelProgram) {
      const found = programsPerformance.find((p) => p.programa === selectedPanelProgram);
      if (found) return found;
    }
    return sortedFilteredPrograms[0] || programsPerformance[0];
  }, [programsPerformance, sortedFilteredPrograms, filterColG_Programa, selectedPanelProgram]);

  const hasActiveFilters =
    macroColH !== 'TODOS' ||
    filterColH_Nivel !== 'TODOS' ||
    filterColG_Programa !== 'TODOS' ||
    filterColL_Ficha.trim() !== '' ||
    filterColP_Estado !== 'TODOS' ||
    filterColQ_TipoRespuesta !== 'TODOS' ||
    filterColR_ProgramaEspecial !== 'TODOS' ||
    activeColYtoAKFilter !== null ||
    programaQuery.trim() !== '' ||
    activeStageKpiFilter !== null ||
    applyDecisionToGlobalBoard;

  const handleResetAllFilters = () => {
    setMacroColH('TODOS');
    setFilterColH_Nivel('TODOS');
    setFilterColG_Programa('TODOS');
    setFilterColL_Ficha('');
    setFilterColP_Estado('TODOS');
    setFilterColQ_TipoRespuesta('TODOS');
    setFilterColR_ProgramaEspecial('TODOS');
    setActiveColYtoAKFilter(null);
    setProgramaQuery('');
    setActiveStageKpiFilter(null);
    setApplyDecisionToGlobalBoard(false);
  };

  // Exportación completa a Excel (.xlsx) incluyendo Resumen de los 7 Indicadores, Alertas, Programas (Col G) y Fichas (Col L)
  const handleExportExcel = () => {
    if (filteredFichas.length === 0 && decisionEvaluations.evaluations.length === 0) return;

    const exportResumen7Kpis = [
      {
        INDICADOR: '1. Fichas activas en desarrollo de la Etapa Lectiva',
        CANTIDAD: stageKpiMetrics.fichasActivasLectiva,
        DETALLE: `Titulada: ${stageKpiMetrics.fichasLectivaTitulada} | Complementaria: ${stageKpiMetrics.fichasLectivaComplementaria}`,
        CRITERIO_CALCULO: 'Estado En ejecución dentro del periodo de Etapa Lectiva (-6m Téc/Tecnól, -3m Aux/Oper)',
      },
      {
        INDICADOR: '2. Fichas activas en desarrollo de la Etapa Productiva',
        CANTIDAD: stageKpiMetrics.fichasActivasProductiva,
        DETALLE: `Téc/Tecnól: ${stageKpiMetrics.fichasProductivaTecTecnologo} | Aux/Oper: ${stageKpiMetrics.fichasProductivaAuxOperario} | En Terminada por fecha (+1 año): ${stageKpiMetrics.fichasPostFechaConFormacion}`,
        CRITERIO_CALCULO: 'Estado En ejecución posterior a Fin Etapa Lectiva hasta Fecha Final',
      },
      {
        INDICADOR: '3. Aprendices en formación — desarrollo de la Etapa Lectiva',
        CANTIDAD: stageKpiMetrics.aprendicesFormacionLectiva,
        DETALLE: `Titulada: ${stageKpiMetrics.aprLectivaTitulada} | Complementaria: ${stageKpiMetrics.aprLectivaComplementaria} | Tránsito/Inducción: ${stageKpiMetrics.aprTransitoInduccionLectiva}`,
        CRITERIO_CALCULO: 'Aprendices en Formación en fichas activas de Etapa Lectiva',
      },
      {
        INDICADOR: '4. Aprendices en formación — desarrollo de la Etapa Productiva',
        CANTIDAD: stageKpiMetrics.aprendicesFormacionProductiva,
        DETALLE: `En fichas activas (En ejecución): ${stageKpiMetrics.aprendicesFormacionProductiva} | En fichas Terminadas por fecha (plazo +1 año): ${stageKpiMetrics.aprProductivaPostFechaPlazo1Anio}`,
        CRITERIO_CALCULO: 'Aprendices en Formación en fichas activas de Etapa Productiva',
      },
      {
        INDICADOR: '5. Aprendices Pendientes por Certificar',
        CANTIDAD: stageKpiMetrics.aprendicesPendientesCertificar,
        DETALLE: `Distribuidos en ${stageKpiMetrics.fichasConPendientesCertificar} fichas (${stageKpiMetrics.pctPendientesCertificar}% del total)`,
        CRITERIO_CALCULO: 'Estado Por Certificar',
      },
      {
        INDICADOR: '6. Aprendices Certificados registrados',
        CANTIDAD: stageKpiMetrics.aprendicesCertificadosRegistrados,
        DETALLE: `En ${stageKpiMetrics.fichasConCertificados} fichas (${stageKpiMetrics.pctCertificados}% tasa de certificación)`,
        CRITERIO_CALCULO: 'Estado Certificado',
      },
      {
        INDICADOR: '7. Aprendices Retiros y Cancelaciones',
        CANTIDAD: stageKpiMetrics.aprendicesRetirosYCancelaciones,
        DETALLE: `Retiros Voluntarios: ${stageKpiMetrics.retirosVoluntariosColAD} | Cancelaciones y Deserciones: ${stageKpiMetrics.cancelacionesYDesercionesAEaAG} (${stageKpiMetrics.pctRetirosCancelaciones}%)`,
        CRITERIO_CALCULO: 'Retiro Voluntario + Cancelamiento + Deserción + Cancelado',
      },
    ];

    const exportDecisionRows = decisionEvaluations.evaluations
      .filter((ev) => ev.hallazgosDecision.length > 0 || ev.hallazgosValidacion.length > 0)
      .map((ev) => {
        const f = ev.fichaRecord;
        return {
          'PRIORIDAD': ev.prioridad,
          'FICHA': f.ficha,
          'PROGRAMA': f.programa,
          'NIVEL DE FORMACION': f.nivelFormacion,
          'ESTADO DE FICHA': f.estadoFicha,
          'ETAPA ACTUAL CALCULADA': ev.etapaActualLabel,
          'FECHA INICIO': f.fechaInicio,
          'FECHA FIN ETAPA LECTIVA (CALCULADA)': f.fechaFinEtapaLectiva,
          'REGLA ETAPA LECTIVA': f.reglaEtapaLectivaLabel,
          'DIAS PARA FIN LECTIVA': ev.diasParaFinLectiva ?? '',
          'CIERRE ETAPA PRODUCTIVA': f.fechaCierreEtapaProductiva,
          'DIAS PARA CIERRE PRODUCTIVA': ev.diasParaCierreProductiva ?? '',
          'LIMITE +1 ANIO ETAPA PRODUCTIVA': f.fechaLimitePresentacionProductiva,
          'DIAS PARA LIMITE +1 ANIO': ev.diasParaLimite1AnioProductiva ?? '',
          'CUPO AUTORIZADO': f.cupo,
          'TOTAL APRENDICES REPORTADOS': f.totalAprendicesYtoAK,
          'DIFERENCIA CUPO VS ESTADOS': f.diferenciaCupoEstados,
          'EN FORMACION': f.colAA_formacion,
          'POR CERTIFICAR': f.colAH_porCertificar,
          'NOVEDADES ADMINISTRATIVAS': f.novedadesAcademicas,
          'OCURRENCIAS FICHA EN ARCHIVO': f.ocurrenciasFicha,
          'DECISIONES REQUERIDAS': ev.hallazgosDecision.join(' | ') || 'Sin alerta de cierre/certificación',
          'VALIDACION DE DATOS': ev.hallazgosValidacion.join(' | ') || 'Datos consistentes',
        };
      });

    const exportPrograms = sortedFilteredPrograms.map((p) => ({
      'PROGRAMA DE FORMACION': p.programa,
      'CODIGOS PROGRAMA': p.codigosPrograma.join(', '),
      'NIVEL DE FORMACION': p.niveles.join(', '),
      'AGRUPACION NIVEL': p.categoriaPrincipal === 'NO_NIVEL' ? 'NO NIVEL (COMPLEMENTARIA / ESPECIAL)' : 'NIVEL TITULADO',
      'TOTAL FICHAS': p.fichasCount,
      'FICHAS EN EJECUCION': p.enEjecucionFichas,
      'FICHAS TERMINADAS': p.terminadasFichas,
      'RESPUESTA ABIERTA': p.abiertasFichas,
      'RESPUESTA CERRADA': p.cerradasFichas,
      'PROGRAMAS ESPECIALES': p.programasEspeciales.join(' | ') || 'OFERTA REGULAR',
      'CUPO TOTAL': p.cupoTotal,
      '% OCUPACION CUPO': p.tasaOcupacionCupo,
      'EN TRANSITO': p.colY_enTransito,
      'INDUCCION': p.colZ_induccion,
      'EN FORMACION': p.colAA_formacion,
      'CONDICIONADO': p.colAB_condicionado,
      'APLAZADO': p.colAC_aplazado,
      'RETIRO VOLUNTARIO': p.colAD_retiroVoluntario,
      'CANCELAMIENTO VIRT/COMP': p.colAE_cancelamientoVirtComp,
      'DESERCION VIRT/COMP': p.colAF_desercionVirtComp,
      'CANCELADO': p.colAG_cancelado,
      'POR CERTIFICAR': p.colAH_porCertificar,
      'CERTIFICADO': p.colAI_certificado,
      'TRASLADADO': p.colAJ_trasladado,
      'OTRO': p.colAK_otro,
      'TOTAL APRENDICES': p.totalAprendicesYtoAK,
      '% CERTIFICACION': p.tasaCertificacion,
      '% CULMINACION': p.tasaCulminacion,
      '% RETENCION': p.tasaRetencion,
      '% BAJAS': p.tasaBajas,
      'DIAGNOSTICO PROGRAMA': p.diagnostico,
    }));

    const exportRows = filteredFichas.map((f) => {
      const ev = decisionEvaluations.byKey.get(`${f.ficha}__${f.filaReporte}`);
      return {
        'NIVEL DE FORMACION': f.nivelFormacion,
        'AGRUPACION NIVEL': f.categoriaColH === 'NO_NIVEL' ? 'NO NIVEL (COMPLEMENTARIA / ESPECIAL)' : 'NIVEL TITULADO',
        'PROGRAMA DE FORMACION': f.programa,
        'FICHA': f.ficha,
        'CODIGO PROGRAMA': f.codigoPrograma,
        'VERSION': f.versionPrograma,
        'DURACION MAXIMA': f.duracionMaxima,
        'DURACION ETAPA LECTIVA': f.duracionEtapaLectiva,
        'DURACION ETAPA PRODUCTIVA': f.duracionEtapaProductiva,
        'FECHA INICIO': f.fechaInicio,
        'FECHA FIN ETAPA LECTIVA': f.fechaFinEtapaLectiva,
        'REGLA ETAPA LECTIVA': f.reglaEtapaLectivaLabel,
        'FECHA FINAL (CIERRE PRODUCTIVA)': f.fechaFin,
        'PLAZO +1 ANIO ETAPA PRODUCTIVA': f.fechaLimitePresentacionProductiva,
        'CUPO AUTORIZADO': f.cupo,
        'DIFERENCIA CUPO VS ESTADOS': f.diferenciaCupoEstados,
        'ESTADO DE FICHA': f.estadoFicha,
        'TIPO DE RESPUESTA': f.tipoRespuesta,
        'PROGRAMA ESPECIAL': f.programaEspecial,
        'CONVENIO': f.convenio,
        'EMPRESA': f.empresa,
        'EN TRANSITO': f.colY_enTransito,
        'INDUCCION': f.colZ_induccion,
        'EN FORMACION': f.colAA_formacion,
        'CONDICIONADO': f.colAB_condicionado,
        'APLAZADO': f.colAC_aplazado,
        'RETIRO VOLUNTARIO': f.colAD_retiroVoluntario,
        'CANCELAMIENTO VIRT/COMP': f.colAE_cancelamientoVirtComp,
        'DESERCION VIRT/COMP': f.colAF_desercionVirtComp,
        'CANCELADO': f.colAG_cancelado,
        'POR CERTIFICAR': f.colAH_porCertificar,
        'CERTIFICADO': f.colAI_certificado,
        'TRASLADADO': f.colAJ_trasladado,
        'OTRO': f.colAK_otro,
        'TOTAL APRENDICES': f.totalAprendicesYtoAK,
        '% CERTIFICACION': f.tasaCertificacion,
        '% RETENCION': f.tasaRetencion,
        '% BAJAS': f.tasaBajas,
        'DIAGNOSTICO DESEMPENO': f.diagnostico,
        'DECISIONES REQUERIDAS': ev ? ev.hallazgosDecision.join(' | ') : '',
        'VALIDACION DATOS': ev ? ev.hallazgosValidacion.join(' | ') : '',
      };
    });

    const wb = XLSX.utils.book_new();
    const wsKpis = XLSX.utils.json_to_sheet(exportResumen7Kpis);
    XLSX.utils.book_append_sheet(wb, wsKpis, 'Indicadores_Etapas_7KPI');
    if (exportDecisionRows.length > 0) {
      const wsDec = XLSX.utils.json_to_sheet(exportDecisionRows);
      XLSX.utils.book_append_sheet(wb, wsDec, 'Alertas_Decision_Validacion');
    }
    const wsProg = XLSX.utils.json_to_sheet(exportPrograms);
    const wsFichas = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, wsProg, 'Desempeno_Programas');
    XLSX.utils.book_append_sheet(wb, wsFichas, 'Fichas_Detalle_Desempeno');
    XLSX.writeFile(wb, `Gestion_Curricular_DF14_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Paginación de tabla maestra
  const totalPages = Math.max(1, Math.ceil(filteredFichas.length / pageSize));
  const paginatedFichas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFichas.slice(start, start + pageSize);
  }, [filteredFichas, currentPage]);

  // Datos de Matriz SofiaPlus (solo si el usuario alterna a la pestaña secundaria con archivos locales cargados)
  const [sofiaSearch, setSofiaSearch] = useState('');
  const [selectedSofiaComp, setSelectedSofiaComp] = useState<string | null>(null);
  const availableSofiaFichas = useMemo(() => Object.values(fichas), [fichas]);

  const sofiaCompetencies = useMemo(() => {
    if (!selectedFichaId || rows.length === 0) return [];
    const fichaRows = rows.filter((r) => r._ficha === selectedFichaId);
    const map: Record<
      string,
      { ras: Set<string>; total: number; ap: number; na: number; pe: number }
    > = {};

    for (const r of fichaRows) {
      const comp = getCompetencia(r) || 'Sin Competencia';
      const ra = getRA(r) || 'Sin RA';
      const j = getJuicio(r);
      if (!map[comp]) {
        map[comp] = { ras: new Set(), total: 0, ap: 0, na: 0, pe: 0 };
      }
      if (ra && ra !== '—') map[comp].ras.add(ra);
      map[comp].total++;
      if (j === 'APROBADO') map[comp].ap++;
      else if (j === 'NO APROBADO') map[comp].na++;
      else map[comp].pe++;
    }

    return Object.entries(map)
      .map(([name, d]) => {
        const sched = programacion.filter(
          (p) =>
            String(p.codigoFicha || '').trim() === String(selectedFichaId).trim() &&
            String(p.competencia || '')
              .toLowerCase()
              .includes(name.toLowerCase())
        );
        const hours = sched.reduce(
          (sum, s) => sum + Number(s.horasProgramadas || s.totalHorasProgramadas || 0),
          0
        );
        return {
          name,
          totalRAs: d.ras.size,
          allRAs: Array.from(d.ras),
          hoursScheduled: hours,
          isScheduled: sched.length > 0,
          aprobados: d.ap,
          noAprobados: d.na,
          pendientes: d.pe,
          completionPercent: d.total > 0 ? Math.round((d.ap / d.total) * 100) : 0,
        };
      })
      .filter((c) => !sofiaSearch.trim() || c.name.toLowerCase().includes(sofiaSearch.toLowerCase()))
      .sort((a, b) => b.totalRAs - a.totalRAs);
  }, [rows, selectedFichaId, programacion, sofiaSearch]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal del Módulo */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Gestión & Calidad</span>
              <span aria-hidden="true">/</span>
              <span className="text-sena font-semibold">Módulo de Gestión Curricular</span>
              {syncMeta && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{syncMeta.fileName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums" title="Fecha y hora en que se modificó el archivo en Google Drive">
                    Actualizado {syncMeta.driveModifiedAt}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Gestión Curricular — Análisis y Desempeño de Fichas
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Agrupación curricular desde Google Drive por Nivel de Formación, filtro y panel de desempeño por Programa de Formación, Indicador de Ficha, Estado de Ficha, Tipo de Respuesta, Programa Especial e indicadores integrales de desempeño y resultados de aprendices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.xlsx,.xls,.csv"
              onChange={handleLocalFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => handleSyncDrive(false)}
              disabled={isLoadingDrive}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sena hover:bg-sena-dark disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
              <span>{isLoadingDrive ? 'Sincronizando Drive...' : 'Sincronizar Drive'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Cargar XML / Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredFichas.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <a
              href={GESTION_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title="Abrir carpeta fuente en Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Carpeta Drive</span>
            </a>
          </div>
        </div>

        {/* Selector de modo secundario si existen juicios SofiaPlus cargados */}
        {availableSofiaFichas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setWorkspaceMode('drive-df14')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'drive-df14'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Análisis Curricular Drive DF-14A
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('sofiaplus')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  workspaceMode === 'sofiaplus'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriz Competencias SofiaPlus ({availableSofiaFichas.length})
              </button>
            </div>
          </div>
        )}

        {/* Mensajes de estado de sincronización */}
        {syncError && (
          <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {syncNotice && (
          <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{syncNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {workspaceMode === 'sofiaplus' ? (
        /* Sub-vista preservada para archivos locales de juicios SofiaPlus */
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Matriz de Competencias y Resultados de Aprendizaje (SofiaPlus)
              </h3>
              <p className="text-xs text-slate-500">
                Cruce de competencias evaluadas en archivos de juicios frente a programación horaria.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedFichaId}
                onChange={(e) => {
                  setSelectedFichaId(e.target.value);
                  setSelectedSofiaComp(null);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {availableSofiaFichas.map((f) => (
                  <option key={f.ficha} value={f.ficha}>
                    Ficha {f.ficha} — {f.programa.slice(0, 38)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={sofiaSearch}
                onChange={(e) => setSofiaSearch(e.target.value)}
                placeholder="Filtrar competencia..."
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 w-48"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-[460px] overflow-y-auto">
              {sofiaCompetencies.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedSofiaComp(c.name)}
                  className={`w-full text-left p-4 transition-colors flex items-center justify-between gap-4 cursor-pointer ${
                    selectedSofiaComp === c.name ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {c.totalRAs} RAs · {c.isScheduled ? `${c.hoursScheduled} h programadas` : 'Sin programación'}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">{c.name}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-800 shrink-0">
                    {c.completionPercent}% aprob.
                  </span>
                </button>
              ))}
            </div>

            <div className="lg:col-span-5 border border-slate-200 rounded-lg p-5">
              {selectedSofiaComp ? (
                (() => {
                  const detail = sofiaCompetencies.find((x) => x.name === selectedSofiaComp);
                  if (!detail) return null;
                  return (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{detail.name}</h4>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="block text-[11px] text-slate-500">Aprobados</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                            {detail.aprobados}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="block text-[11px] text-slate-500">Por Mejorar</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-red-700">
                            {detail.noAprobados}
                          </span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="block text-[11px] text-slate-500">Pendientes</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-slate-800">
                            {detail.pendientes}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">
                        {detail.allRAs.map((ra, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700 flex gap-2">
                            <BookmarkCheck className="w-4 h-4 text-sena shrink-0 mt-0.5" />
                            <span>{ra}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-slate-400">
                  <Award className="w-8 h-8 mb-2 text-slate-300" />
                  <p className="text-xs font-medium text-slate-500">
                    Seleccione una competencia para inspeccionar sus resultados de aprendizaje.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : isLoadingDrive && driveRecords.length === 0 ? (
        /* Skeleton de carga inicial mientras descarga el XML de Google Drive */
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-72 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-44 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-24 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 animate-pulse">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-6 w-16 bg-slate-200 rounded" />
                <div className="h-3 w-28 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 bg-slate-50 border border-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* TABLERO EJECUTIVO PRINCIPAL: LOS 7 INDICADORES DE ETAPA LECTIVA, ETAPA PRODUCTIVA, CERTIFICACIÓN Y RETIROS */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Indicadores de Ejecución por Etapa, Certificación y Retiros
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seguimiento consolidado de fichas activas (<span className="font-mono">En ejecución</span>) y aprendices según desarrollo de Etapa Lectiva (<span className="font-mono">−6m Técnico/Tecnólogo · −3m Auxiliar/Operario</span>), Etapa Productiva, Certificación y Retiros/Cancelaciones. Haga clic en cualquier indicador para filtrar el tablero.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeStageKpiFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveStageKpiFilter(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-sena/40 text-slate-900 text-xs font-semibold cursor-pointer"
                  >
                    <span>Filtro activo: {STAGE_KPI_FILTER_LABELS[activeStageKpiFilter]}</span>
                    <X className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                )}

                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {syncMeta?.driveModifiedIso && (
                    <button
                      type="button"
                      onClick={() => setRefDateMode('CORTE_DRIVE')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        refDateMode === 'CORTE_DRIVE'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Clasificar etapa activa según la fecha de actualización del archivo en Google Drive"
                    >
                      Corte Drive ({formatIsoToDisplay(syncMeta.driveModifiedIso)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRefDateMode('FECHA_ACTUAL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      refDateMode === 'FECHA_ACTUAL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Clasificar etapa activa según la fecha calendario actual"
                  >
                    Hoy ({formatIsoToDisplay(getTodayBogotaIso())})
                  </button>
                </div>
              </div>
            </div>

            {/* Fila 1 (4 Indicadores): Fichas Activas y Aprendices en Formación por Etapa Lectiva y Etapa Productiva */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {/* 1. Fichas activas en desarrollo de la Etapa Lectiva */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'FICHAS_LECTIVA' ? null : 'FICHAS_LECTIVA'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'FICHAS_LECTIVA'
                    ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Fichas Activas en Desarrollo de Etapa Lectiva
                  </span>
                  <BookOpen className="w-4 h-4 text-sena shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {stageKpiMetrics.fichasActivasLectiva.toLocaleString('es-CO')}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      fichas activas
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                    <span>Titulada: {stageKpiMetrics.fichasLectivaTitulada.toLocaleString('es-CO')}</span>
                    <span>·</span>
                    <span>Compl.: {stageKpiMetrics.fichasLectivaComplementaria.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </button>

              {/* 2. Fichas activas en desarrollo de la Etapa Productiva */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'FICHAS_PRODUCTIVA' ? null : 'FICHAS_PRODUCTIVA'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'FICHAS_PRODUCTIVA'
                    ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Fichas Activas en Desarrollo de Etapa Productiva
                  </span>
                  <Briefcase className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {stageKpiMetrics.fichasActivasProductiva.toLocaleString('es-CO')}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      fichas activas
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                    <span>Téc/Tecnól: {stageKpiMetrics.fichasProductivaTecTecnologo}</span>
                    <span>·</span>
                    <span>Aux/Oper: {stageKpiMetrics.fichasProductivaAuxOperario}</span>
                  </div>
                </div>
              </button>

              {/* 3. Aprendices en formación — desarrollo de la Etapa Lectiva */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'APRENDICES_LECTIVA' ? null : 'APRENDICES_LECTIVA'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'APRENDICES_LECTIVA'
                    ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Aprendices en Formación — Desarrollo Etapa Lectiva
                  </span>
                  <GraduationCap className="w-4 h-4 text-sena shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {stageKpiMetrics.aprendicesFormacionLectiva.toLocaleString('es-CO')}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-sena font-semibold">
                      En Formación · Lectiva
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                    <span>Titulada: {stageKpiMetrics.aprLectivaTitulada.toLocaleString('es-CO')}</span>
                    <span>·</span>
                    <span>Compl.: {stageKpiMetrics.aprLectivaComplementaria.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </button>

              {/* 4. Aprendices en formación — desarrollo de la Etapa Productiva */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'APRENDICES_PRODUCTIVA' ? null : 'APRENDICES_PRODUCTIVA'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'APRENDICES_PRODUCTIVA'
                    ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Aprendices en Formación — Desarrollo Etapa Productiva
                  </span>
                  <Users className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {stageKpiMetrics.aprendicesFormacionProductiva.toLocaleString('es-CO')}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-sky-700 font-semibold">
                      En Formación · Productiva
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                    <span>En fichas activas</span>
                    {stageKpiMetrics.aprProductivaPostFechaPlazo1Anio > 0 && (
                      <span title="Aprendices en formación en fichas Terminadas por fecha dentro de la ventana de presentación de etapa productiva">
                        +{stageKpiMetrics.aprProductivaPostFechaPlazo1Anio.toLocaleString('es-CO')} post-fecha
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* Fila 2 (3 Indicadores): Pendientes por Certificar, Certificados Registrados, y Retiros y Cancelaciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 5. Aprendices Pendientes por Certificar */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'PENDIENTES_CERTIFICAR' ? null : 'PENDIENTES_CERTIFICAR'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'PENDIENTES_CERTIFICAR'
                    ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-400/40'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Aprendices Pendientes por Certificar
                  </span>
                  <Award className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-teal-700">
                      {stageKpiMetrics.aprendicesPendientesCertificar.toLocaleString('es-CO')}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-600 font-semibold">
                      {stageKpiMetrics.pctPendientesCertificar}% del total
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-mono tabular-nums">
                    Concentrados en {stageKpiMetrics.fichasConPendientesCertificar.toLocaleString('es-CO')} fichas con trámite de certificación
                  </div>
                </div>
              </button>

              {/* 6. Aprendices Certificados Registrados */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'CERTIFICADOS' ? null : 'CERTIFICADOS'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'CERTIFICADOS'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Aprendices Certificados Registrados
                  </span>
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700">
                      {stageKpiMetrics.aprendicesCertificadosRegistrados.toLocaleString('es-CO')}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-emerald-800 font-semibold">
                      {stageKpiMetrics.pctCertificados}% del total
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-mono tabular-nums">
                    Registrados en {stageKpiMetrics.fichasConCertificados.toLocaleString('es-CO')} fichas certificadas / en cierre
                  </div>
                </div>
              </button>

              {/* 7. Aprendices Retiros y Cancelaciones */}
              <button
                type="button"
                onClick={() =>
                  setActiveStageKpiFilter((prev) =>
                    prev === 'RETIROS_CANCELACIONES' ? null : 'RETIROS_CANCELACIONES'
                  )
                }
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  activeStageKpiFilter === 'RETIROS_CANCELACIONES'
                    ? 'bg-red-50/70 border-red-400 ring-1 ring-red-300/40'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 leading-snug">
                    Aprendices Retiros y Cancelaciones
                  </span>
                  <UserMinus className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-extrabold font-mono tabular-nums text-red-700">
                      {stageKpiMetrics.aprendicesRetirosYCancelaciones.toLocaleString('es-CO')}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-red-700 font-semibold">
                      {stageKpiMetrics.pctRetirosCancelaciones}% del total
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                    <span>Retiro Vol.: {stageKpiMetrics.retirosVoluntariosColAD.toLocaleString('es-CO')}</span>
                    <span>·</span>
                    <span>Cancel./Deserc.: {stageKpiMetrics.cancelacionesYDesercionesAEaAG.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* PASO 1: AGRUPACIÓN COLUMNA H (NIVEL_FORMACION) — Agrupación explícita de No Niveles vs Niveles Titulados */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  01. Agrupación por Nivel de Formación
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clasificación agrupada de los registros que no corresponden a niveles titulados (<span className="font-medium text-slate-700">Curso Especial y Complementaria Virtual</span>) frente a los niveles formales de Formación Titulada.
                </p>
              </div>

              {/* Control segmentado interactivo para filtrar la agrupación de No Niveles */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMacroColH('TODOS');
                    setFilterColH_Nivel('TODOS');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono tabular-nums ${
                    macroColH === 'TODOS'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos los Niveles ({macroColHCounts.totalFichas.toLocaleString('es-CO')})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMacroColH('NO_NIVELES');
                    setFilterColH_Nivel('TODOS');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono tabular-nums ${
                    macroColH === 'NO_NIVELES'
                      ? 'bg-sena text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Agrupación No Niveles ({macroColHCounts.noNivelesFichas.toLocaleString('es-CO')})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMacroColH('NIVELES_TITULADOS');
                    setFilterColH_Nivel('TODOS');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono tabular-nums ${
                    macroColH === 'NIVELES_TITULADOS'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Niveles Titulados ({macroColHCounts.nivelesTituladosFichas.toLocaleString('es-CO')})
                </button>
              </div>
            </div>

            {/* Tarjetas de agrupación por cada valor presente en Columna H */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {colHGroups.map((grp) => {
                const isSelected = filterColH_Nivel === grp.nivel;
                const isDimmed =
                  (macroColH === 'NO_NIVELES' && grp.categoria !== 'NO_NIVEL') ||
                  (macroColH === 'NIVELES_TITULADOS' && grp.categoria !== 'NIVEL_TITULADO');
                const certPct =
                  grp.totalAprendices > 0
                    ? Math.round((grp.certificados / grp.totalAprendices) * 1000) / 10
                    : 0;

                return (
                  <button
                    key={grp.nivel}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFilterColH_Nivel('TODOS');
                      } else {
                        setMacroColH('TODOS');
                        setFilterColH_Nivel(grp.nivel);
                      }
                    }}
                    className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                        : isDimmed
                        ? 'bg-slate-50/50 border-slate-200 opacity-45 hover:opacity-80'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                        <span className={grp.categoria === 'NO_NIVEL' ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                          {grp.categoria === 'NO_NIVEL' ? 'No Nivel · Complementaria' : 'Nivel Titulado'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1 truncate" title={grp.nivel}>
                        {grp.nivel}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900">
                          {grp.fichasCount.toLocaleString('es-CO')}
                        </span>
                        <span className="text-[11px] text-slate-500">fichas</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center justify-between">
                        <span>{grp.totalAprendices.toLocaleString('es-CO')} apr.</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-semibold">{certPct}% cert.</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* PASO 2: CADENA DE FILTROS CURRICULARES OFICIALES (Col H · Col G · Col L · Col P · Col Q · Col R) */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sena" />
                <h3 className="text-sm font-bold text-slate-900">
                  02. Filtros Curriculares Oficiales
                </h3>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar filtros activos</span>
                </button>
              )}
            </div>

            {/* 6 Filtros Oficiales */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3.5">
              {/* 1. Nivel de Formación */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Nivel de Formación
                </label>
                <select
                  value={filterColH_Nivel}
                  onChange={(e) => setFilterColH_Nivel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                >
                  <option value="TODOS">
                    {macroColH === 'NO_NIVELES'
                      ? 'Todos los No Niveles agrupados'
                      : macroColH === 'NIVELES_TITULADOS'
                      ? 'Todos los Niveles Titulados'
                      : 'Todos los niveles de formación'}
                  </option>
                  {optionsColH.map((g) => (
                    <option key={g.nivel} value={g.nivel}>
                      {g.nivel} ({g.fichasCount})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Programa de Formación */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Programa de Formación</span>
                  <span className="font-mono tabular-nums text-slate-500 font-semibold">
                    {optionsColG_Programa.length} prog.
                  </span>
                </label>
                <select
                  value={filterColG_Programa}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterColG_Programa(val);
                    if (val !== 'TODOS') {
                      setSelectedPanelProgram(val);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                >
                  <option value="TODOS">
                    Todos los programas ({optionsColG_Programa.length})
                  </option>
                  {optionsColG_Programa.map(([progName, count]) => (
                    <option key={progName} value={progName}>
                      {progName} ({count} {count === 1 ? 'ficha' : 'fichas'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Indicador y Filtro de Ficha */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Indicador de Ficha</span>
                  <span className="font-mono tabular-nums text-sena font-bold">
                    {filteredFichas.length.toLocaleString('es-CO')} activas
                  </span>
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    list="datalist-fichas-col-l"
                    value={filterColL_Ficha}
                    onChange={(e) => setFilterColL_Ficha(e.target.value)}
                    placeholder="Código de ficha (ej. 3456305)..."
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono tabular-nums font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sena focus:outline-none"
                  />
                  {filterColL_Ficha && (
                    <button
                      type="button"
                      onClick={() => setFilterColL_Ficha('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <datalist id="datalist-fichas-col-l">
                    {filteredFichas.slice(0, 80).map((f) => (
                      <option key={`${f.ficha}-${f.codigoPrograma}`} value={f.ficha}>
                        {f.programa.slice(0, 45)} ({f.estadoFicha})
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 4. Estado de Ficha */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Estado de Ficha
                </label>
                <select
                  value={filterColP_Estado}
                  onChange={(e) => setFilterColP_Estado(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                >
                  <option value="TODOS">Todos los estados ({optionsColP_Estado.reduce((s, x) => s + x[1], 0)})</option>
                  {optionsColP_Estado.map(([estado, count]) => (
                    <option key={estado} value={estado}>
                      {estado} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Tipo de Respuesta */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Tipo de Respuesta
                </label>
                <select
                  value={filterColQ_TipoRespuesta}
                  onChange={(e) => setFilterColQ_TipoRespuesta(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                >
                  <option value="TODOS">ABIERTA + CERRADA ({optionsColQ_Respuesta.reduce((s, x) => s + x[1], 0)})</option>
                  {optionsColQ_Respuesta.map(([resp, count]) => (
                    <option key={resp} value={resp}>
                      {resp} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Programa Especial */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Programa Especial
                </label>
                <select
                  value={filterColR_ProgramaEspecial}
                  onChange={(e) => setFilterColR_ProgramaEspecial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                >
                  <option value="TODOS">Todos los programas especiales ({optionsColR_ProgEspecial.reduce((s, x) => s + x[1], 0)})</option>
                  {optionsColR_ProgEspecial.map(([progEsp, count]) => (
                    <option key={progEsp} value={progEsp}>
                      {progEsp} ({count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barra auxiliar de búsqueda libre y resumen rápido */}
            <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="relative w-full lg:w-96">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={programaQuery}
                  onChange={(e) => setProgramaQuery(e.target.value)}
                  placeholder="Búsqueda rápida por palabra clave en Programa, Código, Convenio o Empresa..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-sena focus:outline-none"
                />
                {programaQuery && (
                  <button
                    type="button"
                    onClick={() => setProgramaQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                <span>
                  Programas: <strong className="text-slate-900">{programsPerformance.length.toLocaleString('es-CO')}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Indicador Fichas (<strong className="text-slate-900">{filteredFichas.length.toLocaleString('es-CO')}</strong> / {driveRecords.length.toLocaleString('es-CO')} fichas)
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  En ejecución: <strong className="text-slate-900">{consolidatedYtoAK.enEjecucionFichas.toLocaleString('es-CO')}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Abierta: <strong className="text-slate-900">{consolidatedYtoAK.abiertasCount.toLocaleString('es-CO')}</strong>
                </span>
                <span aria-hidden="true">/</span>
                <span>
                  Cerrada: <strong className="text-slate-900">{consolidatedYtoAK.cerradasCount.toLocaleString('es-CO')}</strong>
                </span>
              </div>
            </div>
          </section>

          {/* PASO 3: INDICADORES DE ATENCIÓN QUE REQUIEREN DECISIÓN Y VALIDACIÓN DE DATOS */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 space-y-5">
              {/* Encabezado y controles de horizonte y fecha de corte */}
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div className="space-y-1 max-w-3xl">
                  <h3 className="text-sm font-bold text-slate-900">
                    03. Indicadores: Fichas de Atención que Requieren Decisión y Validación de Datos
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cálculo reglamentario sobre la Fecha Final de la ficha: Etapa Lectiva restando <strong className="text-slate-900">6 meses</strong> únicamente a <span className="font-mono">TÉCNICO</span> y <span className="font-mono">TECNÓLOGO</span>, y <strong className="text-slate-900">3 meses</strong> a <span className="font-mono">AUXILIAR</span> y <span className="font-mono">OPERARIO</span>; Cierre de Etapa Productiva en la <span className="font-mono">Fecha Final</span> y <strong className="text-slate-900">+1 año</strong> posterior para presentar etapa productiva. <strong className="text-slate-800">Haga clic sobre cualquier Ficha</strong> para abrir su ventana emergente con fechas, alertas de aprendices fuera de tiempo y resumen de estados.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Ventana de alerta en días */}
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <span className="px-2 text-[11px] font-medium text-slate-500">Horizonte:</span>
                    {([30, 60, 90] as AlertHorizonDays[]).map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setAlertHorizonDays(days)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums font-semibold transition-colors cursor-pointer ${
                          alertHorizonDays === days
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>

                  {/* Referencia temporal */}
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRefDateMode('FECHA_ACTUAL')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        refDateMode === 'FECHA_ACTUAL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Evaluar vencimientos frente a la fecha calendario actual"
                    >
                      Hoy ({formatIsoToDisplay(getTodayBogotaIso())})
                    </button>
                    {syncMeta?.driveModifiedIso && (
                      <button
                        type="button"
                        onClick={() => setRefDateMode('CORTE_DRIVE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          refDateMode === 'CORTE_DRIVE'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Evaluar vencimientos frente a la fecha de actualización del archivo en Drive"
                      >
                        Corte Drive ({formatIsoToDisplay(syncMeta.driveModifiedIso)})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Tarjetas Ejecutivas de Decisión y Validación */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                {/* Tarjeta 1: Fichas próximas a finalizar Etapa Lectiva (-6m Téc/Tecnól, -3m Aux/Oper) */}
                <button
                  type="button"
                  onClick={() => setActiveDecisionQueue('LECTIVA_PROXIMA')}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    activeDecisionQueue === 'LECTIVA_PROXIMA'
                      ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300/50'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Próximas a Finalizar Etapa Lectiva
                      </span>
                      <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      <span className="font-mono">Fecha Final − 6m</span> (Técnico/Tecnólogo) · <span className="font-mono">Fecha Final − 3m</span> (Auxiliar/Operario) en ≤ {alertHorizonDays} días
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                        {decisionSummary.lectivaProximaTotal.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-amber-800 font-semibold">
                        {decisionSummary.lectivaAprendicesActivos.toLocaleString('es-CO')} apr. activos
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                      <span>Téc/Tecnól (−6m): {decisionSummary.lectivaTecTecnologo6m}</span>
                      <span>·</span>
                      <span>Aux/Oper (−3m): {decisionSummary.lectivaAuxOperario3m}</span>
                    </div>
                  </div>
                </button>

                {/* Tarjeta 2: Seguimiento, Evaluación y Cierre de Etapa Productiva (Col N y +1 Año) */}
                <button
                  type="button"
                  onClick={() => setActiveDecisionQueue('PRODUCTIVA_TODAS')}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    activeDecisionQueue.startsWith('PRODUCTIVA_')
                      ? 'bg-emerald-50/70 border-sena ring-1 ring-sena/30'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Cierre y Seguimiento Etapa Productiva
                      </span>
                      <ClipboardCheck className="w-4 h-4 text-sena shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Cierre en la <span className="font-mono">Fecha Final</span> de la ficha y ventana de <span className="font-mono">+1 año</span> posterior para presentar productiva
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                        {decisionSummary.productivaTotal.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-sena font-semibold">
                        Próx. cierre: {decisionSummary.productivaCierreProximo}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                      <span>En prod: {decisionSummary.productivaSeguimiento}</span>
                      <span>·</span>
                      <span>+1 año: {decisionSummary.productivaPlazo1Anio}</span>
                      <span>·</span>
                      <span className="text-red-700 font-semibold">Venc.: {decisionSummary.productivaPlazoVencido}</span>
                    </div>
                  </div>
                </button>

                {/* Tarjeta 3: Pendientes de Certificación y Novedades Administrativas */}
                <button
                  type="button"
                  onClick={() => setActiveDecisionQueue('CERTIFICACION_TODAS')}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    activeDecisionQueue === 'CERTIFICACION_TODAS' || activeDecisionQueue.startsWith('CERT_')
                      ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-400/40'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Pendientes Certificación y Novedades
                      </span>
                      <Award className="w-4 h-4 text-teal-700 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Priorizar revisión de requisitos de certificación y gestión de novedades administrativas
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                        {decisionSummary.certYNovedadesTotal.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-teal-800 font-semibold">
                        {decisionSummary.aprendicesPorCertificar.toLocaleString('es-CO')} apr. por certificar
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                      <span>Por Certificar: {decisionSummary.fichasPorCertificar} fichas</span>
                      <span>·</span>
                      <span>Novedades: {decisionSummary.fichasConNovedadesAdmin} fichas</span>
                    </div>
                  </div>
                </button>

                {/* Tarjeta 4: Datos que Requieren Validación */}
                <button
                  type="button"
                  onClick={() => setActiveDecisionQueue('VALIDACION_CRITICA')}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                    activeDecisionQueue === 'VALIDACION_CRITICA' || activeDecisionQueue.startsWith('VAL_')
                      ? 'bg-red-50/70 border-red-400 ring-1 ring-red-300/50'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Datos que Requieren Validación
                      </span>
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Cupos autorizados vs estados reportados, fechas inconsistentes o fichas duplicadas
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-red-700">
                        {decisionSummary.validacionCriticaTotal.toLocaleString('es-CO')}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-600 font-semibold">
                        Cupo ≠ Estados: {decisionSummary.cupoDiferenteTotal.toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums flex items-center justify-between">
                      <span>Sobrecupo: {decisionSummary.sobrecupoCount}</span>
                      <span>·</span>
                      <span>Fechas: {decisionSummary.fechasInconsistentesCount}</span>
                      <span>·</span>
                      <span>Duplic.: {decisionSummary.duplicadasRowsCount}</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Barra de Sub-Colas Operativas y Sincronización con el Tablero Global */}
              <div className="pt-2 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        key: 'LECTIVA_PROXIMA' as DecisionQueueKey,
                        label: `Fin Lectiva ≤${alertHorizonDays}d (${decisionSummary.lectivaProximaTotal})`,
                      },
                      {
                        key: 'PRODUCTIVA_SEGUIMIENTO_CIERRE' as DecisionQueueKey,
                        label: `En Etapa Productiva (${decisionSummary.productivaSeguimiento})`,
                      },
                      {
                        key: 'PRODUCTIVA_PLAZO_1_ANIO' as DecisionQueueKey,
                        label: `Plazo +1 Año Productiva (${decisionSummary.productivaPlazo1Anio})`,
                      },
                      {
                        key: 'PRODUCTIVA_PLAZO_VENCIDO' as DecisionQueueKey,
                        label: `+1 Año Vencido (${decisionSummary.productivaPlazoVencido})`,
                      },
                      {
                        key: 'CERT_POR_CERTIFICAR' as DecisionQueueKey,
                        label: `Por Certificar (${decisionSummary.fichasPorCertificar})`,
                      },
                      {
                        key: 'CERT_NOVEDADES_ADMIN' as DecisionQueueKey,
                        label: `Novedades Admin. (${decisionSummary.fichasConNovedadesAdmin})`,
                      },
                      {
                        key: 'VAL_SOBRECUPO' as DecisionQueueKey,
                        label: `Sobrecupo (${decisionSummary.sobrecupoCount})`,
                      },
                      {
                        key: 'VAL_CUPO_DIFERENTE' as DecisionQueueKey,
                        label: `Todo Cupo ≠ Estados (${decisionSummary.cupoDiferenteTotal})`,
                      },
                      {
                        key: 'VAL_FECHAS_INCONSISTENTES' as DecisionQueueKey,
                        label: `Fechas Inconsistentes (${decisionSummary.fechasInconsistentesCount})`,
                      },
                      {
                        key: 'VAL_FICHAS_DUPLICADAS' as DecisionQueueKey,
                        label: `Fichas Duplicadas (${decisionSummary.duplicadasRowsCount})`,
                      },
                      ...(decisionSummary.conProgSofiaCount > 0
                        ? [
                            {
                              key: 'CON_PROG_SOFIA' as DecisionQueueKey,
                              label: `Prog. SOFIA Plus (${decisionSummary.conProgSofiaCount})`,
                            },
                          ]
                        : []),
                      ...(decisionSummary.conJuiciosDriveCount > 0
                        ? [
                            {
                              key: 'CON_JUICIOS_DRIVE' as DecisionQueueKey,
                              label: `Juicios Evaluativos (${decisionSummary.conJuiciosDriveCount})`,
                            },
                          ]
                        : []),
                      {
                        key: 'TODAS_EVALUADAS' as DecisionQueueKey,
                        label: `Todas (${decisionEvaluations.evaluations.length})`,
                      },
                    ]
                  ).map((item) => {
                    const selected = activeDecisionQueue === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveDecisionQueue(item.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={decisionSearch}
                      onChange={(e) => setDecisionSearch(e.target.value)}
                      placeholder="Buscar ficha o hallazgo..."
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-sena focus:outline-none"
                    />
                    {decisionSearch && (
                      <button
                        type="button"
                        onClick={() => setDecisionSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setApplyDecisionToGlobalBoard((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                      applyDecisionToGlobalBoard
                        ? 'bg-sena text-white border-sena'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {applyDecisionToGlobalBoard
                      ? 'Filtro global activo en tablero (Quitar)'
                      : 'Aplicar cola al resto del tablero'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla Ejecutiva de Fichas que Requieren Decisión / Validación */}
            {activeDecisionQueueItems.length === 0 ? (
              <div className="p-8 text-center space-y-2 bg-slate-50/40">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  No se detectaron fichas en esta cola con los filtros y fecha de corte actuales.
                </p>
                <p className="text-[11px] text-slate-500">
                  Seleccione otra categoría superior o amplíe el horizonte de días para inspeccionar otros grupos.
                </p>
                {decisionSearch.trim() && activeDecisionQueue !== 'TODAS_EVALUADAS' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveDecisionQueue('TODAS_EVALUADAS')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Buscar «{decisionSearch.trim()}» en todas las fichas evaluadas
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3 whitespace-nowrap">Prioridad</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Ficha</th>
                        <th className="py-2.5 px-3 min-w-[210px]">Programa / Nivel de Formación</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Fecha Inicio</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Fin Etapa Lectiva
                          <span className="block text-[9px] font-normal text-slate-400">
                            −6m (Téc/Tecnól) · −3m (Aux/Oper)
                          </span>
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Cierre Productiva
                          <span className="block text-[9px] font-normal text-slate-400">
                            Fecha Final Ficha
                          </span>
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap">
                          Plazo +1 Año Productiva
                          <span className="block text-[9px] font-normal text-slate-400">
                            Fecha Final + 1 año aprendiz
                          </span>
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          Cupo / Reportados
                        </th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          Form. · Por Cert. · Nov.
                        </th>
                        <th className="py-2.5 px-3 min-w-[260px]">
                          Decisión / Validación Requerida
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedDecisionItems.map((ev) => {
                        const f = ev.fichaRecord;
                        const isInspected = inspectedFicha?.ficha === f.ficha;
                        const detalleMensajes =
                          activeDecisionQueue.startsWith('VAL_') || activeDecisionQueue === 'VALIDACION_CRITICA'
                            ? [...ev.hallazgosValidacion, ...ev.hallazgosDecision]
                            : [...ev.hallazgosDecision, ...ev.hallazgosValidacion];

                        return (
                          <tr
                            key={`${f.ficha}-row-${f.filaReporte}`}
                            onClick={() => {
                              setInspectedFichaCode(f.ficha);
                              setModalFichaTab('RESUMEN');
                              setModalDecisionFichaKey(`${f.ficha}__${f.filaReporte}`);
                            }}
                            className={`transition-colors cursor-pointer ${
                              isInspected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`text-[11px] font-bold ${
                                  ev.prioridad === 'Crítica'
                                    ? 'text-red-700'
                                    : ev.prioridad === 'Alta'
                                    ? 'text-amber-700'
                                    : ev.prioridad === 'Media'
                                    ? 'text-teal-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {ev.prioridad}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedFichaCode(f.ficha);
                                  setModalFichaTab('RESUMEN');
                                  setModalDecisionFichaKey(`${f.ficha}__${f.filaReporte}`);
                                }}
                                title="Abrir ventana emergente con fechas, alertas fuera de tiempo, resumen de estados y programación SOFIA Plus"
                                className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-sena hover:text-sena-dark underline decoration-sena/40 hover:decoration-sena underline-offset-2 cursor-pointer"
                              >
                                <span>{f.ficha}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                              </button>
                              <div className="text-[10px] text-slate-500">
                                {f.estadoFicha}
                                {f.ocurrenciasFicha > 1 && (
                                  <span className="text-red-700 font-semibold"> · {f.ocurrenciasFicha}x registro #{f.filaReporte}</span>
                                )}
                                {fichasWithSofiaProgSet.has(f.ficha) && (
                                  <>
                                    <span> · </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectedFichaCode(f.ficha);
                                        setModalFichaTab('PROGRAMACION_SOFIA');
                                        setModalDecisionFichaKey(`${f.ficha}__${f.filaReporte}`);
                                      }}
                                      className="text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-2 cursor-pointer"
                                    >
                                      Prog. SOFIA Plus
                                    </button>
                                  </>
                                )}
                                {fichasWithJuiciosDriveSet.has(f.ficha) && (
                                  <>
                                    <span> · </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectedFichaCode(f.ficha);
                                        setModalFichaTab('JUICIOS_EVALUATIVOS');
                                        setModalDecisionFichaKey(`${f.ficha}__${f.filaReporte}`);
                                      }}
                                      className="text-teal-700 hover:text-teal-900 font-semibold underline underline-offset-2 cursor-pointer"
                                    >
                                      Juicios Eval.
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 line-clamp-1" title={f.programa}>
                                {f.programa}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1.5">
                                <span className="font-sans font-semibold text-slate-700">{f.nivelFormacion}</span>
                                <span>·</span>
                                <span>
                                  {f.mesesRestadosEtapaLectiva === 6
                                    ? '−6 meses'
                                    : f.mesesRestadosEtapaLectiva === 3
                                    ? '−3 meses'
                                    : 'Fecha directa'}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-slate-600">
                              {f.fechaInicio}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                              <div className="font-bold text-slate-900">{f.fechaFinEtapaLectiva}</div>
                              {ev.diasParaFinLectiva !== null && f.aplicaEtapaProductiva && (
                                <div
                                  className={`text-[10px] ${
                                    ev.diasParaFinLectiva >= 0 && ev.diasParaFinLectiva <= alertHorizonDays
                                      ? 'text-amber-700 font-semibold'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {ev.diasParaFinLectiva >= 0
                                    ? `En ${ev.diasParaFinLectiva} días`
                                    : `Finalizó hace ${Math.abs(ev.diasParaFinLectiva)}d`}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                              <div className="font-semibold text-slate-900">{f.fechaCierreEtapaProductiva}</div>
                              {ev.diasParaCierreProductiva !== null && (
                                <div
                                  className={`text-[10px] ${
                                    ev.diasParaCierreProductiva >= 0 && ev.diasParaCierreProductiva <= alertHorizonDays
                                      ? 'text-sena font-semibold'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {ev.diasParaCierreProductiva >= 0
                                    ? `Cierra en ${ev.diasParaCierreProductiva}d`
                                    : `Cerró hace ${Math.abs(ev.diasParaCierreProductiva)}d`}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                              <div className="font-semibold text-slate-900">{f.fechaLimitePresentacionProductiva}</div>
                              {ev.diasParaLimite1AnioProductiva !== null && (
                                <div
                                  className={`text-[10px] ${
                                    ev.diasParaLimite1AnioProductiva < 0
                                      ? 'text-red-700 font-semibold'
                                      : ev.diasParaLimite1AnioProductiva <= alertHorizonDays
                                      ? 'text-amber-700 font-semibold'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {ev.diasParaLimite1AnioProductiva >= 0
                                    ? `Restan ${ev.diasParaLimite1AnioProductiva}d`
                                    : `Venció hace ${Math.abs(ev.diasParaLimite1AnioProductiva)}d`}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-2.5 text-right whitespace-nowrap font-mono tabular-nums">
                              <div className="font-semibold text-slate-900">
                                {f.cupo} / {f.totalAprendicesYtoAK}
                              </div>
                              <div
                                className={`text-[10px] ${
                                  f.diferenciaCupoEstados > 0
                                    ? 'text-red-700 font-bold'
                                    : f.diferenciaCupoEstados < 0
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {f.diferenciaCupoEstados === 0
                                  ? 'Coincide'
                                  : f.diferenciaCupoEstados > 0
                                  ? `+${f.diferenciaCupoEstados} sobrecupo`
                                  : `${f.diferenciaCupoEstados} dif.`}
                              </div>
                            </td>

                            <td className="py-2.5 px-2.5 text-right whitespace-nowrap font-mono tabular-nums">
                              <div className="text-slate-900 font-semibold">
                                {f.colAA_formacion} · <span className="text-teal-700">{f.colAH_porCertificar}</span> ·{' '}
                                <span className="text-amber-700">{f.novedadesAcademicas}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">Form · Cert · Nov</div>
                            </td>

                            <td className="py-2.5 px-3 text-[11px] text-slate-700 leading-snug">
                              {detalleMensajes.length > 0 ? (
                                <div className="space-y-0.5">
                                  {detalleMensajes.slice(0, 2).map((msg, mIdx) => (
                                    <div key={mIdx} className="line-clamp-2" title={msg}>
                                      • {msg}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">Sin hallazgos</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación del Panel de Decisiones */}
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                  <div className="font-mono tabular-nums">
                    Mostrando {(decisionPage - 1) * decisionPageSize + 1}–
                    {Math.min(decisionPage * decisionPageSize, activeDecisionQueueItems.length)} de{' '}
                    {activeDecisionQueueItems.length.toLocaleString('es-CO')} fichas en cola seleccionada
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={decisionPage <= 1}
                      onClick={() => setDecisionPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <span className="px-3 py-1.5 font-mono tabular-nums font-semibold text-slate-800">
                      Página {decisionPage} / {totalDecisionPages}
                    </span>
                    <button
                      type="button"
                      disabled={decisionPage >= totalDecisionPages}
                      onClick={() => setDecisionPage((p) => Math.min(totalDecisionPages, p + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* PASO 4: ANÁLISIS Y DESEMPEÑO CONSOLIDADO (COLUMNAS Y a AK) */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  04. Indicadores de Análisis y Desempeño de Aprendices
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Haga clic sobre cualquiera de los 13 estados de formación para filtrar únicamente las fichas con aprendices en ese indicador.
                </p>
              </div>
              {activeColYtoAKFilter && (
                <button
                  type="button"
                  onClick={() => setActiveColYtoAKFilter(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold cursor-pointer self-start"
                >
                  <span>
                    Filtro de estado activo:{' '}
                    {COLUMNS_Y_TO_AK_META.find((c) => c.key === activeColYtoAKFilter)?.fullLabel}
                  </span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 4 Bloques Ejecutivos de Desempeño */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs text-slate-500 font-medium block">
                  Indicador de Ficha y Cupo
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                    {filteredFichas.length.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    Cupo: {consolidatedYtoAK.cupoTotal.toLocaleString('es-CO')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Cobertura sobre cupo: {consolidatedYtoAK.tasaOcupacion}%
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs text-slate-500 font-medium block">
                  Total Aprendices Analizados
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                    {consolidatedYtoAK.totalAprendices.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-sena font-semibold">
                    Activos: {consolidatedYtoAK.activosEjecucion.toLocaleString('es-CO')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  En Formación: {consolidatedYtoAK.sums.colAA_formacion.toLocaleString('es-CO')} · Tránsito/Ind: {(consolidatedYtoAK.sums.colY_enTransito + consolidatedYtoAK.sums.colZ_induccion).toLocaleString('es-CO')}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs text-slate-500 font-medium block">
                  Logro y Certificación
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700">
                    {consolidatedYtoAK.tasaCertificacion}%
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-700 font-semibold">
                    {consolidatedYtoAK.sums.colAI_certificado.toLocaleString('es-CO')} cert.
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Por Certificar: {consolidatedYtoAK.sums.colAH_porCertificar.toLocaleString('es-CO')} · Culminación: {consolidatedYtoAK.tasaCulminacion}%
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-xs text-slate-500 font-medium block">
                  Retención Curricular vs Bajas
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                    {consolidatedYtoAK.tasaRetencion}%
                  </span>
                  <span className="text-xs font-mono tabular-nums text-red-700 font-semibold">
                    Bajas: {consolidatedYtoAK.tasaBajas}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Cancelados/Retiros: {consolidatedYtoAK.bajas.toLocaleString('es-CO')} · Novedades: {consolidatedYtoAK.novedades.toLocaleString('es-CO')}
                </p>
              </div>
            </div>

            {/* Matriz Exacta de las 13 Columnas (Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-13 gap-2">
              {COLUMNS_Y_TO_AK_META.map((col) => {
                const count = consolidatedYtoAK.sums[col.key];
                const pct =
                  consolidatedYtoAK.totalAprendices > 0
                    ? Math.round((count / consolidatedYtoAK.totalAprendices) * 1000) / 10
                    : 0;
                const isSelected = activeColYtoAKFilter === col.key;

                return (
                  <button
                    key={col.colLetter}
                    type="button"
                    onClick={() =>
                      setActiveColYtoAKFilter((prev) => (prev === col.key ? null : col.key))
                    }
                    title={`${col.fullLabel}: ${count.toLocaleString('es-CO')} aprendices (${pct}%)`}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[86px] ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            isSelected ? 'text-emerald-300' : 'text-slate-500'
                          }`}
                        >
                          {col.group === 'ejecucion'
                            ? 'Ejecución'
                            : col.group === 'logro'
                            ? 'Logro'
                            : col.group === 'baja'
                            ? 'Retiro/Baja'
                            : 'Novedad'}
                        </span>
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-semibold leading-tight mt-0.5 line-clamp-2 ${
                          isSelected ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {col.shortLabel}
                      </div>
                    </div>

                    <div className="pt-1.5">
                      <span
                        className={`text-sm font-extrabold font-mono tabular-nums block ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {count.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Gráficas Analíticas de Desempeño */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
              {/* Gráfica 1: Distribución Y..AK */}
              <div className="lg:col-span-5 border border-slate-200 rounded-lg p-4 flex flex-col">
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-slate-900">
                    Volumen por Estado del Aprendiz
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Conteo consolidado según los filtros activos de gestión curricular
                  </p>
                </div>
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartStatesData.filter((d) => d.value > 0)}
                      layout="vertical"
                      margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => Number(v).toLocaleString('es-CO')}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={118}
                        tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                      />
                      <Tooltip
                        formatter={(val: any) => [
                          `${Number(val).toLocaleString('es-CO')} aprendices`,
                          'Cantidad',
                        ]}
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartStatesData
                          .filter((d) => d.value > 0)
                          .map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfica 2: Comparativo de Desempeño por Col H o Col R */}
              <div className="lg:col-span-7 border border-slate-200 rounded-lg p-4 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Desempeño Comparativo: Certificados vs En Formación vs Bajas
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Comparación de resultados de certificación, ejecución activa y bajas por agrupación curricular
                    </p>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 rounded-md self-start">
                    <button
                      type="button"
                      onClick={() => setChartDimension('COL_H')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        chartDimension === 'COL_H'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Nivel de Formación
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartDimension('COL_G')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        chartDimension === 'COL_G'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Programa
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartDimension('COL_R')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                        chartDimension === 'COL_R'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Prog. Especial
                    </button>
                  </div>
                </div>

                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartComparativeData}
                      margin={{ top: 8, right: 16, left: 4, bottom: 28 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: '#334155' }}
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => Number(v).toLocaleString('es-CO')}
                      />
                      <Tooltip
                        formatter={(val: any, name: any) => [
                          Number(val).toLocaleString('es-CO'),
                          String(name),
                        ]}
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Certificados" name="Certificados" stackId="a" fill="#15803d" />
                      <Bar dataKey="PorCertificar" name="Por Certificar" stackId="a" fill="#0d9488" />
                      <Bar dataKey="EnFormacion" name="Activos en Ejecución" stackId="a" fill="#39A900" />
                      <Bar dataKey="Bajas" name="Retiros y Cancelaciones" stackId="a" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* PASO 5: PANEL DE DESEMPEÑO POR PROGRAMA DE FORMACIÓN */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    05. Panel de Desempeño por Programa de Formación
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluación consolidada de cada programa de formación en todos sus indicadores operativos y de resultados de aprendices.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setProgramTableMode('COMPLETA_Y_AK')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        programTableMode === 'COMPLETA_Y_AK'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      13 Indicadores de Estado
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramTableMode('COMPACTA')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        programTableMode === 'COMPACTA'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Resumen de Tasas
                    </button>
                  </div>
                </div>
              </div>

              {/* Tarjeta Ejecutiva del Programa en Análisis */}
              {activeProgramDetail && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-3.5 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="text-sena font-semibold">Programa Inspeccionado</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Nivel: <strong className="text-slate-800">{activeProgramDetail.niveles.join(', ')}</strong> (
                          {activeProgramDetail.categoriaPrincipal === 'NO_NIVEL' ? 'No Nivel' : 'Nivel Titulado'})
                        </span>
                        {activeProgramDetail.codigosPrograma.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              Cód: {activeProgramDetail.codigosPrograma.slice(0, 3).join(', ')}
                            </span>
                          </>
                        )}
                      </div>

                      <h4 className="text-base sm:text-lg font-bold text-slate-900">
                        {activeProgramDetail.programa}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>
                          Programas Especiales:{' '}
                          <strong className="text-slate-800">
                            {activeProgramDetail.programasEspeciales.length > 0
                              ? activeProgramDetail.programasEspeciales.slice(0, 3).join(' · ') +
                                (activeProgramDetail.programasEspeciales.length > 3
                                  ? ` (+${activeProgramDetail.programasEspeciales.length - 3})`
                                  : '')
                              : 'Oferta Regular / Sin Programa Especial'}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Diagnóstico Global:{' '}
                          <strong
                            className={
                              activeProgramDetail.diagnostico === 'Óptimo'
                                ? 'text-emerald-700'
                                : activeProgramDetail.diagnostico === 'Alerta de Retención'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }
                          >
                            {activeProgramDetail.diagnostico}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {filterColG_Programa === activeProgramDetail.programa ? (
                        <button
                          type="button"
                          onClick={() => setFilterColG_Programa('TODOS')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Quitar filtro de este Programa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFilterColG_Programa(activeProgramDetail.programa)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sena hover:bg-sena-dark text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Filtrar fichas de este Programa</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 6 Indicadores de Desempeño del Programa */}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Indicador de Fichas</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 block">
                        {activeProgramDetail.fichasCount.toLocaleString('es-CO')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums block">
                        Ejec: {activeProgramDetail.enEjecucionFichas} · Abierta: {activeProgramDetail.abiertasFichas}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Ocupación de Cupo</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 block">
                        {activeProgramDetail.tasaOcupacionCupo}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums block">
                        {activeProgramDetail.totalAprendicesYtoAK.toLocaleString('es-CO')} / {activeProgramDetail.cupoTotal.toLocaleString('es-CO')} cupos
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Ejecución Activa</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-sena block">
                        {activeProgramDetail.activosEjecucion.toLocaleString('es-CO')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums block">
                        En Formación: {activeProgramDetail.colAA_formacion.toLocaleString('es-CO')}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Certificación</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-700 block">
                        {activeProgramDetail.tasaCertificacion}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums block">
                        {activeProgramDetail.colAI_certificado.toLocaleString('es-CO')} certificados
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Culminación</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-teal-700 block">
                        {activeProgramDetail.tasaCulminacion}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums block">
                        Por certificar: {activeProgramDetail.colAH_porCertificar.toLocaleString('es-CO')}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] text-slate-500 block">Retención vs Bajas</span>
                      <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 block">
                        {activeProgramDetail.tasaRetencion}%
                      </span>
                      <span className="text-[10px] text-red-700 font-mono tabular-nums font-semibold block">
                        Bajas: {activeProgramDetail.bajasTotales.toLocaleString('es-CO')} ({activeProgramDetail.tasaBajas}%)
                      </span>
                    </div>
                  </div>

                  {/* Barra de distribución proporcional de aprendices del programa */}
                  {activeProgramDetail.totalAprendicesYtoAK > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums">
                        <span>Distribución porcentual del desempeño del programa ({activeProgramDetail.totalAprendicesYtoAK.toLocaleString('es-CO')} aprendices)</span>
                        <span>
                          Certificados {activeProgramDetail.tasaCertificacion}% · Activos{' '}
                          {Math.round((activeProgramDetail.activosEjecucion / activeProgramDetail.totalAprendicesYtoAK) * 1000) / 10}% · Bajas{' '}
                          {activeProgramDetail.tasaBajas}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-700 h-full"
                          style={{
                            width: `${(activeProgramDetail.colAI_certificado / activeProgramDetail.totalAprendicesYtoAK) * 100}%`,
                          }}
                          title={`Certificados: ${activeProgramDetail.colAI_certificado}`}
                        />
                        <div
                          className="bg-teal-500 h-full"
                          style={{
                            width: `${(activeProgramDetail.colAH_porCertificar / activeProgramDetail.totalAprendicesYtoAK) * 100}%`,
                          }}
                          title={`Por Certificar: ${activeProgramDetail.colAH_porCertificar}`}
                        />
                        <div
                          className="bg-sena h-full"
                          style={{
                            width: `${(activeProgramDetail.activosEjecucion / activeProgramDetail.totalAprendicesYtoAK) * 100}%`,
                          }}
                          title={`En Ejecución: ${activeProgramDetail.activosEjecucion}`}
                        />
                        <div
                          className="bg-amber-500 h-full"
                          style={{
                            width: `${(activeProgramDetail.novedadesAcademicas / activeProgramDetail.totalAprendicesYtoAK) * 100}%`,
                          }}
                          title={`Novedades: ${activeProgramDetail.novedadesAcademicas}`}
                        />
                        <div
                          className="bg-red-600 h-full"
                          style={{
                            width: `${(activeProgramDetail.bajasTotales / activeProgramDetail.totalAprendicesYtoAK) * 100}%`,
                          }}
                          title={`Retiros y Cancelaciones: ${activeProgramDetail.bajasTotales}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Matriz de los 13 indicadores propios de este Programa */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-13 gap-2">
                    {COLUMNS_Y_TO_AK_META.map((col) => {
                      const val = activeProgramDetail[col.key];
                      const pct =
                        activeProgramDetail.totalAprendicesYtoAK > 0
                          ? Math.round((val / activeProgramDetail.totalAprendicesYtoAK) * 1000) / 10
                          : 0;
                      return (
                        <div
                          key={col.colLetter}
                          className={`p-2.5 rounded-lg border ${
                            val > 0 ? 'bg-white border-slate-200' : 'bg-white/60 border-slate-100 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span>
                              {col.group === 'ejecucion'
                                ? 'Ejec.'
                                : col.group === 'logro'
                                ? 'Logro'
                                : col.group === 'baja'
                                ? 'Baja'
                                : 'Nov.'}
                            </span>
                            <span className="tabular-nums">{pct}%</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-700 truncate mt-0.5" title={col.fullLabel}>
                            {col.shortLabel}
                          </div>
                          <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                            {val.toLocaleString('es-CO')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Controles de búsqueda y ordenamiento de la matriz de programas */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={programPanelSearch}
                    onChange={(e) => {
                      setProgramPanelSearch(e.target.value);
                      setProgramPage(1);
                    }}
                    placeholder="Buscar programa de formación o código..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sena focus:outline-none"
                  />
                  {programPanelSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setProgramPanelSearch('');
                        setProgramPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Ordenar programas por:</span>
                  <select
                    value={programSortBy}
                    onChange={(e) => {
                      setProgramSortBy(e.target.value as ProgramSortBy);
                      setProgramPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-sena focus:outline-none"
                  >
                    <option value="fichas">Mayor número de Fichas</option>
                    <option value="aprendices">Mayor volumen de Aprendices</option>
                    <option value="certificacion">Mayor % de Certificación</option>
                    <option value="retencion">Mayor % de Retención Curricular</option>
                    <option value="bajas">Mayor % de Retiros / Cancelaciones</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabla Comparativa por Programa de Formación */}
            {sortedFilteredPrograms.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No se encontraron programas de formación con el criterio ingresado.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3 min-w-[250px]">PROGRAMA DE FORMACIÓN</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">NIVEL DE FORMACIÓN</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Fichas</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Cupo</th>

                        {programTableMode === 'COMPLETA_Y_AK' ? (
                          COLUMNS_Y_TO_AK_META.map((col) => (
                            <th
                              key={col.colLetter}
                              title={col.fullLabel}
                              className="py-2.5 px-2 text-right whitespace-nowrap"
                            >
                              {col.shortLabel}
                            </th>
                          ))
                        ) : (
                          <>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Activos</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Por Cert.</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Certif.</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Bajas</th>
                          </>
                        )}

                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Aprend.</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">% Ocup.</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">% Cert.</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">% Retenc.</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedPrograms.map((p) => {
                        const isSelected = activeProgramDetail?.programa === p.programa;
                        const isFiltered = filterColG_Programa === p.programa;
                        return (
                          <tr
                            key={p.programa}
                            onClick={() => setSelectedPanelProgram(p.programa)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 line-clamp-1" title={p.programa}>
                                {p.programa}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-2">
                                <span>Cód: {p.codigosPrograma[0] || '—'}</span>
                                <span>·</span>
                                <span>Ejec: {p.enEjecucionFichas}</span>
                                <span>·</span>
                                <span>Abiertas: {p.abiertasFichas}</span>
                                {isFiltered && (
                                  <>
                                    <span>·</span>
                                    <span className="font-sans text-sena font-semibold">Filtro activo</span>
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{p.niveles.join(', ')}</div>
                              <div className="text-[10px] text-slate-500">
                                {p.categoriaPrincipal === 'NO_NIVEL' ? 'No Nivel' : 'Titulada'}
                              </div>
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                              {p.fichasCount.toLocaleString('es-CO')}
                            </td>

                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-600">
                              {p.cupoTotal.toLocaleString('es-CO')}
                            </td>

                            {programTableMode === 'COMPLETA_Y_AK' ? (
                              COLUMNS_Y_TO_AK_META.map((col) => {
                                const val = p[col.key];
                                return (
                                  <td
                                    key={col.colLetter}
                                    className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                                      val === 0
                                        ? 'text-slate-300'
                                        : col.group === 'logro'
                                        ? 'text-emerald-700 font-semibold'
                                        : col.group === 'baja'
                                        ? 'text-red-700 font-semibold'
                                        : 'text-slate-900 font-semibold'
                                    }`}
                                  >
                                    {val.toLocaleString('es-CO')}
                                  </td>
                                );
                              })
                            ) : (
                              <>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {p.activosEjecucion.toLocaleString('es-CO')}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-teal-700">
                                  {p.colAH_porCertificar.toLocaleString('es-CO')}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                                  {p.colAI_certificado.toLocaleString('es-CO')}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-red-700">
                                  {p.bajasTotales.toLocaleString('es-CO')}
                                </td>
                              </>
                            )}

                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {p.totalAprendicesYtoAK.toLocaleString('es-CO')}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-700">
                              {p.tasaOcupacionCupo}%
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                              {p.tasaCertificacion}%
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {p.tasaRetencion}%
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`text-[11px] font-semibold ${
                                  p.diagnostico === 'Óptimo'
                                    ? 'text-emerald-700'
                                    : p.diagnostico === 'Alerta de Retención'
                                    ? 'text-red-700'
                                    : p.diagnostico === 'Sin Aprendices'
                                    ? 'text-slate-400'
                                    : 'text-amber-700'
                                }`}
                              >
                                {p.diagnostico}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación de Programas */}
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                  <div className="font-mono tabular-nums">
                    Mostrando {(programPage - 1) * programPageSize + 1}–
                    {Math.min(programPage * programPageSize, sortedFilteredPrograms.length)} de{' '}
                    {sortedFilteredPrograms.length.toLocaleString('es-CO')} programas de formación
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={programPage <= 1}
                      onClick={() => setProgramPage((prev) => Math.max(1, prev - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <span className="px-3 py-1.5 font-mono tabular-nums font-semibold text-slate-800">
                      Página {programPage} / {totalProgramPages}
                    </span>
                    <button
                      type="button"
                      disabled={programPage >= totalProgramPages}
                      onClick={() => setProgramPage((prev) => Math.min(totalProgramPages, prev + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* PASO 4: INSPECTOR DE DESEMPEÑO DE LA FICHA SELECCIONADA (Detalle Individual Completo) */}
          {inspectedFicha && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-sena">
                      Análisis Individual · Ficha {inspectedFicha.ficha}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Nivel: <strong className="text-slate-800">{inspectedFicha.nivelFormacion}</strong> (
                      {inspectedFicha.categoriaColH === 'NO_NIVEL' ? 'No Nivel' : 'Nivel Titulado'})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Estado: <strong className="text-slate-800">{inspectedFicha.estadoFicha}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Respuesta: <strong className="text-slate-800">{inspectedFicha.tipoRespuesta}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Prog. Especial: <strong className="text-slate-800">{inspectedFicha.programaEspecial}</strong>
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {inspectedFicha.programa}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                    <span>Cód. Programa: {inspectedFicha.codigoPrograma || '—'} (v{inspectedFicha.versionPrograma || '1'})</span>
                    <span aria-hidden="true">·</span>
                    <span>Inicio: {inspectedFicha.fechaInicio}</span>
                    <span aria-hidden="true">·</span>
                    <span>Fin: {inspectedFicha.fechaFin}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Duración Máx: {inspectedFicha.duracionMaxima} (Lectiva: {inspectedFicha.duracionEtapaLectiva} / Prod: {inspectedFicha.duracionEtapaProductiva})
                    </span>
                    {(inspectedFicha.empresa || inspectedFicha.convenio) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">
                          Entidad/Convenio: {inspectedFicha.empresa || inspectedFicha.convenio}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Resumen de diagnóstico de la ficha */}
                <div className="flex flex-wrap items-center gap-4 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                  <div>
                    <span className="block text-[11px] text-slate-500">Cupo / Total Reportados</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                      {inspectedFicha.cupo} / {inspectedFicha.totalAprendicesYtoAK} ({inspectedFicha.tasaOcupacionCupo}%)
                    </span>
                  </div>
                  <div className="h-7 w-px bg-slate-200 hidden sm:block" />
                  <div>
                    <span className="block text-[11px] text-slate-500">Certificación / Retención</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                      {inspectedFicha.tasaCertificacion}% cert. · {inspectedFicha.tasaRetencion}% ret.
                    </span>
                  </div>
                  <div className="h-7 w-px bg-slate-200 hidden sm:block" />
                  <div>
                    <span className="block text-[11px] text-slate-500">Diagnóstico de Desempeño</span>
                    <span
                      className={`text-xs font-bold ${
                        inspectedFicha.diagnostico === 'Óptimo'
                          ? 'text-emerald-700'
                          : inspectedFicha.diagnostico === 'Alerta de Retención'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {inspectedFicha.diagnostico}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cronograma Reglamentario (Etapa Lectiva, Etapa Productiva Col N y Plazo +1 Año) y Validación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="block text-[11px] text-slate-500">Fecha Inicio Ficha</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {inspectedFicha.fechaInicio}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Cupo autorizado: {inspectedFicha.cupo} ({inspectedFicha.diferenciaCupoEstados === 0 ? 'Coincide con reportados' : `Dif: ${inspectedFicha.diferenciaCupoEstados > 0 ? '+' : ''}${inspectedFicha.diferenciaCupoEstados}`})
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/80">
                  <span className="block text-[11px] text-slate-600">
                    Fecha Final Etapa Lectiva
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {inspectedFicha.fechaFinEtapaLectiva}
                  </span>
                  <span className="block text-[10px] text-amber-800 mt-0.5">
                    {inspectedFicha.reglaEtapaLectivaLabel}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200/80">
                  <span className="block text-[11px] text-slate-600">
                    Cierre Etapa Productiva
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {inspectedFicha.fechaCierreEtapaProductiva}
                  </span>
                  <span className="block text-[10px] text-emerald-800 mt-0.5">
                    Fecha Final Ficha ({inspectedFicha.fechaFin})
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="block text-[11px] text-slate-600">
                    Plazo +1 Año Etapa Productiva
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {inspectedFicha.fechaLimitePresentacionProductiva}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    {inspectedFicha.aplicaEtapaProductiva
                      ? 'Fecha Final + 1 año reglamentario aprendiz'
                      : 'No aplica etapa productiva'}
                  </span>
                </div>
              </div>

              {/* Desglose individual exacto de estados de la ficha seleccionada */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 xl:grid-cols-13 gap-2">
                {COLUMNS_Y_TO_AK_META.map((col) => {
                  const val = inspectedFicha[col.key];
                  const pct =
                    inspectedFicha.totalAprendicesYtoAK > 0
                      ? Math.round((val / inspectedFicha.totalAprendicesYtoAK) * 100)
                      : 0;
                  return (
                    <div
                      key={col.colLetter}
                      className={`p-2.5 rounded-lg border ${
                        val > 0 ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-100 opacity-65'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>
                          {col.group === 'ejecucion'
                            ? 'Ejec.'
                            : col.group === 'logro'
                            ? 'Logro'
                            : col.group === 'baja'
                            ? 'Baja'
                            : 'Nov.'}
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-700 truncate mt-0.5" title={col.fullLabel}>
                        {col.shortLabel}
                      </div>
                      <div className="text-base font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                        {val}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* PASO 6: TABLA MAESTRA DE FICHAS Y SU DESEMPEÑO (COLUMNAS G, H, L, P, Q, R + COLUMNAS Y a AK) */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  06. Listado Maestro de Fichas y Matriz de Desempeño ({filteredFichas.length.toLocaleString('es-CO')} registros)
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccione cualquier fila para inspeccionar el expediente curricular completo y el cronograma reglamentario de la ficha.
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTableMode('COMPLETA_Y_AK')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    tableMode === 'COMPLETA_Y_AK'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Matriz Completa (13 Estados)
                </button>
                <button
                  type="button"
                  onClick={() => setTableMode('COMPACTA')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    tableMode === 'COMPACTA'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vista Ejecutiva
                </button>
              </div>
            </div>

            {filteredFichas.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  No se encontraron fichas con la combinación actual de filtros seleccionados.
                </p>
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sena text-white text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer todos los filtros</span>
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="py-2.5 px-3 whitespace-nowrap">FICHA</th>
                        <th className="py-2.5 px-3 min-w-[220px]">PROGRAMA DE FORMACIÓN</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">NIVEL DE FORMACIÓN</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">ESTADO DE FICHA</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">TIPO RESPUESTA</th>
                        <th className="py-2.5 px-3 min-w-[170px]">PROGRAMA ESPECIAL</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Cupo</th>

                        {tableMode === 'COMPLETA_Y_AK' ? (
                          COLUMNS_Y_TO_AK_META.map((col) => (
                            <th
                              key={col.colLetter}
                              title={col.fullLabel}
                              className="py-2.5 px-2 text-right whitespace-nowrap"
                            >
                              {col.shortLabel}
                            </th>
                          ))
                        ) : (
                          <>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Activos</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Por Cert.</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Certif.</th>
                            <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Bajas</th>
                          </>
                        )}

                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Aprend.</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">% Cert.</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">% Retenc.</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Desempeño</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedFichas.map((f, idx) => {
                        const isSelected = inspectedFicha?.ficha === f.ficha;
                        return (
                          <tr
                            key={`${f.ficha}-${idx}`}
                            onClick={() => setInspectedFichaCode(f.ficha)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                              {f.ficha}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 line-clamp-1" title={f.programa}>
                                {f.programa}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                Inicio: {f.fechaInicio}
                                {f.aplicaEtapaProductiva && ` · Fin Lectiva: ${f.fechaFinEtapaLectiva}`} · Fecha Final: {f.fechaFin}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">{f.nivelFormacion}</div>
                              <div className="text-[10px] text-slate-500">
                                {f.categoriaColH === 'NO_NIVEL' ? 'No Nivel' : 'Titulada'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                              {f.estadoFicha}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-700">
                              {f.tipoRespuesta}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <span className="line-clamp-1" title={f.programaEspecial}>
                                {f.programaEspecial}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-600">
                              {f.cupo}
                            </td>

                            {tableMode === 'COMPLETA_Y_AK' ? (
                              COLUMNS_Y_TO_AK_META.map((col) => {
                                const val = f[col.key];
                                return (
                                  <td
                                    key={col.colLetter}
                                    className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                                      val === 0
                                        ? 'text-slate-300'
                                        : col.group === 'logro'
                                        ? 'text-emerald-700 font-semibold'
                                        : col.group === 'baja'
                                        ? 'text-red-700 font-semibold'
                                        : 'text-slate-900 font-semibold'
                                    }`}
                                  >
                                    {val}
                                  </td>
                                );
                              })
                            ) : (
                              <>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {f.activosEjecucion}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-teal-700 font-semibold">
                                  {f.colAH_porCertificar}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                                  {f.colAI_certificado}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-red-700 font-semibold">
                                  {f.bajasTotales}
                                </td>
                              </>
                            )}

                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {f.totalAprendicesYtoAK}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                              {f.tasaCertificacion}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                              {f.tasaRetencion}%
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`text-[11px] font-semibold ${
                                  f.diagnostico === 'Óptimo'
                                    ? 'text-emerald-700'
                                    : f.diagnostico === 'Alerta de Retención'
                                    ? 'text-red-700'
                                    : f.diagnostico === 'Sin Aprendices'
                                    ? 'text-slate-400'
                                    : 'text-amber-700'
                                }`}
                              >
                                {f.diagnostico}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                  <div className="font-mono tabular-nums">
                    Mostrando {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredFichas.length)} de{' '}
                    {filteredFichas.length.toLocaleString('es-CO')} fichas
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>
                    <span className="px-3 py-1.5 font-mono tabular-nums font-semibold text-slate-800">
                      Página {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-semibold"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* VENTANA EMERGENTE DE EXPEDIENTE DE FICHA (03. INDICADORES) */}
      {activeModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/55 backdrop-blur-[1px]"
          onClick={() => setModalDecisionFichaKey(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ficha-curricular-title"
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado fijo de la ventana emergente */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/60">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-bold text-sena font-mono tabular-nums">
                    Ficha {activeModalData.f.ficha}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-bold ${
                      activeModalData.ev.prioridad === 'Crítica'
                        ? 'text-red-700'
                        : activeModalData.ev.prioridad === 'Alta'
                        ? 'text-amber-700'
                        : activeModalData.ev.prioridad === 'Media'
                        ? 'text-teal-700'
                        : 'text-slate-700'
                    }`}
                  >
                    Prioridad {activeModalData.ev.prioridad}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-800">
                    {activeModalData.ev.etapaActualLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Estado: <strong className="text-slate-900">{activeModalData.f.estadoFicha}</strong>
                  </span>
                </div>

                <h3
                  id="modal-ficha-curricular-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
                >
                  {activeModalData.f.programa}
                </h3>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    Nivel: <strong className="text-slate-800">{activeModalData.f.nivelFormacion}</strong> (
                    {activeModalData.f.categoriaColH === 'NO_NIVEL' ? 'No Nivel' : 'Titulada'})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Respuesta: <strong className="text-slate-800">{activeModalData.f.tipoRespuesta}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Programa Especial: <strong className="text-slate-800">{activeModalData.f.programaEspecial}</strong>
                  </span>
                  {activeModalData.f.codigoPrograma && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Cód: {activeModalData.f.codigoPrograma} (v{activeModalData.f.versionPrograma || '1'})
                      </span>
                    </>
                  )}
                  {(activeModalData.f.empresa || activeModalData.f.convenio) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Entidad/Convenio:{' '}
                        <strong className="text-slate-800">
                          {activeModalData.f.empresa || activeModalData.f.convenio}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalDecisionFichaKey(null)}
                aria-label="Cerrar ventana emergente"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas de navegación de la Ventana Emergente */}
            <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setModalFichaTab('RESUMEN')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    modalFichaTab === 'RESUMEN'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Resumen e Indicadores de la Ficha
                </button>
                <button
                  type="button"
                  onClick={() => setModalFichaTab('PROGRAMACION_SOFIA')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    modalFichaTab === 'PROGRAMACION_SOFIA'
                      ? 'bg-white text-sena shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span>Programación SOFIA Plus</span>
                  {fichasWithSofiaProgSet.has(activeModalData.f.ficha) && (
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">
                      · Drive
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalFichaTab('JUICIOS_EVALUATIVOS')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    modalFichaTab === 'JUICIOS_EVALUATIVOS'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Juicios Evaluativos</span>
                  {fichasWithJuiciosDriveSet.has(activeModalData.f.ficha) && (
                    <span className="text-[10px] font-mono text-teal-700 font-bold">
                      · Drive
                    </span>
                  )}
                </button>
              </div>

              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Ficha {activeModalData.f.ficha} · Inicio {activeModalData.f.fechaInicio} · Fin{' '}
                {activeModalData.f.fechaFin}
              </span>
            </div>

            {/* Cuerpo desplazable de la ventana emergente */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {modalFichaTab === 'RESUMEN' ? (
                <>
              {/* 1. FECHAS RELEVANTES Y CRONOGRAMA REGLAMENTARIO DE LA FICHA */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900">
                    Cronograma y Fechas Relevantes de la Ficha
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Fecha de referencia evaluada: {formatIsoToDisplay(activeReferenceIso)} (
                    {refDateMode === 'CORTE_DRIVE' ? 'Corte Drive' : 'Fecha actual'})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Fecha Inicio */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Fecha de Inicio
                    </span>
                    <span className="block text-sm font-extrabold font-mono tabular-nums text-slate-900">
                      {activeModalData.f.fechaInicio || 'Sin registro'}
                    </span>
                    <span className="block text-[11px] text-slate-500 font-mono tabular-nums">
                      {activeModalData.diasDesdeInicio !== null
                        ? activeModalData.diasDesdeInicio >= 0
                          ? `Inició hace ${activeModalData.diasDesdeInicio} días`
                          : `Inicia en ${Math.abs(activeModalData.diasDesdeInicio)} días`
                        : 'Duración máx: ' + (activeModalData.f.duracionMaxima || '—')}
                    </span>
                  </div>

                  {/* Fecha Fin Etapa Lectiva */}
                  <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 space-y-1">
                    <span className="block text-[11px] font-medium text-slate-600">
                      Fin Etapa Lectiva
                    </span>
                    <span className="block text-sm font-extrabold font-mono tabular-nums text-slate-900">
                      {activeModalData.f.fechaFinEtapaLectiva || 'Sin registro'}
                    </span>
                    <span
                      className={`block text-[11px] font-mono tabular-nums ${
                        activeModalData.ev.diasParaFinLectiva !== null &&
                        activeModalData.ev.diasParaFinLectiva >= 0 &&
                        activeModalData.ev.diasParaFinLectiva <= alertHorizonDays
                          ? 'text-amber-800 font-semibold'
                          : 'text-slate-600'
                      }`}
                    >
                      {activeModalData.ev.diasParaFinLectiva !== null
                        ? activeModalData.ev.diasParaFinLectiva >= 0
                          ? `Finaliza en ${activeModalData.ev.diasParaFinLectiva} días`
                          : `Finalizó hace ${Math.abs(activeModalData.ev.diasParaFinLectiva)} días`
                        : activeModalData.f.reglaEtapaLectivaLabel}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {activeModalData.f.reglaEtapaLectivaLabel}
                    </span>
                  </div>

                  {/* Fecha Final / Cierre Etapa Productiva */}
                  <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-1">
                    <span className="block text-[11px] font-medium text-slate-600">
                      {activeModalData.f.aplicaEtapaProductiva
                        ? 'Fecha Final (Cierre Productiva)'
                        : 'Fecha Final de la Ficha'}
                    </span>
                    <span className="block text-sm font-extrabold font-mono tabular-nums text-slate-900">
                      {activeModalData.f.fechaFin || 'Sin registro'}
                    </span>
                    <span
                      className={`block text-[11px] font-mono tabular-nums ${
                        activeModalData.diasDesdeFechaFin !== null && activeModalData.diasDesdeFechaFin < 0
                          ? 'text-amber-800 font-semibold'
                          : 'text-emerald-800'
                      }`}
                    >
                      {activeModalData.diasDesdeFechaFin !== null
                        ? activeModalData.diasDesdeFechaFin >= 0
                          ? `Cierra en ${activeModalData.diasDesdeFechaFin} días`
                          : `Cerró hace ${Math.abs(activeModalData.diasDesdeFechaFin)} días`
                        : 'Fecha no disponible'}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono tabular-nums">
                      Lectiva: {activeModalData.f.duracionEtapaLectiva || '0'}h · Prod:{' '}
                      {activeModalData.f.duracionEtapaProductiva || '0'}h
                    </span>
                  </div>

                  {/* Fecha Límite +1 Año Etapa Productiva */}
                  <div
                    className={`p-3.5 rounded-lg border space-y-1 ${
                      activeModalData.ev.diasParaLimite1AnioProductiva !== null &&
                      activeModalData.ev.diasParaLimite1AnioProductiva < 0
                        ? 'border-red-200 bg-red-50/50'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <span className="block text-[11px] font-medium text-slate-600">
                      Plazo Máximo (+1 Año Productiva)
                    </span>
                    <span className="block text-sm font-extrabold font-mono tabular-nums text-slate-900">
                      {activeModalData.f.aplicaEtapaProductiva
                        ? activeModalData.f.fechaLimitePresentacionProductiva
                        : 'No aplica'}
                    </span>
                    <span
                      className={`block text-[11px] font-mono tabular-nums ${
                        activeModalData.ev.diasParaLimite1AnioProductiva !== null &&
                        activeModalData.ev.diasParaLimite1AnioProductiva < 0
                          ? 'text-red-700 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {activeModalData.f.aplicaEtapaProductiva &&
                      activeModalData.ev.diasParaLimite1AnioProductiva !== null
                        ? activeModalData.ev.diasParaLimite1AnioProductiva >= 0
                          ? `Restan ${activeModalData.ev.diasParaLimite1AnioProductiva} días`
                          : `Vencido hace ${Math.abs(activeModalData.ev.diasParaLimite1AnioProductiva)} días`
                        : 'Formación sin etapa productiva'}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {activeModalData.f.aplicaEtapaProductiva
                        ? 'Fecha Final + 1 año reglamentario'
                        : 'Cierre directo en Fecha Final'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. ALERTA DE APRENDICES FUERA DE TIEMPO */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {activeModalData.totalAprendicesFueraDeTiempo > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : activeModalData.alertasFueraDeTiempo.length > 0 ? (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <h4 className="text-xs font-bold text-slate-900">
                      Alerta de Aprendices Fuera de Tiempo y Seguimiento de Plazos
                    </h4>
                  </div>

                  <span
                    className={`text-xs font-mono tabular-nums font-bold ${
                      activeModalData.totalAprendicesFueraDeTiempo > 0
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {activeModalData.totalAprendicesFueraDeTiempo > 0
                      ? `${activeModalData.totalAprendicesFueraDeTiempo.toLocaleString('es-CO')} ${
                          activeModalData.totalAprendicesFueraDeTiempo === 1
                            ? 'aprendiz fuera de tiempo'
                            : 'aprendices fuera de tiempo'
                        } (${activeModalData.pctFueraDeTiempo}%)`
                      : '0 aprendices fuera de tiempo reglamentario'}
                  </span>
                </div>

                {activeModalData.alertasFueraDeTiempo.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeModalData.alertasFueraDeTiempo.map((alerta, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-lg border space-y-1.5 ${
                          alerta.severidad === 'CRITICA'
                            ? 'border-red-200 bg-red-50/55'
                            : alerta.severidad === 'PREVENTIVA'
                            ? 'border-amber-200 bg-amber-50/55'
                            : 'border-slate-200 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold ${
                              alerta.severidad === 'CRITICA'
                                ? 'text-red-800'
                                : alerta.severidad === 'PREVENTIVA'
                                ? 'text-amber-900'
                                : 'text-slate-900'
                            }`}
                          >
                            {alerta.titulo}
                          </span>
                          <span
                            className={`text-xs font-mono tabular-nums font-extrabold ${
                              alerta.severidad === 'CRITICA'
                                ? 'text-red-700'
                                : alerta.severidad === 'PREVENTIVA'
                                ? 'text-amber-800'
                                : 'text-sena'
                            }`}
                          >
                            {alerta.cantidadAprendices.toLocaleString('es-CO')}{' '}
                            {alerta.cantidadAprendices === 1 ? 'aprendiz' : 'aprendices'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{alerta.detalle}</p>
                        <p className="text-[11px] text-slate-600">
                          <strong className="text-slate-800">Acción recomendada:</strong> {alerta.accion}
                        </p>
                      </div>
                    ))}

                    {activeModalData.nominalPendientesEvaluar > 0 && (
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 font-mono tabular-nums">
                        Cruce nominal de juicios evaluativos: se identifican{' '}
                        <strong className="text-slate-900">
                          {activeModalData.nominalPendientesEvaluar}
                        </strong>{' '}
                        aprendices con Resultados de Aprendizaje en estado POR EVALUAR en esta ficha.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs text-emerald-900">
                    Los aprendices registrados en esta ficha se encuentran dentro de los tiempos reglamentarios vigentes según la fecha de referencia seleccionada.
                  </div>
                )}
              </div>

              {/* 3. RESUMEN DE LOS ESTADOS DE LOS APRENDICES */}
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900">
                    Resumen de los Estados de los Aprendices
                  </h4>
                  <div className="text-xs text-slate-600 font-mono tabular-nums">
                    Cupo autorizado: <strong className="text-slate-900">{activeModalData.f.cupo}</strong> · Total reportados:{' '}
                    <strong className="text-slate-900">{activeModalData.f.totalAprendicesYtoAK}</strong> (
                    {activeModalData.f.tasaOcupacionCupo}% ocupación)
                  </div>
                </div>

                {/* 4 Tarjetas de Resumen Agrupado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Activos en Ejecución
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-extrabold font-mono tabular-nums text-sena">
                        {activeModalData.f.activosEjecucion}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {activeModalData.f.totalAprendicesYtoAK > 0
                          ? Math.round(
                              (activeModalData.f.activosEjecucion /
                                activeModalData.f.totalAprendicesYtoAK) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      En Formación: {activeModalData.f.colAA_formacion} · Tránsito/Ind:{' '}
                      {activeModalData.f.colY_enTransito + activeModalData.f.colZ_induccion}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Certificación y Logro
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-extrabold font-mono tabular-nums text-emerald-700">
                        {activeModalData.f.colAI_certificado + activeModalData.f.colAH_porCertificar}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-700 font-semibold">
                        {activeModalData.f.tasaCulminacion}% culm.
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      Certificados: {activeModalData.f.colAI_certificado} · Por Certificar:{' '}
                      {activeModalData.f.colAH_porCertificar}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Novedades Administrativas
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-extrabold font-mono tabular-nums text-amber-700">
                        {activeModalData.f.novedadesAcademicas}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {activeModalData.f.totalAprendicesYtoAK > 0
                          ? Math.round(
                              (activeModalData.f.novedadesAcademicas /
                                activeModalData.f.totalAprendicesYtoAK) *
                                100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      Cond.: {activeModalData.f.colAB_condicionado} · Aplaz.:{' '}
                      {activeModalData.f.colAC_aplazado} · Trasl./Otro:{' '}
                      {activeModalData.f.colAJ_trasladado + activeModalData.f.colAK_otro}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                    <span className="block text-[11px] font-medium text-slate-500">
                      Retiros y Cancelaciones
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-extrabold font-mono tabular-nums text-red-700">
                        {activeModalData.f.bajasTotales}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-red-700 font-semibold">
                        {activeModalData.f.tasaBajas}% bajas
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                      Retiro Vol.: {activeModalData.f.colAD_retiroVoluntario} · Cancel./Deserc.:{' '}
                      {activeModalData.f.colAE_cancelamientoVirtComp +
                        activeModalData.f.colAF_desercionVirtComp +
                        activeModalData.f.colAG_cancelado}
                    </p>
                  </div>
                </div>

                {/* Barra proporcional de distribución de estados */}
                {activeModalData.f.totalAprendicesYtoAK > 0 && (
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/70">
                    <div
                      className="bg-emerald-700 h-full"
                      style={{
                        width: `${
                          (activeModalData.f.colAI_certificado /
                            activeModalData.f.totalAprendicesYtoAK) *
                          100
                        }%`,
                      }}
                      title={`Certificados: ${activeModalData.f.colAI_certificado}`}
                    />
                    <div
                      className="bg-teal-500 h-full"
                      style={{
                        width: `${
                          (activeModalData.f.colAH_porCertificar /
                            activeModalData.f.totalAprendicesYtoAK) *
                          100
                        }%`,
                      }}
                      title={`Por Certificar: ${activeModalData.f.colAH_porCertificar}`}
                    />
                    <div
                      className="bg-sena h-full"
                      style={{
                        width: `${
                          (activeModalData.f.activosEjecucion /
                            activeModalData.f.totalAprendicesYtoAK) *
                          100
                        }%`,
                      }}
                      title={`Activos en Ejecución: ${activeModalData.f.activosEjecucion}`}
                    />
                    <div
                      className="bg-amber-500 h-full"
                      style={{
                        width: `${
                          (activeModalData.f.novedadesAcademicas /
                            activeModalData.f.totalAprendicesYtoAK) *
                          100
                        }%`,
                      }}
                      title={`Novedades Administrativas: ${activeModalData.f.novedadesAcademicas}`}
                    />
                    <div
                      className="bg-red-600 h-full"
                      style={{
                        width: `${
                          (activeModalData.f.bajasTotales /
                            activeModalData.f.totalAprendicesYtoAK) *
                          100
                        }%`,
                      }}
                      title={`Retiros y Cancelaciones: ${activeModalData.f.bajasTotales}`}
                    />
                  </div>
                )}

                {/* Desglose completo de los 13 estados de aprendices */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {COLUMNS_Y_TO_AK_META.map((col) => {
                    const val = activeModalData.f[col.key];
                    const pct =
                      activeModalData.f.totalAprendicesYtoAK > 0
                        ? Math.round((val / activeModalData.f.totalAprendicesYtoAK) * 1000) / 10
                        : 0;
                    return (
                      <div
                        key={col.colLetter}
                        className={`p-2.5 rounded-lg border ${
                          val > 0
                            ? 'bg-slate-50 border-slate-300'
                            : 'bg-white border-slate-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>
                            {col.group === 'ejecucion'
                              ? 'Ejec.'
                              : col.group === 'logro'
                              ? 'Logro'
                              : col.group === 'baja'
                              ? 'Baja'
                              : 'Nov.'}
                          </span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <div
                          className="text-[11px] font-semibold text-slate-800 truncate mt-0.5"
                          title={col.fullLabel}
                        >
                          {col.shortLabel}
                        </div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                          {val}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. OBSERVACIONES DE VALIDACIÓN DE DATOS (si existen) */}
              {activeModalData.ev.hallazgosValidacion.length > 0 && (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>Observaciones de Consistencia y Validación de Datos</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {activeModalData.ev.hallazgosValidacion.map((h, i) => (
                      <li key={i}>• {h}</li>
                    ))}
                  </ul>
                </div>
              )}
                </>
              ) : modalFichaTab === 'PROGRAMACION_SOFIA' ? (
                <ModalProgramacionSofiaTab
                  fichaRecord={activeModalData.f}
                  driveProgramacionFiles={driveProgramacionFiles}
                  availableFichaCodesInBoard={availableFichaCodesInBoard}
                  onDriveFilesDiscovered={(files) => setDriveProgramacionFiles(files)}
                  onOpenOtherFicha={(targetFichaCode) => {
                    const foundEv = decisionEvaluations.evaluations.find(
                      (item) => item.fichaRecord.ficha === targetFichaCode
                    );
                    if (foundEv) {
                      setInspectedFichaCode(targetFichaCode);
                      setModalDecisionFichaKey(
                        `${foundEv.fichaRecord.ficha}__${foundEv.fichaRecord.filaReporte}`
                      );
                      setModalFichaTab('PROGRAMACION_SOFIA');
                    }
                  }}
                />
              ) : (
                <ModalJuiciosEvaluativosTab
                  fichaRecord={activeModalData.f}
                  driveJuiciosFiles={driveJuiciosFiles}
                  availableFichaCodesInBoard={availableFichaCodesInBoard}
                  onDriveFilesDiscovered={(files) => setDriveJuiciosFiles(files)}
                  onOpenOtherFicha={(targetFichaCode) => {
                    const foundEv = decisionEvaluations.evaluations.find(
                      (item) => item.fichaRecord.ficha === targetFichaCode
                    );
                    if (foundEv) {
                      setInspectedFichaCode(targetFichaCode);
                      setModalDecisionFichaKey(
                        `${foundEv.fichaRecord.ficha}__${foundEv.fichaRecord.filaReporte}`
                      );
                      setModalFichaTab('JUICIOS_EVALUATIVOS');
                    }
                  }}
                />
              )}
            </div>

            {/* Pie de acciones de la ventana emergente */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Presione <span className="font-mono font-semibold text-slate-700">Esc</span> o haga clic fuera de la ventana para cerrar
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterColL_Ficha(activeModalData.f.ficha);
                    setInspectedFichaCode(activeModalData.f.ficha);
                    setModalDecisionFichaKey(null);
                  }}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Filtrar tablero por Ficha {activeModalData.f.ficha}
                </button>
                <button
                  type="button"
                  onClick={() => setModalDecisionFichaKey(null)}
                  className="px-4 py-2 rounded-lg bg-sena hover:bg-sena-dark text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cerrar ventana
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
