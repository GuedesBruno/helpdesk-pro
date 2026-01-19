// src/components/TicketDetail.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Trash2, Send, Play, Search, MessageSquare, CheckCircle, UserPlus } from 'lucide-react';
import { startTicket, updateTicketStatus, releaseTicketFromAttendant, getAllAttendants, transferTicket } from '@/lib/queueDistribution';
import { notifyTicketStarted, notifyStatusChange, notifyTicketCanceled, notifyCollaboratorResponse } from '@/lib/notifications';

export default function TicketDetail({ ticket, user, onBack }) {
  const [status, setStatus] = useState(ticket.status);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [collaboratorResponse, setCollaboratorResponse] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [onlineAttendants, setOnlineAttendants] = useState([]);
  const [selectedAttendant, setSelectedAttendant] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(ticket); // Estado local para ticket atualizado

  // Permission checks - Todos atendentes e admins podem editar qualquer chamado
  const canChangeStatus = user.role === 'admin' || user.role === 'atendente';
  const canDelete = user.role === 'admin' ||
    (user.role === 'colaborador' && ticket.createdBy.uid === user.uid);
  const canComment = true;

  // Qualquer atendente ou admin pode agir no chamado (não apenas o atribuído)
  const canActOnTicket = user.role === 'admin' || user.role === 'atendente';

  // Translation helpers
  const getPriorityLabel = (priority) => {
    const labels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente',
    };
    return labels[priority] || priority;
  };

  const getDepartmentLabel = (department) => {
    const labels = {
      support: 'Suporte Técnico',
      financial: 'Financeiro',
      hr: 'Recursos Humanos',
    };
    return labels[department] || department;
  };

  // Listener em tempo real para atualizações do ticket
  useEffect(() => {
    if (!ticket.id) return;

    const ticketRef = doc(db, 'tickets', ticket.id);
    const unsubscribe = onSnapshot(ticketRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const updatedTicket = { id: docSnapshot.id, ...docSnapshot.data() };
        setCurrentTicket(updatedTicket);
        setStatus(updatedTicket.status);
      }
    });

    return () => unsubscribe();
  }, [ticket.id]);

  useEffect(() => {
    if (!ticket.id) return;
    const q = query(collection(db, 'tickets', ticket.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [ticket.id]);

  // Atender chamado (queue -> started) - Atribui ao atendente que iniciar
  const handleStartTicket = async () => {
    try {
      // Atribuir chamado ao atendente que está iniciando
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'started',
        assignedTo: {
          uid: user.uid,
          name: user.name,
          email: user.email
        },
        timeStarted: serverTimestamp(),
        updatedAt: new Date()
      });

      setStatus('started');

      // Enviar notificação por email
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'assigned',
          ticket: {
            ...ticket,
            id: ticket.id,
            status: 'started',
            assignedTo: { uid: user.uid, name: user.name, email: user.email }
          }
        }),
      });
    } catch (error) {
      console.error('Erro ao iniciar atendimento:', error);
    }
  };

  // Colocar em análise (started -> analyzing)
  const handleSetAnalyzing = async () => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'analyzing',
        updatedAt: new Date()
      });
      setStatus('analyzing');

      // Enviar notificação por email
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_change',
          ticket: { ...ticket, id: ticket.id, status: 'analyzing' },
          previousStatus: status,
          user
        }),
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  // Solicitar informação (analyzing -> waiting_user)
  const handleRequestInfo = async () => {
    if (!requestMessage.trim()) return;

    try {
      // 1. Adicionar solicitação como comentário
      await addDoc(collection(db, 'tickets', ticket.id, 'comments'), {
        text: requestMessage,
        createdBy: {
          uid: user.uid,
          name: user.name,
          email: user.email,
        },
        createdAt: serverTimestamp(),
        isRequest: true, // Marcar como solicitação
      });

      // 2. Atualizar status do ticket
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'waiting_user',
        statusMessage: requestMessage,
        updatedAt: new Date()
      });
      setStatus('waiting_user');

      // 3. Enviar notificação por email
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_change',
          ticket: { ...ticket, id: ticket.id, status: 'waiting_user', statusMessage: requestMessage },
          previousStatus: status,
          user
        }),
      });

      setRequestMessage('');
      setShowRequestModal(false);
    } catch (error) {
      console.error('Erro ao solicitar informação:', error);
    }
  };

  // Colaborador responde à solicitação de informação
  const handleCollaboratorResponse = async () => {
    if (!collaboratorResponse.trim()) return;

    try {
      console.log('🔵 Iniciando resposta do colaborador...');

      // 1. Adicionar comentário com a resposta
      await addDoc(collection(db, 'tickets', ticket.id, 'comments'), {
        text: collaboratorResponse,
        createdBy: {
          uid: user.uid,
          name: user.name,
          email: user.email,
        },
        createdAt: serverTimestamp(),
        isResponse: true,
      });
      console.log('✅ Comentário adicionado');

      // 2. Mudar status para analyzing
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'analyzing',
        statusMessage: '', // Limpar mensagem de solicitação
        updatedAt: new Date(),
      });
      setStatus('analyzing');
      console.log('✅ Status atualizado para analyzing');

      // 3. Enviar notificação por email para suporte@tecassistiva.com.br
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          ticket: { ...ticket, id: ticket.id },
          user,
          comment: {
            text: `Resposta do colaborador: ${collaboratorResponse}`,
            author: { uid: user.uid, name: user.name, role: user.role }
          }
        }),
      });
      console.log('✅ Email de notificação enviado');

      // 4. Limpar campo
      setCollaboratorResponse('');
      console.log('✅ Resposta do colaborador concluída!');
    } catch (error) {
      console.error('❌ Erro ao enviar resposta:', error);
    }
  };

  // Resolver chamado (any -> resolved)
  const handleResolve = async () => {
    try {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        status: 'resolved',
        timeResolved: serverTimestamp(),
        updatedAt: new Date()
      });
      setStatus('resolved');

      // Enviar notificação por email
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resolved',
          ticket: { ...ticket, id: ticket.id, status: 'resolved', timeResolved: new Date() }
        }),
      });
    } catch (error) {
      console.error('Erro ao resolver chamado:', error);
    }
  };

  // Excluir chamado
  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir este chamado?')) {
      // Se tem atendente atribuído, notificar
      if (ticket.assignedTo) {
        await notifyTicketCanceled(ticket, ticket.assignedTo);
        await releaseTicketFromAttendant(ticket.assignedTo.uid);
      }

      await deleteDoc(doc(db, 'tickets', ticket.id));
      onBack();
    }
  };

  // Abrir modal de transferência
  const handleOpenTransferModal = async () => {
    const attendants = await getAllAttendants();
    // Filtrar para não mostrar o atendente atual
    const filtered = attendants.filter(a => a.uid !== user.uid);
    setOnlineAttendants(filtered); // Reutilizando o state, mas agora com todos os atendentes
    setShowTransferModal(true);
  };

  // Transferir chamado
  const handleTransfer = async () => {
    if (!selectedAttendant) return;

    setTransferring(true);
    try {
      const newAttendant = onlineAttendants.find(a => a.uid === selectedAttendant);
      await transferTicket(ticket.id, ticket.assignedTo.uid, newAttendant);

      // Fechar modal e voltar
      setShowTransferModal(false);
      onBack();
    } catch (error) {
      console.error('Erro ao transferir chamado:', error);
    } finally {
      setTransferring(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (newComment.trim() === '') return;

    try {
      await addDoc(collection(db, 'tickets', ticket.id, 'comments'), {
        text: newComment,
        createdAt: serverTimestamp(),
        author: { uid: user.uid, name: user.name, role: user.role },
      });

      // Enviar notificação por email
      await fetch('/api/notify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          ticket: { ...ticket, id: ticket.id },
          user,
          comment: {
            text: newComment,
            author: { uid: user.uid, name: user.name, role: user.role }
          }
        }),
      });

      setNewComment('');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
    }
  };

  // Status labels e cores
  const getStatusInfo = (st) => {
    const statusMap = {
      queue: { label: 'Em Fila', color: 'bg-gray-100 text-gray-800' },
      started: { label: 'Iniciado', color: 'bg-blue-100 text-blue-800' },
      analyzing: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
      waiting_user: { label: 'Aguardando Retorno', color: 'bg-orange-100 text-orange-800' },
      canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
      resolved: { label: 'Resolvido', color: 'bg-green-100 text-green-800' },
    };
    return statusMap[st] || { label: st, color: 'bg-gray-100 text-gray-800' };
  };

  const statusInfo = getStatusInfo(status);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <button onClick={onBack} className="flex items-center gap-2 mb-4 text-sm font-semibold text-tec-blue hover:text-tec-blue-light">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6">
        <h2 className="mb-2 text-3xl font-bold text-slate-800">{currentTicket.subject}</h2>
        <p className="text-slate-600">{currentTicket.description}</p>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
          <span><strong>Criado por:</strong> {currentTicket.createdBy.name}</span>
          <span><strong>Prioridade:</strong> {getPriorityLabel(currentTicket.priority)}</span>
          <span>
            <strong>Atendente:</strong> {currentTicket.assignedTo ? currentTicket.assignedTo.name : 'Não atribuído'}
          </span>
        </div>
      </div>

      {/* Alerta de Solicitação de Informação - Para Colaborador */}
      {status === 'waiting_user' && user.uid === ticket.createdBy.uid && (
        <div className="p-4 mb-6 border-l-4 border-yellow-400 rounded-md bg-yellow-50">
          <div className="flex items-start">
            <MessageSquare className="flex-shrink-0 mt-1 mr-3 text-yellow-600" size={20} />
            <div className="flex-1">
              <h3 className="mb-2 font-semibold text-yellow-800">
                ⚠️ Informação Solicitada
              </h3>
              <p className="mb-4 text-gray-700">{ticket.statusMessage}</p>

              <textarea
                value={collaboratorResponse}
                onChange={(e) => setCollaboratorResponse(e.target.value)}
                placeholder="Digite sua resposta aqui..."
                className="w-full p-3 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
              />

              <button
                onClick={handleCollaboratorResponse}
                disabled={!collaboratorResponse.trim()}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                Enviar Resposta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Aguardando Resposta - Para Atendente */}
      {status === 'waiting_user' && user.role !== 'colaborador' && (
        <div className="p-4 mb-6 border-l-4 border-blue-400 rounded-md bg-blue-50">
          <p className="text-blue-800">
            ⏳ Aguardando resposta do colaborador
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Solicitação: {ticket.statusMessage}
          </p>
        </div>
      )}

      {/* Status e Ações */}
      <div className="p-4 mb-6 rounded-md bg-slate-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="font-medium text-slate-700">Status:</label>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <div className="flex gap-2">
            {canChangeStatus && ticket.assignedTo && (
              <button onClick={handleOpenTransferModal} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700">
                <UserPlus className="w-4 h-4" /> Transferir
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-white bg-tec-danger rounded-md hover:bg-red-700">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            )}
          </div>
        </div>

        {/* Botões de Ação para Atendentes e Admin - Todos podem editar */}
        {canActOnTicket && (
          <div className="flex flex-wrap gap-2">
            {status === 'queue' && (
              <button onClick={handleStartTicket} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <Play className="w-4 h-4" /> Atender
              </button>
            )}

            {status === 'started' && (
              <>
                <button onClick={handleSetAnalyzing} className="flex items-center gap-2 px-4 py-2 text-white bg-yellow-600 rounded-md hover:bg-yellow-700">
                  <Search className="w-4 h-4" /> Em Análise
                </button>
                <button onClick={handleResolve} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Resolver
                </button>
              </>
            )}

            {status === 'analyzing' && (
              <>
                <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 text-white bg-orange-600 rounded-md hover:bg-orange-700">
                  <MessageSquare className="w-4 h-4" /> Solicitar Informação
                </button>
                <button onClick={handleResolve} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Resolver
                </button>
              </>
            )}

            {status === 'waiting_user' && (
              <button onClick={handleResolve} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">
                <CheckCircle className="w-4 h-4" /> Resolver
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Solicitar Informação */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-slate-800">Solicitar Informação</h3>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Descreva qual informação você precisa..."
              className="w-full h-32 px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRequestInfo}
                className="flex-1 px-4 py-2 text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transferir Chamado */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-slate-800">Transferir Chamado</h3>

            {onlineAttendants.length === 0 ? (
              <p className="text-slate-600">Nenhum outro atendente online disponível.</p>
            ) : (
              <>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Selecione o atendente:
                </label>
                <select
                  value={selectedAttendant}
                  onChange={(e) => setSelectedAttendant(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                >
                  <option value="">Selecione...</option>
                  {onlineAttendants.map((attendant) => (
                    <option key={attendant.uid} value={attendant.uid}>
                      {attendant.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              {onlineAttendants.length > 0 && (
                <button
                  onClick={handleTransfer}
                  disabled={!selectedAttendant || transferring}
                  className="flex-1 px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {transferring ? 'Transferindo...' : 'Transferir'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comentários - Estilo Chat */}
      <div>
        <h3 className="mb-4 text-xl font-bold text-slate-700">Conversas</h3>
        <div className="mb-6 max-h-96 overflow-y-auto pr-2 space-y-3">
          {comments.map(c => {
            // Verificar se a mensagem é do usuário atual
            const isCurrentUser = c.createdBy?.uid === user.uid || c.author?.uid === user.uid;

            return (
              <div
                key={c.id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${isCurrentUser
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                    }`}
                >
                  {/* Nome do remetente (apenas se não for o usuário atual) */}
                  {!isCurrentUser && (
                    <p className="text-xs font-semibold mb-1 opacity-70">
                      {c.createdBy?.name || c.author?.name || 'Usuário'}
                    </p>
                  )}

                  {/* Texto da mensagem */}
                  <p className="text-sm break-words">{c.text}</p>

                  {/* Timestamp */}
                  <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                    {c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '...'}
                  </p>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <p className="text-center text-slate-500 py-8">Nenhuma conversa ainda.</p>
          )}
        </div>

        {/* Campo de nova mensagem */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-grow px-4 py-3 border rounded-full border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-6 py-3 text-white bg-blue-500 rounded-full hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
