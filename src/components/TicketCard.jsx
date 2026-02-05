// src/components/TicketCard.jsx
'use client';
import { Calendar, Tag, User } from 'lucide-react';

export default function TicketCard({ ticket, onClick }) {
  const statusLabels = {
    queue: 'Em Fila',
    started: 'Iniciado',
    analyzing: 'Em Análise',
    waiting_user: 'Aguardando Retorno',
    waiting_nf: 'Aguardando Emissão de NF',
    nf_emitted: 'NF Emitida',
    canceled: 'Cancelado',
    resolved: 'Resolvido',
    // Fallback para status antigos
    open: 'Aberto',
    progress: 'Em Progresso',
  };

  const statusColors = {
    queue: 'bg-gray-500',
    started: 'bg-blue-500',
    analyzing: 'bg-yellow-500',
    waiting_user: 'bg-orange-500',
    waiting_nf: 'bg-purple-500',
    nf_emitted: 'bg-indigo-500',
    canceled: 'bg-red-500',
    resolved: 'bg-green-500',
    // Fallback para status antigos
    open: 'bg-green-500',
    progress: 'bg-yellow-500',
  };

  const { status, subject, createdAt, department, assignedTo } = ticket;
  const statusLabel = statusLabels[status] || 'Desconhecido';
  const statusColor = statusColors[status] || 'bg-gray-400';

  const getDepartmentLabel = (dept) => {
    const labels = {
      support: 'Suporte Técnico',
      financial: 'Financeiro',
      hr: 'Recursos Humanos',
    };
    return labels[dept] || dept;
  };

  const formattedDate = createdAt?.toDate
    ? new Date(createdAt.toDate()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Data inválida';

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-600';
      case 'high': return 'border-l-yellow-500';
      case 'medium': return 'border-l-blue-400';
      case 'low': return 'border-l-green-600';
      default: return 'border-l-tec-blue';
    }
  };

  const priorityBorderClass = getPriorityColor(ticket.priority);

  return (
    <div
      onClick={onClick}
      className={`
        group relative p-4 bg-white rounded-xl border-l-4 ${priorityBorderClass}
        shadow-sm hover:shadow-xl
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:-translate-y-1
        cursor-pointer
      `}
    >
      {/* Header com badges */}
      <div className="flex items-center justify-between mb-3">
        <span className={`
          px-3 py-1.5 text-xs font-semibold rounded-full
          ${statusColor} text-white
          shadow-sm
        `}>
          {statusLabel}
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Título com melhor tipografia */}
      <h3 className="text-base font-bold text-slate-800 mb-2 line-clamp-2 leading-snug">
        {subject}
      </h3>

      {/* Separador sutil */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-2" />

      {/* Info do solicitante */}
      <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
        <User className="w-4 h-4 text-slate-400" />
        <strong>{ticket.createdBy?.name || 'N/A'}</strong>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Tag className="w-4 h-4 text-slate-400" />
          <span>{getDepartmentLabel(department)}</span>
        </div>
        {assignedTo && (
          <span className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-100">
            📌 {assignedTo.name}
          </span>
        )}
      </div>
    </div>
  );
}
