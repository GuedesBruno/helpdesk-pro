// src/components/NewTicketForm.jsx
'use client';
import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';

export default function NewTicketForm({ user, onTicketCreated }) {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description) return;
    setIsSubmitting(true);

    try {
      // Usar departamento do usuário logado
      const department = user.department || '';
      const departmentName = user.departmentName || '';

      // Criar chamado sem atribuição
      const ticketData = {
        subject,
        priority,
        department,
        departmentName,
        description,
        status: 'queue',
        createdAt: serverTimestamp(),
        createdBy: {
          uid: user.uid,
          name: user.name,
          email: user.email
        },
        assignedTo: null, // Sem atribuição automática
      };

      const ticketRef = await addDoc(collection(db, 'tickets'), ticketData);

      // Enviar notificação por email
      try {
        await fetch('/api/notify-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new',
            ticket: {
              id: ticketRef.id,
              ...ticketData,
              createdAt: new Date(), // Para o email
            }
          }),
        });
      } catch (emailError) {
        console.error('Erro ao enviar notificação por email:', emailError);
        // Não bloqueia a criação do chamado se o email falhar
      }

      onTicketCreated();
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      alert('Erro ao criar chamado. Por favor, tente novamente.');
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
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Prioridade</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">Descrição</label>
          <textarea
            id="description"
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tec-blue disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
          </button>
        </div>
      </form>
    </div>
  );
}
