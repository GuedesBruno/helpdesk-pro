'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Package, Plus, Edit2, Trash2, X, AlertCircle, Loader2, Search, Upload, FileText } from 'lucide-react';

export default function ProductManagement({ onBack }) {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResults, setImportResults] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
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
                active: product.active !== false
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                code: '',
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

    const handleCSVImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError('');
        setImportResults(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').map(line => line.trim()).filter(line => line);

                if (lines.length < 2) {
                    setError('Arquivo CSV vazio ou inválido');
                    setImporting(false);
                    return;
                }

                // Skip header row
                const dataLines = lines.slice(1);
                const results = {
                    success: 0,
                    errors: []
                };

                for (const line of dataLines) {
                    const [code, name] = line.split(',').map(s => s.trim());

                    if (!code || !name) {
                        results.errors.push(`Linha inválida: ${line}`);
                        continue;
                    }

                    // Check if product code already exists
                    const existingProduct = products.find(p => p.code === code);
                    if (existingProduct) {
                        results.errors.push(`Código ${code} já existe`);
                        continue;
                    }

                    try {
                        await setDoc(doc(collection(db, 'products')), {
                            code,
                            name,
                            active: true,
                            createdAt: serverTimestamp()
                        });
                        results.success++;
                    } catch (err) {
                        results.errors.push(`Erro ao criar ${code}: ${err.message}`);
                    }
                }

                setImportResults(results);
                setImporting(false);

                if (results.success > 0) {
                    setSuccess(`${results.success} produto(s) importado(s) com sucesso!`);
                    setTimeout(() => setSuccess(''), 3000);
                }
            } catch (err) {
                console.error('Erro ao processar CSV:', err);
                setError('Erro ao processar arquivo CSV: ' + err.message);
                setImporting(false);
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // Reset input
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
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 whitespace-nowrap"
                    >
                        <Upload className="w-5 h-5" /> Importar CSV
                    </button>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.code}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.name}</td>
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

            {/* CSV Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-green-600" />
                                Importar Produtos via CSV
                            </h3>
                            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                                <h4 className="font-semibold text-blue-900 mb-2">📋 Formato do Arquivo CSV</h4>
                                <p className="text-sm text-blue-800 mb-3">
                                    O arquivo deve conter duas colunas separadas por vírgula:
                                </p>
                                <div className="bg-white p-3 rounded border border-blue-300 font-mono text-sm">
                                    <div className="text-gray-600">codigo,nome</div>
                                    <div>PROD-001,Notebook Dell Latitude</div>
                                    <div>PROD-002,Mouse Logitech MX Master</div>
                                    <div>PROD-003,Teclado Mecânico</div>
                                </div>
                            </div>

                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Importante</h4>
                                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                                    <li>A primeira linha deve ser o cabeçalho (codigo,nome)</li>
                                    <li>Códigos duplicados serão ignorados</li>
                                    <li>Todos os produtos serão criados como "Ativos"</li>
                                </ul>
                            </div>

                            {importing && (
                                <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-md">
                                    <Loader2 className="w-5 h-5 animate-spin text-tec-blue" />
                                    <span className="text-gray-700">Importando produtos...</span>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                                    disabled={importing}
                                >
                                    Cancelar
                                </button>
                                <label className="flex-1">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => {
                                            handleCSVImport(e);
                                            setShowImportModal(false);
                                        }}
                                        className="hidden"
                                        disabled={importing}
                                    />
                                    <div className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-center cursor-pointer">
                                        Selecionar Arquivo CSV
                                    </div>
                                </label>
                            </div>
                        </div>
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

            {/* Import Results Modal */}
            {importResults && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-lg p-6 bg-white rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Resultado da Importação</h3>
                            <button onClick={() => setImportResults(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                                <p className="text-green-800 font-semibold">
                                    ✓ {importResults.success} produto(s) importado(s) com sucesso
                                </p>
                            </div>

                            {importResults.errors.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-red-800 font-semibold mb-2">
                                        ✗ {importResults.errors.length} erro(s):
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                        {importResults.errors.map((error, idx) => (
                                            <li key={idx}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-sm text-blue-800">
                                    <strong>Formato esperado do CSV:</strong><br />
                                    codigo,nome<br />
                                    PROD-001,Nome do Produto
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setImportResults(null)}
                            className="w-full mt-6 px-4 py-2 bg-tec-blue text-white rounded-md hover:bg-tec-blue-light"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
