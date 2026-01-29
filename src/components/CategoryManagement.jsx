'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, Loader2, AlertCircle, Tag } from 'lucide-react';

export default function CategoryManagement({ onBack }) {
    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'standard',
        departments: [],
        active: true
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Carregar Categorias
    useEffect(() => {
        const q = query(collection(db, 'categories'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(data.sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Carregar Departamentos (para seleção)
    useEffect(() => {
        const q = query(collection(db, 'departments'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => d.active);
            setDepartments(data.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                type: category.type || 'standard',
                departments: category.departments || [],
                active: category.active !== false
            });
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                type: 'standard',
                departments: [],
                active: true
            });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategory(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name.trim()) {
            setError('Nome da categoria é obrigatório');
            return;
        }

        if (formData.departments.length === 0) {
            setError('Selecione pelo menos um departamento');
            return;
        }

        try {
            const data = {
                name: formData.name.trim(),
                type: formData.type,
                departments: formData.departments,
                active: formData.active,
                updatedAt: serverTimestamp(),
            };

            if (editingCategory) {
                await updateDoc(doc(db, 'categories', editingCategory.id), data);
                setSuccess('Categoria atualizada com sucesso!');
            } else {
                data.createdAt = serverTimestamp();
                // ID gerado automaticamente ou slug? Vamos usar automático para evitar conflitos de nome.
                await setDoc(doc(collection(db, 'categories')), data);
                setSuccess('Categoria criada com sucesso!');
            }

            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao salvar categoria:', err);
            setError('Erro ao salvar categoria: ' + err.message);
        }
    };

    const handleDeleteClick = (category) => {
        setCategoryToDelete(category);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        try {
            await deleteDoc(doc(db, 'categories', categoryToDelete.id));
            setSuccess('Categoria excluída com sucesso!');
            setShowDeleteModal(false);
            setCategoryToDelete(null);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao excluir:', err);
            setError('Erro ao excluir: ' + err.message);
        }
    };

    const toggleDepartment = (deptCode) => {
        setFormData(prev => {
            const currentDepts = prev.departments;
            if (currentDepts.includes(deptCode)) {
                return { ...prev, departments: currentDepts.filter(d => d !== deptCode) };
            } else {
                return { ...prev, departments: [...currentDepts, deptCode] };
            }
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Gerenciar Categorias</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light"
                >
                    <Plus className="w-5 h-5" /> Nova Categoria
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 mb-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="w-5 h-5" /> {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 p-4 mb-4 text-green-700 bg-green-50 border border-green-200 rounded-md">
                    <Check className="w-5 h-5" /> {success}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map(cat => (
                    <div key={cat.id} className="p-4 border rounded-lg border-slate-200 bg-white hover:border-tec-blue transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-tec-blue" />
                                {cat.name}
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={() => handleOpenModal(cat)} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteClick(cat)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${cat.type === 'equipment_separation' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                {cat.type === 'equipment_separation' ? 'Separação de Equipamentos' : 'Padrão'}
                            </span>
                        </div>

                        <div className="text-sm text-slate-600">
                            <strong>Departamentos:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {cat.departments.map(deptCode => {
                                    const deptName = departments.find(d => d.code === deptCode)?.name || deptCode;
                                    return (
                                        <span key={deptCode} className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                            {deptName}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                            <button onClick={handleCloseModal}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Categoria</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-slate-300 focus:ring-2 focus:ring-tec-blue focus:outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Fluxo</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md border-slate-300 focus:ring-2 focus:ring-tec-blue focus:outline-none"
                                >
                                    <option value="standard">Padrão</option>
                                    <option value="equipment_separation">Separação de Equipamentos para Reunião</option>
                                </select>
                                {formData.type === 'equipment_separation' && (
                                    <p className="text-xs text-purple-600 mt-1">
                                        * Este tipo habilita o fluxo especial de checklist de viagem e produtos.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Visível para Departamentos</label>
                                <div className="grid grid-cols-2 gap-2 border p-3 rounded-md max-h-40 overflow-y-auto">
                                    {departments.map(dept => (
                                        <label key={dept.code} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formData.departments.includes(dept.code)}
                                                onChange={() => toggleDepartment(dept.code)}
                                                className="rounded text-tec-blue focus:ring-tec-blue"
                                            />
                                            <span className="text-sm">{dept.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t mt-4">
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-tec-blue text-white rounded-md hover:bg-blue-700">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Delete */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Confirmar Exclusão</h3>
                        <p className="text-slate-600 mb-6">Excluir a categoria <strong>{categoryToDelete?.name}</strong>?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-3 py-2 bg-gray-200 rounded-md">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
