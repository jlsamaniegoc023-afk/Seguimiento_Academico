import React, { useState, useMemo } from 'react';
import { 
  FichaComplementaria 
} from '../types';
import { 
  Sparkles, 
  Sprout, 
  Hammer, 
  Route, 
  Store, 
  Lightbulb, 
  Handshake, 
  Globe, 
  Laptop, 
  Users, 
  Clock, 
  MapPin, 
  Building2, 
  GraduationCap, 
  CheckCircle2, 
  Download, 
  Search, 
  Filter, 
  Layers, 
  Eye, 
  FileSpreadsheet, 
  Award,
  Calendar,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Briefcase,
  BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SpecialProgramsAnalysisViewProps {
  fichas: FichaComplementaria[];
  onViewFichaDetail?: (ficha: FichaComplementaria) => void;
  onSelectInstructor?: (instructor: string) => void;
}

// Configured list of priority Special Programs
export interface ProgramConfig {
  id: string;
  name: string;
  shortName: string;
  matchPattern: RegExp;
  description: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  accentBg: string;
  cardColor: string;
  category: string;
}

export const SPECIAL_PROGRAMS_CONFIG: ProgramConfig[] = [
  {
    id: 'AULA_MOVIL',
    name: 'AULA MÃ“VIL',
    shortName: 'Aula MÃ³vil',
    matchPattern: /AULA\s*M[OÃ“]VIL/i,
    description: 'FormaciÃ³n mÃ³vil itinerante en vehÃ­culos adaptados para llevar tecnologÃ­a y capacitaciÃ³n tÃ©cnica a zonas rurales y apartadas.',
    icon: Sparkles,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    accentBorder: 'border-amber-400',
    accentBg: 'bg-amber-50',
    cardColor: 'amber',
    category: 'Movilidad & Cobertura Rural'
  },
  {
    id: 'CAMPESENA',
    name: 'CAMPESENA',
    shortName: 'CampeSENA',
    matchPattern: /CAMPESENA|CAMPE\s*SENA/i,
    description: 'Estrategia integral para el reconocimiento, formaciÃ³n, inclusiÃ³n y desarrollo productivo de la poblaciÃ³n campesina colombiana.',
    icon: Sprout,
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    accentBorder: 'border-emerald-500',
    accentBg: 'bg-emerald-50',
    cardColor: 'emerald',
    category: 'Desarrollo Agropecuario'
  },
  {
    id: 'FEC_CONSTRUCCION',
    name: 'FEC - FORMACIÃ“N ESPECIAL CAMPESINA - CONSTRUCCIÃ“N',
    shortName: 'FEC ConstrucciÃ³n',
    matchPattern: /FEC.*CONSTRUCCI[OÃ“]N/i,
    description: 'FormaciÃ³n Especial Campesina en autoconstrucciÃ³n, mamposterÃ­a, mejoramiento de vivienda rural e infraestructura comunitaria.',
    icon: Hammer,
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    accentBorder: 'border-orange-500',
    accentBg: 'bg-orange-50',
    cardColor: 'orange',
    category: 'Infraestructura & HÃ¡bitat Rural'
  },
  {
    id: 'FEC_PLACA_HUELLA',
    name: 'FEC - FORMACIÃ“N ESPECIAL CAMPESINA - PLACA HUELLA',
    shortName: 'FEC Placa Huella',
    matchPattern: /FEC.*PLACA\s*HUELLA/i,
    description: 'CapacitaciÃ³n comunitaria para la construcciÃ³n de pavimentos en placa huella en vÃ­as terciarias y accesos veredales.',
    icon: Route,
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    accentBorder: 'border-teal-500',
    accentBg: 'bg-teal-50',
    cardColor: 'teal',
    category: 'VÃ­as Terciarias & Transporte'
  },
  {
    id: 'FULL_POPULAR',
    name: 'FULL POPULAR',
    shortName: 'Full Popular',
    matchPattern: /FULL\s*POPULAR/i,
    description: 'Estrategia de atenciÃ³n directa a la economÃ­a popular, micro micronegocios, vendedores informales, artesanos y comerciantes independientes.',
    icon: Store,
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    accentBorder: 'border-purple-500',
    accentBg: 'bg-purple-50',
    cardColor: 'purple',
    category: 'EconomÃ­a Popular & Microempresas'
  },
  {
    id: 'PROGRAMA_DE_EMPRENDIMIENTO',
    name: 'PROGRAMA DE EMPRENDIMIENTO',
    shortName: 'Emprendimiento',
    matchPattern: /EMPRENDIMIENTO/i,
    description: 'Fomento a la cultura emprendedora, formulaciÃ³n de modelos de negocio, innovaciÃ³n y fortalecimiento a unidades productivas.',
    icon: Lightbulb,
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    accentBorder: 'border-indigo-500',
    accentBg: 'bg-indigo-50',
    cardColor: 'indigo',
    category: 'Cultura Emprendedora'
  },
  {
    id: 'ALIANZAS_ESTRATEGICAS',
    name: 'ALIANZAS ESTRATEGICAS',
    shortName: 'Alianzas EstratÃ©gicas',
    matchPattern: /ALIANZAS\s*ESTRAT[EÃ‰]GICAS/i,
    description: 'FormaciÃ³n a la medida coordinada mediante convenios interinstitucionales con gremios, empresas y entidades pÃºblicas.',
    icon: Handshake,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    accentBorder: 'border-sky-500',
    accentBg: 'bg-sky-50',
    cardColor: 'sky',
    category: 'Convenios & Empresas'
  },
  {
    id: 'PROGRAMA_DE_BILINGUISMO',
    name: 'PROGRAMA DE BILINGUISMO',
    shortName: 'BilingÃ¼ismo',
    matchPattern: /BILING[UÃœ]ISMO|INGL[EÃ‰]S/i,
    description: 'Cursos de competencias comunicativas en segunda lengua (inglÃ©s) para la competitividad laboral y educativa.',
    icon: Globe,
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    accentBorder: 'border-blue-500',
    accentBg: 'bg-blue-50',
    cardColor: 'blue',
    category: 'Idiomas & GlobalizaciÃ³n'
  },
  {
    id: 'AMBIENTES_VIRTUALES',
    name: 'AMBIENTES VIRTUALES DE APRENDIZAJE',
    shortName: 'Ambientes Virtuales',
    matchPattern: /AMBIENTES\s*VIRTUALES|VIRTUAL/i,
    description: 'FormaciÃ³n complementaria 100% virtual a travÃ©s de la plataforma LMS institucional de SofÃ­a Plus / Zajuna.',
    icon: Laptop,
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    accentBorder: 'border-cyan-500',
    accentBg: 'bg-cyan-50',
    cardColor: 'cyan',
    category: 'FormaciÃ³n Virtual'
  }
];

export const SpecialProgramsAnalysisView: React.FC<SpecialProgramsAnalysisViewProps> = ({
  fichas,
  onViewFichaDetail,
  onSelectInstructor
}) => {
  // Selected Program ID ('TODOS' or any program id)
  const [selectedProgId, setSelectedProgId] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'kpi' | 'cursos' | 'instructores' | 'municipios' | 'fichas'>('kpi');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Helper to match a ficha with a program config
  const getFichaProgramConfig = (f: FichaComplementaria): ProgramConfig | null => {
    const est = (f.estrategiaEspecial || '').trim();
    if (!est) return null;
    return SPECIAL_PROGRAMS_CONFIG.find(cfg => cfg.matchPattern.test(est)) || null;
  };

  // Group and calculate statistics for each special program
  const programsStats = useMemo(() => {
    const map = new Map<string, {
      config: ProgramConfig;
      fichas: FichaComplementaria[];
      totalFichas: number;
      cursosEspeciales: number;
      eventos: number;
      totalMatriculados: number;
      totalCertificados: number;
      totalPorCertificar: number;
      totalEnFormacion: number;
      masculinos: number;
      femeninos: number;
      noBinario: number;
      totalHorasAW: number; // Columna AW TOTAL_HORAS
      horasHombre: number;
      instructores: Set<string>;
      municipios: Set<string>;
      programasNombres: Map<string, { nombre: string; count: number; matriculados: number; certificados: number; porCertificar: number; horas: number }>;
      empresas: Set<string>;
    }>();

    // Initialize map
    SPECIAL_PROGRAMS_CONFIG.forEach(cfg => {
      map.set(cfg.id, {
        config: cfg,
        fichas: [],
        totalFichas: 0,
        cursosEspeciales: 0,
        eventos: 0,
        totalMatriculados: 0,
        totalCertificados: 0,
        totalPorCertificar: 0,
        totalEnFormacion: 0,
        masculinos: 0,
        femeninos: 0,
        noBinario: 0,
        totalHorasAW: 0,
        horasHombre: 0,
        instructores: new Set(),
        municipios: new Set(),
        programasNombres: new Map(),
        empresas: new Set()
      });
    });

    let totalSpecialFichasCount = 0;
    let totalSpecialMatriculados = 0;
    let totalSpecialCertificados = 0;
    let totalSpecialPorCertificar = 0;
    let totalSpecialHorasAW = 0;

    fichas.forEach(f => {
      const cfg = getFichaProgramConfig(f);
      if (cfg && map.has(cfg.id)) {
        const item = map.get(cfg.id)!;
        item.fichas.push(f);
        item.totalFichas++;
        
        const isEvento = (f.nivelFormacion || '').toUpperCase().includes('EVENTO') || (f.tipoFormacion || '').includes('Evento');
        if (isEvento) {
          item.eventos++;
        } else {
          item.cursosEspeciales++;
        }

        const mat = f.matriculados || 0;
        const cert = f.certificados || 0;
        const porCert = f.porCertificar || 0;
        const enForm = f.enFormacion || 0;

        item.totalMatriculados += mat;
        item.totalCertificados += cert;
        item.totalPorCertificar += porCert;
        item.totalEnFormacion += enForm;
        item.masculinos += (f.masculinos || 0);
        item.femeninos += (f.femeninos || 0);
        item.noBinario += (f.noBinario || 0);

        // AW TOTAL_HORAS
        const horasAW = f.horasTotales || f.duracionHoras || 40;
        item.totalHorasAW += horasAW;
        item.horasHombre += mat * (f.duracionHoras || horasAW);

        if (f.instructor && f.instructor !== 'POR ASIGNAR') {
          item.instructores.add(f.instructor.trim());
        }
        if (f.municipio) {
          item.municipios.add(f.municipio.trim());
        }
        if (f.empresa) {
          item.empresas.add(f.empresa.trim());
        }

        // Program breakdown
        const pKey = f.programa || 'SIN NOMBRE';
        const currP = item.programasNombres.get(pKey) || { nombre: pKey, count: 0, matriculados: 0, certificados: 0, porCertificar: 0, horas: 0 };
        currP.count++;
        currP.matriculados += mat;
        currP.certificados += cert;
        currP.porCertificar += porCert;
        currP.horas += horasAW;
        item.programasNombres.set(pKey, currP);

        totalSpecialFichasCount++;
        totalSpecialMatriculados += mat;
        totalSpecialCertificados += cert;
        totalSpecialPorCertificar += porCert;
        totalSpecialHorasAW += horasAW;
      }
    });

    return {
      byProgram: map,
      totalSpecialFichasCount,
      totalSpecialMatriculados,
      totalSpecialCertificados,
      totalSpecialPorCertificar,
      totalSpecialHorasAW
    };
  }, [fichas]);

  // Active Program Info
  const activeProgStats = useMemo(() => {
    if (selectedProgId === 'TODOS') return null;
    return programsStats.byProgram.get(selectedProgId) || null;
  }, [selectedProgId, programsStats]);

  // Fichas for the active view
  const currentProgramFichas = useMemo(() => {
    let list: FichaComplementaria[] = [];
    if (selectedProgId === 'TODOS') {
      list = fichas.filter(f => getFichaProgramConfig(f) !== null);
    } else if (activeProgStats) {
      list = activeProgStats.fichas;
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(f => 
      f.ficha.toLowerCase().includes(term) ||
      f.programa.toLowerCase().includes(term) ||
      (f.instructor || '').toLowerCase().includes(term) ||
      (f.municipio || '').toLowerCase().includes(term) ||
      (f.estrategiaEspecial || '').toLowerCase().includes(term) ||
      (f.empresa || '').toLowerCase().includes(term)
    );
  }, [selectedProgId, activeProgStats, fichas, searchTerm]);

  // Instructors list for active program
  const instructorsList = useMemo(() => {
    const list = currentProgramFichas;
    const instMap = new Map<string, {
      nombre: string;
      fichas: number;
      cursos: number;
      eventos: number;
      matriculados: number;
      certificados: number;
      porCertificar: number;
      horasAW: number;
      municipios: Set<string>;
      programas: Set<string>;
    }>();

    list.forEach(f => {
      const inst = f.instructor || 'POR ASIGNAR';
      const curr = instMap.get(inst) || {
        nombre: inst,
        fichas: 0,
        cursos: 0,
        eventos: 0,
        matriculados: 0,
        certificados: 0,
        porCertificar: 0,
        horasAW: 0,
        municipios: new Set(),
        programas: new Set()
      };

      curr.fichas++;
      const isEvento = (f.nivelFormacion || '').toUpperCase().includes('EVENTO') || (f.tipoFormacion || '').includes('Evento');
      if (isEvento) curr.eventos++;
      else curr.cursos++;

      curr.matriculados += (f.matriculados || 0);
      curr.certificados += (f.certificados || 0);
      curr.porCertificar += (f.porCertificar || 0);
      curr.horasAW += (f.horasTotales || f.duracionHoras || 40);
      if (f.municipio) curr.municipios.add(f.municipio);
      if (f.programa) curr.programas.add(f.programa);

      instMap.set(inst, curr);
    });

    return Array.from(instMap.values()).sort((a, b) => b.horasAW - a.horasAW);
  }, [currentProgramFichas]);

  // Courses catalog for active program
  const coursesCatalog = useMemo(() => {
    const courseMap = new Map<string, {
      programa: string;
      fichas: number;
      matriculados: number;
      certificados: number;
      porCertificar: number;
      horasAW: number;
      duracionProm: number;
      instructores: Set<string>;
      municipios: Set<string>;
    }>();

    currentProgramFichas.forEach(f => {
      const prog = f.programa || 'SIN NOMBRE';
      const curr = courseMap.get(prog) || {
        programa: prog,
        fichas: 0,
        matriculados: 0,
        certificados: 0,
        porCertificar: 0,
        horasAW: 0,
        duracionProm: f.duracionHoras || 40,
        instructores: new Set(),
        municipios: new Set()
      };

      curr.fichas++;
      curr.matriculados += (f.matriculados || 0);
      curr.certificados += (f.certificados || 0);
      curr.porCertificar += (f.porCertificar || 0);
      curr.horasAW += (f.horasTotales || f.duracionHoras || 40);
      if (f.instructor) curr.instructores.add(f.instructor);
      if (f.municipio) curr.municipios.add(f.municipio);

      courseMap.set(prog, curr);
    });

    return Array.from(courseMap.values()).sort((a, b) => b.fichas - a.fichas);
  }, [currentProgramFichas]);

  // Municipalities coverage for active program
  const municipalitiesCoverage = useMemo(() => {
    const munMap = new Map<string, {
      municipio: string;
      fichas: number;
      matriculados: number;
      certificados: number;
      porCertificar: number;
      horasAW: number;
      programas: Set<string>;
      instructores: Set<string>;
    }>();

    currentProgramFichas.forEach(f => {
      const mun = f.municipio || 'SOGAMOSO';
      const curr = munMap.get(mun) || {
        municipio: mun,
        fichas: 0,
        matriculados: 0,
        certificados: 0,
        porCertificar: 0,
        horasAW: 0,
        programas: new Set(),
        instructores: new Set()
      };

      curr.fichas++;
      curr.matriculados += (f.matriculados || 0);
      curr.certificados += (f.certificados || 0);
      curr.porCertificar += (f.porCertificar || 0);
      curr.horasAW += (f.horasTotales || f.duracionHoras || 40);
      if (f.programa) curr.programas.add(f.programa);
      if (f.instructor) curr.instructores.add(f.instructor);

      munMap.set(mun, curr);
    });

    return Array.from(munMap.values()).sort((a, b) => b.matriculados - a.matriculados);
  }, [currentProgramFichas]);

  // Pagination for Fichas
  const totalPages = Math.ceil(currentProgramFichas.length / itemsPerPage);
  const paginatedFichas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return currentProgramFichas.slice(start, start + itemsPerPage);
  }, [currentProgramFichas, currentPage]);

  // Export to Excel
  const handleExportExcel = () => {
    const progLabel = activeProgStats ? activeProgStats.config.shortName : 'Todos_Programas_Especiales';
    const exportData = currentProgramFichas.map(f => ({
      'FICHA': f.ficha,
      'PROGRAMA ESPECIAL': f.estrategiaEspecial || 'N/A',
      'PROGRAMA DE FORMACION': f.programa,
      'NIVEL FORMACION': f.nivelFormacion || 'CURSO ESPECIAL',
      'MODALIDAD': f.modalidad || 'PRESENCIAL',
      'JORNADA': f.jornada || 'MIXTA',
      'INSTRUCTOR': f.instructor || 'POR ASIGNAR',
      'MUNICIPIO': f.municipio || 'SOGAMOSO',
      'DEPARTAMENTO': f.departamento || 'BOYACÃ',
      'APRENDICES MATRICULADOS': f.matriculados || 0,
      'POR CERTIFICAR (COL AH DF-14A)': f.porCertificar || 0,
      'CERTIFICADOS (COL AI DF-14A)': f.certificados || 0,
      'EN FORMACION': f.enFormacion || 0,
      'HOMBRES': f.masculinos || 0,
      'MUJERES': f.femeninos || 0,
      'TOTAL HORAS (COL AW)': f.horasTotales || f.duracionHoras || 0,
      'DURACION HORAS': f.duracionHoras || 0,
      'FECHA INICIO': f.fechaInicio,
      'FECHA FIN': f.fechaFin,
      'ESTADO': f.estadoFicha,
      'EMPRESA / CONVENIO': f.empresa || f.convenio || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProgramasEspeciales');
    XLSX.writeFile(wb, `SENA_PE04_${progLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pt-6 border-t-2 border-slate-200" id="seccion-analisis-programas-especiales">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Estrategias Focalizadas & Poblacionales SENA
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              AnÃ¡lisis por Programas Especiales
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Monitoreo y evaluaciÃ³n especializada para <strong>Aula MÃ³vil</strong>, <strong>CampeSENA</strong>, <strong>FEC ConstrucciÃ³n</strong>, <strong>FEC Placa Huella</strong>, <strong>Full Popular</strong>, <strong>Programa de Emprendimiento</strong> y alianzas territoriales.
            </p>
          </div>

          {/* Quick Metrics Badge in Header */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-xs self-start lg:self-auto shrink-0">
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Total Fichas</span>
              <strong className="text-base font-black text-white">{programsStats.totalSpecialFichasCount.toLocaleString('es-CO')}</strong>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-bold text-sky-300 block">Matriculados</span>
              <strong className="text-base font-black text-white">{programsStats.totalSpecialMatriculados.toLocaleString('es-CO')}</strong>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Certificados (AI)</span>
              <strong className="text-base font-black text-emerald-300">{programsStats.totalSpecialCertificados.toLocaleString('es-CO')}</strong>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Por Certificar (AH)</span>
              <strong className="text-base font-black text-amber-300">{programsStats.totalSpecialPorCertificar.toLocaleString('es-CO')}</strong>
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-bold text-slate-300 block">Horas AW</span>
              <strong className="text-base font-black text-emerald-400">{Math.round(programsStats.totalSpecialHorasAW).toLocaleString('es-CO')}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Program Selector Grid (Interactive Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600" />
            Seleccione el Programa Especial para Analizar:
          </label>
          <span className="text-xs text-slate-500">
            {SPECIAL_PROGRAMS_CONFIG.length} Estrategias registradas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card: TODOS */}
          <button
            type="button"
            onClick={() => {
              setSelectedProgId('TODOS');
              setCurrentPage(1);
            }}
            className={`p-3.5 rounded-xl text-left border transition-all relative overflow-hidden flex flex-col justify-between ${
              selectedProgId === 'TODOS'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${selectedProgId === 'TODOS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-100 text-slate-700'}`}>
                  <BarChart2 className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedProgId === 'TODOS' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                  Consolidado
                </span>
              </div>
              <h4 className="font-bold text-xs line-clamp-1">TODOS LOS PROGRAMAS</h4>
              <p className={`text-[11px] mt-0.5 ${selectedProgId === 'TODOS' ? 'text-slate-300' : 'text-slate-500'}`}>
                Vista global y comparativa
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/40 flex items-center justify-between text-xs">
              <span className="font-extrabold">{programsStats.totalSpecialFichasCount} fichas</span>
              <span className="font-mono text-[11px] opacity-90">{Math.round(programsStats.totalSpecialHorasAW).toLocaleString('es-CO')} hrs</span>
            </div>
          </button>

          {/* Cards for each Program */}
          {SPECIAL_PROGRAMS_CONFIG.map(cfg => {
            const stat = programsStats.byProgram.get(cfg.id);
            const isSelected = selectedProgId === cfg.id;
            const Icon = cfg.icon;
            const fichasCount = stat?.totalFichas || 0;
            const matriculadosCount = stat?.totalMatriculados || 0;
            const horasAW = stat?.totalHorasAW || 0;

            return (
              <button
                key={cfg.id}
                type="button"
                onClick={() => {
                  setSelectedProgId(cfg.id);
                  setCurrentPage(1);
                }}
                className={`p-3.5 rounded-xl text-left border transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? `${cfg.accentBg} ${cfg.accentBorder} border-2 shadow-md ring-2 ring-emerald-500/50`
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-lg ${cfg.badgeBg} ${cfg.badgeText}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {fichasCount > 0 ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                        {fichasCount} {fichasCount === 1 ? 'ficha' : 'fichas'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        0 fichas
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug" title={cfg.name}>
                    {cfg.shortName}
                  </h4>
                  <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                    {cfg.category}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{matriculadosCount.toLocaleString('es-CO')} apr.</span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700">{Math.round(horasAW).toLocaleString('es-CO')} hrs</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Program Summary Card & Selected Details */}
      {activeProgStats ? (
        /* SINGLE PROGRAM SELECTED VIEW */
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden space-y-6 p-6">
          {/* Header of Active Program */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-xl ${activeProgStats.config.badgeBg} ${activeProgStats.config.badgeText} shadow-xs`}>
                <activeProgStats.config.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">
                    {activeProgStats.config.name}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${activeProgStats.config.badgeBg} ${activeProgStats.config.badgeText}`}>
                    {activeProgStats.config.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  {activeProgStats.config.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel ({activeProgStats.config.shortName})
              </button>
              <button
                type="button"
                onClick={() => setSelectedProgId('TODOS')}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Ver Todos
              </button>
            </div>
          </div>

          {/* 6 KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* KPI 1: Fichas & Cursos */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Cursos / Fichas</span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {activeProgStats.totalFichas}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <span>{activeProgStats.cursosEspeciales} Cursos</span>
                {activeProgStats.eventos > 0 && <span>Â· {activeProgStats.eventos} Eventos</span>}
              </div>
            </div>

            {/* KPI 2: Aprendices Matriculados */}
            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200">
              <div className="flex items-center justify-between text-sky-700 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Matriculados</span>
                <Users className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="text-xl font-black text-sky-900">
                {activeProgStats.totalMatriculados.toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] text-sky-700 mt-1">
                {activeProgStats.femeninos} M Â· {activeProgStats.masculinos} H
              </div>
            </div>

            {/* KPI 3: Aprendices Certificados (Col. AI DF-14A) */}
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-300">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Certificados (AI)</span>
                <Award className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-800">
                {activeProgStats.totalCertificados.toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] text-emerald-700 mt-1">
                {activeProgStats.totalMatriculados > 0 ? ((activeProgStats.totalCertificados / activeProgStats.totalMatriculados) * 100).toFixed(1) : 0}% tasa cert.
              </div>
            </div>

            {/* KPI 4: Por Certificar (Col. AH DF-14A) */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300">
              <div className="flex items-center justify-between text-amber-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Por Certificar (AH)</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-800">
                {activeProgStats.totalPorCertificar.toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] text-amber-700 mt-1">
                {activeProgStats.totalEnFormacion > 0 ? `${activeProgStats.totalEnFormacion} en form.` : 'Pendiente juicio'}
              </div>
            </div>

            {/* KPI 5: Horas Dictadas (Columna AW TOTAL_HORAS) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-600 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Horas AW</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-800">
                {Math.round(activeProgStats.totalHorasAW).toLocaleString('es-CO')} <span className="text-xs font-semibold text-emerald-600">hrs</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Sumatoria Columna AW
              </div>
            </div>

            {/* KPI 6: Instructores y Municipios */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Cobertura</span>
                <MapPin className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="text-xl font-black text-slate-900">
                {activeProgStats.instructores.size} <span className="text-xs font-normal text-slate-500">inst.</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {activeProgStats.municipios.size} municipios atendidos
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* COMPARATIVE SUMMARY VIEW (ALL SPECIAL PROGRAMS) */
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-600" />
                Consolidado Comparativo de Programas Especiales
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                DistribuciÃ³n de fichas, aprendices matriculados, por certificar (Col. AH) y certificados (Col. AI).
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Consolidado Completo
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-3">Programa Especial / Estrategia</th>
                  <th className="px-3 py-3 text-center">Cursos / Fichas</th>
                  <th className="px-3 py-3 text-center">Matriculados</th>
                  <th className="px-3 py-3 text-center bg-amber-50/80 text-amber-900 border-x border-amber-200">
                    Por Certificar (AH)
                  </th>
                  <th className="px-3 py-3 text-center bg-emerald-50/80 text-emerald-900 border-x border-emerald-200">
                    Certificados (AI)
                  </th>
                  <th className="px-3 py-3 text-center bg-slate-50 text-slate-800 border-r border-slate-200">
                    Horas Dictadas (Col. AW)
                  </th>
                  <th className="px-3 py-3 text-center">Instructores</th>
                  <th className="px-3 py-3 text-center">Municipios</th>
                  <th className="px-3 py-3 text-center">AcciÃ³n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SPECIAL_PROGRAMS_CONFIG.map(cfg => {
                  const stat = programsStats.byProgram.get(cfg.id);
                  const Icon = cfg.icon;
                  const fichasCount = stat?.totalFichas || 0;
                  const matriculadosCount = stat?.totalMatriculados || 0;
                  const certificadosCount = stat?.totalCertificados || 0;
                  const porCertificarCount = stat?.totalPorCertificar || 0;
                  const horasAW = stat?.totalHorasAW || 0;
                  const instCount = stat?.instructores.size || 0;
                  const munCount = stat?.municipios.size || 0;

                  return (
                    <tr key={cfg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${cfg.badgeBg} ${cfg.badgeText}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <strong className="text-slate-800 text-xs block">{cfg.name}</strong>
                            <span className="text-[10px] text-slate-500">{cfg.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">
                        {fichasCount > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText} text-xs font-bold`}>
                            {fichasCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-slate-800">
                        {matriculadosCount > 0 ? matriculadosCount.toLocaleString('es-CO') : '-'}
                      </td>
                      <td className="px-3 py-3 text-center bg-amber-50/40 font-mono font-bold text-amber-900 border-x border-amber-100">
                        {porCertificarCount > 0 ? porCertificarCount.toLocaleString('es-CO') : '-'}
                      </td>
                      <td className="px-3 py-3 text-center bg-emerald-50/40 font-mono font-bold text-emerald-800 border-x border-emerald-100">
                        {certificadosCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            {certificadosCount.toLocaleString('es-CO')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center bg-slate-50 font-mono font-bold text-slate-800 border-r border-slate-200">
                        {horasAW > 0 ? `${Math.round(horasAW).toLocaleString('es-CO')} hrs` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 font-medium">
                        {instCount > 0 ? `${instCount} doc.` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 font-medium">
                        {munCount > 0 ? `${munCount} mun.` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProgId(cfg.id);
                            setCurrentPage(1);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                        >
                          Ver Detalle <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100/90 text-slate-900 border-t-2 border-slate-300 font-bold text-xs">
                <tr>
                  <td className="px-3.5 py-3 uppercase tracking-wider font-bold text-slate-800">
                    Total Estrategias Especiales
                  </td>
                  <td className="px-3 py-3 text-center font-black text-emerald-900">
                    {programsStats.totalSpecialFichasCount} fichas
                  </td>
                  <td className="px-3 py-3 text-center font-black text-slate-900">
                    {programsStats.totalSpecialMatriculados.toLocaleString('es-CO')}
                  </td>
                  <td className="px-3 py-3 text-center bg-amber-100 text-amber-900 font-mono font-black border-x border-amber-300">
                    {programsStats.totalSpecialPorCertificar.toLocaleString('es-CO')}
                  </td>
                  <td className="px-3 py-3 text-center bg-emerald-100 text-emerald-900 font-mono font-black border-x border-emerald-300">
                    {programsStats.totalSpecialCertificados.toLocaleString('es-CO')}
                  </td>
                  <td className="px-3 py-3 text-center bg-slate-200 text-slate-900 font-mono font-black border-r border-slate-300">
                    {Math.round(programsStats.totalSpecialHorasAW).toLocaleString('es-CO')} hrs
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700">
                    {Array.from(programsStats.byProgram.values()).reduce((acc: number, p: any) => acc + (p?.instructores?.size || 0), 0)} asignaciones
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700">
                    Cobertura regional
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tabs for In-Depth Exploration */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('kpi')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'kpi'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Cursos Ofertados ({coursesCatalog.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('instructores')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'instructores'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Instructores ({instructorsList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('municipios')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'municipios'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Cobertura Territorial ({municipalitiesCoverage.length} Mun.)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fichas')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'fichas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Listado de Fichas ({currentProgramFichas.length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar ficha, curso, instructor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="p-5">
          {/* TAB 1: CURSOS OFERTADOS */}
          {activeTab === 'kpi' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Programas de FormaciÃ³n y Cursos Ofertados
                </h4>
                <span className="text-xs text-slate-500">
                  {coursesCatalog.length} programas Ãºnicos
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Programa de FormaciÃ³n</th>
                      <th className="px-3 py-2.5 text-center">Fichas</th>
                      <th className="px-3 py-2.5 text-center">Matriculados</th>
                      <th className="px-3 py-2.5 text-center bg-amber-50 text-amber-900 border-x border-amber-200">
                        Por Certificar (AH)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-emerald-50 text-emerald-900 border-r border-emerald-200">
                        Certificados (AI)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-slate-50 text-slate-800 border-r border-slate-200">
                        Horas (Col. AW)
                      </th>
                      <th className="px-3 py-2.5">Instructores Asignados</th>
                      <th className="px-3 py-2.5">Municipios de ImparticiÃ³n</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coursesCatalog.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No se encontraron programas con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      coursesCatalog.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-800 max-w-sm">
                            {c.programa}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                              {c.fichas}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-800">
                            {c.matriculados.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-amber-50/40 font-mono font-bold text-amber-900 border-x border-amber-100">
                            {c.porCertificar > 0 ? c.porCertificar.toLocaleString('es-CO') : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-emerald-50/40 font-mono font-bold text-emerald-800 border-r border-emerald-100">
                            {c.certificados > 0 ? (
                              <span className="font-bold text-emerald-700">{c.certificados.toLocaleString('es-CO')}</span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-slate-50 font-mono font-bold text-slate-800 border-r border-slate-200">
                            {Math.round(c.horasAW).toLocaleString('es-CO')} hrs
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-xs">
                            <div className="line-clamp-2 text-[11px]" title={Array.from(c.instructores).join(', ')}>
                              {Array.from(c.instructores).slice(0, 3).join(', ')}
                              {c.instructores.size > 3 && ` (+${c.instructores.size - 3} mÃ¡s)`}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-xs">
                            <div className="line-clamp-2 text-[11px]" title={Array.from(c.municipios).join(', ')}>
                              {Array.from(c.municipios).slice(0, 3).join(', ')}
                              {c.municipios.size > 3 && ` (+${c.municipios.size - 3} mÃ¡s)`}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INSTRUCTORES ASIGNADOS */}
          {activeTab === 'instructores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  Docentes e Instructores a Cargo de la Estrategia
                </h4>
                <span className="text-xs text-slate-500">
                  {instructorsList.length} instructores
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Instructor / Responsable</th>
                      <th className="px-3 py-2.5 text-center">Fichas</th>
                      <th className="px-3 py-2.5 text-center">Cursos</th>
                      <th className="px-3 py-2.5 text-center">Eventos</th>
                      <th className="px-3 py-2.5 text-center">Matriculados</th>
                      <th className="px-3 py-2.5 text-center bg-amber-50 text-amber-900 border-x border-amber-200 font-bold">
                        Por Certificar (AH)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-emerald-50 text-emerald-900 border-r border-emerald-200 font-bold">
                        Certificados (AI)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-slate-50 text-slate-800 border-r border-slate-200 font-bold">
                        Horas (Col. AW)
                      </th>
                      <th className="px-3 py-2.5">Municipios Atendidos</th>
                      <th className="px-3 py-2.5 text-center">AcciÃ³n</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {instructorsList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No se encontraron instructores con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      instructorsList.map((inst, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-800">
                            {inst.nombre}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                              {inst.fichas}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{inst.cursos || '-'}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{inst.eventos || '-'}</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-800">
                            {inst.matriculados.toLocaleString('es-CO')}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-amber-50/40 font-mono font-bold text-amber-900 border-x border-amber-100">
                            {inst.porCertificar > 0 ? inst.porCertificar.toLocaleString('es-CO') : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-emerald-50/40 font-mono font-bold text-emerald-800 border-r border-emerald-100">
                            {inst.certificados > 0 ? (
                              <span className="font-bold text-emerald-700">{inst.certificados.toLocaleString('es-CO')}</span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-slate-50 font-mono font-bold text-slate-800 border-r border-slate-200">
                            {Math.round(inst.horasAW).toLocaleString('es-CO')} hrs
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-xs">
                            <div className="line-clamp-1 text-[11px]" title={Array.from(inst.municipios).join(', ')}>
                              {Array.from(inst.municipios).join(', ') || 'SOGAMOSO'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {onSelectInstructor && inst.nombre !== 'POR ASIGNAR' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectInstructor(inst.nombre);
                                  // Scroll up slightly to calendar if needed
                                  window.scrollTo({ top: 500, behavior: 'smooth' });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                              >
                                Ver Calendario
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COBERTURA TERRITORIAL */}
          {activeTab === 'municipios' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Municipios y Cobertura GeogrÃ¡fica
                </h4>
                <span className="text-xs text-slate-500">
                  {municipalitiesCoverage.length} municipios
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {municipalitiesCoverage.map((m, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          {m.municipio}
                        </strong>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {m.fichas} {m.fichas === 1 ? 'ficha' : 'fichas'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {m.programas.size} programas distintos impartidos
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Aprendices</span>
                        <strong className="text-slate-800">{m.matriculados.toLocaleString('es-CO')}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Horas Dictadas</span>
                        <strong className="text-emerald-700 font-mono">{Math.round(m.horasAW).toLocaleString('es-CO')} hrs</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LISTADO DETALLADO DE FICHAS */}
          {activeTab === 'fichas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Detalle de Fichas ({currentProgramFichas.length.toLocaleString('es-CO')})
                </h4>
                <p className="text-xs text-slate-500">
                  PÃ¡gina {currentPage} de {totalPages || 1}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Ficha</th>
                      <th className="px-3.5 py-2.5">Estrategia Especial</th>
                      <th className="px-3.5 py-2.5">Programa de FormaciÃ³n</th>
                      <th className="px-3 py-2.5">Instructor</th>
                      <th className="px-3 py-2.5">Municipio</th>
                      <th className="px-3 py-2.5 text-center">Matriculados</th>
                      <th className="px-3 py-2.5 text-center bg-amber-50 text-amber-900 border-x border-amber-200 font-bold">
                        Por Certificar (AH)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-emerald-50 text-emerald-900 border-r border-emerald-200 font-bold">
                        Certificados (AI)
                      </th>
                      <th className="px-3 py-2.5 text-center bg-slate-50 text-slate-800 border-r border-slate-200 font-bold">
                        Horas (Col. AW)
                      </th>
                      <th className="px-3 py-2.5 text-center">Estado</th>
                      <th className="px-3 py-2.5 text-center">AcciÃ³n</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedFichas.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          No se encontraron fichas con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedFichas.map((f, idx) => (
                        <tr key={f.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800">
                            {f.ficha}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {f.estrategiaEspecial || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 max-w-xs">
                            <div className="font-semibold text-slate-800 line-clamp-2" title={f.programa}>
                              {f.programa}
                            </div>
                            {f.empresa && (
                              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                {f.empresa}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 font-medium max-w-xs truncate">
                            {f.instructor || 'POR ASIGNAR'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {f.municipio || 'SOGAMOSO'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                            {f.matriculados}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-amber-50/40 font-mono font-bold text-amber-900 border-x border-amber-100">
                            {f.porCertificar > 0 ? f.porCertificar : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-emerald-50/40 font-mono font-bold text-emerald-800 border-r border-emerald-100">
                            {f.certificados > 0 ? (
                              <span className="font-bold text-emerald-700">{f.certificados}</span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center bg-slate-50 font-mono font-bold text-slate-800 border-r border-slate-200">
                            {f.horasTotales || f.duracionHoras || 40} hrs
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              /terminad/i.test(f.estadoFicha)
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {f.estadoFicha}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {onViewFichaDetail && (
                              <button
                                type="button"
                                onClick={() => onViewFichaDetail(f)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Ver
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                  <span className="text-slate-500">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, currentProgramFichas.length)} de {currentProgramFichas.length} registros
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="px-2 text-slate-700 font-semibold">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

