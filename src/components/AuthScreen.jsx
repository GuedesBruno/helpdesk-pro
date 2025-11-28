// src/components/AuthScreen.jsx
'use client';
import { User, Headset, Shield } from 'lucide-react';

const mockUsers = {
  user: { uid: 'user123', name: 'João Colaborador', email: 'joao@empresa.com', role: 'user' },
  attendant: { uid: 'attendant456', name: 'Maria Atendente', email: 'maria@empresa.com', role: 'attendant' },
  admin: { uid: 'admin789', name: 'Carlos Administrador', email: 'carlos@empresa.com', role: 'admin' },
};

export default function AuthScreen({ onLogin }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800">HelpDesk Pro</h1>
          <p className="mt-2 text-slate-600">Selecione seu perfil para continuar</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => onLogin(mockUsers.user)} className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <User className="w-5 h-5" /> Entrar como Colaborador
          </button>
          <button onClick={() => onLogin(mockUsers.attendant)} className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-white transition-colors bg-slate-700 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">
            <Headset className="w-5 h-5" /> Entrar como Atendente
          </button>
          <button onClick={() => onLogin(mockUsers.admin)} className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
            <Shield className="w-5 h-5" /> Entrar como Administrador
          </button>
        </div>
        <p className="text-xs text-center text-slate-500">Este é um ambiente de simulação.</p>
      </div>
    </div>
  );
}
