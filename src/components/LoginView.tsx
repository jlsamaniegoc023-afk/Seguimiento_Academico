import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import SENALogo from './SENALogo';

interface LoginViewProps {
  onLoginSuccess: (email: string, role: string) => void;
}

const CREDENTIALS = [
  { email: 'instructor@sena.edu.co', pass: 'sena2026', role: 'Instructor' },
  { email: 'coordinador@sena.edu.co', pass: 'centro2026', role: 'Coordinador' },
  { email: 'admin@sena.edu.co', pass: 'admin123', role: 'Administrador' },
  { email: 'eapuentes@sena.edu.co', pass: 'CentroMinero911', role: 'Instructor EA' },
  { email: 'yglopez@sena.edu.co', pass: 'CentroMinero9111', role: 'Instructor YG' },
];

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    const found = CREDENTIALS.find(
      (c) => c.email.toLowerCase() === trimmedEmail && c.pass === password
    );

    if (found) {
      onLoginSuccess(found.email, found.role);
    } else {
      setError('Correo electrónico o contraseña incorrectos. Por favor verifique.');
    }
  };

  return (
    <div className="min-h-screen bg-[#39A900] flex flex-col items-center justify-center p-4 font-sans select-none antialiased relative overflow-hidden">
      {/* Decorative ambient background elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl max-w-md w-full border border-white/10 relative z-10 transition-all duration-300">
        
        {/* Card Header without Logo */}
        <div className="pb-6 border-b border-slate-100 text-center">
          <div>
            <h1 className="text-sm font-black text-slate-800 leading-tight">Centro de Formación Minero</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold mt-1">REGIONAL BOYACÁ — SENA</p>
          </div>
        </div>

        {/* Login Form Title */}
        <div className="mt-8 mb-6">
          <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-none">Iniciar sesión</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
            Accede con tu correo institucional asignado
          </p>
        </div>

        {/* Error Feedback Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@sena.edu.co"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#39A900] outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Password Input Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#39A900] outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full bg-[#39A900] hover:bg-[#2e8800] text-white py-3.5 px-4 rounded-2xl text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-[#39A900]/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <LogIn className="w-4 h-4" />
            Ingresar al sistema
          </button>
        </form>

        {/* Quick Help Credentials helper block */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowCredentials(!showCredentials)}
            className="text-[11px] font-bold text-slate-400 hover:text-[#39A900] transition-colors uppercase tracking-wider"
          >
            {showCredentials ? 'Ocultar Credenciales de Prueba' : 'Ver Credenciales de Prueba'}
          </button>

          {showCredentials && (
            <div className="mt-4 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 text-[11px] space-y-2.5 font-semibold text-slate-600">
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[9px] mb-1.5 border-b border-slate-200 pb-1">
                Credenciales disponibles:
              </p>
              {CREDENTIALS.map((cred) => (
                <div
                  key={cred.email}
                  onClick={() => {
                    setEmail(cred.email);
                    setPassword(cred.pass);
                  }}
                  className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 p-2 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                  title="Haz clic para autocompletar"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{cred.role}</span>
                    <span className="text-slate-500 font-normal">{cred.email}</span>
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                      {cred.pass}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
