// src/components/DepartmentManagement.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

export default function DepartmentManagement({ onBack }) {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const deptCollection = collection(db, 'departments');
        const q = query(deptCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const deptData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDepartments(deptData.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleOpenModal = (dept = null) => {
        if (dept) {
            setEditingDept(dept);
            setFormData({
                name: dept.name,
                code: dept.code,
                description: dept.description || '',
            });
        } else {
            setEditingDept(null);
            setFormData({ name: '', code: '', description: '' });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingDept(null);
        setFormData({ name: '', code: '', description: '' });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validações
        if (!formData.name.trim() || !formData.code.trim()) {
            setError('Nome e código são obrigatórios');
            return;
        }

        // Verificar se código já existe (apenas ao criar)
        if (!editingDept) {
            const codeExists = departments.some(d => d.code === formData.code.toLowerCase());
            if (codeExists) {
                setError('Já existe um departamento com este código');
                return;
            }
        }

        try {
            if (editingDept) {
                // Atualizar departamento existente
                const deptRef = doc(db, 'departments', editingDept.id);
                await updateDoc(deptRef, {
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    updatedAt: serverTimestamp(),
                });
                setSuccess('Departamento atualizado com sucesso!');
            } else {
                // Criar novo departamento
                const deptRef = doc(db, 'departments', formData.code.toLowerCase());
                await setDoc(deptRef, {
                    name: formData.name.trim(),
                    code: formData.code.toLowerCase(),
                    description: formData.description.trim(),
                    active: true,
                    createdAt: serverTimestamp(),
                });
                setSuccess('Departamento criado com sucesso!');
            }

            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao salvar departamento:', err);
            setError('Erro ao salvar departamento: ' + err.message);
        }
    };

    const handleDeleteClick = (dept) => {
        setDeptToDelete(dept);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deptToDelete) return;

        try {
            const deptRef = doc(db, 'departments', deptToDelete.id);
            await deleteDoc(deptRef);
            setSuccess('Departamento excluído com sucesso!');
            setShowDeleteModal(false);
            setDeptToDelete(null);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao excluir departamento:', err);
            setError('Erro ao excluir departamento: ' + err.message);
            setShowDeleteModal(false);
            setDeptToDelete(null);
            setTimeout(() => setError(''), 3000);
        }
    };

    const handleToggleActive = async (dept) => {
        try {
            const deptRef = doc(db, 'departments', dept.id);
            await updateDoc(deptRef, {
                active: !dept.active,
                updatedAt: serverTimestamp(),
            });
            setSuccess(`Departamento ${dept.active ? 'desativado' : 'ativado'} com sucesso!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao alterar status:', err);
            setError('Erro ao alterar status: ' + err.message);
            setTimeout(() => setError(''), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-slate-600">Carregando departamentos...</div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Gerenciar Departamentos</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light"
                >
                    <Plus className="w-5 h-5" />
                    Novo Departamento
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 mb-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 p-4 mb-4 text-green-700 bg-green-50 border border-green-200 rounded-md">
                    <Check className="w-5 h-5" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {departments.map(dept => (
                    <div
                        key={dept.id}
                        className={`p-4 border rounded-lg ${dept.active ? 'bg-white border-slate-200' : 'bg-gray-50 border-gray-300'}`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Building2 className={`w-5 h-5 ${dept.active ? 'text-tec-blue' : 'text-gray-400'}`} />
                                <h3 className={`font-bold ${dept.active ? 'text-slate-800' : 'text-gray-500'}`}>
                                    {dept.name}
                                </h3>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${dept.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {dept.active ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>

                        <p className="mb-1 text-sm text-slate-600">
                            <strong>Código:</strong> {dept.code}
                        </p>

                        {dept.description && (
                            <p className="mb-3 text-sm text-slate-500">{dept.description}</p>
                        )}

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => handleOpenModal(dept)}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                            >
                                <Edit2 className="w-4 h-4" />
                                Editar
                            </button>
                            <button
                                onClick={() => handleToggleActive(dept)}
                                className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${dept.active ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                            >
                                {dept.active ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                                onClick={() => handleDeleteClick(dept)}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-red-700 bg-red-50 rounded hover:bg-red-100"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                            </button>
                        </div>
                    </div>
                ))}

                {departments.length === 0 && (
                    <div className="col-span-full p-8 text-center text-slate-500">
                        Nenhum departamento cadastrado. Clique em "Novo Departamento" para começar.
                    </div>
                )}
            </div>

            {/* Modal Criar/Editar */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
                        <h3 className="mb-4 text-xl font-bold text-slate-800">
                            {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Nome do Departamento *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-tec-blue"
                                    placeholder="Ex: Suporte Técnico"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Código *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                                    className="w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-tec-blue"
                                    placeholder="Ex: support"
                                    disabled={!!editingDept}
                                    required
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    {editingDept ? 'O código não pode ser alterado' : 'Use apenas letras minúsculas e underscores'}
                                </p>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-slate-700">
                                    Descrição
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-slate-300 focus:outline-none focus:ring-2 focus:ring-tec-blue"
                                    placeholder="Descrição opcional do departamento"
                                    rows="3"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light"
                                >
                                    {editingDept ? 'Salvar' : 'Criar'}
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
                                onClick={() => { setShowDeleteModal(false); setDeptToDelete(null); }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="mb-2 text-gray-700 font-medium">
                                Tem certeza que deseja excluir o departamento <span className="font-bold text-slate-800">"{deptToDelete?.name}"</span>?
                            </p>
                            <p className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100">
                                <strong>Atenção:</strong> Usuários e chamaos vinculados a este departamento podem ser afetados. Esta ação não pode ser desfeita.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeptToDelete(null); }}
                                className="flex-1 px-4 py-2 text-gray-700 transition-colors bg-gray-200 rounded-md hover:bg-gray-300 font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 font-semibold"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir Departamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
