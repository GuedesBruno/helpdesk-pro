// src/components/TicketCard.jsx
'use client';
import { Calendar, Tag } from 'lucide-react';

const statusConfig = {
  open: { text: 'Aberto', color: 'bg-green-500' },
  progress: { text: 'Em Progresso', color: 'bg-yellow-500' },
  resolved: { text: 'Resolvido', color: 'bg-slate-500' },
};

export default function TicketCard({ ticket, onClick }) {
  const { status, subject, createdAt, department } = ticket;
  const config = statusConfig[status] || { text: 'Desconhecido', color: 'bg-gray-400' };

  const formattedDate = createdAt?.toDate ? new Date(createdAt.toDate()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data inválida';

  return (
    <div onClick={onClick} className="p-4 transition-all duration-300 bg-white border-l-4 rounded-md shadow-sm cursor-pointer border-l-indigo-600 hover:shadow-lg hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${config.color}`}>{config.text}</span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-4 h-4" /> <span>{formattedDate}</span>
        </div>
      </div>
      <h3 className="mb-2 font-bold text-slate-800">{subject}</h3>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Tag className="w-4 h-4" /> <span>{department}</span>
      </div>
    </div>
  );
}
