/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Award, 
  Users, 
  GraduationCap, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  RotateCcw, 
  Building2, 
  Layers, 
  TrendingUp, 
  CheckCircle2, 
  FileSpreadsheet, 
  Eye, 
  MapPin, 
  UserCheck, 
  Activity,
  Briefcase,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area, 
  Legend 
} from 'recharts';
import { FichaComplementaria, SofiaRow, FichaMeta } from '../types';
import { 
  fetchComplementariaFromDrive, 
  getCachedComplementaria, 
  parseComplementariaWorkbook, 
  saveCachedComplementaria, 
  clearComplementariaCache,
  SyncInfo,
  DRIVE_FOLDER_URL 
} from '../services/complementariaService';
import { InstructorCalendarScheduleView } from './InstructorCalendarScheduleView';
import { SpecialProgramsAnalysisView } from './SpecialProgramsAnalysisView';

interface AnalisisComplementariaViewProps {
  rows?: SofiaRow[];
  fichas?: { [id: string]: FichaMeta };
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FULL_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SECTOR_COLORS: { [key: string]: string } = {
  'MINERIA': '#0284c7',
  'CONSTRUCCION': '#ea580c',
  'SALUD': '#16a34a',
  'SERVICIOS': '#9333ea',
  'INDUSTRIA': '#4f46e5',
  'TRANSVERSAL': '#d97706',
  'AGROPECUARIO': '#65a30d',
  'OTRO': '#64748b'
};

export default function AnalisisComplementariaView({}: AnalisisComplementariaViewProps) {
  // Persistence state initialized from cache or PE-04 baseline
  const [fichasComp, setFichasComp] = useState<FichaComplementaria[]>(() => {
    return getCachedComplementaria().data;
  });

  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(() => {
    return getCachedComplementaria().syncInfo;
  });

  const [driveFolderInput, setDriveFolderInput] = useState<string>(DRIVE_FOLDER_URL);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'fichas' | 'instructores' | 'municipios' | 'empresas' | 'cargar'>('resumen');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNivel, setSelectedNivel] = useState('TODOS');
  const [selectedModalidad, setSelectedModalidad] = useState('TODOS');
  const [selectedSector, setSelectedSector] = useState('TODOS');
  const [selectedEstado, setSelectedEstado] = useState('TODOS');
  const [selectedInstructor, setSelectedInstructor] = useState('TODOS');
  const [selectedMunicipio, setSelectedMunicipio] = useState('TODOS');
  const [selectedEstrategia, setSelectedEstrategia] = useState('TODOS');
  const [selectedMonth, setSelectedMonth] = useState('TODOS');
  const [showInstructorMatrix, setShowInstructorMatrix] = useState(false);

  // Modal / Detail state
  const [selectedFichaDetail, setSelectedFichaDetail] = useState<FichaComplementaria | null>(null);

  // Pagination for tables
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Auto-sync from Google Drive upon opening the view
  const autoSyncDoneRef = useRef(false);

