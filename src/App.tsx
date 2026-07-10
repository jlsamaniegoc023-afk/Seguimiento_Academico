/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SofiaRow, FichaMeta, ProgramacionRow, ViewType } from './types';
import CargarView from './components/CargarView';
import DashboardView from './components/DashboardView';
import AprendicesView from './components/AprendicesView';
import JuiciosView from './components/JuiciosView';
import NoAprobadosView from './components/NoAprobadosView';
import CompetenciasView from './components/CompetenciasView';
import EtapaProductivaView from './components/EtapaProductivaView';
import ProgramacionView from './components/ProgramacionView';
import LoginView from './components/LoginView';
import SENALogo from './components/SENALogo';
import GestionCurricularView from './components/GestionCurricularView';
import IndicadoresView from './components/IndicadoresView';
import SeguimientoEPView from './components/SeguimientoEPView';

import { 
  Upload, 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  AlertTriangle, 
  GraduationCap, 
  Calendar, 
  Trash2, 
  CircleUser,
  Activity,
  Layers,
  LogOut,
  BookOpen,
  BarChart3
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(() => {
    const saved = localStorage.getItem('sena_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [rows, setRows] = useState<SofiaRow[]>([]);
  const [fichas, setFichas] = useState<{ [id: string]: FichaMeta }>({});
  const [programacion, setProgramacion] = useState<ProgramacionRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  const [selectedFichaId, setSelectedFichaId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewType>('cargar');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const handleLoginSuccess = (email: string, role: string) => {
    const user = { email, role };
    setCurrentUser(user);
    localStorage.setItem('sena_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    if (confirm('¿Está seguro de que desea cerrar la sesión?')) {
      setCurrentUser(null);
      localStorage.removeItem('sena_current_user');
    }
  };

  const showLoading = (show: boolean, msg: string = '') => {
    setIsLoading(show);
    setLoadingMsg(msg);
  };

  const handleProcessComplete = (parsedRows: SofiaRow[], parsedFichas: { [id: string]: FichaMeta }) => {
    // Merge new rows with existing rows, preventing duplicates for the same Ficha ID.
    const newlyUploadedFichaIds = Object.keys(parsedFichas);
    const filteredOldRows = rows.filter(r => !newlyUploadedFichaIds.includes(r._ficha));
    
    const mergedRows = [...filteredOldRows, ...parsedRows];
    
    const mergedFichas = { ...fichas };
    for (const id of newlyUploadedFichaIds) {
      const existing = fichas[id];
      const newly = parsedFichas[id];
      if (existing) {
        mergedFichas[id] = {
          ...newly,
          archivos: Array.from(new Set([
            ...(existing.archivos || []),
            ...(newly.archivos || [])
          ]))
        };
      } else {
        mergedFichas[id] = newly;
      }
    }

    setRows(mergedRows);
    setFichas(mergedFichas);
    
    // Automatically set the first uploaded Ficha as active if none was selected
    if (!selectedFichaId && newlyUploadedFichaIds.length > 0) {
      setSelectedFichaId(newlyUploadedFichaIds[0]);
    }
    
    setActiveTab('dashboard');
  };

  const handleDeleteFicha = (id: string) => {
    const updatedRows = rows.filter(r => r._ficha !== id);
    setRows(updatedRows);
    
    const updatedFichas = { ...fichas };
    delete updatedFichas[id];
    setFichas(updatedFichas);
    
    if (selectedFichaId === id) {
      const remainingFichas = Object.keys(updatedFichas);
      setSelectedFichaId(remainingFichas.length > 0 ? remainingFichas[0] : '');
    }
    
    if (updatedRows.length === 0) {
      setActiveTab('cargar');
    }
  };

  const clearAllData = () => {
    if (!confirm('¿Está seguro de borrar absolutamente toda la información actual de las fichas e instructores?')) return;
    setRows([]);
    setFichas({});
    setProgramacion([]);
    setPendingFiles([]);
    setActiveTab('cargar');
  };

  const navigationTabs = [
    { id: 'cargar', label: 'Cargar Fichas', icon: Upload },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, disabled: rows.length === 0 },
    { id: 'aprendices', label: 'Aprendices', icon: Users, disabled: rows.length === 0 },
    { id: 'juicios', label: 'Juicios', icon: ClipboardList, disabled: rows.length === 0 },
    { id: 'no-aprob', label: 'No Aprobados', icon: AlertTriangle, disabled: rows.length === 0 },
    { id: 'competencias', label: 'Competencias', icon: Layers, disabled: rows.length === 0 },
    { id: 'etapa-productiva', label: 'Etapa Productiva', icon: GraduationCap, disabled: rows.length === 0 },
    { id: 'seguimiento-ep', label: 'Seguimiento Etapa Productiva', icon: Activity },
    { id: 'programacion', label: 'Programación', icon: Calendar },
    { id: 'separator-section', label: 'Gestión & Calidad', icon: null, isSeparator: true },
    { id: 'gestion-curricular', label: 'Gestión Curricular', icon: BookOpen, disabled: rows.length === 0 },
    { id: 'indicadores', label: 'Indicadores de Gestión', icon: BarChart3, disabled: rows.length === 0 }
  ];

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none antialiased text-slate-800">
      
      {/* Loading Backdrop Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-xs w-full text-center mx-4 border border-slate-100 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-sena/15 border-t-sena rounded-full animate-spin mb-4" />
            <p className="font-extrabold text-slate-900 mb-1">Procesando Datos</p>
            <p className="text-xs text-slate-500 truncate max-w-xs px-2">{loadingMsg || 'Cargando...'}</p>
          </div>
        </div>
      )}

      {/* Main Header Bar */}
      <header className="bg-sena text-white shadow-lg sticky top-0 z-[90]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div>
              <h1 className="text-sm font-black leading-tight tracking-tight">Centro de Formación Minero</h1>
              <p className="text-[10px] text-white/80 uppercase tracking-widest font-extrabold">Sistema de Seguimiento Académico</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-bold backdrop-blur-md">
              <CircleUser className="w-4 h-4" />
              <span>{currentUser.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-100 hover:text-white px-3.5 py-1.5 rounded-full border border-red-500/10 text-xs font-bold transition-all cursor-pointer uppercase tracking-wider"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Application Body Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        
        {/* Navigation Sidebar Drawer */}
        <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between p-3.5">
          <div className="space-y-1">
            {navigationTabs.map(tab => {
              if (tab.isSeparator) {
                return (
                  <div key={tab.id} className="py-2.5 flex flex-col gap-1.5 px-3.5 select-none">
                    <hr className="border-slate-150" />
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block">
                      {tab.label}
                    </span>
                  </div>
                );
              }
              const Icon = tab.icon!;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  disabled={tab.disabled}
                  onClick={() => setActiveTab(tab.id as ViewType)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-transparent text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-sena border-emerald-100'
                      : tab.disabled
                      ? 'text-slate-300 cursor-not-allowed opacity-50'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sena' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {(rows.length > 0 || programacion.length > 0) && (
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={clearAllData}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-red-500 hover:bg-red-50/50 border border-transparent hover:border-red-100 text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                Borrar Todo
              </button>
            </div>
          )}
        </aside>

        {/* Content Panel Scroll Wrapper */}
        <div className="flex-1 overflow-y-auto min-w-0 bg-slate-50">
          
          {/* Mobile Tab bar - only visible on small screens */}
          <div className="md:hidden flex items-center gap-1.5 p-2 bg-white border-b border-slate-200 overflow-x-auto custom-scrollbar">
            {navigationTabs.map(tab => {
              if (tab.isSeparator) {
                return (
                  <div key={tab.id} className="h-6 w-[1.5px] bg-slate-200 mx-2 self-center flex-shrink-0 select-none" />
                );
              }
              const Icon = tab.icon!;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  disabled={tab.disabled}
                  onClick={() => setActiveTab(tab.id as ViewType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border ${
                    isActive
                      ? 'bg-emerald-50 text-sena border-emerald-100'
                      : tab.disabled
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : 'text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700 cursor-pointer'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Core Routed Main Workspace */}
          <main className="p-4 sm:p-6 lg:p-8 max-w-[1380px] mx-auto min-h-full">
            
            {activeTab === 'cargar' && (
              <CargarView
                pendingFiles={pendingFiles}
                setPendingFiles={setPendingFiles}
                onProcessComplete={handleProcessComplete}
                showLoading={showLoading}
                existingFichas={fichas}
                onDeleteFicha={handleDeleteFicha}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                rows={rows}
                fichas={fichas}
                programacion={programacion}
                onNavigate={(tabId) => setActiveTab(tabId as ViewType)}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'aprendices' && (
              <AprendicesView 
                rows={rows} 
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'juicios' && (
              <JuiciosView 
                rows={rows} 
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'no-aprob' && (
              <NoAprobadosView 
                rows={rows} 
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'competencias' && (
              <CompetenciasView 
                rows={rows} 
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'etapa-productiva' && (
              <EtapaProductivaView 
                rows={rows} 
                fichas={fichas}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'seguimiento-ep' && (
              <SeguimientoEPView 
                rows={rows}
                fichas={fichas}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'programacion' && (
              <ProgramacionView
                programacion={programacion}
                setProgramacion={setProgramacion}
                rows={rows}
                fichas={fichas}
                showLoading={showLoading}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'gestion-curricular' && (
              <GestionCurricularView
                rows={rows}
                fichas={fichas}
                programacion={programacion}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

            {activeTab === 'indicadores' && (
              <IndicadoresView
                rows={rows}
                fichas={fichas}
                programacion={programacion}
                selectedFichaId={selectedFichaId}
                setSelectedFichaId={setSelectedFichaId}
              />
            )}

          </main>
        </div>

      </div>
    </div>
  );
}
