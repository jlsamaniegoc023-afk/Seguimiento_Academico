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
  horasInasistencia?: number;
  totalInasistencias?: number;
  detallesInasistencias?: InasistenciaRecord[];
}

export interface InasistenciaRecord {
  id: string;
  ficha: string;
  codigoFicha: string;
  programa?: string;
  instructor: string;
  idAprendiz: string;
  docNumerico: string;
  aprendiz: string;
  fechaInicio: string;
  fechaFin: string;
  cantHoras: number;
  justificacion: string;
  observaciones?: string;
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

export interface FichaComplementaria {
  id: string;
  ficha: string;
  codigoFicha?: string;
  programa: string;
  codigoPrograma?: string;
  versionPrograma?: string | number;
  tipoFormacion: 'Complementaria Virtual' | 'Complementaria Presencial' | 'Complementaria Especial' | string;
  nivelFormacion?: string;
  modalidad?: string;
  jornada?: string;
  duracionHoras: number;
  horasPlanta?: number;
  horasContratistas?: number;
  horasTotales?: number;
  fechaInicio: string;
  fechaFin: string;
  estadoFicha: 'En ejecución' | 'Terminada' | 'Terminada por fecha' | 'Certificada' | 'Cancelada' | string;
  vigencia: string;
  municipio: string;
  departamento?: string;
  regional?: string;
  centro: string;
  instructor: string;
  empresa?: string;
  nitEmpresa?: string;
  lineaTematica: string;
  ocupacion?: string;
  estrategiaEspecial?: string;
  convenio?: string;
  cuposProgramados: number;
  matriculados: number;
  masculinos?: number;
  femeninos?: number;
  noBinario?: number;
  activos?: number;
  certificados: number;
  porCertificar: number;
  enFormacion: number;
  desertores: number;
  cancelados: number;
  retiroVoluntario: number;
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
  | 'horas-reportadas'
  | 'analisis-df14'
  | 'gestion-curricular'
  | 'indicadores'
  | 'analisis-complementaria';
