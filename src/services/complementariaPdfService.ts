/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FichaComplementaria } from '../types';

export interface GeneratePdfOptions {
  fichas: FichaComplementaria[];
  selectedInstructor?: string;
  vigencia?: string;
  centro?: string;
  sourceFileName?: string;
  onProgress?: (current: number, total: number, instructorName: string) => void;
}

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function parseMonthIndex(dateStr?: string): number {
  if (!dateStr) return -1;
  const clean = dateStr.trim();
  const slashParts = clean.split('/');
  if (slashParts.length === 3) {
    const m = parseInt(slashParts[1], 10) - 1;
    if (m >= 0 && m < 12) return m;
  }
  const dashParts = clean.split('-');
  if (dashParts.length === 3) {
    const m = parseInt(dashParts[1], 10) - 1;
    if (m >= 0 && m < 12) return m;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.getMonth();
  }
  return -1;
}

export async function generateInstructoresComplementariaPDF(options: GeneratePdfOptions): Promise<void> {
  const { fichas, selectedInstructor, vigencia = '2026', centro = 'Centro Minero - Regional Boyacá', sourceFileName, onProgress } = options;

  if (!fichas || fichas.length === 0) {
    throw new Error('No hay registros de formación complementaria disponibles para generar el reporte.');
  }

  // Group fichas by instructor
  const instructorMap = new Map<string, FichaComplementaria[]>();

  fichas.forEach(f => {
    const inst = (f.instructor || 'POR ASIGNAR').trim().toUpperCase();
    if (selectedInstructor && selectedInstructor !== 'TODOS') {
      if (inst !== selectedInstructor.trim().toUpperCase()) return;
    }
    if (!instructorMap.has(inst)) {
      instructorMap.set(inst, []);
    }
    instructorMap.get(inst)!.push(f);
  });

  // Sort instructors alphabetically
  const sortedInstructors = Array.from(instructorMap.keys()).sort((a, b) => {
    if (a === 'POR ASIGNAR') return 1;
    if (b === 'POR ASIGNAR') return -1;
    return a.localeCompare(b, 'es');
  });

  if (sortedInstructors.length === 0) {
    throw new Error('No se encontraron instructores con los filtros seleccionados.');
  }

  // Create jsPDF instance in Landscape A4 (297 x 210 mm) for optimal data density and clarity
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~210 mm
  const marginX = 12;
  const now = new Date();
  const formattedGenDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  const totalInstructors = sortedInstructors.length;

  for (let idx = 0; idx < totalInstructors; idx++) {
    const instName = sortedInstructors[idx];
    const instFichas = instructorMap.get(instName) || [];

    if (onProgress) {
      onProgress(idx + 1, totalInstructors, instName);
      // Brief tick for UI responsiveness
      await new Promise(r => setTimeout(r, 10));
    }

    if (idx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // --- 1. Top Header Banner ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setFillColor(57, 169, 0); // SENA Emerald green accent bar
    doc.rect(0, 18, pageWidth, 2.5, 'F');

    // Title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('SERVICIO NACIONAL DE APRENDIZAJE - SENA', marginX, 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text(`${centro.toUpperCase()} | REPORTE PE-04 FORMACIÓN COMPLEMENTARIA | VIGENCIA ${vigencia}`, marginX, 13);

    // Right-side badge in header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(57, 169, 0);
    doc.text('INFORME ACADÉMICO INDIVIDUAL POR INSTRUCTOR', pageWidth - marginX, 10, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generado: ${formattedGenDate}`, pageWidth - marginX, 14.5, { align: 'right' });

    let currentY = 24.5;

    // --- 2. Instructor Profile & KPI Cards ---
    // Background card for instructor info
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 26, 2, 2, 'FD');

    // Instructor Name & Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(instName, marginX + 4, currentY + 7);

    // Calculate Instructor Metrics
    const totalCursos = instFichas.length;
    const totalMatriculados = instFichas.reduce((acc, f) => acc + (f.matriculados || 0), 0);
    const totalCertificados = instFichas.reduce((acc, f) => acc + (f.certificados || 0), 0);
    const totalActivos = instFichas.reduce((acc, f) => acc + (f.activos || f.enFormacion || 0), 0);
    const totalHorasDocente = instFichas.reduce((acc, f) => acc + (f.horasTotales || f.duracionHoras || 0), 0);
    const totalHorasHombre = instFichas.reduce((acc, f) => acc + ((f.duracionHoras || 0) * (f.matriculados || 0)), 0);
    const eficacia = totalMatriculados > 0 ? Math.round((totalCertificados / totalMatriculados) * 100) : 0;

    const sectores = Array.from(new Set(instFichas.map(f => f.lineaTematica).filter(Boolean)));
    const municipios = Array.from(new Set(instFichas.map(f => f.municipio).filter(Boolean)));
    const empresas = Array.from(new Set(instFichas.map(f => f.empresa).filter(Boolean)));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    const sectoresText = sectores.length > 0 ? sectores.slice(0, 3).join(', ') + (sectores.length > 3 ? ` (+${sectores.length - 3})` : '') : 'General';
    const munText = municipios.length > 0 ? municipios.slice(0, 3).join(', ') + (municipios.length > 3 ? ` (+${municipios.length - 3})` : '') : 'Sogamoso';
    const empText = empresas.length > 0 ? `${empresas.length} aliada(s)` : 'Abierta / Demanda social';

    doc.text(`Líneas Temáticas: ${sectoresText}   |   Municipios: ${munText}   |   Empresas/Convenios: ${empText}`, marginX + 4, currentY + 12.5);

    // Mini KPI Pills within the profile card
    const kpiBoxWidth = 38;
    const kpiBoxHeight = 10;
    const kpiY = currentY + 14.5;
    const kpiStartX = marginX + 4;
    const kpiGap = 4.5;

    const kpis = [
      { label: 'Cursos / Fichas', val: `${totalCursos}`, color: [2, 132, 199] },
      { label: 'Matriculados', val: totalMatriculados.toLocaleString('es-CO'), color: [16, 185, 129] },
      { label: 'Certificados', val: totalCertificados.toLocaleString('es-CO'), color: [5, 150, 105] },
      { label: 'Eficacia Certif.', val: `${eficacia}%`, color: [147, 51, 234] },
      { label: 'Horas Dictadas', val: `${totalHorasDocente} hrs`, color: [217, 119, 6] },
      { label: 'Horas Hombre', val: totalHorasHombre.toLocaleString('es-CO'), color: [79, 70, 229] },
      { label: 'En Formación', val: `${totalActivos}`, color: [13, 148, 136] }
    ];

    kpis.forEach((kpi, kIdx) => {
      const x = kpiStartX + (kIdx * (kpiBoxWidth + kpiGap));
      if (x + kpiBoxWidth <= pageWidth - marginX) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, kpiY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + (kpiBoxWidth / 2), kpiY + 3.5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.val, x + (kpiBoxWidth / 2), kpiY + 8, { align: 'center' });
      }
    });

    currentY += 28.5;

    // --- 3. Monthly Program Schedule Table ---
    // Compute monthly breakdown for this instructor
    const monthlyFichas = new Array(12).fill(0);
    const monthlyHoras = new Array(12).fill(0);
    const monthlyMatriculados = new Array(12).fill(0);
    const monthlyCertificados = new Array(12).fill(0);

    instFichas.forEach(f => {
      const mIdx = parseMonthIndex(f.fechaInicio);
      if (mIdx >= 0 && mIdx < 12) {
        monthlyFichas[mIdx] += 1;
        monthlyHoras[mIdx] += (f.horasTotales || f.duracionHoras || 0);
        monthlyMatriculados[mIdx] += (f.matriculados || 0);
        monthlyCertificados[mIdx] += (f.certificados || 0);
      }
    });

    const monthHeaders = ['Indicador Mensual', ...MONTH_NAMES_SHORT, 'TOTAL'];
    const rowCursos = ['Cursos Programados', ...monthlyFichas.map(v => v === 0 ? '-' : `${v}`), `${totalCursos}`];
    const rowHoras = ['Horas Totales (AW)', ...monthlyHoras.map(v => v === 0 ? '-' : `${v}h`), `${totalHorasDocente}h`];
    const rowMatric = ['Aprendices Matric.', ...monthlyMatriculados.map(v => v === 0 ? '-' : `${v}`), `${totalMatriculados}`];
    const rowCert = ['Aprendices Certif.', ...monthlyCertificados.map(v => v === 0 ? '-' : `${v}`), `${totalCertificados}`];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Cronograma y Distribución de Carga Mensual (Programación Anual)', marginX, currentY + 3.5);

    autoTable(doc, {
      startY: currentY + 5,
      margin: { left: marginX, right: marginX },
      head: [monthHeaders],
      body: [rowCursos, rowHoras, rowMatric, rowCert],
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        halign: 'center',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 36 },
        13: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 4;

    // --- 4. Detailed Table of Courses (Cursos Creados) ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`2. Cursos Creados y Detalle de Formación Asignada (${instFichas.length} Cursos)`, marginX, currentY + 3.5);

    // Prepare table rows
    const cursosBody = instFichas.map(f => {
      const dur = f.duracionHoras ? `${f.duracionHoras}h` : '-';
      const fechas = (f.fechaInicio && f.fechaFin) ? `${f.fechaInicio} a ${f.fechaFin}` : (f.fechaInicio || '-');
      const mat = (f.matriculados || 0).toString();
      const cert = (f.certificados || 0).toString();
      const mun = f.municipio || 'Sogamoso';
      const aliada = f.empresa ? f.empresa.slice(0, 22) : (f.convenio ? f.convenio.slice(0, 22) : 'Abierta');
      const estado = f.estadoFicha || 'En ejecución';
      const mod = f.modalidad || (f.tipoFormacion.includes('Virtual') ? 'VIRTUAL' : 'PRESENCIAL');

      return [
        f.codigoFicha || f.ficha,
        f.programa || 'CURSO SIN NOMBRE',
        mod,
        dur,
        fechas,
        estado,
        `${mat} / ${cert}`,
        mun,
        aliada
      ];
    });

    autoTable(doc, {
      startY: currentY + 5,
      margin: { left: marginX, right: marginX, bottom: 12 },
      head: [[
        'Ficha',
        'Programa de Formación',
        'Modalidad',
        'Horas',
        'Fechas (Inicio - Fin)',
        'Estado',
        'Matr / Cert',
        'Municipio',
        'Empresa / Convenio'
      ]],
      body: cursosBody,
      theme: 'striped',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.6,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [57, 169, 0], // SENA Emerald
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 20, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 36, halign: 'center' },
        5: { cellWidth: 24, halign: 'center' },
        6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 24 },
        8: { cellWidth: 'auto' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: (data) => {
        // Footer on every page
        const pNum = doc.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184); // slate-400
        
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageHeight - 7, pageWidth - marginX, pageHeight - 7);

        doc.text(
          `SENA Centro Minero | Reporte Oficial PE-04 | Instructor: ${instName}`,
          marginX,
          pageHeight - 3.5
        );
        doc.text(
          `Página ${pNum}`,
          pageWidth - marginX,
          pageHeight - 3.5,
          { align: 'right' }
        );
      }
    });
  }

  // Generate filename
  const cleanName = selectedInstructor && selectedInstructor !== 'TODOS'
    ? `Reporte_Instructor_${selectedInstructor.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`
    : `Reporte_Analisis_Formacion_Complementaria_Instructores`;

  const fileName = `${cleanName}_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.pdf`;

  // Trigger browser download
  doc.save(fileName);
}
