/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Servicio de Generación de Informes PDF para Análisis de Tiempos y Horas Programadas por Instructor.
 * Incluye:
 * - Primera Hoja: Informe General Consolidado de Alertas (< 100h, 100-140h, > 180h).
 * - Hojas Siguientes: Una hoja dedicada por cada instructor con el análisis detallado de tiempos y horas.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReporteHorasRecord, cleanInstructorName } from '../components/HorasReportadasView';

export interface GenerateTiemposPdfOptions {
  records: ReporteHorasRecord[];
  monthsList?: string[];
  selectedInstructorId?: string | null;
  vigencia?: string;
  centro?: string;
  onProgress?: (current: number, total: number, instructorName: string) => void;
}

export type AlertType = 'BAJA' | 'INTERMEDIA' | 'OPTIMA' | 'SOBRECARGA';

export interface InstructorMonthlyRow {
  mes: string;
  hTitulada: number;
  hComplementaria: number;
  totalFormacion: number;
  hAdicionales: number;
  totalHoras: number;
  disenoCurricular: number;
  investigacion: number;
  calidad: number;
  otros: number;
  alert: AlertType;
  alertLabel: string;
}

export interface InstructorAnalysis {
  id: string;
  name: string;
  doc: string;
  vinculacion: string;
  monthlyRows: InstructorMonthlyRow[];
  totalHoras: number;
  promedioMensual: number;
  maxMonth: { mes: string; horas: number };
  minMonth: { mes: string; horas: number };
  countBaja: number;         // < 100h
  countIntermedia: number;   // 100 - 140h
  countOptima: number;       // 140 - 190h
  countSobrecarga: number;   // > 190h
  primaryAlert: AlertType;
  alertSummaryText: string;
}

/**
 * Determina el tipo de alerta según los criterios especificados:
 * - < 100 horas al mes: Alerta Baja
 * - 100 a 140 horas al mes: Alerta Intermedia
 * - 140 a 190 horas al mes: Rango Óptimo / Normal
 * - > 190 horas al mes: Alerta Sobrecarga
 */
export function getAlertForHours(hours: number): { type: AlertType; label: string; shortLabel: string } {
  if (hours < 100) {
    return { type: 'BAJA', label: 'Alerta Baja Carga (< 100h)', shortLabel: '< 100h' };
  }
  if (hours >= 100 && hours <= 140) {
    return { type: 'INTERMEDIA', label: 'Alerta Intermedia (100–140h)', shortLabel: '100-140h' };
  }
  if (hours > 140 && hours <= 190) {
    return { type: 'OPTIMA', label: 'Carga Óptima (140–190h)', shortLabel: '140-190h' };
  }
  return { type: 'SOBRECARGA', label: 'Alerta Sobrecarga (> 190h)', shortLabel: '> 190h' };
}

