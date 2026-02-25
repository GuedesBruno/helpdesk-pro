'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Plus, LogOut, Download, Loader2, Users, Building2, Menu, X, CheckCircle, Tag, Package, FileText, AlertTriangle } from 'lucide-react';
import AuthScreen from '@/components/AuthScreen';
import TicketCard from '@/components/TicketCard';
import TicketDetail from '@/components/TicketDetail';
import NewTicketForm from '@/components/NewTicketForm';
import UserManagement from '@/components/UserManagement';
import DepartmentManagement from '@/components/DepartmentManagement';
import CategoryManagement from '@/components/CategoryManagement';
import ProductManagement from '@/components/ProductManagement';
import InventoryManagement from '@/components/InventoryManagement';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list, detail, new, users, resolved, departments, categories, products, inventories, finance_control
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const TECASSISTIVA_LOGO_URL = "/logo.png";

  // Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  // Resolved View Filters
  const [resolvedDateFrom, setResolvedDateFrom] = useState('');
  const [resolvedDateTo, setResolvedDateTo] = useState('');
  const [resolvedSearchTerm, setResolvedSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            ...userData
          });
        } else {
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            role: 'colaborador',
            name: user.displayName || 'Usuário'
          });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let q;
    const ticketsRef = collection(db, 'tickets');

    if (view === 'resolved') {
      // Finalized tickets: resolved, canceled, no_solution
      const finalizedStatuses = ['resolved', 'canceled', 'no_solution'];

      if (currentUser.role === 'admin') {
        q = query(ticketsRef, where('status', 'in', finalizedStatuses), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'gerente') {
        // Removed where('department') to avoid missing composite index; filtering below
        q = query(ticketsRef, where('status', 'in', finalizedStatuses), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'atendente' || currentUser.role === 'colaborador_atendente') {
        // Support attendants see all finalized tickets
        // Other department attendants (e.g., Finance) see only their department's finalized tickets (filtered below)
        q = query(ticketsRef, where('status', 'in', finalizedStatuses), orderBy('createdAt', 'desc'));
      } else {
        // Colaborador sees their own finalized tickets
        q = query(ticketsRef, where('status', 'in', finalizedStatuses), where('createdBy.uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      }
    } else if (view === 'finance_control') {
      // Finance view - Tickets waiting for NF or with NF Emitted (Pending Return)
      q = query(ticketsRef, where('status', 'in', ['waiting_nf', 'nf_emitted']), orderBy('createdAt', 'desc'));
    } else if (view === 'list') { // Open tickets - exclude finalized statuses
      const activeStatuses = ['queue', 'started', 'analyzing', 'waiting_user', 'waiting_nf', 'nf_emitted'];

      if (currentUser.role === 'admin') {
        q = query(ticketsRef, where('status', 'in', activeStatuses), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'gerente') {
        // Removed where('department') to avoid missing composite index; filtering below
        q = query(ticketsRef, where('status', 'in', activeStatuses), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'atendente' || currentUser.role === 'colaborador_atendente') {
        // Support attendants see all open tickets
        // Other department attendants (e.g., Finance) see only their department's open tickets (filtered below)
        q = query(ticketsRef, where('status', 'in', activeStatuses), orderBy('createdAt', 'desc'));
      } else {
        q = query(ticketsRef, where('status', 'in', activeStatuses), where('createdBy.uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      }
    } else {
      return; // Other views don't need ticket list
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side filtering
      if (currentUser.role === 'gerente') {
        // Managers see their department's tickets, OR tickets they created themselves
        docs = docs.filter(ticket => ticket.department === currentUser.department || ticket.createdBy?.uid === currentUser.uid);
      } else if (currentUser.role === 'atendente' || currentUser.role === 'colaborador_atendente') {
        if (currentUser.department !== 'suporte') {
          // Non-support attendants only see their department's tickets
          docs = docs.filter(ticket => ticket.department === currentUser.department);
        }
        if (currentUser.department === 'financeiro') {
          // Finance attendants should only see equipment separation tickets
          docs = docs.filter(ticket => ticket.categoryType === 'equipment_separation');
        }
      }

      setTickets(docs);
    }, (error) => {
      console.error("Error fetching tickets:", error);
      // Fallback for missing index:
      if (error.code === 'failed-precondition') {
        console.log("Index missing, alerting user (dev mode)");
      }
    });

    return () => unsubscribe();
  }, [currentUser, view]);

  // Permission helpers
  const canViewFinance = currentUser && (
    currentUser.role === 'admin' ||
    (currentUser.role === 'gerente' && currentUser.department === 'financeiro') ||
    (currentUser.role === 'atendente' && currentUser.department === 'financeiro') ||
    (currentUser.role === 'colaborador_atendente' && currentUser.department === 'financeiro')
  );

  const handleSignOut = () => signOut(auth);

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    setView('detail');
    setIsSidebarOpen(false);
  };

  const handleBackToList = () => {
    setSelectedTicket(null);
    setView('list'); // Default back to list, logic could be smarter to return to prev view
  };

  const exportToCSV = () => {
    let headers, rows, filename;

    // Filter tickets by date if range is provided
    let ticketsToExport = [...tickets];
    if (exportDateFrom || exportDateTo) {
      ticketsToExport = tickets.filter(t => {
        if (!t.createdAt) return false;
        const ticketDate = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);

        if (exportDateFrom) {
          const fromDate = new Date(exportDateFrom + 'T00:00:00');
          if (ticketDate < fromDate) return false;
        }

        if (exportDateTo) {
          const toDate = new Date(exportDateTo + 'T23:59:59');
          if (ticketDate > toDate) return false;
        }

        return true;
      });
    }

    if (view === 'finance_control') {
      // Finance-specific export with product details
      headers = ['ID Chamado', 'Assunto', 'Solicitante', 'Departamento', 'Data Solicitação', 'Produto Código', 'Produto Nome', 'Número de Série'];
      rows = [];

      ticketsToExport.forEach(t => {
        if (t.products && t.products.length > 0) {
          t.products.forEach(p => {
            rows.push([
              t.id,
              `"${t.subject}"`,
              t.createdBy?.name || '',
              t.departmentName || '',
              t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : '',
              p.code || '',
              `"${p.name || ''}"`,
              p.serialNumber || ''
            ]);
          });
        } else {
          rows.push([t.id, `"${t.subject}"`, t.createdBy?.name || '', t.departmentName || '', t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : '', '-', '-', '-']);
        }
      });
      filename = `emissao_nf_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      // General export for list and resolved views
      headers = ['ID', 'Assunto', 'Status', 'Prioridade', 'Departamento', 'Solicitante', 'Atendente', 'Data Criação', 'Data Resolução'];
      rows = ticketsToExport.map(t => [
        t.id,
        `"${t.subject}"`,
        t.status,
        t.priority || 'medium',
        t.departmentName || '',
        t.createdBy?.name || '',
        t.assignedTo?.name || 'Não atribuído',
        t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : '',
        t.timeResolved?.toDate ? t.timeResolved.toDate().toLocaleDateString() : ''
      ]);
      filename = `chamados_${view}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 text-tec-blue animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-tec-blue shadow-xl transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full text-white">
          <div className="p-6 border-b border-blue-800">
            <button
              onClick={() => { setView('list'); setIsSidebarOpen(false); }}
              className="flex items-center gap-3 mb-6 w-full hover:opacity-80 transition-opacity cursor-pointer"
              title="Ir para página inicial"
            >
              <img src={TECASSISTIVA_LOGO_URL} alt="Tecassistiva" className="h-14 w-auto" />
              <h1 className="text-lg font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                Helpdesk Tecassistiva
              </h1>
            </button>
            <p className="mt-2 text-sm text-blue-100">
              Olá, {(() => {
                if (!currentUser.name) return 'Usuário';
                const parts = currentUser.name.trim().split(' ');
                if (parts.length === 1) return parts[0];
                return `${parts[0]} ${parts[parts.length - 1]}`;
              })()}
            </p>
            <span className="inline-block px-2 py-1 mt-1 text-xs font-semibold text-blue-900 bg-blue-100 rounded-full capitalize">
              {currentUser.role === 'gerente' ? 'Gerente / Gestor' : currentUser.role}
            </span>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <button
              onClick={() => { setView('list'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 font-semibold transition-colors rounded-md
                ${view === 'list' ? 'bg-white text-tec-blue shadow-md' : 'text-blue-100 hover:bg-blue-800'}`}
            >
              <Users className="w-5 h-5" />
              {currentUser.role === 'gerente' ? 'Chamados do Depto.' : 'Meus Chamados'}
            </button>

            <button
              onClick={() => { setView('resolved'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 font-semibold transition-colors rounded-md
                ${view === 'resolved' ? 'bg-white text-tec-blue shadow-md' : 'text-blue-100 hover:bg-blue-800'}`}
            >
              <CheckCircle className="w-5 h-5" />
              {currentUser.role === 'gerente' ? 'Finalizados do Depto.' : 'Finalizados'}
            </button>

            {/* Menu Financeiro */}
            {canViewFinance && (
              <button
                onClick={() => { setView('finance_control'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 font-semibold transition-colors rounded-md
                        ${view === 'finance_control' ? 'bg-white text-tec-blue shadow-md' : 'text-blue-100 hover:bg-blue-800'}`}
              >
                <FileText className="w-5 h-5" />
                Controle de NFs
                {/* Badge Count could go here */}
              </button>
            )}

            {currentUser.role === 'admin' && (
              <>
                <div className="mt-4 mb-2 px-4 text-xs font-bold text-blue-200 uppercase tracking-wider">
                  Gerenciamento
                </div>
                <button onClick={() => setShowExportModal(true)} className="w-full flex items-center gap-3 px-4 py-2 font-semibold text-blue-100 transition-colors hover:bg-blue-800 rounded-md">
                  <Download className="w-5 h-5" /> Exportar Geral
                </button>
                <button onClick={() => setView('users')} className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md ${view === 'users' ? 'bg-white text-tec-blue' : 'text-blue-100 hover:bg-blue-800'}`}>
                  <Users className="w-5 h-5" /> Usuários
                </button>
                <button onClick={() => setView('departments')} className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md ${view === 'departments' ? 'bg-white text-tec-blue' : 'text-blue-100 hover:bg-blue-800'}`}>
                  <Building2 className="w-5 h-5" /> Departamentos
                </button>
                <button onClick={() => setView('categories')} className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md ${view === 'categories' ? 'bg-white text-tec-blue' : 'text-blue-100 hover:bg-blue-800'}`}>
                  <Tag className="w-5 h-5" /> Categorias
                </button>
                <button onClick={() => setView('products')} className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md ${view === 'products' ? 'bg-white text-tec-blue' : 'text-blue-100 hover:bg-blue-800'}`}>
                  <Package className="w-5 h-5" /> Produtos
                </button>
                <button onClick={() => setView('inventories')} className={`w-full flex items-center gap-3 px-4 py-2 mt-2 font-semibold transition-colors rounded-md ${view === 'inventories' ? 'bg-white text-tec-blue' : 'text-blue-100 hover:bg-blue-800'}`}>
                  <Package className="w-5 h-5" /> Estoques
                </button>
              </>
            )}
          </nav>

          <div className="p-4 border-t bg-slate-50">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-semibold text-red-100 transition-colors border border-red-400 rounded-md hover:bg-red-700 bg-red-600 bg-opacity-80"
            >
              <LogOut className="w-4 h-4" /> Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-slate-100 p-4 lg:p-8">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-slate-800">Helpdesk Tecassistiva</h1>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-600 rounded-md hover:bg-slate-200"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* View Content */}
        {view === 'list' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                {currentUser.role === 'gerente' ? 'Chamados do Depto.' : 'Meus Chamados'}
              </h2>
              {/* Only show New Ticket button for relevant roles */}
              {['admin', 'colaborador', 'colaborador_atendente', 'gerente'].includes(currentUser.role) && (
                <button
                  onClick={() => setView('new')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-all bg-tec-blue rounded-lg shadow-md hover:shadow-lg hover:bg-tec-blue-light"
                >
                  <Plus className="w-4 h-4" /> Novo Chamado
                </button>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onClick={() => handleTicketClick(ticket)} />
                ))
              ) : (
                <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-xl shadow-sm">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhum chamado pendente.</p>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'resolved' && (() => {
          // Filter tickets for resolved view
          const filteredResolved = tickets.filter(t => {
            // Apply Date Filter based on timeResolved OR createdAt if timeResolved is missing
            if (resolvedDateFrom || resolvedDateTo) {
              const dateField = t.timeResolved || t.createdAt;
              if (dateField) {
                const itemDate = dateField.toDate ? dateField.toDate() : new Date(dateField);

                if (resolvedDateFrom) {
                  const fromDate = new Date(resolvedDateFrom + 'T00:00:00');
                  if (itemDate < fromDate) return false;
                }

                if (resolvedDateTo) {
                  const toDate = new Date(resolvedDateTo + 'T23:59:59');
                  if (itemDate > toDate) return false;
                }
              }
            }

            // Apply Search Term Filter
            if (resolvedSearchTerm) {
              const term = resolvedSearchTerm.toLowerCase();
              const matchSubject = t.subject?.toLowerCase().includes(term);
              const matchTicketId = t.id?.toLowerCase().includes(term);
              const matchUser = t.createdBy?.name?.toLowerCase().includes(term);
              const matchAssigned = t.assignedTo?.name?.toLowerCase().includes(term);

              if (!matchSubject && !matchTicketId && !matchUser && !matchAssigned) {
                return false;
              }
            }

            return true;
          });

          return (
            <div className="flex flex-col h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Finalizados
                </h2>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg shadow-sm">
                  <input
                    type="text"
                    placeholder="Buscar assunto, usuário ou ID..."
                    value={resolvedSearchTerm}
                    onChange={(e) => setResolvedSearchTerm(e.target.value)}
                    className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue min-w-[200px]"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium">De:</span>
                    <input
                      type="date"
                      value={resolvedDateFrom}
                      onChange={(e) => setResolvedDateFrom(e.target.value)}
                      className="px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue text-slate-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium">Até:</span>
                    <input
                      type="date"
                      value={resolvedDateTo}
                      onChange={(e) => setResolvedDateTo(e.target.value)}
                      className="px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue text-slate-600"
                    />
                  </div>
                  {(resolvedDateFrom || resolvedDateTo || resolvedSearchTerm) && (
                    <button
                      onClick={() => {
                        setResolvedDateFrom('');
                        setResolvedDateTo('');
                        setResolvedSearchTerm('');
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chamado</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Informações</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Resolução</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredResolved.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleTicketClick(t)}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900 line-clamp-2">{t.subject}</span>
                              <span className="text-xs font-mono text-slate-500 mt-1">#{t.id.slice(0, 8)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col text-sm text-slate-600">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" /> {t.createdBy?.name || 'Desconhecido'}</span>
                              <span className="flex items-center gap-1 mt-1 text-xs"><Building2 className="w-3 h-3 text-slate-400" /> {t.departmentName || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {t.timeResolved?.toDate ? t.timeResolved.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('pt-BR') : '-')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {t.status === 'resolved' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 gap-1">
                                <CheckCircle className="w-3 h-3" /> Resolvido
                              </span>
                            ) : t.status === 'canceled' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 gap-1">
                                <X className="w-3 h-3" /> Cancelado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 gap-1">
                                <AlertTriangle className="w-3 h-3" /> Sem Solução
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredResolved.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <CheckCircle className="w-12 h-12 mb-3 text-slate-300" />
                              <p className="text-base font-medium">Nenhum chamado encontrado com esses filtros.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {view === 'finance_control' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-pink-600" />
                Controle de NFs
              </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
              >
                <Download className="w-4 h-4" /> Exportar
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assunto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prazo Devolução</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.map(t => {
                    // Deadline Alert Logic
                    let deadlineAlert = null;
                    if (t.status === 'nf_emitted' && t.nfReturnDeadline) {
                      const deadlineDate = t.nfReturnDeadline.toDate ? t.nfReturnDeadline.toDate() : new Date(t.nfReturnDeadline);
                      const today = new Date();
                      const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        deadlineAlert = <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Vencido ({Math.abs(diffDays)}d)</span>;
                      } else if (diffDays <= 7) {
                        deadlineAlert = <span className="text-orange-600 font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Vence em {diffDays}d</span>;
                      } else {
                        deadlineAlert = <span className="text-slate-500">{deadlineDate.toLocaleDateString()}</span>;
                      }
                    }

                    return (
                      <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleTicketClick(t)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">#{t.id.slice(0, 6)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.subject}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.createdBy?.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {t.status === 'waiting_nf'
                            ? <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-semibold">Emitir NF</span>
                            : <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">Aguardando Retorno</span>
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {deadlineAlert || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <span className="text-blue-600 hover:text-blue-900">Ver Detalhes</span>
                        </td>
                      </tr>
                    );
                  })}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                        Nenhuma NF pendente de emissão ou retorno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === 'new' && <NewTicketForm user={currentUser} onTicketCreated={handleBackToList} />}
        {view === 'detail' && selectedTicket && <TicketDetail ticket={selectedTicket} user={currentUser} onBack={handleBackToList} />}
        {view === 'users' && <UserManagement onBack={handleBackToList} />}
        {view === 'departments' && <DepartmentManagement onBack={handleBackToList} />}
        {view === 'categories' && <CategoryManagement onBack={handleBackToList} />}
        {view === 'products' && <ProductManagement onBack={handleBackToList} />}
        {view === 'inventories' && <InventoryManagement onBack={handleBackToList} />}
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Exportar Relatório</h2>
            <p className="text-sm text-slate-600 mb-4">
              Selecione o período para filtrar os chamados. Deixe em branco para exportar todos da lista atual.
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
                  exportToCSV();
                }}
                className="flex-1 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-blue-700 transition-colors font-semibold"
              >
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
