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

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list, detail, new, users, resolved, departments, categories, products, waiting_nf
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const TECASSISTIVA_LOGO_URL = "https://tecassistiva.com.br/wp-content/uploads/2022/02/Logo-Tecassistiva.png";

  // Modals
  const [showExportModal, setShowExportModal] = useState(false);

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
      if (currentUser.role === 'admin') {
        q = query(ticketsRef, where('status', '==', 'resolved'), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'gerente') {
        q = query(ticketsRef, where('status', '==', 'resolved'), where('department', '==', currentUser.department), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'atendente') {
        q = query(ticketsRef, where('status', '==', 'resolved'), orderBy('createdAt', 'desc'));
      } else {
        q = query(ticketsRef, where('status', '==', 'resolved'), where('createdBy.uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      }
    } else if (view === 'finance_control') {
      // Finance view - Tickets waiting for NF or with NF Emitted (Pending Return)
      q = query(ticketsRef, where('status', 'in', ['waiting_nf', 'nf_emitted']), orderBy('createdAt', 'desc'));
    } else if (view === 'list') { // Open tickets
      if (currentUser.role === 'admin') {
        q = query(ticketsRef, where('status', '!=', 'resolved'), orderBy('status'), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'gerente') {
        q = query(ticketsRef, where('status', '!=', 'resolved'), where('department', '==', currentUser.department), orderBy('status'), orderBy('createdAt', 'desc'));
      } else if (currentUser.role === 'atendente') {
        q = query(ticketsRef, where('status', '!=', 'resolved'), orderBy('status'), orderBy('createdAt', 'desc'));
      } else {
        q = query(ticketsRef, where('status', '!=', 'resolved'), where('createdBy.uid', '==', currentUser.uid), orderBy('status'), orderBy('createdAt', 'desc'));
      }
    } else {
      return; // Other views don't need ticket list
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Client-side filtering if needed (e.g. for composite index issues during dev)
      // For now, assume indexes are built or queries are simple enough
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
    // CSV Export specifically for Finance view
    if (view === 'finance_control') {
      const headers = ['ID Chamado', 'Assunto', 'Solicitante', 'Departamento', 'Data Solicitação', 'Produto Código', 'Produto Nome', 'Número de Série'];
      const rows = [];

      tickets.forEach(t => {
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

      const csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `emissao_nf_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  // Permissões para ver menu Financeiro
  const canViewFinance = ['admin', 'atendente', 'gerente'].includes(currentUser.role); // Simplificando acesso

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
            <div className="flex items-center gap-2 mb-4">
              {/* Logo Image */}
              <div className="bg-white p-2 rounded-lg">
                <img src={TECASSISTIVA_LOGO_URL} alt="Tecassistiva" className="h-8 w-auto" />
              </div>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
              Helpdesk Tecassistiva
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              Olá, {currentUser.name?.split(' ')[0]}
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
              {currentUser.role === 'gerente' ? 'Resolvidos do Depto.' : 'Resolvidos'}
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
          <h1 className="text-xl font-bold text-slate-800">HelpDesk Pro</h1>
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
                {currentUser.role === 'gerente' ? 'Chamados do Departamento' : 'Chamados em Aberto'}
              </h2>
              {/* Only show New Ticket button for relevant roles */}
              {['admin', 'colaborador', 'gerente'].includes(currentUser.role) && (
                <button
                  onClick={() => setView('new')}
                  className="flex items-center gap-2 px-4 py-2 text-white transition-transform bg-tec-blue rounded-full shadow-lg hover:scale-105 hover:bg-tec-blue-light"
                >
                  <Plus className="w-5 h-5" /> Novo Chamado
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onClick={handleTicketClick} />
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-lg shadow-sm">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-lg">Nenhum chamado pendente.</p>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'resolved' && (
          <>
            <h2 className="mb-6 text-2xl font-bold text-slate-800">Chamados Resolvidos</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tickets.length > 0 ? (
                tickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} onClick={handleTicketClick} />
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-lg shadow-sm">
                  <p>Nenhum chamado resolvido encontrado.</p>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'finance_control' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-pink-600" />
                Controle de Notas Fiscais
              </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm"
              >
                <Download className="w-5 h-5" /> Baixar Planilha
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
      </main>

      {/* Export Modal (Original) - Keep it or remove if replaced by Finance export? keeping for general export */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Exportar Chamados</h3>
            <p className="text-slate-600 mb-6">Funcionalidade de exportação geral em construção.</p>
            <button onClick={() => setShowExportModal(false)} className="w-full py-2 bg-gray-200 rounded-md">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
