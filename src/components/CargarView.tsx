/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  ShieldAlert, 
  RefreshCw, 
  Globe, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Users
} from 'lucide-react';
import { SofiaRow, FichaMeta, InasistenciaRecord } from '../types';
import { 
  DEFAULT_INASISTENCIAS_DRIVE_URL, 
  fetchInasistenciasFromDrive, 
  parseInasistenciasWorkbook 
} from '../services/inasistenciasService';

interface CargarViewProps {
  pendingFiles: File[];
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onProcessComplete: (rows: SofiaRow[], fichas: { [id: string]: FichaMeta }) => void;
  showLoading: (show: boolean, msg?: string) => void;
  existingFichas: { [id: string]: FichaMeta };
  onDeleteFicha: (fichaId: string) => void;
  inasistencias?: InasistenciaRecord[];
  onInasistenciasLoaded?: (records: InasistenciaRecord[]) => void;
}

export default function CargarView({
  pendingFiles,
  setPendingFiles,
  onProcessComplete,
  showLoading,
  existingFichas = {},
  onDeleteFicha,
  inasistencias = [],
  onInasistenciasLoaded
}: CargarViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);
  const [driveSyncError, setDriveSyncError] = useState<string | null>(null);
  const [autoSyncInasistencias, setAutoSyncInasistencias] = useState(true);
  const [driveUrl, setDriveUrl] = useState(DEFAULT_INASISTENCIAS_DRIVE_URL);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inasistenciaFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const allowed = (Array.from(e.dataTransfer.files) as File[]).filter(f => 
        /\.(xlsx|xls)$/i.test(f.name)
      );
      addFiles(allowed);
    }
  };

  const addFiles = (newFiles: File[]) => {
    setPendingFiles(prev => {
      const filtered = newFiles.filter(nf => !prev.some(pf => pf.name === nf.name));
      return [...prev, ...filtered];
    });
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const clearFiles = () => {
    setPendingFiles([]);
  };

  // Sync with Google Drive Documentation
  const handleSyncDriveInasistencias = async () => {
    setIsSyncingDrive(true);
    setDriveSyncError(null);
    setDriveSyncSuccess(null);
    showLoading(true, 'Sincronizando Consolidado de Inasistencias desde Google Drive...');

    try {
      const records = await fetchInasistenciasFromDrive(driveUrl);
      if (onInasistenciasLoaded) {
        onInasistenciasLoaded(records);
      }
      setDriveSyncSuccess(`¡Sincronización exitosa! Se cargaron ${records.length.toLocaleString('es-CO')} registros de inasistencias desde Google Drive.`);
    } catch (err: any) {
      console.error('Error al sincronizar Drive:', err);
      setDriveSyncError(err.message || 'Error al conectar con el archivo de Google Drive. Verifique el enlace y los permisos.');
    } finally {
      setIsSyncingDrive(false);
      showLoading(false);
    }
  };

  // Upload local Inasistencias Excel file
  const handleInasistenciasFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showLoading(true, `Cargando archivo de inasistencias: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const parsed = parseInasistenciasWorkbook(wb);
        if (parsed.length > 0) {
          if (onInasistenciasLoaded) {
            onInasistenciasLoaded(parsed);
          }
          setDriveSyncSuccess(`¡Archivo local de inasistencias cargado! Se procesaron ${parsed.length.toLocaleString('es-CO')} registros.`);
        } else {
          setDriveSyncError('No se encontraron registros de inasistencia válidos en el archivo seleccionado.');
        }
      } catch (err: any) {
        console.error(err);
        setDriveSyncError('Error al leer el archivo Excel de inasistencias.');
      } finally {
        showLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    if (e.target) e.target.value = '';
  };

  const parseFile = (file: File): Promise<{ rows: SofiaRow[]; meta: FichaMeta }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, raw: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

          const meta: FichaMeta = {
            ficha: file.name.replace(/\.[^/.]+$/, ''),
            programa: file.name.replace(/\.[^/.]+$/, ''),
            estadoFicha: '',
            fechaInicio: '',
            fechaFin: '',
            centro: '',
            regional: '',
            count: 0,
            archivos: [file.name]
          };

          // Analizar filas de cabecera de metadatos (comúnmente las primeras 20 filas en SofiaPlus)
          raw.slice(0, 20).forEach(r => {
            if (!Array.isArray(r)) return;
            r.forEach((cell, idx) => {
              const cellStr = String(cell || '').trim();
              if (!cellStr) return;
              
              const cellStrLower = cellStr.toLowerCase();
              
              const getNextVal = () => {
                for (let j = idx + 1; j < r.length; j++) {
                  const val = String(r[j] || '').trim();
                  if (val) return val;
                }
                return '';
              };

              const getMergedOrNextVal = () => {
                if (cellStr.includes(':')) {
                  const parts = cellStr.split(':');
                  const after = parts.slice(1).join(':').trim();
                  if (after) return after;
                }
                return getNextVal();
              };

              if (cellStrLower.includes('ficha de caracter') && !cellStrLower.includes('estado')) {
                const val = getMergedOrNextVal();
                if (val) meta.ficha = val;
              }
              if (cellStrLower.includes('denominaci')) {
                const val = getMergedOrNextVal();
                if (val) meta.programa = val;
              }
              if (cellStrLower.includes('estado de la ficha')) {
                const val = getMergedOrNextVal();
                if (val) meta.estadoFicha = val;
              }
              if (cellStrLower.includes('fecha inicio')) {
                const val = getMergedOrNextVal();
                if (val) meta.fechaInicio = val;
              }
              if (cellStrLower.includes('fecha fin')) {
                const val = getMergedOrNextVal();
                if (val) meta.fechaFin = val;
              }
              if (cellStrLower.includes('centro de formaci')) {
                const val = getMergedOrNextVal();
                if (val) meta.centro = val;
              }
              if (cellStrLower.includes('regional')) {
                const val = getMergedOrNextVal();
                if (val) meta.regional = val;
              }
            });
          });

          let hRow = -1;
          raw.slice(0, 30).forEach((r, i) => {
            const s = r.join('|').toLowerCase();
            if (s.includes('juicio') && (s.includes('evaluaci') || s.includes('resultado'))) hRow = i;
          });
          if (hRow < 0) {
            raw.slice(0, 30).forEach((r, i) => {
              const s = r.join('|').toLowerCase();
              if (s.includes('nombre') && s.includes('estado')) hRow = i;
            });
          }
          if (hRow < 0) hRow = 12;

          const hdrs = (raw[hRow] || []).map(h => String(h || '').trim());
          const rows = raw.slice(hRow + 1)
            .filter(r => r.some(c => c !== '' && c != null))
            .map(r => {
              const o: SofiaRow = {
                _ficha: meta.ficha,
                _prog: meta.programa
              };
              hdrs.forEach((h, i) => {
                if (h) {
                  o[h] = String(r[i] ?? '').trim();
                }
              });
              return o;
            });

          meta.count = rows.length;
          resolve({ rows, meta });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const handleProcess = async () => {
    if (pendingFiles.length === 0) return;
    showLoading(true, 'Procesando archivos...');
    let allRows: SofiaRow[] = [];
    const allFichas: { [id: string]: FichaMeta } = {};

    try {
      // 1. If autoSync is enabled and inasistencias are empty, try background fetch from Drive
      if (autoSyncInasistencias && inasistencias.length === 0 && onInasistenciasLoaded) {
        try {
          showLoading(true, 'Consultando documentación de inasistencias en Google Drive...');
          const driveInas = await fetchInasistenciasFromDrive(driveUrl);
          onInasistenciasLoaded(driveInas);
        } catch (e) {
          console.warn('Nota: Inasistencias de Drive se cargarán desde el respaldo local o caché:', e);
        }
      }

      // 2. Process all pending SofiaPlus Ficha files
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        showLoading(true, `Procesando: ${file.name} (${i + 1}/${pendingFiles.length})`);
        const result = await parseFile(file);
        allRows = [...allRows, ...result.rows];
        
        const existing = allFichas[result.meta.ficha];
        if (existing) {
          allFichas[result.meta.ficha] = {
            ...result.meta,
            count: existing.count + result.meta.count,
            archivos: Array.from(new Set([...(existing.archivos || []), ...(result.meta.archivos || [])]))
          };
        } else {
          allFichas[result.meta.ficha] = result.meta;
        }
      }
      onProcessComplete(allRows, allFichas);
      setPendingFiles([]);
      showLoading(false);
    } catch (err) {
      console.error('Error procesando archivos:', err);
      alert('Error al procesar los archivos. Verifique que sean reportes de SofiaPlus válidos.');
      showLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 view-enter" id="view-cargar">
      
      {/* Title */}
      <div className="text-center space-y-2 pt-4">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Cargar Fichas y Documentación SENA
        </h2>
        <p className="text-slate-500 max-w-xl mx-auto text-sm font-medium">
          Carga los reportes de SofiaPlus y sincroniza la documentación de inasistencias de Google Drive para cruzar y analizar el rendimiento de los aprendices.
        </p>
      </div>

      {/* Tarjeta de Sincronización de Inasistencias Google Drive */}
      <div className="bg-white border border-emerald-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 bg-emerald-100/80 rounded-2xl flex items-center justify-center text-sena flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900">
                  Documentación de Inasistencias (Google Drive / Excel)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-sena">
                  {inasistencias.length.toLocaleString('es-CO')} registros vinculados
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Lee automáticamente los reportes de inasistencias por ficha y aprendiz para cruzarlos con el estado de matrícula.
              </p>
            </div>
          </div>

          {/* Action Buttons for Drive Documentation */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="file"
              ref={inasistenciaFileInputRef}
              onChange={handleInasistenciasFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <button
              onClick={() => inasistenciaFileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200"
              title="Cargar archivo Excel de inasistencias manualmente"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Excel</span>
            </button>

            <button
              onClick={handleSyncDriveInasistencias}
              disabled={isSyncingDrive}
              className="px-4 py-2 bg-sena hover:bg-sena-dark text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-sena/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              <span>{isSyncingDrive ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {driveSyncSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sena" />
              <span>{driveSyncSuccess}</span>
            </div>
            <button onClick={() => setDriveSyncSuccess(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {driveSyncError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{driveSyncError}</span>
            </div>
            <button onClick={() => setDriveSyncError(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <input
            type="checkbox"
            id="autoSyncInas"
            checked={autoSyncInasistencias}
            onChange={(e) => setAutoSyncInasistencias(e.target.checked)}
            className="w-4 h-4 text-sena accent-sena rounded cursor-pointer"
          />
          <label htmlFor="autoSyncInas" className="text-xs font-semibold text-slate-600 cursor-pointer">
            Vincular y actualizar automáticamente las inasistencias de Google Drive al cargar y procesar fichas
          </label>
        </div>
      </div>

      {/* Dropzone Fichas SofiaPlus */}
      <div
        id="dropzone"
        className={`dropzone border-2 border-dashed rounded-[24px] p-12 text-center cursor-pointer transition-all duration-200 ${
          dragOver 
            ? 'border-sena bg-emerald-50/50 scale-[0.99]' 
            : 'border-emerald-100 bg-[#f0fdf4]'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md border border-sena/10">
          <Upload className="w-10 h-10 text-sena" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">
          Arrastra reportes de Ficha SofiaPlus aquí o haz clic para seleccionar
        </h3>
        <p className="text-sm text-slate-500">
          Puedes cargar múltiples fichas simultáneamente (.xlsx, .xls)
        </p>
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          multiple
          accept=".xls,.xlsx"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Lista de archivos pendientes */}
      {pendingFiles.length > 0 && (
        <div id="pending-files-container" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-5 h-5 text-sena" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Archivos seleccionados ({pendingFiles.length})
            </span>
          </div>
          
          <div id="pending-files-list" className="space-y-3">
            {pendingFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-sena/10 rounded-lg flex items-center justify-center text-sena">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{f.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {(f.size / 1024).toFixed(1)} KB · Pendiente
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="p-1.5 hover:bg-slate-200/50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleProcess}
              className="btn btn-primary px-8 py-2.5 font-bold text-sm bg-sena text-white rounded-xl shadow-lg shadow-sena/20 hover:bg-sena-dark transition-all flex items-center gap-2 cursor-pointer"
            >
              Procesar y analizar
            </button>
            <button
              onClick={clearFiles}
              className="btn btn-secondary px-5 py-2.5 font-semibold text-sm bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all cursor-pointer"
            >
              Limpiar todo
            </button>
          </div>
        </div>
      )}

      {/* Fichas ya cargadas */}
      {Object.keys(existingFichas).length > 0 && (
        <div id="existing-fichas-container" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-sena" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Fichas actualmente cargadas en el sistema ({Object.keys(existingFichas).length})
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(existingFichas).map(([id, meta]) => (
              <div
                key={id}
                className="flex items-center justify-between p-3.5 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-sena/10 rounded-lg flex items-center justify-center text-sena flex-shrink-0">
                    <span className="text-xs font-black">F</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">FICHA {id}</p>
                    <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[280px]">
                      {meta.programa}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Está seguro de eliminar la Ficha ${id} de la aplicación?`)) {
                      onDeleteFicha(id);
                    }
                  }}
                  className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors flex-shrink-0 cursor-pointer"
                  title="Eliminar Ficha"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seguridad */}
      <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
        <ShieldAlert className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400/80">
          Seguridad Garantizada — Procesamiento Seguro en el Navegador
        </span>
      </div>
    </div>
  );
}
