// src/app/page.js
'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Plus, LogOut, Download, Loader2, Users, Building2, Menu, X, CheckCircle } from 'lucide-react';
import AuthScreen from '@/components/AuthScreen';
import TicketCard from '@/components/TicketCard';
import TicketDetail from '@/components/TicketDetail';
import NewTicketForm from '@/components/NewTicketForm';
import UserManagement from '@/components/UserManagement';
import DepartmentManagement from '@/components/DepartmentManagement';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [resolvedTickets, setResolvedTickets] = useState([]);
  const [view, setView] = useState('list'); // 'list', 'detail', 'new', 'users', 'departments', 'resolved', 'open' (colaborador)
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [previousView, setPreviousView] = useState('list'); // Para rastrear view anterior

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

  const sortTickets = (ticketsList) => {
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

    return [...ticketsList].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;

      const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);

      // Comparar apenas dias (zerando horas)
      const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
      const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();

      // 1. Dias diferentes: Mais antigos primeiro
      if (dayA !== dayB) {
        return dayA - dayB;
      }

      // 2. Mesmo dia: Prioridade (Urgente > Alta > Média > Baixa)
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;

      if (weightA !== weightB) {
        return weightB - weightA;
      }

      // 3. Mesmo dia e prioridade: Mais antigos primeiro (por hora)
      return dateA.getTime() - dateB.getTime();
    });
  };

  useEffect(() => {
    if (!currentUser) return;
    // Não carregar tickets na view 'resolved' (tem query separada) ou 'open' (colaborador/gerente)
    if (view === 'resolved' || (view === 'open' && ['colaborador', 'gerente'].includes(currentUser.role))) return;

    setLoading(true);
    const ticketsCollection = collection(db, 'tickets');

    // Fetch all tickets and filter on client side to avoid complex indexes
    const q = currentUser.role === 'colaborador'
      ? query(
        ticketsCollection,
        where('createdBy.uid', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      )
      : query(
        ticketsCollection,
        orderBy('createdAt', 'desc')
      );

    const unsubscribeTickets = onSnapshot(q, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter out resolved and canceled tickets on client side
      const activeTickets = allTickets.filter(t =>
        t.status !== 'resolved' && t.status !== 'canceled'
      );
      setTickets(sortTickets(activeTickets));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar chamados:", error);
      setLoading(false);
    });

    return () => unsubscribeTickets();
  }, [currentUser, view]);

  // Load resolved tickets
  useEffect(() => {
    if (!currentUser || view !== 'resolved') return;

    const ticketsCollection = collection(db, 'tickets');

    // Admin sees all resolved tickets, Atendente sees only their own, Colaborador sees only theirs
    const q = currentUser.role === 'admin'
      ? query(
        ticketsCollection,
        where('status', '==', 'resolved'),
        orderBy('timeResolved', 'desc')
      )
      : currentUser.role === 'atendente'
        ? query(
          ticketsCollection,
          where('status', '==', 'resolved'),
          where('assignedTo.uid', '==', currentUser.uid),
          orderBy('timeResolved', 'desc')
        )
        : currentUser.role === 'gerente'
          ? query(
            ticketsCollection,
            where('status', '==', 'resolved'),
            where('department', '==', currentUser.department),
            orderBy('timeResolved', 'desc')
          )
          : query(
            ticketsCollection,
            where('status', '==', 'resolved'),
            where('createdBy.uid', '==', currentUser.uid),
            orderBy('timeResolved', 'desc')
          );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resolved = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setResolvedTickets(resolved);
    }, (error) => {
      console.error("Erro ao buscar chamados resolvidos:", error);
    });

    return () => unsubscribe();
  }, [currentUser, view]);

  // Load open tickets for collaborators/gerentes (view 'open')
  useEffect(() => {
    if (!currentUser || !['colaborador', 'gerente'].includes(currentUser.role) || view !== 'open') return;

    setLoading(true);
    const ticketsCollection = collection(db, 'tickets');

    const q = currentUser.role === 'gerente'
      ? query(
        ticketsCollection,
        where('department', '==', currentUser.department),
        orderBy('createdAt', 'desc')
      )
      : query(
        ticketsCollection,
        where('createdBy.uid', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filtrar apenas chamados não resolvidos
      const openTickets = allTickets.filter(t => t.status !== 'resolved' && t.status !== 'canceled');
      setTickets(sortTickets(openTickets));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar chamados em aberto:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, view]);

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
    setPreviousView(view); // Salvar view atual antes de mudar
    setSelectedTicket(ticket);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedTicket(null);
    setView(previousView); // Voltar para a view anterior
  };

  const handleExportReport = async (dateFrom = '', dateTo = '') => {
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

    // Fetch ALL tickets from Firestore (not just the filtered state)
    const ticketsCollection = collection(db, 'tickets');
    const allTicketsQuery = query(ticketsCollection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(allTicketsQuery);
    const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter tickets by date range
    let filteredTickets = allTickets;
    if (dateFrom || dateTo) {
      filteredTickets = allTickets.filter(t => {
        if (!t.createdAt) return false;

        // Convert Firestore timestamp to Date
        let ticketDate;
        if (t.createdAt.toDate) {
          ticketDate = t.createdAt.toDate();
        } else if (t.createdAt.seconds) {
          ticketDate = new Date(t.createdAt.seconds * 1000);
        } else {
          ticketDate = new Date(t.createdAt);
        }

        if (dateFrom) {
          const fromDate = new Date(dateFrom + 'T00:00:00');
          if (ticketDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo + 'T23:59:59');
          if (ticketDate > toDate) return false;
        }

        return true;
      });
    }

    // Check if there are tickets to export
    if (filteredTickets.length === 0) {
      alert('Nenhum chamado encontrado no período selecionado.');
      return;
    }

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
    const rows = filteredTickets.map(t => {
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

    // Generate filename with date range
    let filename = 'relatorio_chamados';
    if (dateFrom && dateTo) {
      filename += `_${dateFrom}_a_${dateTo}`;
    } else if (dateFrom) {
      filename += `_desde_${dateFrom}`;
    } else if (dateTo) {
      filename += `_ate_${dateTo}`;
    } else {
      filename += `_${new Date().toISOString().split('T')[0]}`;
    }
    filename += '.csv';

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", filename);
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
        w-72 p-6 text-white bg-tec-blue 
        flex flex-col justify-between
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div>
          <button
            onClick={() => {
              setView(currentUser.role === 'colaborador' ? 'open' : 'list');
              setSelectedTicket(null);
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3 mb-8 w-full hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src="/logo.png" alt="Teca Logo" className="w-10 h-10" />
            <h1 className="text-2xl font-bold">Helpdesk Tecassistiva</h1>
          </button>
          <div className="mt-8">
            <p className="text-lg font-semibold">{currentUser.name}</p>
            <p className="text-sm text-indigo-300 capitalize">
              {currentUser.role === 'admin' ? 'Administrador' :
                currentUser.role === 'atendente' ? 'Atendente' : 'Colaborador'}
            </p>
          </div>

          <nav className="mt-10">
            {/* Colaborador e Gerente veem "Chamados em Aberto" e "Chamados Resolvidos" */}
            {['colaborador', 'gerente'].includes(currentUser.role) && (
              <>
                <button
                  onClick={() => setView('open')}
                  className={`w-full flex items-center gap-3 px-4 py-2 font-semibold transition-colors rounded-md whitespace-nowrap ${view === 'open' ? 'bg-blue-600 text-white' : 'text-tec-gray-dark bg-tec-gray-light hover:bg-gray-300'
                    }`}
                >
                  <Users className="w-5 h-5 flex-shrink-0" /> {currentUser.role === 'gerente' ? 'Chamados do Depto.' : 'Meus Chamados'}
                </button>
                <button
                  onClick={() => setView('resolved')}
                  className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md whitespace-nowrap ${view === 'resolved' ? 'bg-green-600 text-white' : 'text-tec-gray-dark bg-tec-gray-light hover:bg-gray-300'
                    }`}
                >
                  <CheckCircle className="w-5 h-5 flex-shrink-0" /> {currentUser.role === 'gerente' ? 'Resolvidos do Depto.' : 'Chamados Resolvidos'}
                </button>
              </>
            )}

            {/* Admin e Atendente veem "Fila" */}
            {(currentUser.role === 'admin' || currentUser.role === 'atendente') && (
              <>
                <button onClick={() => setView('list')} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                  <Users className="w-5 h-5" /> Fila
                </button>
                <button onClick={() => setView('resolved')} className="w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
                  <CheckCircle className="w-5 h-5" /> Resolvidos
                </button>
              </>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button onClick={() => setShowExportModal(true)} className="w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold text-tec-gray-dark transition-colors bg-tec-gray-light rounded-md hover:bg-gray-300">
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
        {view === 'open' && (
          <div>
            <h2 className="mb-6 text-3xl font-bold text-slate-800">Meus Chamados</h2>
            {loading ? (
              <div className="flex justify-center mt-10">
                <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {tickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} onClick={() => handleSelectTicket(ticket)} />)}
                {tickets.length === 0 && <p className="text-slate-600">Nenhum chamado pendente encontrado.</p>}
              </div>
            )}
          </div>
        )}
        {view === 'resolved' && (
          <div>
            <h2 className="mb-6 text-3xl font-bold text-slate-800">Chamados Resolvidos</h2>
            {resolvedTickets.length === 0 ? (
              <p className="text-slate-600">Nenhum chamado resolvido ainda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {resolvedTickets.map(ticket => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => handleSelectTicket(ticket)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'new' && <NewTicketForm user={currentUser} onTicketCreated={handleBackToList} />}
        {view === 'detail' && selectedTicket && <TicketDetail ticket={selectedTicket} user={currentUser} onBack={handleBackToList} />}
        {view === 'users' && <UserManagement onBack={handleBackToList} />}
        {view === 'departments' && <DepartmentManagement onBack={handleBackToList} />}
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Exportar Relatório</h2>
            <p className="text-sm text-slate-600 mb-4">
              Selecione o período para filtrar os chamados. Deixe em branco para exportar todos.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data DE
                </label>
                <input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tec-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data ATÉ
                </label>
                <input
                  type="date"
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tec-blue"
                />
              </div>

              {exportDateFrom && exportDateTo && new Date(exportDateFrom) > new Date(exportDateTo) && (
                <p className="text-sm text-red-600">
                  A data DE não pode ser maior que a data ATÉ
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportDateFrom('');
                  setExportDateTo('');
                }}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (exportDateFrom && exportDateTo && new Date(exportDateFrom) > new Date(exportDateTo)) {
                    alert('A data DE não pode ser maior que a data ATÉ');
                    return;
                  }
                  handleExportReport(exportDateFrom, exportDateTo);
                  setShowExportModal(false);
                  setExportDateFrom('');
                  setExportDateTo('');
                }}
                className="flex-1 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-blue-700 transition-colors font-semibold"
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão Flutuante para Novo Chamado - Apenas para Colaboradores e Gerentes */}
      {currentUser && ['colaborador', 'gerente'].includes(currentUser.role) && view !== 'new' && view !== 'detail' && (
        <button
          onClick={() => setView('new')}
          className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center z-50 hover:scale-110"
          title="Novo Chamado"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
