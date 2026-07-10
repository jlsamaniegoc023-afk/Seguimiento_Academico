/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FichaMeta {
  ficha: string;
  programa: string;
  estadoFicha: string;
  fechaInicio: string;
  fechaFin: string;
  centro: string;
  regional: string;
  count: number;
  archivos?: string[];
}

export interface SofiaRow {
  [key: string]: string;
  _ficha: string;
  _prog: string;
}

export interface ApprenticeStat {
  id: string;
  nombre: string;
  doc: string;
  estado: string;
  ficha: string;
  total: number;
  ap: number;
  na: number;
  pe: number;
}

export interface CompetenciaStat {
  nombre: string;
  ficha: string;
  total: number;
  ap: number;
  na: number;
  pe: number;
  instructores: string[];
}

export interface ProgramacionRow {
  competencia: string;
  instructor: string;
  fecha: string;
  horasProgramadas: number;
  horasEjecutadas: number;
  horasPendientes: number;
  totalHorasProgramadas: number;
  fechaInicioProg?: string;
  fechaFinProg?: string;
  codigoFicha?: string;
  nombrePrograma?: string;
  [key: string]: any;
}

export interface VerificationStat extends ProgramacionRow {
  totalJuicios: number;
  aprobados: number;
  pendientes: number;
  status: 'aprobado' | 'proceso' | 'vacio';
}

export type ViewType = 
  | 'cargar' 
  | 'dashboard' 
  | 'aprendices' 
  | 'juicios' 
  | 'no-aprob' 
  | 'competencias' 
  | 'etapa-productiva' 
  | 'seguimiento-ep'
  | 'programacion'
  | 'gestion-curricular'
  | 'indicadores';
