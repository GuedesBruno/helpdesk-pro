// src/components/NewTicketForm.jsx
'use client';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';

export default function NewTicketForm({ user, onTicketCreated }) {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('medium');
  const [department, setDepartment] = useState('support');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        subject, priority, department, description, status: 'open', createdAt: serverTimestamp(),
        createdBy: { uid: user.uid, name: user.name, email: user.email },
      });
      onTicketCreated();
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-slate-800">Abrir Novo Chamado</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700">Assunto</label>
          <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Prioridade</label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <option value="low">Baixa</option> <option value="medium">Média</option> <option value="high">Alta</option>
            </select>
          </div>
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-slate-700">Departamento</label>
            <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
              <option value="support">Suporte Técnico</option> <option value="financial">Financeiro</option> <option value="hr">Recursos Humanos</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">Descrição</label>
          <textarea id="description" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required></textarea>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300">
            <Send className="w-4 h-4" /> {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
          </button>
        </div>
      </form>
    </div>
  );
}
