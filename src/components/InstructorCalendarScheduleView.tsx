/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  BookOpen, 
  Users, 
  Layers, 
  Sparkles, 
  Info, 
  Eye, 
  Download,
  CalendarDays,
  Sun,
  Flame,
  Search,
  Filter,
  Check,
  Building2,
  CalendarRange
} from 'lucide-react';
import { FichaComplementaria } from '../types';

interface InstructorCalendarScheduleViewProps {
  fichas: FichaComplementaria[];
  selectedInstructor?: string;
  onSelectInstructor?: (instructor: string) => void;
  onViewFichaDetail?: (ficha: FichaComplementaria) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const SHORT_MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Robust date parser supporting DD/MM/YYYY, YYYY-MM-DD, and Date objects
 */
function parseDateRobust(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  
  // DD/MM/YYYY format
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
  }

  // YYYY-MM-DD format
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
  }

  // Standard date parsing fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

function formatDateDisplay(d: Date | null): string {
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const InstructorCalendarScheduleView: React.FC<InstructorCalendarScheduleViewProps> = ({
  fichas,
  selectedInstructor = 'TODOS',
  onSelectInstructor,
  onViewFichaDetail
}) => {
  // List of distinct instructors with counts
  const instructorsSummary = useMemo(() => {
    const map: { [name: string]: { name: string; count: number; matriculados: number; horas: number } } = {};
    fichas.forEach(f => {
      const inst = f.instructor || 'POR ASIGNAR';
      if (!map[inst]) {
        map[inst] = { name: inst, count: 0, matriculados: 0, horas: 0 };
      }
      map[inst].count += 1;
      map[inst].matriculados += f.matriculados || 0;
      map[inst].horas += f.horasTotales || f.duracionHoras || 0;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [fichas]);

  // Default instructor selection
  const [activeInstructor, setActiveInstructor] = useState<string>(() => {
    if (selectedInstructor && selectedInstructor !== 'TODOS') return selectedInstructor;
    return instructorsSummary[0]?.name || 'TODOS';
  });

  // Keep synced if parent changes selectedInstructor to a specific one
  React.useEffect(() => {
    if (selectedInstructor && selectedInstructor !== 'TODOS') {
      setActiveInstructor(selectedInstructor);
    }
  }, [selectedInstructor]);

  // Determine active year based on fichas
  const activeYear = useMemo(() => {
    for (const f of fichas) {
      const d = parseDateRobust(f.fechaInicio);
      if (d) return d.getFullYear();
    }
    return 2026;
  }, [fichas]);

  // State for Month and View Mode
  const [currentYear, setCurrentYear] = useState<number>(activeYear);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(0); // 0 = Enero
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'timeline'>('month');
  const [instructorSearch, setInstructorSearch] = useState<string>('');

  // Filtered instructors for selector dropdown
  const filteredInstructorsList = useMemo(() => {
    if (!instructorSearch.trim()) return instructorsSummary;
    const term = instructorSearch.toLowerCase();
    return instructorsSummary.filter(i => i.name.toLowerCase().includes(term));
  }, [instructorsSummary, instructorSearch]);

  // Fichas assigned to current instructor with parsed Date objects
  const instructorFichas = useMemo(() => {
    if (!activeInstructor || activeInstructor === 'TODOS') {
      return fichas.map(f => ({
        ...f,
        parsedStart: parseDateRobust(f.fechaInicio),
        parsedEnd: parseDateRobust(f.fechaFin)
      }));
    }

    return fichas
      .filter(f => (f.instructor || 'POR ASIGNAR') === activeInstructor)
      .map(f => ({
        ...f,
        parsedStart: parseDateRobust(f.fechaInicio),
        parsedEnd: parseDateRobust(f.fechaFin)
      }));
  }, [fichas, activeInstructor]);

  // Handle Instructor Change
  const handleInstructorChange = (inst: string) => {
    setActiveInstructor(inst);
    setSelectedDayNumber(null);
    if (onSelectInstructor) {
      onSelectInstructor(inst);
    }
  };

  // Build Calendar Days for Current Month
  const monthCalendarData = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    // In JS, getDay() returns 0 for Sunday, 1 for Monday... We want Monday = 0, Sunday = 6
    const firstDayOfWeek = (new Date(currentYear, currentMonthIndex, 1).getDay() + 6) % 7;

    const days = [];

    // Prepend empty padding days for previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        dayNumber: null,
        date: null,
        isPadding: true,
        isWeekend: false,
        isProgrammed: false,
        activeFichas: []
      });
    }

    let totalProgrammedWeekdays = 0;
    let totalAvailableWeekdays = 0;
    let totalWeekendDays = 0;
    let totalProgrammedWeekendDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(currentYear, currentMonthIndex, d);
      const dayOfWeek = (dayDate.getDay() + 6) % 7; // 0=Lun, 6=Dom
      const isWeekend = dayOfWeek >= 5;

      // Find all fichas active on this date
      const activeFichas = instructorFichas.filter(f => {
        if (!f.parsedStart || !f.parsedEnd) return false;
        // Strip time for exact day comparison
        const dayTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
        const startTime = new Date(f.parsedStart.getFullYear(), f.parsedStart.getMonth(), f.parsedStart.getDate()).getTime();
        const endTime = new Date(f.parsedEnd.getFullYear(), f.parsedEnd.getMonth(), f.parsedEnd.getDate()).getTime();
        return dayTime >= startTime && dayTime <= endTime;
      });

      const isProgrammed = activeFichas.length > 0;

      if (isWeekend) {
        totalWeekendDays++;
        if (isProgrammed) totalProgrammedWeekendDays++;
      } else {
        if (isProgrammed) {
          totalProgrammedWeekdays++;
        } else {
          totalAvailableWeekdays++;
        }
      }

      days.push({
        dayNumber: d,
        date: dayDate,
        dayOfWeek,
        isPadding: false,
        isWeekend,
        isProgrammed,
        activeFichas
      });
    }

    const totalWeekdays = totalProgrammedWeekdays + totalAvailableWeekdays;
    const occupancyRate = totalWeekdays > 0 ? Math.round((totalProgrammedWeekdays / totalWeekdays) * 100) : 0;
    const availabilityRate = 100 - occupancyRate;

    // Fichas active in this month
    const monthStart = new Date(currentYear, currentMonthIndex, 1).getTime();
    const monthEnd = new Date(currentYear, currentMonthIndex, daysInMonth, 23, 59, 59).getTime();

    const fichasInThisMonth = instructorFichas.filter(f => {
      if (!f.parsedStart || !f.parsedEnd) return false;
      const st = f.parsedStart.getTime();
      const en = f.parsedEnd.getTime();
      return st <= monthEnd && en >= monthStart;
    });

    const totalHoursMonth = fichasInThisMonth.reduce((acc, f) => acc + (f.horasTotales || f.duracionHoras || 0), 0);
    const totalStudentsMonth = fichasInThisMonth.reduce((acc, f) => acc + (f.matriculados || 0), 0);

    return {
      days,
      daysInMonth,
      totalWeekdays,
      totalProgrammedWeekdays,
      totalAvailableWeekdays,
      totalWeekendDays,
      totalProgrammedWeekendDays,
      occupancyRate,
      availabilityRate,
      fichasInThisMonth,
      totalHoursMonth,
      totalStudentsMonth
    };
  }, [currentYear, currentMonthIndex, instructorFichas]);

  // Year Summary Data across all 12 months for the selected instructor
  const yearlySummaryData = useMemo(() => {
    return MONTH_NAMES.map((mName, mIdx) => {
      const daysInM = new Date(currentYear, mIdx + 1, 0).getDate();
      let programmedWeekdays = 0;
      let availableWeekdays = 0;
      const activeFichasSet = new Set<string>();

      for (let d = 1; d <= daysInM; d++) {
        const dayDate = new Date(currentYear, mIdx, d);
        const dayOfWeek = (dayDate.getDay() + 6) % 7;
        const isWeekend = dayOfWeek >= 5;

        const activeOnDay = instructorFichas.filter(f => {
          if (!f.parsedStart || !f.parsedEnd) return false;
          const dayTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
          const startTime = new Date(f.parsedStart.getFullYear(), f.parsedStart.getMonth(), f.parsedStart.getDate()).getTime();
          const endTime = new Date(f.parsedEnd.getFullYear(), f.parsedEnd.getMonth(), f.parsedEnd.getDate()).getTime();
          return dayTime >= startTime && dayTime <= endTime;
        });

        if (!isWeekend) {
          if (activeOnDay.length > 0) {
            programmedWeekdays++;
            activeOnDay.forEach(f => activeFichasSet.add(f.ficha));
          } else {
            availableWeekdays++;
          }
        }
      }

      const totalWeekdays = programmedWeekdays + availableWeekdays;
      const occRate = totalWeekdays > 0 ? Math.round((programmedWeekdays / totalWeekdays) * 100) : 0;

      return {
        monthIndex: mIdx,
        monthName: mName,
        shortName: SHORT_MONTH_NAMES[mIdx],
        daysInMonth: daysInM,
        programmedWeekdays,
        availableWeekdays,
        totalWeekdays,
        occupancyRate: occRate,
        fichasCount: activeFichasSet.size
      };
    });
  }, [currentYear, instructorFichas]);

  // Active day details when clicked
  const selectedDayInfo = useMemo(() => {
    if (!selectedDayNumber) return null;
    return monthCalendarData.days.find(d => d.dayNumber === selectedDayNumber && !d.isPadding) || null;
  }, [selectedDayNumber, monthCalendarData]);

  // Navigate months
  const handlePrevMonth = () => {
    setSelectedDayNumber(null);
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonthIndex(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDayNumber(null);
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonthIndex(m => m + 1);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Header Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-xs">
              <CalendarDays className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-wide text-white flex items-center gap-2">
                Calendario de Programación y Días Disponibles por Instructor
              </h3>
              <p className="text-xs text-slate-300">
                Basado en <code className="text-emerald-300 font-mono text-[11px]">FECHA_INICIO_FICHA</code> y <code className="text-sky-300 font-mono text-[11px]">FECHA_TERMINACION_FICHA</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Instructor Picker + View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Instructor Selector */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 shadow-2xs">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">Instructor:</span>
            <select
              value={activeInstructor}
              onChange={(e) => handleInstructorChange(e.target.value)}
              className="text-xs font-bold text-white bg-transparent focus:outline-none cursor-pointer max-w-[220px] truncate"
            >
              <option value="TODOS" className="bg-slate-800 text-white">Todos los Instructores (Consolidado)</option>
              {instructorsSummary.map(inst => (
                <option key={inst.name} value={inst.name} className="bg-slate-800 text-white">
                  {inst.name} ({inst.count} fichas)
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                viewMode === 'month' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Mes a Mes
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                viewMode === 'year' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Vista Anual
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 font-semibold rounded-md transition-all ${
                viewMode === 'timeline' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              Lista de Cursos
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 space-y-6">
        {/* Month Navigation & Month Switcher Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={handlePrevMonth}
                title="Mes anterior"
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-800 px-3 py-1 min-w-[140px] text-center">
                {MONTH_NAMES[currentMonthIndex]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                title="Mes siguiente"
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1">
              {SHORT_MONTH_NAMES.map((sm, idx) => (
                <button
                  key={sm}
                  onClick={() => {
                    setCurrentMonthIndex(idx);
                    setSelectedDayNumber(null);
                  }}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                    currentMonthIndex === idx
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {sm}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Legend Chips */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Día Programado (Con Clases)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              Día Disponible (Hábil Libre)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              Fin de Semana
            </span>
          </div>
        </div>

        {/* 4 Metric KPI Cards for the Instructor & Period */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: Días Programados */}
          <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Días Programados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-900">
              {monthCalendarData.totalProgrammedWeekdays} <span className="text-xs font-semibold text-emerald-700">días hábiles</span>
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
              {monthCalendarData.occupancyRate}% Ocupación laboral en el mes
            </p>
          </div>

          {/* KPI 2: Días Disponibles */}
          <div className="p-4 bg-sky-50/70 rounded-xl border border-sky-200">
            <div className="flex items-center justify-between text-sky-700 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Días Disponibles</span>
              <Sun className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-sky-900">
              {monthCalendarData.totalAvailableWeekdays} <span className="text-xs font-semibold text-sky-700">días libres</span>
            </p>
            <p className="text-[11px] text-sky-700 font-semibold mt-1">
              {monthCalendarData.availabilityRate}% Disponibilidad para asignar cursos
            </p>
          </div>

          {/* KPI 3: Fichas en el Mes */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cursos en Ejecución</span>
              <BookOpen className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {monthCalendarData.fichasInThisMonth.length} <span className="text-xs font-semibold text-slate-500">fichas</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {activeInstructor === 'TODOS' ? 'Consolidado Centro Minero' : activeInstructor}
            </p>
          </div>

          {/* KPI 4: Horas & Matrícula */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Horas & Aprendices</span>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-800">
              {monthCalendarData.totalHoursMonth.toLocaleString('es-CO')} <span className="text-xs font-normal text-slate-500">hrs</span>
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              {monthCalendarData.totalStudentsMonth.toLocaleString('es-CO')} aprendices inscritos
            </p>
          </div>
        </div>

        {/* VIEW MODE: MONTH CALENDAR GRID */}
        {viewMode === 'month' && (
          <div className="space-y-4">
            {/* Calendar Grid Container */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              {/* Day of Week Header */}
              <div className="grid grid-cols-7 bg-slate-100 text-center border-b border-slate-200 text-xs font-bold uppercase text-slate-700 py-2.5">
                {DAY_LABELS.map((day, idx) => (
                  <div key={day} className={idx >= 5 ? 'text-slate-400' : 'text-slate-800'}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {monthCalendarData.days.map((item, idx) => {
                  if (item.isPadding) {
                    return (
                      <div 
                        key={`pad-${idx}`} 
                        className="min-h-[85px] sm:min-h-[105px] bg-slate-50/40 p-2 text-slate-300 select-none"
                      />
                    );
                  }

                  const isSelected = selectedDayNumber === item.dayNumber;

                  return (
                    <div
                      key={`day-${item.dayNumber}`}
                      onClick={() => {
                        if (item.dayNumber) {
                          setSelectedDayNumber(isSelected ? null : item.dayNumber);
                        }
                      }}
                      className={`min-h-[85px] sm:min-h-[105px] p-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 bg-emerald-50/40 z-10'
                          : item.isWeekend
                            ? 'bg-slate-50/70 hover:bg-slate-100/60'
                            : item.isProgrammed
                              ? 'bg-emerald-50/50 hover:bg-emerald-100/60'
                              : 'bg-white hover:bg-sky-50/50'
                      }`}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between">
                        <span 
                          className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : item.isProgrammed
                                ? 'bg-emerald-600 text-white font-black shadow-2xs'
                                : item.isWeekend
                                  ? 'text-slate-400'
                                  : 'text-slate-700'
                          }`}
                        >
                          {item.dayNumber}
                        </span>

                        {/* Top Indicator */}
                        {item.isProgrammed ? (
                          <span className="hidden sm:inline-flex text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                            {item.activeFichas.length} {item.activeFichas.length === 1 ? 'curso' : 'cursos'}
                          </span>
                        ) : !item.isWeekend ? (
                          <span className="hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                            Libre
                          </span>
                        ) : null}
                      </div>

                      {/* Day Content Badges */}
                      <div className="mt-1 space-y-1">
                        {item.isProgrammed ? (
                          <div>
                            {item.activeFichas.slice(0, 2).map((f) => (
                              <div
                                key={f.id || f.ficha}
                                className="text-[10px] bg-white border border-emerald-200 text-emerald-900 rounded p-1 shadow-2xs truncate font-medium"
                                title={`Ficha: ${f.ficha} - ${f.programa}`}
                              >
                                <span className="font-bold text-emerald-700">F.{f.ficha}</span> {f.programa.substring(0, 18)}...
                              </div>
                            ))}
                            {item.activeFichas.length > 2 && (
                              <div className="text-[9px] font-bold text-emerald-800 text-center bg-emerald-100 rounded py-0.5">
                                +{item.activeFichas.length - 2} más
                              </div>
                            )}
                          </div>
                        ) : item.isWeekend ? (
                          <div className="text-[10px] text-slate-400 text-center py-1">
                            Fin de semana
                          </div>
                        ) : (
                          <div className="text-[10px] text-sky-700 font-semibold text-center bg-sky-50 rounded py-1 border border-sky-100">
                            Disponible
                          </div>
                        )}
                      </div>

                      {/* Bottom Dot for Mobile */}
                      <div className="sm:hidden flex justify-center mt-1">
                        {item.isProgrammed ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        ) : !item.isWeekend ? (
                          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Inspector Panel */}
            {selectedDayInfo && selectedDayInfo.dayNumber && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-800">
                      Detalle del Día {selectedDayInfo.dayNumber} de {MONTH_NAMES[currentMonthIndex]} de {currentYear}
                    </h4>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      selectedDayInfo.isProgrammed
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedDayInfo.isWeekend
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-sky-100 text-sky-800'
                    }`}>
                      {selectedDayInfo.isProgrammed
                        ? `${selectedDayInfo.activeFichas.length} Cursos Activos (Día Programado)`
                        : selectedDayInfo.isWeekend
                          ? 'Fin de semana (Descanso)'
                          : 'Día Hábil Disponible (Sin programación)'}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedDayNumber(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                  >
                    Cerrar Detalle
                  </button>
                </div>

                {selectedDayInfo.activeFichas.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 bg-white rounded-lg border border-slate-200 text-xs">
                    {selectedDayInfo.isWeekend
                      ? 'Este día corresponde a fin de semana. No hay jornadas académicas registradas.'
                      : 'El instructor se encuentra completamente disponible en esta fecha para la apertura o asignación de nuevas acciones de formación complementaria.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDayInfo.activeFichas.map((f) => (
                      <div
                        key={f.id || f.ficha}
                        className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Ficha: {f.ficha}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500 font-semibold">
                              {f.nivelFormacion || f.tipoFormacion}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {f.duracionHoras} hrs
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 line-clamp-2">
                          {f.programa}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[10px]">FECHA INICIO:</span>
                            <strong className="text-slate-800">{f.fechaInicio}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">FECHA TERMINACIÓN:</span>
                            <strong className="text-slate-800">{f.fechaFin}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">MUNICIPIO:</span>
                            <strong className="text-slate-800 truncate block">{f.municipio}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">APRENDICES:</span>
                            <strong className="text-emerald-700">{f.matriculados} matriculados</strong>
                          </div>
                        </div>

                        {onViewFichaDetail && (
                          <div className="text-right pt-1">
                            <button
                              onClick={() => onViewFichaDetail(f)}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver Ficha Completa
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE: YEAR CALENDAR GRID (12 MONTHS) */}
        {viewMode === 'year' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {yearlySummaryData.map((m) => (
                <div
                  key={m.monthIndex}
                  onClick={() => {
                    setCurrentMonthIndex(m.monthIndex);
                    setViewMode('month');
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    m.programmedWeekdays > 0
                      ? 'bg-white hover:border-emerald-400 border-slate-200 shadow-2xs hover:shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <h5 className="text-xs font-bold text-slate-800 uppercase">
                      {m.monthName}
                    </h5>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                      {m.fichasCount} {m.fichasCount === 1 ? 'ficha' : 'fichas'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px]">Días Programados:</span>
                      <strong className="text-emerald-700">{m.programmedWeekdays} días</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px]">Días Disponibles:</span>
                      <strong className="text-sky-700">{m.availableWeekdays} días</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-[11px]">Tasa de Ocupación:</span>
                      <strong className="text-slate-800 font-bold">{m.occupancyRate}%</strong>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${m.occupancyRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 hover:underline">
                      Explorar Calendario de {m.shortName} →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW MODE: TIMELINE / CHRONOLOGICAL LIST OF COURSES */}
        {viewMode === 'timeline' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-emerald-600" />
                Cronología de Cursos Asignados ({instructorFichas.length} Cursos Registrados)
              </h4>
              <span className="text-xs text-slate-500">
                Ordenados por fecha de inicio
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Ficha</th>
                    <th className="px-3 py-2.5">Programa de Formación</th>
                    <th className="px-3 py-2.5">Tipo / Nivel</th>
                    <th className="px-3 py-2.5 text-center">Fecha Inicio</th>
                    <th className="px-3 py-2.5 text-center">Fecha Fin</th>
                    <th className="px-3 py-2.5 text-center">Duración Horas</th>
                    <th className="px-3 py-2.5">Municipio</th>
                    <th className="px-3 py-2.5 text-center">Aprendices</th>
                    <th className="px-3 py-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {instructorFichas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No hay cursos registrados para este instructor en el periodo.
                      </td>
                    </tr>
                  ) : (
                    instructorFichas
                      .sort((a, b) => (a.parsedStart?.getTime() || 0) - (b.parsedStart?.getTime() || 0))
                      .map((f, idx) => (
                        <tr key={f.id || idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                            {f.ficha}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800 max-w-xs truncate" title={f.programa}>
                            {f.programa}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 text-[10px] rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {f.nivelFormacion || f.tipoFormacion}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-800 bg-emerald-50/40">
                            {f.fechaInicio}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-sky-800 bg-sky-50/40">
                            {f.fechaFin}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-700">
                            {f.duracionHoras} hrs
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 truncate max-w-[120px]">
                            {f.municipio}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                            {f.matriculados}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {onViewFichaDetail && (
                              <button
                                onClick={() => onViewFichaDetail(f)}
                                className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                              >
                                Ver Detalle
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
      </div>
    </div>
  );
};
