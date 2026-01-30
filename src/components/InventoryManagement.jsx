// src/components/InventoryManagement.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Package, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

export default function InventoryManagement({ onBack }) {
    const [inventories, setInventories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingInv, setEditingInv] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [invToDelete, setInvToDelete] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const invCollection = collection(db, 'inventories');
        const q = query(invCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInventories(invData.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleOpenModal = (inv = null) => {
        if (inv) {
            setEditingInv(inv);
            setFormData({
                name: inv.name,
                code: inv.code,
                description: inv.description || '',
            });
        } else {
            setEditingInv(null);
            setFormData({ name: '', code: '', description: '' });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingInv(null);
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
        if (!editingInv) {
            const codeExists = inventories.some(i => i.code === formData.code.toUpperCase());
            if (codeExists) {
                setError('Já existe um estoque com este código');
                return;
            }
        }

        try {
            if (editingInv) {
                // Atualizar estoque existente
                const invRef = doc(db, 'inventories', editingInv.id);
                await updateDoc(invRef, {
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    updatedAt: serverTimestamp(),
                });
                setSuccess('Estoque atualizado com sucesso!');
            } else {
                // Criar novo estoque
                const invRef = doc(db, 'inventories', formData.code.toUpperCase());
                await setDoc(invRef, {
                    name: formData.name.trim(),
                    code: formData.code.toUpperCase(),
                    description: formData.description.trim(),
                    active: true,
                    createdAt: serverTimestamp(),
                });
                setSuccess('Estoque criado com sucesso!');
            }

            setTimeout(() => {
                handleCloseModal();
                setSuccess('');
            }, 1500);
        } catch (err) {
            console.error('Erro ao salvar estoque:', err);
            setError('Erro ao salvar estoque. Tente novamente.');
        }
    };

    const handleToggleActive = async (inv) => {
        try {
            const invRef = doc(db, 'inventories', inv.id);
            await updateDoc(invRef, {
                active: !inv.active,
                updatedAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            setError('Erro ao atualizar status do estoque');
        }
    };

    const handleDeleteClick = (inv) => {
        setInvToDelete(inv);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!invToDelete) return;

        try {
            await deleteDoc(doc(db, 'inventories', invToDelete.id));
            setSuccess('Estoque removido com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
            setShowDeleteModal(false);
            setInvToDelete(null);
        } catch (err) {
            console.error('Erro ao remover estoque:', err);
            setError('Erro ao remover estoque');
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="text-slate-600 hover:text-slate-800"
                    >
                        ← Voltar
                    </button>
                    <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-8 h-8 text-tec-blue" />
                        Gerenciar Estoques
                    </h2>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light"
                >
                    <Plus className="w-5 h-5" /> Novo Estoque
                </button>
            </div>

            {error && (
                <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 mb-4 text-green-700 bg-green-100 border border-green-400 rounded flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    {success}
                </div>
            )}

            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-tec-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nome
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Código
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Descrição
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {inventories.map((inv) => (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{inv.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-500 font-mono">{inv.code}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-500">{inv.description || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleActive(inv)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${inv.active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}
                                        >
                                            {inv.active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                onClick={() => handleOpenModal(inv)}
                                                className="text-blue-600 hover:text-blue-900"
                                                title="Editar estoque"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(inv)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Remover estoque"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {inventories.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        Nenhum estoque cadastrado. Clique em "Novo Estoque" para começar.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Criar/Editar */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingInv ? 'Editar Estoque' : 'Novo Estoque'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Nome *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                    placeholder="Ex: Estoque Principal"
                                />
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Código *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue font-mono"
                                    required
                                    disabled={!!editingInv}
                                    placeholder="Ex: EST-01"
                                    maxLength={10}
                                />
                                {editingInv && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        O código não pode ser alterado após a criação
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">
                                    Descrição
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    rows="3"
                                    placeholder="Descrição opcional do estoque"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light"
                                >
                                    {editingInv ? 'Atualizar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Confirmar Exclusão</h3>
                        </div>

                        <p className="mb-6 text-gray-600">
                            Tem certeza que deseja remover o estoque <strong>{invToDelete?.name}</strong>?
                            Esta ação não pode ser desfeita.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
                            >
                                Sim, Remover
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
