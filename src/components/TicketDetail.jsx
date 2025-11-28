// src/components/TicketDetail.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Trash2, Send } from 'lucide-react';

export default function TicketDetail({ ticket, user, onBack }) {
  const [status, setStatus] = useState(ticket.status);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const isPrivileged = user.role === 'admin' || user.role === 'attendant';

  useEffect(() => {
    if (!ticket.id) return;
    const q = query(collection(db, 'tickets', ticket.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [ticket.id]);

  const handleStatusChange = async (newStatus) => {
    const ticketRef = doc(db, 'tickets', ticket.id);
    await updateDoc(ticketRef, { status: newStatus });
    setStatus(newStatus);
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza?')) {
      await deleteDoc(doc(db, 'tickets', ticket.id));
      onBack();
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (newComment.trim() === '') return;
    await addDoc(collection(db, 'tickets', ticket.id, 'comments'), {
      text: newComment, createdAt: serverTimestamp(),
      author: { uid: user.uid, name: user.name, role: user.role },
    });
    setNewComment('');
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <button onClick={onBack} className="flex items-center gap-2 mb-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="mb-6">
        <h2 className="mb-2 text-3xl font-bold text-slate-800">{ticket.subject}</h2>
        <p className="text-slate-600">{ticket.description}</p>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
          <span><strong>Criado por:</strong> {ticket.createdBy.name}</span>
          <span><strong>Prioridade:</strong> {ticket.priority}</span>
          <span><strong>Departamento:</strong> {ticket.department}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 rounded-md bg-slate-50">
        <div>
          <label className="mr-2 font-medium text-slate-700">Status:</label>
          {isPrivileged ? (
            <select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="px-3 py-1 border rounded-md border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="open">Aberto</option> <option value="progress">Em Progresso</option> <option value="resolved">Resolvido</option>
            </select>
          ) : (<span className="font-semibold text-indigo-700">{status}</span>)}
        </div>
        {user.role === 'admin' && (
          <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        )}
      </div>
      <div>
        <h3 className="mb-4 text-xl font-bold text-slate-700">Comentários</h3>
        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-2">
          {comments.map(c => (
            <div key={c.id} className="p-3 rounded-md bg-slate-100">
              <p className="text-slate-800">{c.text}</p>
              <p className="mt-1 text-xs text-right text-slate-500">
                - {c.author.name} ({c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleString('pt-BR') : '...'})
              </p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-slate-500">Nenhum comentário.</p>}
        </div>
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Adicionar comentário..." className="flex-grow px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <button type="submit" className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"><Send className="w-5 h-5" /></button>
        </form>
      </div>
    </div>
  );
}
