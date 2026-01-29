// src/components/UserManagement.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { Users, Mail, Trash2, X, Loader2, Edit } from 'lucide-react';

export default function UserManagement({ onBack }) {
    console.log('🔄 UserManagement component loaded - Version 2.0');

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('colaborador');
    const [inviteDepartment, setInviteDepartment] = useState('');
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        role: '',
        department: ''
    });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    useEffect(() => {
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load departments
    useEffect(() => {
        const deptCollection = collection(db, 'departments');
        const q = query(deptCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const deptData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => d.active); // Only active departments
            setDepartments(deptData.sort((a, b) => a.name.localeCompare(b.name)));
        });

        return () => unsubscribe();
    }, []);

    const handleRoleChange = async (userId, newRole) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { role: newRole });
        } catch (error) {
            console.error('Erro ao atualizar role:', error);
            setError('Erro ao atualizar permissão do usuário');
        }
    };

    const handleDeleteUser = async (userId) => {
        console.log('handleDeleteUser chamado para userId:', userId);
        setUserToDelete(userId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;

        console.log('Confirmando exclusão do usuário:', userToDelete);
        try {
            const userRef = doc(db, 'users', userToDelete);
            await deleteDoc(userRef);
            console.log('Usuário excluído com sucesso!');
            setSuccess('Usuário removido com sucesso');
            setTimeout(() => setSuccess(''), 3000);
            setShowDeleteModal(false);
            setUserToDelete(null);
        } catch (error) {
            console.error('Erro ao remover usuário:', error);
            console.error('Código do erro:', error.code);
            console.error('Mensagem do erro:', error.message);

            // Mensagem de erro mais detalhada
            let errorMessage = 'Erro ao remover usuário';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permissão negada. Verifique se você é administrador e se as regras do Firestore estão corretas.';
            } else if (error.message) {
                errorMessage = `Erro ao remover usuário: ${error.message}`;
            }

            setError(errorMessage);
            setTimeout(() => setError(''), 5000);
            setShowDeleteModal(false);
            setUserToDelete(null);
        }
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        setEditForm({
            name: user.name || '',
            email: user.email || '',
            role: user.role || 'colaborador',
            department: user.department || ''
        });
        setShowEditModal(true);
        setError('');
        setSuccess('');
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            // Buscar nome do departamento se foi alterado
            let departmentName = editingUser.departmentName;
            if (editForm.department !== editingUser.department) {
                const deptRef = doc(db, 'departments', editForm.department);
                const deptDoc = await getDoc(deptRef);
                departmentName = deptDoc.exists() ? deptDoc.data().name : '';
            }

            // Atualizar usuário no Firestore
            const userRef = doc(db, 'users', editingUser.id);
            await updateDoc(userRef, {
                name: editForm.name,
                email: editForm.email,
                role: editForm.role,
                department: editForm.department,
                departmentName: departmentName,
                updatedAt: new Date()
            });

            setSuccess('Usuário atualizado com sucesso!');
            setShowEditModal(false);
            setEditingUser(null);
            setEditForm({ name: '', email: '', role: '', department: '' });
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            setError('Erro ao atualizar usuário: ' + error.message);
        }
    };


    const handleInviteUser = async (e) => {
        e.preventDefault();
        setInviting(true);
        setError('');
        setSuccess('');

        try {
            // Buscar nome do departamento
            const deptRef = doc(db, 'departments', inviteDepartment);
            const deptDoc = await getDoc(deptRef);
            const departmentName = deptDoc.exists() ? deptDoc.data().name : '';

            // Gerar token único
            const token = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Criar documento de convite no Firestore
            const inviteRef = doc(db, 'invites', token);
            await setDoc(inviteRef, {
                email: inviteEmail,
                role: inviteRole,
                department: inviteDepartment,
                departmentName: departmentName,
                token: token,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
                status: 'pending',
                usedAt: null,
            });

            // Enviar email via API
            const response = await fetch('/api/send-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole,
                    token: token,
                }),
            });

            if (!response.ok) {
                throw new Error('Erro ao enviar email');
            }

            setSuccess(`Convite enviado para ${inviteEmail}! O usuário receberá um email com link para completar o cadastro.`);
            setInviteEmail('');
            setInviteRole('colaborador');
            setInviteDepartment('');
            setShowInviteModal(false);
        } catch (error) {
            console.error('Erro ao enviar convite:', error);
            setError('Erro ao enviar convite: ' + error.message);
        } finally {
            setInviting(false);
        }
    };

    const getRoleLabel = (role) => {
        const labels = {
            admin: 'Administrador',
            atendente: 'Atendente',
            gerente: 'Gerente / Gestor',
            colaborador: 'Colaborador'
        };
        return labels[role] || role;
    };

    const getRoleColor = (role) => {
        const colors = {
            admin: 'bg-red-100 text-red-800',
            atendente: 'bg-blue-100 text-blue-800',
            gerente: 'bg-indigo-100 text-indigo-800',
            colaborador: 'bg-gray-100 text-gray-800'
        };
        return colors[role] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-slate-800">Gerenciar Usuários</h2>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light"
                >
                    <Mail className="w-5 h-5" /> Convidar Usuário
                </button>
            </div>

            {error && (
                <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded">
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 mb-4 text-green-700 bg-green-100 border border-green-400 rounded">
                    {success}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
                </div>
            ) : (
                <div className="overflow-hidden bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    Nome
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    Permissão
                                </th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                            className="px-3 py-1 text-sm border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                        >
                                            <option value="colaborador">Colaborador</option>
                                            <option value="gerente">Gerente / Gestor</option>
                                            <option value="atendente">Atendente</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleOpenEditModal(user)}
                                                className="text-blue-600 hover:text-blue-900"
                                                title="Editar usuário"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteUser(user.id);
                                                }}
                                                className="text-red-600 hover:text-red-900"
                                                title="Remover usuário"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Convite */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Convidar Novo Usuário</h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleInviteUser} className="space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                    placeholder="usuario@email.com"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    O usuário receberá um email com link para completar o cadastro
                                </p>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Permissão
                                </label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                >
                                    <option value="colaborador">Colaborador</option>
                                    <option value="gerente">Gerente / Gestor</option>
                                    <option value="atendente">Atendente</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Departamento *
                                </label>
                                <select
                                    value={inviteDepartment}
                                    onChange={(e) => setInviteDepartment(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                >
                                    <option value="">Selecione um departamento</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.code}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light disabled:opacity-50"
                                >
                                    {inviting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4" />
                                            Enviar Convite
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Edição */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Editar Usuário</h3>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingUser(null);
                                    setEditForm({ name: '', email: '', role: '', department: '' });
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Nome
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                    placeholder="Nome do usuário"
                                />
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                    placeholder="usuario@email.com"
                                />
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Permissão
                                </label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                >
                                    <option value="colaborador">Colaborador</option>
                                    <option value="gerente">Gerente / Gestor</option>
                                    <option value="atendente">Atendente</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Departamento *
                                </label>
                                <select
                                    value={editForm.department}
                                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                >
                                    <option value="">Selecione um departamento</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.code}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingUser(null);
                                        setEditForm({ name: '', email: '', role: '', department: '' });
                                    }}
                                    className="flex-1 px-4 py-2 text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light"
                                >
                                    <Edit className="w-4 h-4" />
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-red-600">⚠️ Confirmar Exclusão</h3>
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setUserToDelete(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="mb-6 text-gray-700">
                            Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setUserToDelete(null);
                                }}
                                className="flex-1 px-4 py-2 text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300 font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 font-semibold"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir Usuário
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