  const handleSyncFromDrive = async (silent: boolean = false, force: boolean = false, customUrl?: string) => {
    setIsSyncing(true);
    setSyncError(null);
    if (!silent) setSyncSuccessMsg(null);

    try {
      if (force) {
        clearComplementariaCache();
      }
      const urlToUse = customUrl || driveFolderInput || DRIVE_FOLDER_URL;
      const result = await fetchComplementariaFromDrive(urlToUse, force);
      setFichasComp(result.data);
      setSyncInfo(result.syncInfo);
      
      const ceCount = result.data.filter(f => (f.nivelFormacion || '').toUpperCase().includes('CURSO ESPECIAL') || (f.tipoFormacion || '').includes('Complementaria')).length;
      const evCount = result.data.filter(f => (f.nivelFormacion || '').toUpperCase().includes('EVENTO') || (f.tipoFormacion || '').includes('Evento')).length;

      setSyncSuccessMsg(`Sincronización exitosa con Google Drive: ${result.data.length.toLocaleString('es-CO')} registros PE-04 actualizados (${ceCount} Cursos Especiales y ${evCount} Eventos de Divulgación).`);
      setTimeout(() => setSyncSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error('Error sincronizando con Google Drive:', err);
      setSyncError(err?.message || 'Error al conectar con Google Drive. Se mantienen los datos en caché.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!autoSyncDoneRef.current) {
      autoSyncDoneRef.current = true;
      handleSyncFromDrive(true, false);
    }
  }, []);

  // Filter options
  const nivelesList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.nivelFormacion || f.tipoFormacion).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const modalidadesList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.modalidad || f.tipoFormacion).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const sectoresList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.lineaTematica).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const estadosList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.estadoFicha).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const instructoresList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.instructor).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const municipiosList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.municipio).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  const estrategiasList = useMemo(() => {
    const set = new Set(fichasComp.map(f => f.estrategiaEspecial).filter(Boolean));
    return ['TODOS', ...Array.from(set).sort()];
  }, [fichasComp]);

  // Filtered dataset
  const filteredFichas = useMemo(() => {
    return fichasComp.filter(f => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchFicha = f.ficha.toLowerCase().includes(query);
        const matchProg = f.programa.toLowerCase().includes(query);
        const matchInst = (f.instructor || '').toLowerCase().includes(query);
        const matchMun = (f.municipio || '').toLowerCase().includes(query);
        const matchLin = (f.lineaTematica || '').toLowerCase().includes(query);
        const matchEmp = (f.empresa || '').toLowerCase().includes(query);
        const matchEst = (f.estrategiaEspecial || '').toLowerCase().includes(query);
        if (!matchFicha && !matchProg && !matchInst && !matchMun && !matchLin && !matchEmp && !matchEst) return false;
      }

      if (selectedNivel !== 'TODOS' && (f.nivelFormacion || f.tipoFormacion) !== selectedNivel) return false;
      if (selectedModalidad !== 'TODOS' && (f.modalidad || f.tipoFormacion) !== selectedModalidad) return false;
      if (selectedSector !== 'TODOS' && f.lineaTematica !== selectedSector) return false;
      if (selectedEstado !== 'TODOS' && f.estadoFicha !== selectedEstado) return false;
      if (selectedInstructor !== 'TODOS' && f.instructor !== selectedInstructor) return false;
      if (selectedMunicipio !== 'TODOS' && f.municipio !== selectedMunicipio) return false;
      if (selectedEstrategia !== 'TODOS' && f.estrategiaEspecial !== selectedEstrategia) return false;

      if (selectedMonth !== 'TODOS' && f.fechaInicio) {
        const parts = f.fechaInicio.split('/');
        if (parts.length === 3) {
          const mIdx = parseInt(parts[1], 10) - 1;
          if (mIdx >= 0 && mIdx < 12 && MONTH_NAMES[mIdx] !== selectedMonth) return false;
        } else {
          const d = new Date(f.fechaInicio);
          if (!isNaN(d.getTime())) {
            const mIdx = d.getMonth();
            if (MONTH_NAMES[mIdx] !== selectedMonth) return false;
          }
        }
      }

      return true;
    });
  }, [
    fichasComp,
    searchTerm,
    selectedNivel,
    selectedModalidad,
    selectedSector,
    selectedEstado,
    selectedInstructor,
    selectedMunicipio,
    selectedEstrategia,
    selectedMonth
  ]);

  // Key performance indicators
  const kpis = useMemo(() => {
    const totalFichas = filteredFichas.length;
    let cuposProgramados = 0;
    let matriculados = 0;
    let masculinos = 0;
    let femeninos = 0;
    let noBinario = 0;
    let activos = 0;
    let certificados = 0;
    let enFormacion = 0;
    let porCertificar = 0;
    let desertores = 0;
    let cancelados = 0;
    let retiroVoluntario = 0;
    let totalHorasHombre = 0;
    let totalHorasFormacion = 0;

    filteredFichas.forEach(f => {
      cuposProgramados += f.cuposProgramados || 0;
      matriculados += f.matriculados || 0;
      masculinos += f.masculinos || 0;
      femeninos += f.femeninos || 0;
      noBinario += f.noBinario || 0;
      activos += f.activos || 0;
      certificados += f.certificados || 0;
      enFormacion += f.enFormacion || 0;
      porCertificar += f.porCertificar || 0;
      desertores += f.desertores || 0;
      cancelados += f.cancelados || 0;
      retiroVoluntario += f.retiroVoluntario || 0;
      totalHorasHombre += (f.duracionHoras || 0) * (f.matriculados || 0);
      totalHorasFormacion += f.horasTotales || f.duracionHoras || 0;
    });

    const totalDesercion = desertores + cancelados + retiroVoluntario;
    const tasaCertificacion = matriculados > 0 ? Math.round((certificados / matriculados) * 100) : 0;
    const tasaDesercion = matriculados > 0 ? Math.round((totalDesercion / matriculados) * 100) : 0;
    const tasaOcupacion = cuposProgramados > 0 ? Math.round((matriculados / cuposProgramados) * 100) : 0;

    return {
      totalFichas,
      cuposProgramados,
      matriculados,
      masculinos,
      femeninos,
      noBinario,
      activos,
      certificados,
      enFormacion,
      porCertificar,
      totalDesercion,
      totalHorasHombre,
      totalHorasFormacion,
      tasaCertificacion,
      tasaDesercion,
      tasaOcupacion
    };
  }, [filteredFichas]);

  // Detailed Breakdown by Nivel Formacion (CURSO ESPECIAL vs EVENTO)
  const nivelBreakdown = useMemo(() => {
    const ce = {
      fichas: 0,
      matriculados: 0,
      masculinos: 0,
      femeninos: 0,
      activos: 0,
      certificados: 0,
      enFormacion: 0,
      desertores: 0,
      totalHoras: 0,
      horasHombre: 0,
      duracionPromedio: 0
    };

    const ev = {
      fichas: 0,
      matriculados: 0,
      masculinos: 0,
      femeninos: 0,
      activos: 0,
      certificados: 0,
      enFormacion: 0,
      desertores: 0,
      totalHoras: 0,
      horasHombre: 0,
      duracionPromedio: 0
    };

    filteredFichas.forEach(f => {
      const niv = (f.nivelFormacion || '').toUpperCase();
      const isEvento = niv.includes('EVENTO') || (f.tipoFormacion || '').includes('Evento');
      const target = isEvento ? ev : ce;

      target.fichas += 1;
      target.matriculados += f.matriculados || 0;
      target.masculinos += f.masculinos || 0;
      target.femeninos += f.femeninos || 0;
      target.activos += f.activos || 0;
      target.certificados += f.certificados || 0;
      target.enFormacion += f.enFormacion || 0;
      target.desertores += f.desertores || 0;
      target.totalHoras += f.horasTotales || f.duracionHoras || 0;
      target.horasHombre += (f.duracionHoras || 0) * (f.matriculados || 0);
    });

    ce.duracionPromedio = ce.fichas > 0 ? Math.round(ce.totalHoras / ce.fichas) : 0;
    ev.duracionPromedio = ev.fichas > 0 ? Math.round(ev.totalHoras / ev.fichas) : 0;

    const totalMat = (ce.matriculados + ev.matriculados) || 1;
    const ceShare = Math.round((ce.matriculados / totalMat) * 100);
    const evShare = Math.round((ev.matriculados / totalMat) * 100);

    return {
      cursoEspecial: {
        ...ce,
        share: ceShare,
        tasaCert: ce.matriculados > 0 ? Math.round((ce.certificados / ce.matriculados) * 100) : 0
      },
      evento: {
        ...ev,
        share: evShare,
        tasaCert: ev.matriculados > 0 ? Math.round((ev.certificados / ev.matriculados) * 100) : 0
      }
    };
  }, [filteredFichas]);

  // Chart Data: Sectores / Líneas Temáticas
  const sectorData = useMemo(() => {
    const map: { [key: string]: { name: string; matriculados: number; fichas: number; certificados: number } } = {};
    filteredFichas.forEach(f => {
      const sec = f.lineaTematica || 'OTRO';
      if (!map[sec]) {
        map[sec] = { name: sec, matriculados: 0, fichas: 0, certificados: 0 };
      }
      map[sec].matriculados += f.matriculados || 0;
      map[sec].fichas += 1;
      map[sec].certificados += f.certificados || 0;
    });
    return Object.values(map).sort((a, b) => b.matriculados - a.matriculados);
  }, [filteredFichas]);

  // Chart Data: Modalidad
  const modalidadData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredFichas.forEach(f => {
      const mod = f.modalidad || f.tipoFormacion || 'PRESENCIAL';
      map[mod] = (map[mod] || 0) + (f.matriculados || 0);
    });
    const colors = ['#0284c7', '#16a34a', '#d97706', '#9333ea', '#ea580c'];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  }, [filteredFichas]);

  // Chart Data: Top Municipios
  const topMunicipiosData = useMemo(() => {
    const map: { [key: string]: { name: string; matriculados: number; fichas: number } } = {};
    filteredFichas.forEach(f => {
      const mun = f.municipio || 'SOGAMOSO';
      if (!map[mun]) {
        map[mun] = { name: mun, matriculados: 0, fichas: 0 };
      }
      map[mun].matriculados += f.matriculados || 0;
      map[mun].fichas += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.matriculados - a.matriculados)
      .slice(0, 8);
  }, [filteredFichas]);

  // Chart Data: Evolución Mensual
  const monthlyData = useMemo(() => {
    const months = MONTH_NAMES.map(m => ({ month: m, matriculados: 0, certificados: 0, fichas: 0 }));
    filteredFichas.forEach(f => {
      let mIdx = -1;
      if (f.fechaInicio) {
        const parts = f.fechaInicio.split('/');
        if (parts.length === 3) {
          mIdx = parseInt(parts[1], 10) - 1;
        } else {
          const d = new Date(f.fechaInicio);
          if (!isNaN(d.getTime())) mIdx = d.getMonth();
        }
      }
      if (mIdx >= 0 && mIdx < 12) {
        months[mIdx].matriculados += f.matriculados || 0;
        months[mIdx].certificados += f.certificados || 0;
        months[mIdx].fichas += 1;
      }
    });
    return months;
  }, [filteredFichas]);

  // Chart Data: Fichas Creadas por Mes (Detallado con Cursos Especiales vs Eventos e Instructores)
  const monthlyFichasDetailedData = useMemo(() => {
    const months = MONTH_NAMES.map((m, idx) => ({
      index: idx,
      month: m,
      fullMonth: FULL_MONTH_NAMES[idx],
      fichas: 0,
      cursosEspeciales: 0,
      eventos: 0,
      matriculados: 0,
      certificados: 0,
      activos: 0,
      horasTotales: 0,
      horasHombre: 0,
      instructores: new Set<string>()
    }));

    filteredFichas.forEach(f => {
      let mIdx = -1;
      if (f.fechaInicio) {
        const parts = f.fechaInicio.split('/');
        if (parts.length === 3) {
          mIdx = parseInt(parts[1], 10) - 1;
        } else {
          const d = new Date(f.fechaInicio);
          if (!isNaN(d.getTime())) mIdx = d.getMonth();
        }
      }
      if (mIdx >= 0 && mIdx < 12) {
        const niv = (f.nivelFormacion || '').toUpperCase();
        const isEvento = niv.includes('EVENTO') || (f.tipoFormacion || '').includes('Evento');

        months[mIdx].fichas += 1;
        if (isEvento) {
          months[mIdx].eventos += 1;
        } else {
          months[mIdx].cursosEspeciales += 1;
        }

        months[mIdx].matriculados += f.matriculados || 0;
        months[mIdx].certificados += f.certificados || 0;
        months[mIdx].activos += f.activos || 0;
        months[mIdx].horasTotales += f.horasTotales || f.duracionHoras || 0;
        months[mIdx].horasHombre += (f.duracionHoras || 0) * (f.matriculados || 0);
        if (f.instructor) {
          months[mIdx].instructores.add(f.instructor);
        }
      }
    });

    const totalFichas = months.reduce((acc, m) => acc + m.fichas, 0);
    const totalMatriculados = months.reduce((acc, m) => acc + m.matriculados, 0);
    const totalHoras = months.reduce((acc, m) => acc + m.horasTotales, 0);
    const monthsWithFichas = months.filter(m => m.fichas > 0).length || 1;
    const avgFichas = Math.round(totalFichas / monthsWithFichas);
    const peakMonth = [...months].sort((a, b) => b.fichas - a.fichas)[0];

    return {
      months,
      totalFichas,
      totalMatriculados,
      totalHoras,
      avgFichas,
      peakMonth: peakMonth && peakMonth.fichas > 0 ? peakMonth : null
    };
  }, [filteredFichas]);

  // Matrix of Instructors and their Monthly Fichas Creation
  const instructorMonthlyMatrix = useMemo(() => {
    const map: { [instructor: string]: { instructor: string; totalFichas: number; monthly: number[]; cursosEspeciales: number; eventos: number; matriculados: number } } = {};
    
    fichasComp.forEach(f => {
      if (selectedNivel !== 'TODOS' && (f.nivelFormacion || f.tipoFormacion) !== selectedNivel) return;
      if (selectedSector !== 'TODOS' && f.lineaTematica !== selectedSector) return;
      if (selectedModalidad !== 'TODOS' && (f.modalidad || f.tipoFormacion) !== selectedModalidad) return;

      const inst = f.instructor || 'POR ASIGNAR';
      if (!map[inst]) {
        map[inst] = {
          instructor: inst,
          totalFichas: 0,
          monthly: new Array(12).fill(0),
          cursosEspeciales: 0,
          eventos: 0,
          matriculados: 0
        };
      }
      
      let mIdx = -1;
      if (f.fechaInicio) {
        const parts = f.fechaInicio.split('/');
        if (parts.length === 3) {
          mIdx = parseInt(parts[1], 10) - 1;
        } else {
          const d = new Date(f.fechaInicio);
          if (!isNaN(d.getTime())) mIdx = d.getMonth();
        }
      }

      map[inst].totalFichas += 1;
      map[inst].matriculados += f.matriculados || 0;
      const niv = (f.nivelFormacion || '').toUpperCase();
      if (niv.includes('EVENTO') || (f.tipoFormacion || '').includes('Evento')) {
        map[inst].eventos += 1;
      } else {
        map[inst].cursosEspeciales += 1;
      }

      if (mIdx >= 0 && mIdx < 12) {
        map[inst].monthly[mIdx] += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.totalFichas - a.totalFichas);
  }, [fichasComp, selectedNivel, selectedSector, selectedModalidad]);

  // Instructor Performance
  const instructorStats = useMemo(() => {
    const map: { [key: string]: {
      instructor: string;
      fichas: number;
      matriculados: number;
      certificados: number;
      activos: number;
      horasHombre: number;
      horasDocente: number;
      sectores: Set<string>;
      municipios: Set<string>;
    } } = {};

    filteredFichas.forEach(f => {
      const inst = f.instructor || 'POR ASIGNAR';
      if (!map[inst]) {
        map[inst] = {
          instructor: inst,
          fichas: 0,
          matriculados: 0,
          certificados: 0,
          activos: 0,
          horasHombre: 0,
          horasDocente: 0,
          sectores: new Set(),
          municipios: new Set()
        };
      }
      map[inst].fichas += 1;
      map[inst].matriculados += f.matriculados || 0;
      map[inst].certificados += f.certificados || 0;
      map[inst].activos += f.activos || 0;
      map[inst].horasHombre += (f.duracionHoras || 0) * (f.matriculados || 0);
      map[inst].horasDocente += f.horasTotales || f.duracionHoras || 0;
      if (f.lineaTematica) map[inst].sectores.add(f.lineaTematica);
      if (f.municipio) map[inst].municipios.add(f.municipio);
    });

    return Object.values(map).sort((a, b) => b.matriculados - a.matriculados);
  }, [filteredFichas]);

  // Municipio Stats
  const municipioStats = useMemo(() => {
    const map: { [key: string]: {
      municipio: string;
      departamento: string;
      fichas: number;
      matriculados: number;
      certificados: number;
      activos: number;
      horasHombre: number;
      empresas: Set<string>;
    } } = {};

    filteredFichas.forEach(f => {
      const mun = f.municipio || 'SOGAMOSO';
      if (!map[mun]) {
        map[mun] = {
          municipio: mun,
          departamento: f.departamento || 'BOYACÁ',
          fichas: 0,
          matriculados: 0,
          certificados: 0,
          activos: 0,
          horasHombre: 0,
          empresas: new Set()
        };
      }
      map[mun].fichas += 1;
      map[mun].matriculados += f.matriculados || 0;
      map[mun].certificados += f.certificados || 0;
      map[mun].activos += f.activos || 0;
      map[mun].horasHombre += (f.duracionHoras || 0) * (f.matriculados || 0);
      if (f.empresa) map[mun].empresas.add(f.empresa);
    });

    return Object.values(map).sort((a, b) => b.matriculados - a.matriculados);
  }, [filteredFichas]);

  // Empresas & Programas Especiales Stats
  const empresaStats = useMemo(() => {
    const map: { [key: string]: {
      empresa: string;
      fichas: number;
      matriculados: number;
      certificados: number;
      programas: Set<string>;
      estrategias: Set<string>;
    } } = {};

    filteredFichas.forEach(f => {
      const emp = f.empresa || 'CONVOCATORIA ABIERTA';
      if (!map[emp]) {
        map[emp] = {
          empresa: emp,
          fichas: 0,
          matriculados: 0,
          certificados: 0,
          programas: new Set(),
          estrategias: new Set()
        };
      }
      map[emp].fichas += 1;
      map[emp].matriculados += f.matriculados || 0;
      map[emp].certificados += f.certificados || 0;
      if (f.programa) map[emp].programas.add(f.programa);
      if (f.estrategiaEspecial) map[emp].estrategias.add(f.estrategiaEspecial);
    });

    return Object.values(map).sort((a, b) => b.matriculados - a.matriculados);
  }, [filteredFichas]);

  // Estrategias Especiales Stats (Campesena, Alianzas, etc.)
  const estrategiaStats = useMemo(() => {
    const map: { [key: string]: { estrategia: string; fichas: number; matriculados: number; certificados: number } } = {};
    filteredFichas.forEach(f => {
      const est = f.estrategiaEspecial || 'REGULAR';
      if (!map[est]) {
        map[est] = { estrategia: est, fichas: 0, matriculados: 0, certificados: 0 };
      }
      map[est].fichas += 1;
      map[est].matriculados += f.matriculados || 0;
      map[est].certificados += f.certificados || 0;
    });
    return Object.values(map).sort((a, b) => b.matriculados - a.matriculados);
  }, [filteredFichas]);

  // Paginated fichas list
  const totalPages = Math.ceil(filteredFichas.length / pageSize);
  const paginatedFichas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFichas.slice(start, start + pageSize);
  }, [filteredFichas, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedNivel, selectedModalidad, selectedSector, selectedEstado, selectedInstructor, selectedMunicipio, selectedEstrategia, selectedMonth]);

  // Manual File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const parsed = parseComplementariaWorkbook(wb, file.name);

        const newSyncInfo: SyncInfo = {
          source: `Archivo Local: ${file.name}`,
          syncDate: new Date().toLocaleString('es-CO'),
          totalRecords: parsed.length,
          fileName: file.name,
          status: 'local'
        };

        setFichasComp(parsed);
        setSyncInfo(newSyncInfo);
        saveCachedComplementaria(parsed, newSyncInfo);
        setSyncSuccessMsg(`Archivo "${file.name}" procesado exitosamente (${parsed.length} registros).`);
        setTimeout(() => setSyncSuccessMsg(null), 5000);
        setActiveSubTab('resumen');
      } catch (err: any) {
        console.error('Error al procesar archivo:', err);
        setSyncError(err?.message || 'Error al procesar el archivo Excel. Verifique la estructura.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = filteredFichas.map(f => ({
      'Ficha': f.ficha,
      'Código Ficha': f.codigoFicha || f.ficha,
      'Programa de Formación': f.programa,
      'Código Programa': f.codigoPrograma || '',
      'Versión': f.versionPrograma || 1,
      'Nivel de Formación': f.nivelFormacion || f.tipoFormacion,
      'Modalidad': f.modalidad || 'PRESENCIAL',
      'Jornada': f.jornada || 'MIXTA',
      'Sector / Línea': f.lineaTematica,
      'Estado': f.estadoFicha,
      'Fecha Inicio': f.fechaInicio,
      'Fecha Fin': f.fechaFin,
      'Duración (Horas)': f.duracionHoras,
      'Horas Totales': f.horasTotales || f.duracionHoras,
      'Municipio': f.municipio,
      'Departamento': f.departamento || 'BOYACÁ',
      'Centro': f.centro || 'CENTRO MINERO',
      'Instructor': f.instructor,
      'Empresa': f.empresa || '',
      'Estrategia Especial': f.estrategiaEspecial || '',
      'Total Aprendices': f.matriculados,
      'Masculinos': f.masculinos || 0,
      'Femeninos': f.femeninos || 0,
      'No Binario': f.noBinario || 0,
      'Activos': f.activos || 0,
      'Certificados': f.certificados,
      'En Formación': f.enFormacion,
      'Desertores': f.desertores,
      'Horas Hombre': (f.duracionHoras || 0) * (f.matriculados || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formación Complementaria');
    XLSX.writeFile(wb, `Reporte_Complementaria_CentroMinero_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Download template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'IDENTIFICADOR_FICHA': 3437899,
        'NOMBRE_PROGRAMA_FORMACION': 'APLICACION DEL REGLAMENTO DE HIGIENE Y SEGURIDAD EN LABORES MINERAS',
        'NIVEL_FORMACION': 'CURSO ESPECIAL',
        'MODALIDAD_FORMACION': 'PRESENCIAL',
        'NOMBRE_JORNADA': 'MIXTA',
        'NOMBRE_RESPONSABLE': 'JAVIER RIOS CHAPARRO',
        'NOMBRE_EMPRESA': 'AGREGADOS DE ORIENTE SAS',
        'NOMBRE_NUEVO_SECTOR': 'MINERIA',
        'NOMBRE_MUNICIPIO_CURSO': 'SOGAMOSO',
        'NOMBRE_DEPARTAMENTO_CURSO': 'BOYACÁ',
        'NOMBRE_PROGRAMA_ESPECIAL': 'ALIANZAS ESTRATEGICAS',
        'TOTAL_APRENDICES': 25,
        'TOTAL_APRENDICES_MASCULINOS': 18,
        'TOTAL_APRENDICES_FEMENINOS': 7,
        'TOTAL_APRENDICES_ACTIVOS': 23,
        'DURACION_PROGRAMA': 48,
        'ESTADO_CURSO': 'Terminada',
        'FECHA_INICIO_FICHA': '02/03/2026',
        'FECHA_TERMINACION_FICHA': '06/03/2026'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_PE04');
    XLSX.writeFile(wb, 'Plantilla_Formacion_Complementaria_PE04.xlsx');
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedNivel('TODOS');
    setSelectedModalidad('TODOS');
    setSelectedSector('TODOS');
    setSelectedEstado('TODOS');
    setSelectedInstructor('TODOS');
    setSelectedMunicipio('TODOS');
    setSelectedEstrategia('TODOS');
    setSelectedMonth('TODOS');
  };

  return (
    <div id="analisis-complementaria-container" className="space-y-6">
      
      {/* Header Banner & Title */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Análisis Formación Complementaria
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PE-04 Centro Minero
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Monitoreo integral de cursos especiales, eventos y formación complementaria. Sincronización automática de reporte PE-04 desde Google Drive.
              </p>
            </div>
          </div>

          {/* Action buttons & Drive Sync */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-sync-drive"
              onClick={() => handleSyncFromDrive(false)}
              disabled={isSyncing}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-all shadow-xs ${
                isSyncing 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
              title="Sincronizar archivo PE-04 directamente desde la carpeta de Google Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando con Drive...' : 'Sincronizar con Drive'}
            </button>

            <button
              id="btn-tab-cargar"
              onClick={() => setActiveSubTab('cargar')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-all ${
                activeSubTab === 'cargar'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              Cargar Archivo
            </button>

            <button
              id="btn-export-excel"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600" />
              Exportar
            </button>
          </div>
        </div>

        {/* Live Drive Sync Info Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-600 bg-slate-50/80 rounded-lg p-3 border">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-700">Fuente:</span>
            <span className="text-slate-600 truncate max-w-xs md:max-w-md">
              {syncInfo?.source || 'Google Drive (PE-04 Centro Minero)'}
            </span>
            {syncInfo?.fileName && (
              <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-mono text-[11px]">
                {syncInfo.fileName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-500">
              Última actualización: <strong className="text-slate-700">{syncInfo?.syncDate || 'Hoy'}</strong>
            </span>
            <span className="text-slate-500">
              Registros: <strong className="text-emerald-700">{fichasComp.length.toLocaleString('es-CO')}</strong>
            </span>
            <a 
              href={DRIVE_FOLDER_URL}
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium underline"
            >
              Carpeta Drive <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Success / Error Messages */}
        {syncSuccessMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button 
              onClick={() => handleSyncFromDrive(false)}
              className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          id="subtab-resumen"
          onClick={() => setActiveSubTab('resumen')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'resumen'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Dashboard & KPIs
        </button>

        <button
          id="subtab-fichas"
          onClick={() => setActiveSubTab('fichas')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'fichas'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Cursos y Fichas ({filteredFichas.length})
        </button>

        <button
          id="subtab-instructores"
          onClick={() => setActiveSubTab('instructores')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'instructores'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Instructores ({instructorStats.length})
        </button>

        <button
          id="subtab-municipios"
          onClick={() => setActiveSubTab('municipios')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'municipios'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Cobertura Territorial ({municipioStats.length})
        </button>

        <button
          id="subtab-empresas"
          onClick={() => setActiveSubTab('empresas')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'empresas'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Empresas & Estrategias ({empresaStats.length})
        </button>

        <button
          id="subtab-cargar"
          onClick={() => setActiveSubTab('cargar')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ml-auto ${
            activeSubTab === 'cargar'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-dashed border-slate-300'
          }`}
        >
          <Upload className="w-4 h-4" />
          Cargar Archivo Excel
        </button>
      </div>

      {/* VIEW: CARGAR ARCHIVO */}
      {activeSubTab === 'cargar' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                Cargar Archivo de Formación Complementaria (Excel / XML / CSV)
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Cargue reportes manuales en formato PE-04 u hojas de cálculo con datos de cursos especiales y formación complementaria.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Plantilla PE-04
              </button>
              <button
                onClick={() => handleSyncFromDrive(false)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sincronizar desde Drive
              </button>
            </div>
          </div>

          {/* Dropzone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-200 hover:border-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Haga clic o arrastre su archivo Excel aquí
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Formatos soportados: .xlsx, .xls, .xml (SpreadsheetML), .csv
              </p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx,.xls,.xml,.csv" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button 
              type="button" 
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              Seleccionar Archivo
            </button>
          </div>

          {/* Explanatory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Sincronización con Drive
              </h4>
              <p className="text-xs text-slate-600">
                La aplicación descarga y analiza automáticamente el archivo <code>PE-04_1.xml</code> alojado en la carpeta de Google Drive configurada.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                Compatibilidad Estructura
              </h4>
              <p className="text-xs text-slate-600">
                Soporta campos estándar de SOFIA Plus / PE-04: Identificador Ficha, Nombre Programa, Nivel, Modalidad, Responsable, Horas, Aprendices y Municipio.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Persistencia Local
              </h4>
              <p className="text-xs text-slate-600">
                Los datos cargados se mantienen guardados de forma segura en su navegador para acceso inmediato y consultas sin recargar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FILTER BAR (Visible for all analytical tabs) */}
      {activeSubTab !== 'cargar' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="search-complementaria"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ficha, programa, instructor, municipio, empresa o estrategia..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick reset button */}
            <button
              id="btn-reset-filters"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar Filtros
            </button>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 pt-1">
            {/* Nivel */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nivel Formación (Col. I)</label>
              <select
                id="filter-nivel"
                value={selectedNivel}
                onChange={(e) => setSelectedNivel(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700 font-medium"
              >
                {nivelesList.map(n => {
                  let label = n;
                  if (n === 'TODOS') label = 'Todos (Cursos y Eventos)';
                  else if (n === 'CURSO ESPECIAL') label = 'CURSO ESPECIAL (Formación Complementaria)';
                  else if (n === 'EVENTO') label = 'EVENTO (Evento de Divulgación)';
                  return <option key={n} value={n}>{label}</option>;
                })}
              </select>
            </div>

            {/* Modalidad */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Modalidad</label>
              <select
                id="filter-modalidad"
                value={selectedModalidad}
                onChange={(e) => setSelectedModalidad(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {modalidadesList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Sector / Línea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sector / Línea</label>
              <select
                id="filter-sector"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {sectoresList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado Curso</label>
              <select
                id="filter-estado"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {estadosList.map(est => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>

            {/* Municipio */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Municipio</label>
              <select
                id="filter-municipio"
                value={selectedMunicipio}
                onChange={(e) => setSelectedMunicipio(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {municipiosList.map(mun => (
                  <option key={mun} value={mun}>{mun}</option>
                ))}
              </select>
            </div>

            {/* Instructor */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Instructor / Responsable</label>
              <select
                id="filter-instructor"
                value={selectedInstructor}
                onChange={(e) => setSelectedInstructor(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {instructoresList.map(inst => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>

            {/* Estrategia Especial */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estrategia / Convenio</label>
              <select
                id="filter-estrategia"
                value={selectedEstrategia}
                onChange={(e) => setSelectedEstrategia(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
              >
                {estrategiasList.map(est => (
                  <option key={est} value={est}>{est || 'Ninguno'}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DASHBOARD & KPIS */}
      {activeSubTab === 'resumen' && (
        <div className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Cursos / Fichas */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cursos / Fichas</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">
                  {kpis.totalFichas.toLocaleString('es-CO')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Horas totales: <span className="font-semibold text-slate-700">{kpis.totalHorasFormacion.toLocaleString('es-CO')} hrs</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center border border-sky-100">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Total Aprendices Matriculados */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aprendices Matriculados</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">
                  {kpis.matriculados.toLocaleString('es-CO')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Género: <span className="font-semibold text-slate-700">M: {kpis.masculinos} | F: {kpis.femeninos}</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Aprendices Certificados */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aprendices Certificados</p>
                <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                  {kpis.certificados.toLocaleString('es-CO')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tasa certificación: <span className="font-semibold text-emerald-600">{kpis.tasaCertificacion}%</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Horas Hombre Impartidas */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Horas / Hombre</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">
                  {kpis.totalHorasHombre.toLocaleString('es-CO')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Eficacia cupos: <span className="font-semibold text-slate-700">{kpis.tasaOcupacion}%</span>
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* DASHBOARD PRINCIPAL: CURSO ESPECIAL (= Formación Complementaria) vs EVENTO (= Evento de Divulgación) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-wide uppercase text-white">
                    Dashboard Oficial por Nivel de Formación (Columna I)
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Datos consolidados de <strong className="text-emerald-300">CURSO ESPECIAL (Formación Complementaria)</strong> y <strong className="text-sky-300">EVENTO (Evento de Divulgación)</strong> sincronizados de PE-04.
                </p>
              </div>

              {/* Quick toggle chips */}
              <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setSelectedNivel('TODOS')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    selectedNivel === 'TODOS'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Todos ({kpis.totalFichas})
                </button>
                <button
                  onClick={() => setSelectedNivel('CURSO ESPECIAL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    selectedNivel === 'CURSO ESPECIAL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-emerald-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Cursos Especiales ({nivelBreakdown.cursoEspecial.fichas})
                </button>
                <button
                  onClick={() => setSelectedNivel('EVENTO')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    selectedNivel === 'EVENTO'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-sky-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  Eventos ({nivelBreakdown.evento.fichas})
                </button>
              </div>
            </div>

            {/* Side-by-side Dual Category Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* PANEL 1: CURSO ESPECIAL (Formación Complementaria) */}
              <div className={`p-5 transition-colors ${selectedNivel === 'CURSO ESPECIAL' ? 'bg-emerald-50/40' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shadow-xs border border-emerald-200">
                      CE
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-800">
                          CURSO ESPECIAL
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Formación Complementaria
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cursos de capacitación laboral, actualización técnica y certificación
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedNivel(selectedNivel === 'CURSO ESPECIAL' ? 'TODOS' : 'CURSO ESPECIAL')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                      selectedNivel === 'CURSO ESPECIAL'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {selectedNivel === 'CURSO ESPECIAL' ? 'Filtro Activo' : 'Ver solo Cursos'}
                  </button>
                </div>

                {/* Metrics Grid CE */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Cursos / Fichas</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {nivelBreakdown.cursoEspecial.fichas.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Math.round((nivelBreakdown.cursoEspecial.fichas / (kpis.totalFichas || 1)) * 100)}% del total
                    </p>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                    <p className="text-[11px] font-semibold uppercase text-emerald-700">Matriculados</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">
                      {nivelBreakdown.cursoEspecial.matriculados.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {nivelBreakdown.cursoEspecial.share}% matrícula
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Horas Totales</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {nivelBreakdown.cursoEspecial.totalHoras.toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-500">hrs</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Prom: {nivelBreakdown.cursoEspecial.duracionPromedio} hrs/curso
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Aprendices Certificados</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.cursoEspecial.certificados.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {nivelBreakdown.cursoEspecial.tasaCert}% certificación
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Género (M / F)</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.cursoEspecial.masculinos} / {nivelBreakdown.cursoEspecial.femeninos}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Hombres {Math.round((nivelBreakdown.cursoEspecial.masculinos / (nivelBreakdown.cursoEspecial.matriculados || 1)) * 100)}%
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Horas / Hombre</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.cursoEspecial.horasHombre.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Impacto pedagógico
                    </p>
                  </div>
                </div>

                {/* Progress bar ratio CE */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Participación en Matrícula Total</span>
                    <span className="font-bold text-emerald-700">{nivelBreakdown.cursoEspecial.share}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${nivelBreakdown.cursoEspecial.share}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* PANEL 2: EVENTO (Evento de Divulgación) */}
              <div className={`p-5 transition-colors ${selectedNivel === 'EVENTO' ? 'bg-sky-50/40' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm shadow-xs border border-sky-200">
                      ED
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-800">
                          EVENTO
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          Evento de Divulgación
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Jornadas técnicas, talleres especializados y conferencias tecnológicas
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedNivel(selectedNivel === 'EVENTO' ? 'TODOS' : 'EVENTO')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
                      selectedNivel === 'EVENTO'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-sky-50 hover:text-sky-700'
                    }`}
                  >
                    {selectedNivel === 'EVENTO' ? 'Filtro Activo' : 'Ver solo Eventos'}
                  </button>
                </div>

                {/* Metrics Grid Eventos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Eventos / Fichas</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {nivelBreakdown.evento.fichas.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Math.round((nivelBreakdown.evento.fichas / (kpis.totalFichas || 1)) * 100)}% del total
                    </p>
                  </div>

                  <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200/80">
                    <p className="text-[11px] font-semibold uppercase text-sky-700">Participantes</p>
                    <p className="text-xl font-bold text-sky-800 mt-1">
                      {nivelBreakdown.evento.matriculados.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-sky-600 mt-0.5">
                      {nivelBreakdown.evento.share}% participación
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Horas Totales</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {nivelBreakdown.evento.totalHoras.toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-500">hrs</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Prom: {nivelBreakdown.evento.duracionPromedio} hrs/evento
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Asistentes Certificados</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.evento.certificados.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-sky-600 mt-0.5">
                      {nivelBreakdown.evento.tasaCert}% certificación
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Género (M / F)</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.evento.masculinos} / {nivelBreakdown.evento.femeninos}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Mujeres {Math.round((nivelBreakdown.evento.femeninos / (nivelBreakdown.evento.matriculados || 1)) * 100)}%
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Horas / Asistente</p>
                    <p className="text-lg font-bold text-slate-800 mt-1">
                      {nivelBreakdown.evento.horasHombre.toLocaleString('es-CO')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Cobertura y difusión
                    </p>
                  </div>
                </div>

                {/* Progress bar ratio Eventos */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Participación en Matrícula Total</span>
                    <span className="font-bold text-sky-700">{nivelBreakdown.evento.share}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${nivelBreakdown.evento.share}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CHARTS ROW 1: Sectores & Modalidades */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Distribución por Sector */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Matrícula por Sector / Línea Temática
                </h3>
                <span className="text-xs text-slate-400">{sectorData.length} sectores</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorData.slice(0, 7)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      angle={-25} 
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip 
                      formatter={(val: any) => [Number(val).toLocaleString('es-CO') + ' aprendices', 'Matriculados']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="matriculados" radius={[4, 4, 0, 0]}>
                      {sectorData.slice(0, 7).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SECTOR_COLORS[entry.name] || '#0284c7'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Distribución por Modalidad */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Modalidad de Formación
                </h3>
              </div>
              <div className="h-72 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="75%">
                  <PieChart>
                    <Pie
                      data={modalidadData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {modalidadData.map((entry, index) => (
                        <Cell key={`mod-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [Number(val).toLocaleString('es-CO'), 'Aprendices']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs mt-2">
                  {modalidadData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                      <span className="text-slate-600">{entry.name}:</span>
                      <strong className="text-slate-800">{entry.value.toLocaleString('es-CO')}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CHARTS ROW 2: Evolución Mensual & Top Municipios */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolución Mensual */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Evolución Mensual de Aprendices
                </h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMatr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip 
                      formatter={(val: any) => [Number(val).toLocaleString('es-CO'), 'Aprendices']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Area type="monotone" dataKey="matriculados" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMatr)" name="Matriculados" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Municipios Cobertura */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  Top Municipios Cobertura
                </h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMunicipiosData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
                    <Tooltip 
                      formatter={(val: any) => [Number(val).toLocaleString('es-CO') + ' aprendices', 'Cobertura']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="matriculados" fill="#0284c7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* NUEVA MÉTRICA: CANTIDAD DE FICHAS CREADAS POR MES & POR INSTRUCTOR */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            {/* Header with Title and Integrated Instructor Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      {selectedInstructor === 'TODOS' 
                        ? 'Cantidad de Fichas Creadas por Mes (Consolidado)' 
                        : `Cantidad de Fichas Creadas por Mes — Instructor: ${selectedInstructor}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedInstructor === 'TODOS'
                        ? 'Distribución y ritmo de apertura mensual de fichas (Cursos Especiales y Eventos de Divulgación) en el Centro Minero.'
                        : `Comportamiento mensual de programación y apertura de cursos asignados al instructor seleccionado.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Instructor Selector */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <label htmlFor="instructor-month-select" className="text-xs font-bold text-slate-600 whitespace-nowrap">
                    Filtrar por Instructor:
                  </label>
                  <select
                    id="instructor-month-select"
                    value={selectedInstructor}
                    onChange={(e) => setSelectedInstructor(e.target.value)}
                    className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[240px] truncate"
                  >
                    {instructoresList.map(inst => (
                      <option key={inst} value={inst}>
                        {inst === 'TODOS' ? 'Todos los Instructores' : inst}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInstructor !== 'TODOS' && (
                  <button
                    onClick={() => setSelectedInstructor('TODOS')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                  >
                    Ver Todos los Instructores
                  </button>
                )}
              </div>
            </div>

            {/* 4 KPI Summary Cards for Fichas Creadas por Mes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Fichas Creadas</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {monthlyFichasDetailedData.totalFichas.toLocaleString('es-CO')}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {monthlyFichasDetailedData.months.reduce((a, b) => a + b.cursosEspeciales, 0)} Cursos
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    {monthlyFichasDetailedData.months.reduce((a, b) => a + b.eventos, 0)} Eventos
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                <p className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider">Mes con Mayor Asignación</p>
                <p className="text-xl font-bold text-emerald-900 mt-1 truncate">
                  {monthlyFichasDetailedData.peakMonth ? monthlyFichasDetailedData.peakMonth.fullMonth : 'Sin registros'}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  {monthlyFichasDetailedData.peakMonth ? `${monthlyFichasDetailedData.peakMonth.fichas} fichas creadas` : '-'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Promedio Mensual</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {monthlyFichasDetailedData.avgFichas} <span className="text-xs font-medium text-slate-500">fichas/mes</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ritmo de apertura en meses activos
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Impacto Formativo</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {monthlyFichasDetailedData.totalMatriculados.toLocaleString('es-CO')} <span className="text-xs font-medium text-slate-500">apr.</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {monthlyFichasDetailedData.totalHoras.toLocaleString('es-CO')} horas cátedra
                </p>
              </div>
            </div>

            {/* Bar Chart: Cantidad de Fichas por Mes */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Evolución Mensual de Fichas ({selectedInstructor === 'TODOS' ? 'Todos los Instructores' : selectedInstructor})
                </h4>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
                    <span className="text-slate-600 font-medium">CURSO ESPECIAL (Formación Complementaria)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-sky-500"></span>
                    <span className="text-slate-600 font-medium">EVENTO (Evento de Divulgación)</span>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full bg-slate-50/50 p-3 rounded-xl border border-slate-200/80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyFichasDetailedData.months} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1.5 min-w-[200px]">
                              <p className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-1">
                                {data.fullMonth}
                              </p>
                              <div className="flex justify-between items-center text-slate-700">
                                <span>Total Fichas Creadas:</span>
                                <strong className="text-slate-900 text-sm">{data.fichas}</strong>
                              </div>
                              <div className="flex justify-between items-center text-emerald-700">
                                <span>Cursos Especiales:</span>
                                <strong>{data.cursosEspeciales}</strong>
                              </div>
                              <div className="flex justify-between items-center text-sky-700">
                                <span>Eventos de Divulgación:</span>
                                <strong>{data.eventos}</strong>
                              </div>
                              <div className="border-t border-slate-100 pt-1 flex justify-between items-center text-slate-600">
                                <span>Aprendices Matriculados:</span>
                                <strong>{data.matriculados.toLocaleString('es-CO')}</strong>
                              </div>
                              <div className="flex justify-between items-center text-slate-600">
                                <span>Horas Totales:</span>
                                <strong>{data.horasTotales.toLocaleString('es-CO')} hrs</strong>
                              </div>
                              {selectedInstructor === 'TODOS' && data.instructores.size > 0 && (
                                <div className="flex justify-between items-center text-slate-500 text-[10px] pt-0.5">
                                  <span>Instructores Activos:</span>
                                  <strong>{data.instructores.size}</strong>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="cursosEspeciales" name="Cursos Especiales (Formación Complementaria)" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
                    <Bar dataKey="eventos" name="Eventos de Divulgación" fill="#0284c7" radius={[3, 3, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 12 Months Interactive Grid Cards */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Desglose Mes a Mes ({selectedInstructor === 'TODOS' ? 'Todos los Instructores' : selectedInstructor})
                </h4>
                <span className="text-[11px] text-slate-500">
                  Haga clic en un mes para filtrar el tablero general
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
                {monthlyFichasDetailedData.months.map((m) => {
                  const isSelected = selectedMonth === m.month;
                  const isPeak = monthlyFichasDetailedData.peakMonth?.month === m.month && m.fichas > 0;

                  return (
                    <div
                      key={m.month}
                      onClick={() => setSelectedMonth(isSelected ? 'TODOS' : m.month)}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-xs'
                          : isPeak
                            ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100/80 text-slate-800'
                            : m.fichas > 0
                              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-slate-50/60 border-slate-200 text-slate-400'
                      }`}
                    >
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {m.month}
                      </p>
                      <p className={`text-base font-black my-0.5 ${isSelected ? 'text-white' : m.fichas > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                        {m.fichas}
                      </p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {m.fichas > 0 ? `${m.matriculados} apr.` : 'Sin fichas'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrix / Summary Table by Instructor x Month */}
            <div className="pt-2 border-t border-slate-100">
              {selectedInstructor === 'TODOS' ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        Matriz de Fichas Creadas por Instructor por Cada Mes
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Consolidado de fichas asignadas a cada instructor mes a mes durante la vigencia.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowInstructorMatrix(!showInstructorMatrix)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors self-start sm:self-auto"
                    >
                      {showInstructorMatrix ? 'Ocultar Matriz Completa' : `Ver Matriz de Instructores (${instructorMonthlyMatrix.length})`}
                    </button>
                  </div>

                  {showInstructorMatrix && (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5 font-bold sticky left-0 bg-slate-100 z-10">Instructor Responsable</th>
                            <th className="px-2 py-2.5 text-center bg-slate-200/80 font-bold">Total</th>
                            {MONTH_NAMES.map(m => (
                              <th key={m} className="px-2 py-2.5 text-center">{m}</th>
                            ))}
                            <th className="px-3 py-2.5 text-center font-bold">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {instructorMonthlyMatrix.slice(0, 30).map((row, idx) => (
                            <tr key={row.instructor} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-50'}>
                              <td className="px-3 py-2 font-semibold text-slate-800 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                                {row.instructor}
                              </td>
                              <td className="px-2 py-2 text-center font-bold bg-emerald-50/80 text-emerald-800">
                                {row.totalFichas}
                              </td>
                              {row.monthly.map((val, mIdx) => (
                                <td 
                                  key={mIdx} 
                                  className={`px-2 py-2 text-center text-[11px] ${
                                    val > 0 
                                      ? 'font-bold text-slate-800 bg-emerald-50/30' 
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {val > 0 ? val : '-'}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedInstructor(row.instructor)}
                                  className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors"
                                >
                                  Ver Instructor
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Specific Instructor Detailed Monthly Breakdown */
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                          Detalle Mensual del Instructor: <span className="text-emerald-700 font-extrabold normal-case text-sm">{selectedInstructor}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Horas dictadas calculadas a partir de la sumatoria de la columna <strong className="text-slate-700">AW (TOTAL_HORAS)</strong> del reporte PE-04.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedInstructor('TODOS')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg transition-colors shadow-2xs self-start sm:self-auto"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Volver a ver todos los instructores
                    </button>
                  </div>

                  {/* 4 Mini Metrics for the selected Instructor */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Total Horas Dictadas (Col. AW)</span>
                      <strong className="text-lg font-black text-emerald-700 mt-0.5 block">
                        {monthlyFichasDetailedData.totalHoras.toLocaleString('es-CO')} <span className="text-xs font-medium text-slate-500">hrs</span>
                      </strong>
                      <span className="text-[10px] text-slate-400">Sumatoria anual PE-04</span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Promedio Mensual Dictado</span>
                      <strong className="text-lg font-black text-slate-800 mt-0.5 block">
                        {Math.round(monthlyFichasDetailedData.totalHoras / (monthlyFichasDetailedData.months.filter(m => m.fichas > 0).length || 1))} <span className="text-xs font-medium text-slate-500">hrs/mes activo</span>
                      </strong>
                      <span className="text-[10px] text-slate-400">En meses con asignación</span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Total Cursos / Fichas</span>
                      <strong className="text-lg font-black text-slate-800 mt-0.5 block">
                        {monthlyFichasDetailedData.totalFichas} <span className="text-xs font-medium text-slate-500">fichas</span>
                      </strong>
                      <span className="text-[10px] text-slate-400">{monthlyFichasDetailedData.months.reduce((a, b) => a + b.cursosEspeciales, 0)} cursos · {monthlyFichasDetailedData.months.reduce((a, b) => a + b.eventos, 0)} eventos</span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Aprendices Atendidos</span>
                      <strong className="text-lg font-black text-slate-800 mt-0.5 block">
                        {monthlyFichasDetailedData.totalMatriculados.toLocaleString('es-CO')} <span className="text-xs font-medium text-slate-500">apr.</span>
                      </strong>
                      <span className="text-[10px] text-slate-400">Total matriculados</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5">Mes</th>
                          <th className="px-3 py-2.5 text-center">Fichas Asignadas</th>
                          <th className="px-3 py-2.5 text-center">Cursos Especiales</th>
                          <th className="px-3 py-2.5 text-center">Eventos</th>
                          <th className="px-3 py-2.5 text-center">Aprendices</th>
                          <th className="px-3 py-2.5 text-center bg-emerald-50/80 text-emerald-900 font-bold border-x border-emerald-200/60">
                            Horas Dictadas (Col. AW TOTAL_HORAS)
                          </th>
                          <th className="px-3 py-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monthlyFichasDetailedData.months.map((m) => (
                          <tr key={m.month} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{m.fullMonth}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                              {m.fichas > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                  {m.fichas} fichas
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">0</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">{m.cursosEspeciales || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">{m.eventos || '-'}</td>
                            <td className="px-3 py-2.5 text-center font-medium text-slate-800">
                              {m.matriculados > 0 ? m.matriculados.toLocaleString('es-CO') : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center bg-emerald-50/40 border-x border-emerald-100 font-mono font-bold text-emerald-800">
                              {m.horasTotales > 0 ? `${m.horasTotales.toLocaleString('es-CO')} hrs` : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {m.fichas > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Activo
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Sin programación</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100/90 text-slate-900 border-t-2 border-slate-300 font-bold text-[11px]">
                        <tr>
                          <td className="px-3 py-2.5 uppercase tracking-wider text-slate-800">
                            Total Acumulado Anual
                          </td>
                          <td className="px-3 py-2.5 text-center text-emerald-900 font-black">
                            {monthlyFichasDetailedData.totalFichas} fichas
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700">
                            {monthlyFichasDetailedData.months.reduce((a, b) => a + b.cursosEspeciales, 0)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700">
                            {monthlyFichasDetailedData.months.reduce((a, b) => a + b.eventos, 0)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-900 font-black">
                            {monthlyFichasDetailedData.totalMatriculados.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-emerald-100 text-emerald-900 font-mono font-black border-x border-emerald-300 text-xs">
                            {monthlyFichasDetailedData.totalHoras.toLocaleString('es-CO')} hrs
                          </td>
                          <td className="px-3 py-2.5 text-center text-emerald-700">
                            {monthlyFichasDetailedData.months.filter(m => m.fichas > 0).length} meses activos
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CALENDARIO DE PROGRAMACIÓN Y DÍAS DISPONIBLES POR INSTRUCTOR */}
          <InstructorCalendarScheduleView
            fichas={fichasComp}
            selectedInstructor={selectedInstructor}
            onSelectInstructor={(inst) => setSelectedInstructor(inst)}
            onViewFichaDetail={(f) => setSelectedFichaDetail(f)}
          />

          {/* ANÁLISIS POR PROGRAMAS ESPECIALES (AULA MÓVIL, CAMPESENA, FEC CONSTRUCCIÓN, FEC PLACA HUELLA, FULL POPULAR, EMPRENDIMIENTO) */}
          <SpecialProgramsAnalysisView
            fichas={fichasComp}
            onViewFichaDetail={(f) => setSelectedFichaDetail(f)}
            onSelectInstructor={(inst) => setSelectedInstructor(inst)}
          />
        </div>
      )}

      {/* VIEW: CURSOS Y FICHAS (TABLA DETALLADA) */}
      {activeSubTab === 'fichas' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Listado de Cursos y Fichas ({filteredFichas.length.toLocaleString('es-CO')})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mostrando página {currentPage} de {totalPages || 1}
              </p>
            </div>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors self-start sm:self-auto shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Tabla Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ficha</th>
                  <th className="py-3 px-4">Programa de Formación</th>
                  <th className="py-3 px-3">Nivel / Modalidad</th>
                  <th className="py-3 px-3">Sector</th>
                  <th className="py-3 px-3">Instructor / Responsable</th>
                  <th className="py-3 px-3">Municipio</th>
                  <th className="py-3 px-3 text-center">Horas</th>
                  <th className="py-3 px-3 text-center">Aprendices</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedFichas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No se encontraron fichas o cursos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedFichas.map((f, idx) => (
                    <tr key={f.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {f.ficha}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 line-clamp-2" title={f.programa}>
                          {f.programa}
                        </div>
                        {f.empresa && (
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{f.empresa}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {f.nivelFormacion || f.tipoFormacion}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {f.modalidad || 'PRESENCIAL'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span 
                          className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded"
                          style={{
                            backgroundColor: `${SECTOR_COLORS[f.lineaTematica] || '#0284c7'}15`,
                            color: SECTOR_COLORS[f.lineaTematica] || '#0284c7'
                          }}
                        >
                          {f.lineaTematica || 'GENERAL'}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[150px]">
                        <div className="font-medium text-slate-800 truncate" title={f.instructor}>
                          {f.instructor || 'POR ASIGNAR'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {f.fechaInicio} - {f.fechaFin}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {f.municipio}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                        {f.horasTotales || f.duracionHoras}h
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-slate-800">{f.matriculados}</span>
                        <div className="text-[10px] text-slate-400">
                          M:{f.masculinos || 0} F:{f.femeninos || 0}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          f.estadoFicha.toLowerCase().includes('terminad')
                            ? 'bg-emerald-100 text-emerald-800'
                            : f.estadoFicha.toLowerCase().includes('ejecucion')
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {f.estadoFicha}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedFichaDetail(f)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Ver detalle completo de ficha"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500">
                Página {currentPage} de {totalPages} ({filteredFichas.length} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                >
                  Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 text-xs font-semibold rounded bg-white border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: RENDIMIENTO POR INSTRUCTOR */}
      {activeSubTab === 'instructores' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Consolidado de Formación por Instructor ({instructorStats.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cursos asignados, cobertura de aprendices y horas impartidas según reporte PE-04.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Instructor / Responsable</th>
                  <th className="py-3 px-3 text-center">Cursos / Fichas</th>
                  <th className="py-3 px-3 text-center">Aprendices Matriculados</th>
                  <th className="py-3 px-3 text-center">Aprendices Certificados</th>
                  <th className="py-3 px-3 text-center">Horas Dictadas (Col. AW)</th>
                  <th className="py-3 px-3 text-center">Horas Hombre</th>
                  <th className="py-3 px-3">Líneas Temáticas</th>
                  <th className="py-3 px-3">Municipios Atendidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {instructorStats.map((inst, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {inst.instructor}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700">
                      {inst.fichas}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">
                      {inst.matriculados.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                      {inst.certificados.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                      {inst.horasDocente} hrs
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {inst.horasHombre.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(inst.sectores).map((sec, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                            {sec}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                        {Array.from(inst.municipios).slice(0, 3).join(', ')}
                        {inst.municipios.size > 3 && ` (+${inst.municipios.size - 3})`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: COBERTURA TERRITORIAL */}
      {activeSubTab === 'municipios' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              Distribución Territorial de la Formación ({municipioStats.length} Municipios)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cobertura en municipios y departamentos con total de cursos y aprendices impactados.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Municipio</th>
                  <th className="py-3 px-3">Departamento</th>
                  <th className="py-3 px-3 text-center">Fichas / Cursos</th>
                  <th className="py-3 px-3 text-center">Aprendices Matriculados</th>
                  <th className="py-3 px-3 text-center">Aprendices Certificados</th>
                  <th className="py-3 px-3 text-center">Horas Hombre</th>
                  <th className="py-3 px-3">Empresas / Aliados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {municipioStats.map((mun, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {mun.municipio}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {mun.departamento}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700">
                      {mun.fichas}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-sky-700">
                      {mun.matriculados.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                      {mun.certificados.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {mun.horasHombre.toLocaleString('es-CO')}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                        {Array.from(mun.empresas).filter(Boolean).slice(0, 2).join(', ') || 'General / Convocatoria'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: EMPRESAS & ESTRATEGIAS */}
      {activeSubTab === 'empresas' && (
        <div className="space-y-6">
          {/* Estrategias Especiales Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {estrategiaStats.slice(0, 3).map((est, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Estrategia Especial</span>
                <h4 className="text-base font-bold text-slate-800 mt-1">{est.estrategia || 'REGULAR'}</h4>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-slate-600">{est.fichas} Cursos</span>
                  <strong className="text-emerald-700">{est.matriculados.toLocaleString('es-CO')} Aprendices</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Empresas Aliadas Table */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Empresas y Entidades Beneficiarias ({empresaStats.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Empresa / Entidad</th>
                    <th className="py-3 px-3 text-center">Fichas</th>
                    <th className="py-3 px-3 text-center">Aprendices</th>
                    <th className="py-3 px-3">Estrategias</th>
                    <th className="py-3 px-3">Programas Impartidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {empresaStats.slice(0, 20).map((emp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {emp.empresa}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {emp.fichas}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700">
                        {emp.matriculados.toLocaleString('es-CO')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {Array.from(emp.estrategias).filter(Boolean).map((est, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                              {est}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                        {Array.from(emp.programas).slice(0, 2).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CARGAR ARCHIVO Y SINCRONIZACIÓN GOOGLE DRIVE */}
      {activeSubTab === 'cargar' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Card 1: Sincronización Google Drive */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Sincronización Directa con Google Drive
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Conexión directa a la carpeta compartida de Google Drive para descargar e integrar en tiempo real el reporte PE-04.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Conexión Activa
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL de la Carpeta o Archivo de Google Drive:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    id="input-drive-folder-url"
                    value={driveFolderInput}
                    onChange={(e) => setDriveFolderInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 px-3.5 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-mono"
                  />
                  <button
                    id="btn-revert-drive-url"
                    type="button"
                    onClick={() => setDriveFolderInput(DRIVE_FOLDER_URL)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Restablecer URL Oficial
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  id="btn-trigger-drive-sync"
                  type="button"
                  onClick={() => handleSyncFromDrive(false, false, driveFolderInput)}
                  disabled={isSyncing}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-white shadow-xs transition-all ${
                    isSyncing
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando desde Google Drive...' : 'Sincronizar Ahora con Drive'}
                </button>

                <button
                  id="btn-force-drive-refresh"
                  type="button"
                  onClick={() => handleSyncFromDrive(false, true, driveFolderInput)}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 shadow-xs transition-all active:scale-95"
                  title="Elimina la caché local y vuelve a consultar la información más fresca de Google Drive"
                >
                  <RotateCcw className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  Forzar Actualización (Limpiar Caché)
                </button>

                <a
                  href={driveFolderInput || DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  Abrir Carpeta en Google Drive
                </a>
              </div>

              {/* Sync Status Banner */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Fuente actual de datos:</span>
                  <strong className="text-slate-800 text-sm font-bold">{syncInfo?.source || 'Google Drive PE-04'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Archivo procesado:</span>
                  <strong className="text-slate-800 font-mono">{syncInfo?.fileName || 'PE-04_1.xml'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Última sincronización:</span>
                  <strong className="text-slate-800">{syncInfo?.syncDate || 'Hoy'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Total registros PE-04:</span>
                  <strong className="text-emerald-700 text-sm font-bold">{fichasComp.length.toLocaleString('es-CO')} registros</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Carga Manual de Archivo */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Carga Manual de Archivo PE-04
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    También puede subir directamente un archivo exportado de Sofía Plus en formato XML Spreadsheet, XLSX o XLS.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Plantilla
              </button>
            </div>

            <div className="p-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.xml,.csv"
                className="hidden"
                id="file-upload-complementaria-manual"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/30 transition-all group"
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Haga clic para seleccionar o arrastre el archivo PE-04 aquí
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Formatos soportados: XML Spreadsheet 2003 (.xml), Excel (.xlsx, .xls) generados por el reporte PE-04 de Sofía Plus.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs group-hover:border-emerald-400">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Examinar archivos de mi equipo
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Reglas de Filtrado & Cobertura */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-xs space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Criterios de Extracción y Clasificación PE-04
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <strong className="text-emerald-700 block mb-1">1. CURSO ESPECIAL (Formación Complementaria)</strong>
                <p>
                  Cursos de formación complementaria corta orientados al desarrollo o actualización de competencias laborales específicas.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <strong className="text-purple-700 block mb-1">2. EVENTO (Evento de Divulgación Tecnológica)</strong>
                <p>
                  Jornadas, seminarios y eventos de divulgación y transferencia tecnológica para la comunidad y empresas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE COMPLETO DE FICHA */}
      {selectedFichaDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-5 animate-fadeIn">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ficha #{selectedFichaDetail.ficha}
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">
                  {selectedFichaDetail.programa}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedFichaDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Nivel Formación</span>
                <strong className="text-slate-800">{selectedFichaDetail.nivelFormacion || selectedFichaDetail.tipoFormacion}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Modalidad</span>
                <strong className="text-slate-800">{selectedFichaDetail.modalidad || 'PRESENCIAL'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Jornada</span>
                <strong className="text-slate-800">{selectedFichaDetail.jornada || 'MIXTA'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Sector</span>
                <strong className="text-slate-800">{selectedFichaDetail.lineaTematica}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Municipio</span>
                <strong className="text-slate-800">{selectedFichaDetail.municipio}, {selectedFichaDetail.departamento || 'BOYACÁ'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Estado Curso</span>
                <strong className="text-emerald-700">{selectedFichaDetail.estadoFicha}</strong>
              </div>
            </div>

            {/* Dates & Instructor */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Instructor Responsable:</span>
                <strong className="text-slate-800">{selectedFichaDetail.instructor}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Empresa Aliada:</span>
                <strong className="text-slate-800">{selectedFichaDetail.empresa || 'Convocatoria Abierta'}</strong>
              </div>
              {selectedFichaDetail.estrategiaEspecial && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Programa Especial:</span>
                  <strong className="text-indigo-700">{selectedFichaDetail.estrategiaEspecial}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Fechas de Ejecución:</span>
                <strong className="text-slate-800">{selectedFichaDetail.fechaInicio} al {selectedFichaDetail.fechaFin}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Duración Total Horas:</span>
                <strong className="text-slate-800">{selectedFichaDetail.duracionHoras} horas</strong>
              </div>
            </div>

            {/* Aprendices Breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Métricas de Aprendices</h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Total</span>
                  <strong className="text-sm text-slate-800">{selectedFichaDetail.matriculados}</strong>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Hombres</span>
                  <strong className="text-sm text-sky-700">{selectedFichaDetail.masculinos || 0}</strong>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Mujeres</span>
                  <strong className="text-sm text-rose-700">{selectedFichaDetail.femeninos || 0}</strong>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-[10px]">Certificados</span>
                  <strong className="text-sm text-emerald-700">{selectedFichaDetail.certificados}</strong>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedFichaDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
