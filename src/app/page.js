// src/app/page.js
'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Plus, LogOut, Download, Loader2 } from 'lucide-react';
import AuthScreen from '@/components/AuthScreen';
import TicketCard from '@/components/TicketCard';
import TicketDetail from '@/components/TicketDetail';
import NewTicketForm from '@/components/NewTicketForm';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [view, setView] = useState('list'); // 'list', 'detail', 'new'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, fetch additional details (role) from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              name: userData.name || user.displayName || 'Usuário',
              role: userData.role || 'user'
            });
          } else {
            // Fallback if user doc doesn't exist (shouldn't happen with new signup flow)
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              name: user.displayName || 'Usuário',
              role: 'user'
            });
          }
        } catch (error) {
          console.error("Error fetching user details:", error);
        }
      } else {
        setCurrentUser(null);
        setTickets([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const ticketsCollection = collection(db, 'tickets');

    // Admin sees all tickets, User sees only their own
    const q = currentUser.role === 'user'
      ? query(ticketsCollection, where('createdBy.uid', '==', currentUser.uid), orderBy('createdAt', 'desc'))
      : query(ticketsCollection, orderBy('createdAt', 'desc'));

    const unsubscribeTickets = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(ticketsData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar chamados:", error);
      setLoading(false);
    });

    return () => unsubscribeTickets();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('list');
      setSelectedTicket(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedTicket(null);
    setView('list');
  };

  const handleExportReport = () => {
    if (currentUser?.role !== 'admin') return;
    const headers = ['ID', 'Assunto', 'Status', 'Prioridade', 'Departamento', 'Criado por', 'Email Criador', 'Data Criação'];
    const rows = tickets.map(t => [
      t.id, `"${t.subject.replace(/"/g, '""')}"`, t.status, t.priority, t.department,
      t.createdBy.name, t.createdBy.email,
      t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toLocaleString('pt-BR') : 'N/A'
    ].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "relatorio_chamados.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-64 p-6 text-white bg-slate-800 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-bold">HelpDesk Pro</h1>
          <div className="mt-8">
            <p className="text-lg font-semibold">{currentUser.name}</p>
            <p className="text-sm text-indigo-300 capitalize">{currentUser.role === 'admin' ? 'Administrador' : 'Colaborador'}</p>
          </div>
          <nav className="mt-10">
            <button onClick={() => setView('new')} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-white transition-colors bg-indigo-600 rounded-md hover:bg-indigo-700">
              <Plus className="w-5 h-5" /> Novo Chamado
            </button>
            {currentUser.role === 'admin' && (
              <button onClick={handleExportReport} className="w-full flex items-center gap-3 px-4 py-2 mt-4 font-semibold text-slate-800 transition-colors bg-slate-200 rounded-md hover:bg-slate-300">
                <Download className="w-5 h-5" /> Exportar
              </button>
            )}
          </nav>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-white transition-colors bg-red-600 rounded-md hover:bg-red-700">
          <LogOut className="w-5 h-5" /> Sair
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {view === 'list' && (
          <div>
            <h2 className="mb-6 text-3xl font-bold text-slate-800">Meus Chamados</h2>
            {loading ? (
              <div className="flex justify-center mt-10">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {tickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} onClick={() => handleSelectTicket(ticket)} />)}
                {tickets.length === 0 && <p className="text-slate-600">Nenhum chamado encontrado.</p>}
              </div>
            )}
          </div>
        )}
        {view === 'new' && <NewTicketForm user={currentUser} onTicketCreated={handleBackToList} />}
        {view === 'detail' && selectedTicket && <TicketDetail ticket={selectedTicket} user={currentUser} onBack={handleBackToList} />}
      </main>
    </div>
  );
}
