// src/app/page.js
'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Plus, LogOut, Download, Loader2, Users, Building2, Menu, X } from 'lucide-react';
import AuthScreen from '@/components/AuthScreen';
import TicketCard from '@/components/TicketCard';
import TicketDetail from '@/components/TicketDetail';
import NewTicketForm from '@/components/NewTicketForm';
import UserManagement from '@/components/UserManagement';
import DepartmentManagement from '@/components/DepartmentManagement';
import OnlineToggle from '@/components/OnlineToggle';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [view, setView] = useState('list'); // 'list', 'detail', 'new', 'users', 'departments'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Helper function to retry Firestore operations
  const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        console.warn(`Retry ${i + 1}/${maxRetries} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  };

  useEffect(() => {
    let unsubscribeUser = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, listen to user document changes in real-time
        try {
          const userDocRef = doc(db, 'users', user.uid);

          // Use onSnapshot for real-time updates
          unsubscribeUser = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setCurrentUser({
                uid: user.uid,
                email: user.email,
                name: userData.name || user.displayName || 'Usuário',
                role: userData.role || 'user',
                isOnline: userData.isOnline,
                department: userData.department,
                departmentName: userData.departmentName,
              });
            } else {
              // User doc doesn't exist, create it
              console.warn("User document not found, creating default profile");
              const defaultUserData = {
                uid: user.uid,
                name: user.displayName || 'Usuário',
                email: user.email,
                role: 'colaborador',
                isOnline: false,
                createdAt: new Date().toISOString()
              };

              setDoc(userDocRef, defaultUserData);

              setCurrentUser({
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'Usuário',
                role: 'colaborador',
                isOnline: false,
              });
            }
            setAuthLoading(false);
          }, (error) => {
            console.error("Error listening to user document:", error);
            setAuthLoading(false);
          });
        } catch (error) {
          console.error("Error setting up user listener:", error);
          setAuthLoading(false);
        }
      } else {
        setCurrentUser(null);
        setTickets([]);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const ticketsCollection = collection(db, 'tickets');

    // Colaborador sees only their own tickets
    // Admin and Atendente see all tickets
    const q = currentUser.role === 'colaborador'
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

    // Helper functions
    const getStatusLabel = (status) => {
      const labels = { queue: 'Em Fila', started: 'Iniciado', analyzing: 'Em Análise', waiting_user: 'Aguardando Retorno', resolved: 'Resolvido', canceled: 'Cancelado' };
      return labels[status] || status;
    };

    const getPriorityLabel = (priority) => {
      const labels = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
      return labels[priority] || priority;
    };

    const getDepartmentLabel = (dept) => {
      const labels = { support: 'Suporte Técnico', financial: 'Financeiro', hr: 'Recursos Humanos' };
      return labels[dept] || dept;
    };

    const calculateHours = (start, end) => {
      if (!start || !end) return 'N/A';
      const startDate = start.toDate ? start.toDate() : new Date(start);
      const endDate = end.toDate ? end.toDate() : new Date(end);
      const hours = (endDate - startDate) / (1000 * 60 * 60);
      // Prevent negative values
      if (hours < 0) return 'N/A';
      return hours.toFixed(2) + 'h';
    };

    const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('pt-BR');
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return 'N/A';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('pt-BR');
    };

    // Headers
    const headers = [
      'ID', 'Assunto', 'Status', 'Prioridade', 'Departamento',
      'Criado por', 'Email', 'Atendente',
      'Data Criação', 'Hora Criação',
      'Data Início', 'Hora Início',
      'Data Resolução', 'Hora Resolução',
      'Tempo em Fila', 'Tempo de Resolução'
    ];

    // Rows
    const rows = tickets.map(t => {
      const escapeCSV = (value) => `"${String(value || 'N/A').replace(/"/g, '""')}"`;

      return [
        escapeCSV(t.id),
        escapeCSV(t.subject),
        escapeCSV(getStatusLabel(t.status)),
        escapeCSV(getPriorityLabel(t.priority)),
        escapeCSV(getDepartmentLabel(t.department)),
        escapeCSV(t.createdBy?.name || 'N/A'),
        escapeCSV(t.createdBy?.email || 'N/A'),
        escapeCSV(t.assignedTo?.name || 'Não atribuído'),
        escapeCSV(formatDate(t.createdAt)),
        escapeCSV(formatTime(t.createdAt)),
        escapeCSV(formatDate(t.timeStarted)),
        escapeCSV(formatTime(t.timeStarted)),
        escapeCSV(formatDate(t.timeResolved)),
        escapeCSV(formatTime(t.timeResolved)),
        escapeCSV(calculateHours(t.createdAt, t.timeStarted)),
        escapeCSV(calculateHours(t.timeStarted, t.timeResolved))
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `relatorio_chamados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <Loader2 className="w-10 h-10 text-tec-blue animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Hamburger Menu Button (Mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 text-white bg-tec-blue rounded-md lg:hidden"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 p-6 text-white bg-tec-blue 
        flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="Teca Logo" className="w-10 h-10" />
            <h1 className="text-2xl font-bold">Helpdesk Tecassistiva</h1>
          </div>
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-lg font-semibold">{currentUser.name}</p>
              {(currentUser.role === 'atendente' || currentUser.role === 'admin') && (
                <OnlineToggle user={currentUser} />
              )}
            </div>
            <p className="text-sm text-indigo-300 capitalize">
              {currentUser.role === 'admin' ? 'Administrador' :
                currentUser.role === 'atendente' ? 'Atendente' : 'Colaborador'}
            </p>
          </div>

          <nav className="mt-10">
            {/* Colaborador vê "Novo Chamado" */}
            {currentUser.role === 'colaborador' && (
              <button onClick={() => setView('new')} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                <Plus className="w-5 h-5" /> Novo Chamado
              </button>
            )}

            {/* Admin e Atendente veem "Fila" */}
            {(currentUser.role === 'admin' || currentUser.role === 'atendente') && (
              <button onClick={() => setView('list')} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                <Users className="w-5 h-5" /> Fila
              </button>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button onClick={handleExportReport} className="w-full flex items-center gap-3 px-4 py-2 mt-4 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                  <Download className="w-5 h-5" /> Exportar
                </button>
                <button onClick={() => setView('users')} className="w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                  <Users className="w-5 h-5" /> Usuários
                </button>
                <button onClick={() => setView('departments')} className="w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                  <Building2 className="w-5 h-5" /> Departamentos
                </button>
              </>
            )}
          </nav>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-white transition-colors bg-tec-danger rounded-md hover:bg-red-700">
          <LogOut className="w-5 h-5" /> Sair
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {view === 'list' && (
          <div>
            <h2 className="mb-6 text-3xl font-bold text-slate-800">Meus Chamados</h2>
            {loading ? (
              <div className="flex justify-center mt-10">
                <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
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
        {view === 'users' && <UserManagement onBack={handleBackToList} />}
        {view === 'departments' && <DepartmentManagement onBack={handleBackToList} />}
      </main>
    </div>
  );
}
