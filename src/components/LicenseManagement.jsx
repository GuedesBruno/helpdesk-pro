'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { FileText, Plus, Edit2, Trash2, X, Search, Loader2, ChevronDown, ChevronRight, Package, User, Hash, CreditCard } from 'lucide-react';

export default function LicenseManagement({ onBack }) {
    const [licenses, setLicenses] = useState([]);
    const [products, setProducts] = useState([]);
    const [groupedLicenses, setGroupedLicenses] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingLicense, setEditingLicense] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [licenseToDelete, setLicenseToDelete] = useState(null);
    const [expandedProducts, setExpandedProducts] = useState({});

    const [formData, setFormData] = useState({
        productId: '',
        invoice: '',
        clientName: '',
        identifier: '',
        serialNumber: '',
        licenseKey: ''
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        // Listen to products for real-time updates and dropdown
        const qProducts = query(collection(db, 'products'));
        const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData.sort((a, b) => a.name.localeCompare(b.name)));
        });

        // Listen to licenses
        const qLicenses = query(collection(db, 'licenses'));
        const unsubscribeLicenses = onSnapshot(qLicenses, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLicenses(data);
            setLoading(false);
        });

        return () => {
            unsubscribeProducts();
            unsubscribeLicenses();
        };
    }, []);

    useEffect(() => {
        // Group licenses by product and filter products that have at least one license
        const term = searchTerm.toLowerCase();
        const filtered = licenses.filter(l => 
            l.clientName?.toLowerCase().includes(term) ||
            l.licenseKey?.toLowerCase().includes(term) ||
            l.invoice?.toLowerCase().includes(term) ||
            l.serialNumber?.toLowerCase().includes(term) ||
            l.productName?.toLowerCase().includes(term) ||
            l.identifier?.toLowerCase().includes(term)
        );

        const groups = {};
        filtered.forEach(license => {
            const product = products.find(p => p.id === license.productId);
            const pName = product ? product.name : (license.productName || 'Produto não identificado');

            if (!groups[license.productId]) {
                groups[license.productId] = {
                    productId: license.productId,
                    productName: pName,
                    items: []
                };
            }
            groups[license.productId].items.push({
                ...license,
                productName: pName // Ensure item has updated name for search filtering if needed
            });
        });

        // Convert to array and sort by product name
        const sortedGroups = Object.values(groups).sort((a, b) => a.productName.localeCompare(b.productName));
        setGroupedLicenses(sortedGroups);

        // Auto-expand if searching
        if (searchTerm) {
            const expandAll = {};
            sortedGroups.forEach(g => expandAll[g.productId] = true);
            setExpandedProducts(expandAll);
        }
    }, [licenses, searchTerm]);

    const toggleProduct = (productId) => {
        setExpandedProducts(prev => ({
            ...prev,
            [productId]: !prev[productId]
        }));
    };

    const handleOpenModal = (license = null) => {
        if (license) {
            setEditingLicense(license);
            setFormData({
                productId: license.productId,
                invoice: license.invoice || '',
                clientName: license.clientName || '',
                identifier: license.identifier || '',
                serialNumber: license.serialNumber || '',
                licenseKey: license.licenseKey || ''
            });
        } else {
            setEditingLicense(null);
            setFormData({
                productId: '',
                invoice: '',
                clientName: '',
                identifier: '',
                serialNumber: '',
                licenseKey: ''
            });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingLicense(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.productId || !formData.clientName || !formData.licenseKey) {
            setError('Produto, Nome do Cliente e Licença são obrigatórios');
            return;
        }

        const selectedProduct = products.find(p => p.id === formData.productId);

        try {
            const data = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            if (editingLicense) {
                await updateDoc(doc(db, 'licenses', editingLicense.id), data);
                setSuccess('Licença atualizada com sucesso!');
            } else {
                data.createdAt = serverTimestamp();
                await setDoc(doc(collection(db, 'licenses')), data);
                setSuccess('Licença cadastrada com sucesso!');
            }

            handleCloseModal();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Erro ao salvar licença:', err);
            setError('Erro ao salvar licença: ' + err.message);
        }
    };

    const handleDeleteClick = (license) => {
        setLicenseToDelete(license);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!licenseToDelete) return;
        try {
            await deleteDoc(doc(db, 'licenses', licenseToDelete.id));
            setSuccess('Licença excluída com sucesso!');
            setShowDeleteModal(false);
            setLicenseToDelete(null);
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
                <h2 className="text-2xl font-bold text-slate-800">Gerenciar Licenças</h2>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar cliente, licença, NF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-tec-blue text-sm w-64"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" /> Nova Licença
                    </button>
                </div>
            </div>

            {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">{error}</div>}
            {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-md">{success}</div>}

            <div className="space-y-4">
                {groupedLicenses.length > 0 ? groupedLicenses.map(group => (
                    <div key={group.productId} className="border rounded-lg overflow-hidden shadow-sm">
                        <button
                            onClick={() => toggleProduct(group.productId)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {expandedProducts[group.productId] ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                                <Package className="w-5 h-5 text-tec-blue" />
                                <span className="font-bold text-slate-700">{group.productName}</span>
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{group.items.length} {group.items.length === 1 ? 'licença' : 'licenças'}</span>
                            </div>
                        </button>

                        {expandedProducts[group.productId] && (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Usuário</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nota Fiscal</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Série</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Licença</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {group.items.map(license => (
                                            <tr key={license.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900">{license.clientName}</span>
                                                        <span className="text-xs text-slate-500">{license.identifier}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{license.invoice || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{license.serialNumber || '-'}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono text-xs border border-slate-200">
                                                        {license.licenseKey}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button onClick={() => handleOpenModal(license)} className="text-blue-600 hover:text-blue-900 mr-3 p-1 rounded-full hover:bg-blue-50 transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(license)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="text-lg font-medium">Nenhuma licença encontrada.</p>
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-tec-blue hover:underline">Limpar busca</button>}
                    </div>
                )}
            </div>

            {/* Modal for Add/Edit */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">{editingLicense ? 'Editar Licença' : 'Nova Licença'}</h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Produto
                                    </label>
                                    <select
                                        value={formData.productId}
                                        onChange={e => setFormData({ ...formData, productId: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none"
                                        required
                                    >
                                        <option value="">Selecione um produto...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <User className="w-4 h-4" /> Nome do Cliente / Usuário
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.clientName}
                                        onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none"
                                        placeholder="Ex: João da Silva"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" /> CPF / CNPJ
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.identifier}
                                        onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none"
                                        placeholder="000.000.000-00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Nota Fiscal
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.invoice}
                                        onChange={e => setFormData({ ...formData, invoice: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none"
                                        placeholder="Nº da NF"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <Hash className="w-4 h-4" /> Número de Série
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.serialNumber}
                                        onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none"
                                        placeholder="Ex: SN123456789"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        <Hash className="w-4 h-4" /> Licença (Chave / Código)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.licenseKey}
                                        onChange={e => setFormData({ ...formData, licenseKey: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-tec-blue outline-none font-mono"
                                        placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 border-t mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-tec-blue text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                                >
                                    {editingLicense ? 'Salvar Alterações' : 'Cadastrar Licença'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow-xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Confirmar Exclusão</h3>
                        <p className="text-slate-600 mb-6">Excluir permanentemente a licença do cliente <strong>{licenseToDelete?.clientName}</strong>?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
