'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Send, Plus, Trash2, Calendar, MapPin, Plane, Car, Box } from 'lucide-react';

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function NewTicketForm({ user, onTicketCreated }) {
  const [categories, setCategories] = useState([]);
  const [productsList, setProductsList] = useState([]); // Database products
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form Basic Fields
  const [subject, setSubject] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null); // Full object
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  // Equipment Separation Fields
  const [meetingType, setMeetingType] = useState('internal'); // internal | external
  const [meetingState, setMeetingState] = useState('');
  const [meetingCity, setMeetingCity] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [transportType, setTransportType] = useState('car'); // car | plane

  // Product Selection Rows (Default 6)
  const [selectedProducts, setSelectedProducts] = useState(
    Array(6).fill().map(() => ({ productId: '', name: '', code: '' }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Categories and Products
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Categories filtered by User Department
        const catsRef = collection(db, 'categories');
        const catsSnapshot = await getDocs(catsRef);
        const validCats = catsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(cat =>
            cat.active &&
            cat.departments?.includes(user.department)
          );
        setCategories(validCats);

        // Load Products (If needed, optimize to load only when special category selected?)
        // Loading all for now as dataset is likely small (< 1000)
        const prodsRef = collection(db, 'products');
        const prodsSnapshot = await getDocs(prodsRef);
        const activeProds = prodsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => p.active)
          .sort((a, b) => a.name.localeCompare(b.name));
        setProductsList(activeProds);

      } catch (err) {
        console.error("Error loading form config:", err);
      } finally {
        setLoadingConfig(false);
      }
    };

    if (user && user.department) {
      loadData();
    }
  }, [user]);

  // Handle Category Change
  const handleCategoryChange = (catId) => {
    setCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    setSelectedCategory(cat);

    // Auto-set subject for special category if empty? No, let user define.
    if (cat?.type === 'equipment_separation' && !subject) {
      setSubject('Separação de Equipamentos para Reunião');
    }
  };

  // Handle Product Row Change
  const handleProductChange = (index, prodId) => {
    const newRows = [...selectedProducts];
    if (!prodId) {
      newRows[index] = { productId: '', name: '', code: '' };
    } else {
      const prod = productsList.find(p => p.id === prodId);
      if (prod) {
        newRows[index] = {
          productId: prod.id,
          name: prod.name,
          code: prod.code,
          serialNumber: '' // Will be filled by attendant
        };
      }
    }
    setSelectedProducts(newRows);
  };

  const addProductRow = () => {
    setSelectedProducts([...selectedProducts, { productId: '', name: '', code: '' }]);
  };

  const removeProductRow = (index) => {
    const newRows = [...selectedProducts];
    newRows.splice(index, 1);
    setSelectedProducts(newRows);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description || !categoryId) return;
    setIsSubmitting(true);

    try {
      // Base Data
      const department = user.department || '';
      const departmentName = user.departmentName || '';

      const ticketData = {
        subject,
        priority,
        department,
        departmentName,
        description,
        status: 'queue',
        createdAt: serverTimestamp(),
        createdBy: {
          uid: user.uid,
          name: user.name,
          email: user.email
        },
        assignedTo: null,

        // Category Info
        categoryId,
        categoryName: selectedCategory?.name || 'Geral',
        categoryType: selectedCategory?.type || 'standard'
      };

      // Add Special Fields if Equipment Separation
      if (selectedCategory?.type === 'equipment_separation') {
        const validProducts = selectedProducts.filter(p => p.productId);

        if (validProducts.length === 0) {
          alert('Por favor, selecione pelo menos um produto.');
          setIsSubmitting(false);
          return;
        }

        ticketData.meetingInfo = {
          type: meetingType,
          ...(meetingType === 'external' ? {
            state: meetingState,
            city: meetingCity,
            departureDate: departureDate ? new Date(departureDate).toISOString() : null,
            returnDate: returnDate ? new Date(returnDate).toISOString() : null,
            transport: transportType
          } : {})
        };

        ticketData.products = validProducts;
      }

      const ticketRef = await addDoc(collection(db, 'tickets'), ticketData);

      // Notification
      try {
        await fetch('/api/notify-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new',
            ticket: {
              id: ticketRef.id,
              ...ticketData,
              createdAt: new Date(),
            }
          }),
        });
      } catch (emailError) {
        console.error('Erro ao enviar notificação por email:', emailError);
      }

      onTicketCreated();
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      alert('Erro ao criar chamado. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingConfig) return <div className="p-6">Carregando configurações...</div>;

  const isSeparation = selectedCategory?.type === 'equipment_separation';

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="mb-6 text-2xl font-bold text-slate-800">Abrir Novo Chamado</h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Categoria *</label>
          <select
            value={categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:ring-tec-blue focus:border-tec-blue"
            required
          >
            <option value="">Selecione uma categoria...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Dynamic Fields */}
        {isSeparation && (
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-6">
            <h3 className="font-semibold text-lg text-slate-800 border-b pb-2 flex items-center gap-2">
              <Box className="w-5 h-5 text-tec-blue" />
              Dados da Solicitação de Equipamentos
            </h3>

            {/* Meeting Type */}
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Reunião Interna ou Externa?</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="meetingType"
                    value="internal"
                    checked={meetingType === 'internal'}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className="text-tec-blue focus:ring-tec-blue"
                  />
                  Reunião Interna
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="meetingType"
                    value="external"
                    checked={meetingType === 'external'}
                    onChange={(e) => setMeetingType(e.target.value)}
                    className="text-tec-blue focus:ring-tec-blue"
                  />
                  Reunião Externa
                </label>
              </div>
            </div>

            {/* External Meeting Details */}
            {meetingType === 'external' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Estado (UF) *</label>
                  <select
                    value={meetingState}
                    onChange={(e) => setMeetingState(e.target.value)}
                    className="block w-full px-3 py-2 mt-1 border rounded-md border-slate-300"
                    required
                  >
                    <option value="">Selecione...</option>
                    {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Município *</label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={meetingCity}
                      onChange={(e) => setMeetingCity(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 border rounded-md border-slate-300"
                      placeholder="Ex: São Paulo"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Data de Ida *</label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 border rounded-md border-slate-300"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Data de Volta *</label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2 border rounded-md border-slate-300"
                      required
                    />
                  </div>
                </div>
                <div className="col-span-full">
                  <span className="block text-sm font-medium text-slate-700 mb-2">Transporte *</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md hover:bg-white transition-colors bg-white">
                      <input type="radio" name="transport" value="car" checked={transportType === 'car'} onChange={(e) => setTransportType(e.target.value)} className="text-tec-blue" />
                      <Car className="w-5 h-5 text-slate-600" />
                      <span>Carro da Empresa</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md hover:bg-white transition-colors bg-white">
                      <input type="radio" name="transport" value="plane" checked={transportType === 'plane'} onChange={(e) => setTransportType(e.target.value)} className="text-tec-blue" />
                      <Plane className="w-5 h-5 text-slate-600" />
                      <span>Avião</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Product Selection */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-3">Seleção de Produtos *</label>
              <div className="space-y-3">
                {selectedProducts.map((row, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <span className="text-sm font-mono text-gray-400 w-6">{index + 1}.</span>
                    <select
                      value={row.productId}
                      onChange={(e) => handleProductChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md border-slate-300 text-sm focus:ring-tec-blue focus:border-tec-blue"
                    >
                      <option value="">Selecione um produto...</option>
                      {productsList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                    {index >= 6 && (
                      <button
                        type="button"
                        onClick={() => removeProductRow(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addProductRow}
                className="mt-4 flex items-center gap-2 text-sm text-tec-blue hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" /> Adicionar mais produtos
              </button>
            </div>
          </div>
        )}

        {/* Standard Fields */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700">Assunto</label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:ring-tec-blue focus:border-tec-blue"
            required
            placeholder={isSeparation ? "Separação de Equipamentos..." : "Resumo do problema"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Prioridade</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:ring-tec-blue focus:border-tec-blue"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">Descrição / Observações</label>
          <textarea
            id="description"
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:ring-tec-blue focus:border-tec-blue"
            required
            placeholder={isSeparation ? "Inclua detalhes adicionais sobre o uso dos equipamentos..." : "Descreva o problema detalhadamente..."}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tec-blue disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 duration-200"
          >
            <Send className="w-5 h-5" />
            {isSubmitting ? 'Enviando...' : 'Enviar Chamado'}
          </button>
        </div>
      </form>
    </div>
  );
}
