/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SofiaRow, ApprenticeStat, CompetenciaStat } from './types';

export function getField(r: SofiaRow, ...keys: string[]): string {
  for (const k of keys) {
    const fk = Object.keys(r).find(rk => rk.toLowerCase().includes(k.toLowerCase()));
    if (fk && r[fk] !== '' && r[fk] != null) return String(r[fk]);
  }
  return '';
}

export const getJuicio = (r: SofiaRow): 'APROBADO' | 'NO APROBADO' | 'POR EVALUAR' => {
  const j = getField(r, 'Juicio de Evaluaci', 'Juicio', 'Evaluaci').toUpperCase().trim();
  if (j.includes('NO AP')) return 'NO APROBADO';
  if (j.includes('APROBADO')) return 'APROBADO';
  return 'POR EVALUAR';
};

export const getEstado = (r: SofiaRow): string => {
  return getField(r, 'Estado').toUpperCase().trim();
};

export const getNombre = (r: SofiaRow): string => {
  const n = getField(r, 'Nombre');
  const a = getField(r, 'Apellidos');
  if (n || a) return `${n} ${a}`.trim();
  return getField(r, 'Aprendiz') || '—';
};

export const getDoc = (r: SofiaRow): string => {
  return getField(r, 'Número de Documento', 'Documento', 'Cedula');
};

export const getCompetencia = (r: SofiaRow): string => {
  return getField(r, 'Competencia');
};

export const getRA = (r: SofiaRow): string => {
  return getField(r, 'Resultado de Aprendizaje', 'Resultado', 'RA');
};

export const getFecha = (r: SofiaRow): string => {
  return getField(r, 'Fecha y Hora', 'Fecha');
};

export const getInstructor = (r: SofiaRow): string => {
  return getField(r, 'Instructor', 'Nombre Instructor', 'Funcionario', 'Calificado Por');
};

export function computeAprendizStats(data: SofiaRow[]): ApprenticeStat[] {
  const m: { [id: string]: ApprenticeStat } = {};
  data.forEach(r => {
    const id = getDoc(r) || getNombre(r);
    if (!id || id === '—') return;
    if (!m[id]) {
      m[id] = {
        id,
        nombre: getNombre(r),
        doc: getDoc(r),
        estado: getEstado(r),
        ficha: r._ficha || '',
        total: 0,
        ap: 0,
        na: 0,
        pe: 0
      };
    }
    m[id].total++;
    const j = getJuicio(r);
    if (j === 'NO APROBADO') m[id].na++;
    else if (j === 'APROBADO') m[id].ap++;
    else m[id].pe++;
    
    const estado = getEstado(r);
    if (estado) m[id].estado = estado;
  });
  return Object.values(m);
}

export function computeCompetenciaStats(data: SofiaRow[]): CompetenciaStat[] {
  const m: { [name: string]: CompetenciaStat } = {};
  data.forEach(r => {
    const c = getCompetencia(r);
    if (!c) return;
    if (!m[c]) {
      m[c] = {
        nombre: c,
        ficha: r._ficha || '',
        total: 0,
        ap: 0,
        na: 0,
        pe: 0,
        instructores: []
      };
    }
    m[c].total++;
    const j = getJuicio(r);
    if (j === 'NO APROBADO') m[c].na++;
    else if (j === 'APROBADO') m[c].ap++;
    else m[c].pe++;
    
    const inst = getInstructor(r);
    if (inst && inst !== '—' && !m[c].instructores.includes(inst)) {
      m[c].instructores.push(inst);
    }
  });
  return Object.values(m).sort((a, b) => b.total - a.total);
}

export function esEtapaPractica(comp: string): boolean {
  const c = comp.toUpperCase().trim();
  return (c.includes('RESULTADO') && (c.includes('ETAPA PRAC') || c.includes('ETAPA PRODUCTIVA')))
      || c === 'ETAPA PRODUCTIVA'
      || (c.includes('ETAPA PRAC') && !c.includes('RESULT'));
}