const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function sortMonthsChronologically(months: string[]): string[] {
  return [...months].sort((a, b) => {
    const idxA = SPANISH_MONTHS.indexOf(a.toLowerCase().trim());
    const idxB = SPANISH_MONTHS.indexOf(b.toLowerCase().trim());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Agrupa y analiza los registros por instructor y mes
 */
export function analyzeInstructorsData(
  records: ReporteHorasRecord[],
  monthsList?: string[],
  selectedInstructorId?: string | null
): { instructors: InstructorAnalysis[]; months: string[]; generalStats: any } {
  if (!records || records.length === 0) {
    return { instructors: [], months: [], generalStats: null };
  }

  // Detect available months
  let effectiveMonths: string[] = [];
  if (monthsList && monthsList.length > 0) {
    effectiveMonths = monthsList;
  } else {
    const mSet = new Set<string>();
    records.forEach(r => {
      if (r.hoja && r.hoja !== 'SOFIA' && r.hoja !== 'Google Drive' && !/^\d+$/.test(r.hoja) && !r.hoja.toUpperCase().startsWith('REGIONAL')) {
        const cleanM = r.hoja.trim();
        mSet.add(cleanM.charAt(0).toUpperCase() + cleanM.slice(1).toLowerCase());
      }
    });
    effectiveMonths = mSet.size > 0 ? sortMonthsChronologically(Array.from(mSet)) : ['Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
  }

  // Group by instructor key (cédula o nombre)
  const instructorGroups = new Map<string, ReporteHorasRecord[]>();

  records.forEach(r => {
    const cName = cleanInstructorName(r.instructor || 'INSTRUCTOR SIN NOMBRE');
    const doc = r.documentoInstructor || '';
    const key = doc || cName.toUpperCase().trim();

    if (!instructorGroups.has(key)) {
      instructorGroups.set(key, []);
    }
    instructorGroups.get(key)!.push(r);
  });

  const instructors: InstructorAnalysis[] = [];

  instructorGroups.forEach((instRecs, key) => {
    if (selectedInstructorId && selectedInstructorId !== 'TODOS') {
      const matchDoc = instRecs.some(r => r.documentoInstructor === selectedInstructorId);
      const matchKey = key === selectedInstructorId;
      const matchName = instRecs.some(r => cleanInstructorName(r.instructor).toUpperCase().trim() === selectedInstructorId.toUpperCase().trim());
      if (!matchDoc && !matchKey && !matchName) return;
    }

    const first = instRecs[0];
    const name = cleanInstructorName(first.instructor || key).toUpperCase();
    const doc = first.documentoInstructor || (key.match(/^\d+$/) ? key : 'Sin Documento');
    const vinculacion = first.vinculacion || 'CONTRATISTA SENA';

    let totalHoras = 0;
    let countBaja = 0;
    let countIntermedia = 0;
    let countOptima = 0;
    let countSobrecarga = 0;

    const monthlyRows: InstructorMonthlyRow[] = effectiveMonths.map(m => {
      const monthLower = m.toLowerCase().trim();
      const matching = instRecs.filter(r => {
        if (!r.hoja) return false;
        const h = r.hoja.toLowerCase().trim();
        return h === monthLower || h.includes(monthLower) || monthLower.includes(h);
      });

      if (matching.length > 0) {
        const hTit = matching.reduce((s, r) => s + (r.horasTituladaLectiva !== undefined && r.horasTituladaLectiva !== null ? r.horasTituladaLectiva : (r.horasEjecutadas || 0)), 0);
        const hComp = matching.reduce((s, r) => s + (r.horasComplementaria || 0), 0);
        const totForm = matching.reduce((s, r) => s + (r.totalHorasFormacion !== undefined && r.totalHorasFormacion !== null ? r.totalHorasFormacion : (hTit + hComp)), 0);
        const hAdic = matching.reduce((s, r) => s + (r.horasAdicionales || 0), 0);
        const totH = matching.reduce((s, r) => s + (r.totalHorasInstructor !== undefined && r.totalHorasInstructor !== null ? r.totalHorasInstructor : (totForm + hAdic)), 0);

        const diseno = matching.reduce((s, r) => s + (r.disenoCurricular || 0), 0);
        const inv = matching.reduce((s, r) => s + (r.investigacionAplicada || 0), 0);
        const cal = matching.reduce((s, r) => s + (r.aseguramientoCalidad || 0), 0);
        const otr = matching.reduce((s, r) => s + (r.otrosActividades || 0), 0);

        const alertInfo = getAlertForHours(totH);
        if (alertInfo.type === 'BAJA') countBaja++;
        else if (alertInfo.type === 'INTERMEDIA') countIntermedia++;
        else if (alertInfo.type === 'OPTIMA') countOptima++;
        else if (alertInfo.type === 'SOBRECARGA') countSobrecarga++;

        totalHoras += totH;

        return {
          mes: m,
          hTitulada: hTit,
          hComplementaria: hComp,
          totalFormacion: totForm,
          hAdicionales: hAdic,
          totalHoras: totH,
          disenoCurricular: diseno,
          investigacion: inv,
          calidad: cal,
          otros: otr,
          alert: alertInfo.type,
          alertLabel: alertInfo.label
        };
      }

      // Mes sin reporte explícito
      const alertInfo = getAlertForHours(0);
      countBaja++;

      return {
        mes: m,
        hTitulada: 0,
        hComplementaria: 0,
        totalFormacion: 0,
        hAdicionales: 0,
        totalHoras: 0,
        disenoCurricular: 0,
        investigacion: 0,
        calidad: 0,
        otros: 0,
        alert: alertInfo.type,
        alertLabel: alertInfo.label
      };
    });

    const activeMonthsCount = monthlyRows.filter(r => r.totalHoras > 0).length;
    const avgDivisor = activeMonthsCount > 0 ? activeMonthsCount : monthlyRows.length;
    const promedioMensual = avgDivisor > 0 ? totalHoras / avgDivisor : 0;

    let maxMonth = monthlyRows[0] || { mes: 'N/A', totalHoras: 0 };
    let minMonth = monthlyRows[0] || { mes: 'N/A', totalHoras: 0 };

    monthlyRows.forEach(r => {
      if (r.totalHoras > maxMonth.totalHoras) maxMonth = r;
      if (r.totalHoras < minMonth.totalHoras) minMonth = r;
    });

    // Primary alert logic
    let primaryAlert: AlertType = 'OPTIMA';
    let alertSummaryText = 'Cumplimiento Óptimo';

    if (countSobrecarga > 0) {
      primaryAlert = 'SOBRECARGA';
      alertSummaryText = `Sobrecarga en ${countSobrecarga} mes(es) (> 190h)`;
    } else if (countBaja > 0) {
      primaryAlert = 'BAJA';
      alertSummaryText = `Baja Carga en ${countBaja} mes(es) (< 100h)`;
    } else if (countIntermedia > 0) {
      primaryAlert = 'INTERMEDIA';
      alertSummaryText = `Carga Intermedia en ${countIntermedia} mes(es) (100–140h)`;
    }

    instructors.push({
      id: key,
      name,
      doc,
      vinculacion,
      monthlyRows,
      totalHoras,
      promedioMensual,
      maxMonth: { mes: maxMonth.mes, horas: maxMonth.totalHoras },
      minMonth: { mes: minMonth.mes, horas: minMonth.totalHoras },
      countBaja,
      countIntermedia,
      countOptima,
      countSobrecarga,
      primaryAlert,
      alertSummaryText
    });
  });

  // Sort: prioritize alert cases first, then by total hours descending
  instructors.sort((a, b) => {
    const priorityWeight = (inst: InstructorAnalysis) => {
      if (inst.countSobrecarga > 0) return 4;
      if (inst.countBaja > 0) return 3;
      if (inst.countIntermedia > 0) return 2;
      return 1;
    };
    const diff = priorityWeight(b) - priorityWeight(a);
    if (diff !== 0) return diff;
    return b.totalHoras - a.totalHoras || a.name.localeCompare(b.name);
  });

  // Global counts
  let totalBajaInstructors = 0;
  let totalIntermediaInstructors = 0;
  let totalOptimaInstructors = 0;
  let totalSobrecargaInstructors = 0;

  instructors.forEach(i => {
    if (i.countSobrecarga > 0) totalSobrecargaInstructors++;
    if (i.countBaja > 0) totalBajaInstructors++;
    if (i.countIntermedia > 0 && i.countBaja === 0 && i.countSobrecarga === 0) totalIntermediaInstructors++;
    if (i.countOptima > 0 && i.countBaja === 0 && i.countIntermedia === 0 && i.countSobrecarga === 0) totalOptimaInstructors++;
  });

  const generalStats = {
    totalInstructores: instructors.length,
    totalBajaInstructors,
    totalIntermediaInstructors,
    totalOptimaInstructors,
    totalSobrecargaInstructors,
    monthsCount: effectiveMonths.length
  };

  return { instructors, months: effectiveMonths, generalStats };
}

/**
 * Genera el documento PDF Completo:
 * 1. Página 1: INFORME GENERAL DE ALERTAS (Dashboard Ejecutivo + Tabla de Alertas)
 * 2. Páginas siguientes: Una hoja por cada instructor con el análisis detallado de tiempos y horas programadas
 */
export async function generateInstructoresTiemposPDF(options: GenerateTiemposPdfOptions): Promise<void> {
  const {
    records,
    monthsList,
    selectedInstructorId,
    vigencia = '2026',
    centro = 'Centro Minero - Regional Boyacá (9111)',
    onProgress
  } = options;

  if (!records || records.length === 0) {
    throw new Error('No hay registros de horas disponibles para generar el reporte.');
  }

  const { instructors, months, generalStats } = analyzeInstructorsData(records, monthsList, selectedInstructorId);

  if (instructors.length === 0) {
    throw new Error('No se encontraron instructores coincidentes con la selección.');
  }

  // Create jsPDF in Landscape A4 (297 x 210 mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const marginX = 12;

  const now = new Date();
  const formattedGenDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  // =========================================================================
  // HOJA 1: INFORME GENERAL DE ALERTAS DE TIEMPOS Y HORAS PROGRAMADAS
  // =========================================================================
  if (onProgress) {
    onProgress(0, instructors.length, 'Generando Informe de Alertas...');
    await new Promise(r => setTimeout(r, 10));
  }

  // --- Header Banner Institucional SENA ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setFillColor(57, 169, 0); // SENA Green accent
  doc.rect(0, 20, pageWidth, 2.5, 'F');

  // Title Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('SERVICIO NACIONAL DE APRENDIZAJE - SENA', marginX, 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text(`REGIONAL BOYACÁ · ${centro.toUpperCase()} · VIGENCIA ${vigencia}`, marginX, 14);

  // Right Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(57, 169, 0);
  doc.text('INFORME CONSOLIDADO DE ALERTAS DE TIEMPOS', pageWidth - marginX, 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado: ${formattedGenDate} | Hoja 1: Matriz de Alertas`, pageWidth - marginX, 14.5, { align: 'right' });

  let currentY = 26;

  // --- Title of Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. CUADRO DE MANDO Y ALERTAS DE EJECUCIÓN HORARIA MENSUAL', marginX, currentY + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Análisis de carga horaria programada y ejecutada por mes según los umbrales normativos institucionales.', marginX, currentY + 5.5);

  currentY += 8.5;

  // --- 4 Executive KPI Cards ---
  const cardWidth = (pageWidth - (marginX * 2) - 9) / 4; // 4 cards with 3mm gaps
  const cardHeight = 17;

  // Card 1: ALERTA CRÍTICA (< 100h)
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(marginX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text('ALERTA CRÍTICA (< 100h / MES)', marginX + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text(`${generalStats.totalBajaInstructors}`, marginX + 3, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Instructores con meses < 100h', marginX + 3, currentY + 15);

  // Card 2: ALERTA INTERMEDIA (100 - 140h)
  const card2X = marginX + cardWidth + 3;
  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(254, 240, 138); // amber-200
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('ALERTA INTERMEDIA (100–140h / MES)', card2X + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(`${generalStats.totalIntermediaInstructors}`, card2X + 3, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Carga moderada / sub-estándar', card2X + 3, currentY + 15);

  // Card 3: RANGO ÓPTIMO (140 - 190h)
  const card3X = card2X + cardWidth + 3;
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text('RANGO ÓPTIMO (140–190h / MES)', card3X + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(`${generalStats.totalOptimaInstructors}`, card3X + 3, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Meta estándar contractual', card3X + 3, currentY + 15);

  // Card 4: ALERTA SOBRECARGA (> 190h)
  const card4X = card3X + cardWidth + 3;
  doc.setFillColor(250, 245, 255); // purple-50
  doc.setDrawColor(233, 213, 255); // purple-200
  doc.roundedRect(card4X, currentY, cardWidth, cardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(109, 40, 217); // purple-700
  doc.text('ALERTA SOBRECARGA (> 190h / MES)', card4X + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(88, 28, 135); // purple-900
  doc.text(`${generalStats.totalSobrecargaInstructors}`, card4X + 3, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Exceso de horas mensuales', card4X + 3, currentY + 15);

  currentY += cardHeight + 4;

  // --- Explanatory Alert Guide Strip ---
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 8, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('CRITERIOS DE ALERTA APLICADOS:', marginX + 3, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('• ROJO (< 100h): Alerta por déficit o subejecución horaria   |   • AMARILLO (100–140h): Alerta intermedia de seguimiento   |   • VERDE (140–190h): Cumplimiento contractual normal   |   • MORADO (> 190h): Alerta por sobreasignación de horas', marginX + 48, currentY + 5);

  currentY += 10.5;

  // --- Table: Matriz Consolidada de Alertas por Instructor ---
  const alertTableHeaders = [
    '#',
    'Instructor (Nombres y Cédula)',
    'Tipo Vinculación',
    ...months.map(m => m.toUpperCase()),
    'Promedio',
    'Total Horas',
    'Diagnóstico General'
  ];

  const alertTableBody = instructors.map((inst, idx) => {
    const row = [
      (idx + 1).toString(),
      `${inst.name}\nCC: ${inst.doc}`,
      inst.vinculacion.replace('NOMBRAMIENTO ', 'NOMB. '),
      ...months.map(m => {
        const mRow = inst.monthlyRows.find(mr => mr.mes.toLowerCase() === m.toLowerCase());
        const h = mRow ? mRow.totalHoras : 0;
        return `${h}h`;
      }),
      `${inst.promedioMensual.toFixed(1)}h`,
      `${inst.totalHoras}h`,
      inst.alertSummaryText
    ];
    return row;
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [alertTableHeaders],
    body: alertTableBody,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 48 },
      2: { halign: 'left', fontSize: 6, cellWidth: 26 },
      // Dynamic month columns styled in didParseCell
      [3 + months.length]: { halign: 'right', fontStyle: 'bold', cellWidth: 15 },
      [4 + months.length]: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },
      [5 + months.length]: { halign: 'center', fontStyle: 'bold', fontSize: 6.2, cellWidth: 32 }
    },
    didParseCell: (data) => {
      // Color-code month cells based on alert ranges
      if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + months.length) {
        const cellVal = data.cell.raw as string;
        const hours = parseInt(cellVal, 10) || 0;
        data.cell.styles.halign = 'center';

        if (hours < 100) {
          data.cell.styles.fillColor = [254, 226, 226]; // light red
          data.cell.styles.textColor = [159, 18, 57];   // deep red
          data.cell.styles.fontStyle = 'bold';
        } else if (hours >= 100 && hours <= 140) {
          data.cell.styles.fillColor = [254, 240, 138]; // light yellow/amber
          data.cell.styles.textColor = [146, 64, 14];   // dark amber
          data.cell.styles.fontStyle = 'bold';
        } else if (hours > 140 && hours <= 190) {
          data.cell.styles.fillColor = [240, 253, 244]; // light emerald
          data.cell.styles.textColor = [22, 101, 52];    // dark green
        } else if (hours > 190) {
          data.cell.styles.fillColor = [233, 213, 255]; // light purple
          data.cell.styles.textColor = [88, 28, 135];   // deep purple
          data.cell.styles.fontStyle = 'bold';
        }
      }

      // Color-code the Diagnostic column
      if (data.section === 'body' && data.column.index === 5 + months.length) {
        const text = data.cell.raw as string;
        if (text.includes('> 190h')) {
          data.cell.styles.fillColor = [250, 245, 255];
          data.cell.styles.textColor = [109, 40, 217];
        } else if (text.includes('< 100h')) {
          data.cell.styles.fillColor = [254, 242, 242];
          data.cell.styles.textColor = [190, 18, 60];
        } else if (text.includes('100–140h')) {
          data.cell.styles.fillColor = [254, 252, 232];
          data.cell.styles.textColor = [180, 83, 9];
        } else {
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [21, 128, 61];
        }
      }
    }
  });

  // Footer for Sheet 1
  const pageCountBeforeInstructors = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCountBeforeInstructors; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Centro Minero SENA - Regional Boyacá · Sistema Integrado de Seguimiento Académico · Informe de Alertas de Tiempos', marginX, pageHeight - 5);
    doc.text(`Hoja ${p} (Matriz General de Alertas)`, pageWidth - marginX, pageHeight - 5, { align: 'right' });
  }

  // =========================================================================
  // HOJAS POR INSTRUCTOR: UNA HOJA DEDICADA POR CADA INSTRUCTOR
  // =========================================================================
  const totalInstructors = instructors.length;

  for (let idx = 0; idx < totalInstructors; idx++) {
    const inst = instructors[idx];

    if (onProgress) {
      onProgress(idx + 1, totalInstructors, inst.name);
      await new Promise(r => setTimeout(r, 10));
    }

    // Add a dedicated new page for this instructor
    doc.addPage('a4', 'landscape');
    const curPageNum = (doc as any).internal.getNumberOfPages();

    // --- 1. Top Header Banner ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setFillColor(57, 169, 0); // SENA Emerald green accent bar
    doc.rect(0, 18, pageWidth, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('SERVICIO NACIONAL DE APRENDIZAJE - SENA', marginX, 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text(`${centro.toUpperCase()} | ANÁLISIS DE TIEMPOS Y HORAS PROGRAMADAS | VIGENCIA ${vigencia}`, marginX, 13);

    // Right badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(57, 169, 0);
    doc.text('HOJA INDIVIDUAL POR INSTRUCTOR', pageWidth - marginX, 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Instructor ${idx + 1} de ${totalInstructors} | Generado: ${formattedGenDate}`, pageWidth - marginX, 13.5, { align: 'right' });

    let instY = 24.5;

    // --- 2. Instructor Profile Card & KPIs ---
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(marginX, instY, pageWidth - (marginX * 2), 24, 2, 2, 'FD');

    // Instructor Name & Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(inst.name, marginX + 4, instY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Documento: CC ${inst.doc}   |   Vinculación: ${inst.vinculacion}   |   Meses Evaluados: ${inst.monthlyRows.length}`, marginX + 4, instY + 11.5);

    // Alert Badge in Profile
    let badgeBg: [number, number, number] = [240, 253, 244];
    let badgeText: [number, number, number] = [21, 128, 61];
    let badgeLabel = '🟢 RANGO ÓPTIMO';

    if (inst.countSobrecarga > 0) {
      badgeBg = [250, 245, 255];
      badgeText = [109, 40, 217];
      badgeLabel = `🔴 ALERTA SOBRECARGA (> 190h en ${inst.countSobrecarga} mes/es)`;
    } else if (inst.countBaja > 0) {
      badgeBg = [254, 242, 242];
      badgeText = [190, 18, 60];
      badgeLabel = `🚨 ALERTA BAJA CARGA (< 100h en ${inst.countBaja} mes/es)`;
    } else if (inst.countIntermedia > 0) {
      badgeBg = [254, 252, 232];
      badgeText = [180, 83, 9];
      badgeLabel = `⚠️ ALERTA INTERMEDIA (100–140h en ${inst.countIntermedia} mes/es)`;
    }

    doc.setFillColor(...badgeBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX + 4, instY + 14.5, 80, 6, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...badgeText);
    doc.text(badgeLabel, marginX + 6, instY + 18.7);

    // KPI Metrics in Box (right side of profile card)
    const kpiStartX = marginX + 110;
    const kpiW = (pageWidth - (marginX * 2) - 114) / 4;

    const miniKPIs = [
      { label: 'HORAS TOTALES', val: `${inst.totalHoras.toLocaleString('es-CO')} h`, sub: 'Acumulado' },
      { label: 'PROMEDIO MENSUAL', val: `${inst.promedioMensual.toFixed(1)} h`, sub: 'Por mes activo' },
      { label: 'MES MÁS HORAS', val: `${inst.maxMonth.horas} h`, sub: inst.maxMonth.mes },
      { label: 'MES MENOS HORAS', val: `${inst.minMonth.horas} h`, sub: inst.minMonth.mes }
    ];

    miniKPIs.forEach((k, kIdx) => {
      const x = kpiStartX + (kIdx * kpiW);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(k.label, x, instY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(k.val, x, instY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(71, 85, 105);
      doc.text(k.sub, x, instY + 17);
    });

    instY += 27.5;

    // --- 3. Table: Ejecución de Tiempos y Horas Programadas Mes a Mes ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Ejecución Mensual de Tiempos y Horas Programadas (Vigencia 2026)', marginX, instY + 3.5);

    const monthlyTableHeaders = [
      'Mes',
      'H. Formación Titulada (Lectiva)',
      'H. Formación Complementaria',
      'Total H. Formación',
      'H. Adicionales (Apoyo)',
      'Total Horas Programadas',
      'Estado / Nivel de Alerta'
    ];

    const monthlyTableBody = inst.monthlyRows.map(r => [
      r.mes.toUpperCase(),
      r.hTitulada > 0 ? r.hTitulada.toString() : '—',
      r.hComplementaria > 0 ? r.hComplementaria.toString() : '—',
      r.totalFormacion.toString(),
      r.hAdicionales > 0 ? r.hAdicionales.toString() : '—',
      r.totalHoras.toString(),
      r.alertLabel
    ]);

    // Summary totals row
    const sumTitulada = inst.monthlyRows.reduce((s, r) => s + r.hTitulada, 0);
    const sumComp = inst.monthlyRows.reduce((s, r) => s + r.hComplementaria, 0);
    const sumForm = inst.monthlyRows.reduce((s, r) => s + r.totalFormacion, 0);
    const sumAdic = inst.monthlyRows.reduce((s, r) => s + r.hAdicionales, 0);

    monthlyTableBody.push([
      'TOTAL ACUMULADO',
      sumTitulada.toString(),
      sumComp.toString(),
      sumForm.toString(),
      sumAdic.toString(),
      `${inst.totalHoras} h`,
      `Promedio: ${inst.promedioMensual.toFixed(1)} h/mes`
    ]);

    autoTable(doc, {
      startY: instY + 5,
      margin: { left: marginX, right: marginX },
      head: [monthlyTableHeaders],
      body: monthlyTableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        halign: 'right'
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 42 },
        2: { cellWidth: 42 },
        3: { cellWidth: 34, fontStyle: 'bold' },
        4: { cellWidth: 34 },
        5: { cellWidth: 38, fontStyle: 'bold', textColor: [15, 23, 42] },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 51 }
      },
      didParseCell: (data) => {
        // Last row is Total Acumulado
        if (data.section === 'body' && data.row.index === monthlyTableBody.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.section === 'body' && data.column.index === 6) {
          // Alert Badge column coloring
          const text = data.cell.raw as string;
          if (text.includes('> 190h')) {
            data.cell.styles.fillColor = [250, 245, 255];
            data.cell.styles.textColor = [109, 40, 217];
          } else if (text.includes('< 100h')) {
            data.cell.styles.fillColor = [254, 242, 242];
            data.cell.styles.textColor = [190, 18, 60];
          } else if (text.includes('100–140h')) {
            data.cell.styles.fillColor = [254, 252, 232];
            data.cell.styles.textColor = [180, 83, 9];
          } else {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = [21, 128, 61];
          }
        }
      }
    });

    // @ts-ignore
    instY = (doc as any).lastAutoTable.finalY + 4;

    // --- 4. Special Activities / Support Breakdown ---
    const hasSpecialHours = inst.monthlyRows.some(r => r.disenoCurricular > 0 || r.investigacion > 0 || r.calidad > 0 || r.otros > 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Desglose de Actividades Especiales y Apoyo a la Gestión (Horas Adicionales)', marginX, instY + 3);

    if (hasSpecialHours) {
      const specialHeaders = ['Mes', 'Diseño Curricular', 'Investigación Aplicada', 'Aseguramiento Calidad', 'Otras Actividades', 'Total Apoyo'];
      const specialBody = inst.monthlyRows.map(r => [
        r.mes,
        r.disenoCurricular > 0 ? `${r.disenoCurricular} h` : '—',
        r.investigacion > 0 ? `${r.investigacion} h` : '—',
        r.calidad > 0 ? `${r.calidad} h` : '—',
        r.otros > 0 ? `${r.otros} h` : '—',
        r.hAdicionales > 0 ? `${r.hAdicionales} h` : '—'
      ]);

      const sumDiseno = inst.monthlyRows.reduce((s, r) => s + r.disenoCurricular, 0);
      const sumInv = inst.monthlyRows.reduce((s, r) => s + r.investigacion, 0);
      const sumCal = inst.monthlyRows.reduce((s, r) => s + r.calidad, 0);
      const sumOtros = inst.monthlyRows.reduce((s, r) => s + r.otros, 0);

      specialBody.push([
        'TOTAL APOYO',
        `${sumDiseno} h`,
        `${sumInv} h`,
        `${sumCal} h`,
        `${sumOtros} h`,
        `${sumAdic} h`
      ]);

      autoTable(doc, {
        startY: instY + 4.5,
        margin: { left: marginX, right: marginX },
        head: [specialHeaders],
        body: specialBody,
        theme: 'grid',
        styles: {
          fontSize: 6.8,
          cellPadding: 1.5,
          halign: 'right',
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 6.8,
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === specialBody.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // @ts-ignore
      instY = (doc as any).lastAutoTable.finalY + 4;
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, instY + 4.5, pageWidth - (marginX * 2), 7, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('El instructor dedicó el 100% de su dedicación horaria a Formación Directa (Titulada / Complementaria). No registra horas de apoyo reportadas.', marginX + 3, instY + 9);

      instY += 14;
    }

    // --- 5. Diagnostic Commentary & Signature Boxes ---
    const signBoxY = pageHeight - 34;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, signBoxY - 9, pageWidth - (marginX * 2), 8, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text('OBSERVACIONES Y AUDITORÍA ACADÉMICA:', marginX + 3, signBoxY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Variabilidad horaria: Máx ${inst.maxMonth.horas}h (${inst.maxMonth.mes}) - Mín ${inst.minMonth.horas}h (${inst.minMonth.mes}). ` +
      `Alertas registradas: ${inst.countBaja} mes(es) <100h | ${inst.countIntermedia} mes(es) 100-140h | ${inst.countSobrecarga} mes(es) >190h.`,
      marginX + 56, signBoxY - 4
    );

    // Signatures
    const sigWidth = (pageWidth - (marginX * 2) - 30) / 2;

    // Left Signature
    doc.setDrawColor(148, 163, 184);
    doc.line(marginX + 15, signBoxY + 15, marginX + 15 + sigWidth, signBoxY + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(inst.name, marginX + 15 + (sigWidth / 2), signBoxY + 19, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Firma del Instructor · C.C. ${inst.doc}`, marginX + 15 + (sigWidth / 2), signBoxY + 23, { align: 'center' });

    // Right Signature
    const rightSigX = marginX + 15 + sigWidth + 30;
    doc.line(rightSigX, signBoxY + 15, rightSigX + sigWidth, signBoxY + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('COORDINACIÓN ACADÉMICA Y DE FORMACIÓN', rightSigX + (sigWidth / 2), signBoxY + 19, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Centro Minero · Regional Boyacá (9111)', rightSigX + (sigWidth / 2), signBoxY + 23, { align: 'center' });

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 6.5, pageWidth - marginX, pageHeight - 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184);
    doc.text(`Centro Minero SENA · Regional Boyacá · Sistema Integrado de Seguimiento Académico · Vigencia ${vigencia}`, marginX, pageHeight - 3);
    doc.text(`Hoja ${curPageNum} (Instructor: ${inst.name})`, pageWidth - marginX, pageHeight - 3, { align: 'right' });
  }

  // Save the document with a descriptive name
  const filename = selectedInstructorId && selectedInstructorId !== 'TODOS'
    ? `SENA_Tiempos_Instructor_${instructors[0].name.replace(/\s+/g, '_')}_${vigencia}.pdf`
    : `SENA_Informe_Tiempos_Alertas_Instructores_${vigencia}.pdf`;

  doc.save(filename);
}
