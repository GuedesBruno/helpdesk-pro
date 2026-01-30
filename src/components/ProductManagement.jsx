'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Package, Plus, Edit2, Trash2, X, AlertCircle, Loader2, Search } from 'lucide-react';

export default function ProductManagement({ onBack }) {
    const [products, setProducts] = useState([]);
    const [inventories, setInventories] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        inventory: '',
        active: true
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Ordernar por nome
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
            setProducts(sorted);
            setFilteredProducts(sorted);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch inventories
    useEffect(() => {
        const q = query(collection(db, 'inventories'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Only active inventories
            const activeInv = data.filter(inv => inv.active).sort((a, b) => a.name.localeCompare(b.name));
            setInventories(activeInv);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProducts(products);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term)
            );
            setFilteredProducts(filtered);
        }
    }, [searchTerm, products]);

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                code: product.code,
                inventory: product.inventory || '',
                active: product.active !== false
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                code: '',
                inventory: '',
                active: true
            });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProduct(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name.trim() || !formData.code.trim()) {
            setError('Nome e Código são obrigatórios');
            return;
        }

        try {
            const data = {
                name: formData.name.trim(),
                code: formData.code.trim(),
                inventory: formData.inventory,
                inventoryName: inventories.find(inv => inv.code === formData.inventory)?.name || '',
                active: formData.active,
                updatedAt: serverTimestamp(),
            };

            if (editingProduct) {
                await updateDoc(doc(db, 'products', editingProduct.id), data);
                setSuccess('Produto atualizado com sucesso!');
            } else {
                data.createdAt = serverTimestamp();
                await setDoc(doc(collection(db, 'products')), data); // Auto ID
                setSuccess('Produto cadastrado com sucesso!');
            }

            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao salvar produto:', err);
            setError('Erro ao salvar produto: ' + err.message);
        }
    };

    const handleDeleteClick = (product) => {
        setProductToDelete(product);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!productToDelete) return;
        try {
            await deleteDoc(doc(db, 'products', productToDelete.id));
            setSuccess('Produto excluído com sucesso!');
            setShowDeleteModal(false);
            setProductToDelete(null);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao excluir:', err);
            setError('Erro ao excluir: ' + err.message);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-tec-blue animate-spin" /></div>;

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Gerenciar Produtos</h2>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue text-sm w-64"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" /> Novo Produto
                    </button>
                </div>
            </div>

            {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">{error}</div>}
            {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-md">{success}</div>}

            <div className="overflow-hidden border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.inventoryName || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {product.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenModal(product)} className="text-blue-600 hover:text-blue-900 mr-3">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteClick(product)} className="text-red-600 hover:text-red-900">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals are similar to Categories, omitted for brevity but included in full file */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                            <button onClick={handleCloseModal}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                                <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="w-full px-3 py-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Estoque</label>
                                <select
                                    value={formData.inventory}
                                    onChange={e => setFormData({ ...formData, inventory: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue"
                                    required
                                >
                                    <option value="">Selecione um estoque</option>
                                    {inventories.map(inv => (
                                        <option key={inv.id} value={inv.code}>{inv.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="rounded text-tec-blue" />
                                <label htmlFor="active" className="text-sm font-medium text-slate-700">Ativo</label>
                            </div>
                            <div className="flex gap-3 pt-4 border-t">
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-tec-blue text-white rounded-md">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Confirmar Exclusão</h3>
                        <p className="text-slate-600 mb-6">Excluir produto <strong>{productToDelete?.name}</strong>?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-3 py-2 bg-gray-200 rounded-md">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
