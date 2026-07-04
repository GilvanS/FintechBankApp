import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Sparkles, Tag, ChevronRight, X, CheckCircle2, 
  AlertTriangle, Heart, Info, Percent, Search, Filter, ShieldCheck, 
  Layers, ShoppingCart, Sparkle
} from 'lucide-react';
import { Transaction } from '../types';
import { getProducts, checkout } from '../services/api';

interface ShopViewProps {
  accountBalance: number;
  onPurchaseComplete: (newTx: Transaction, amount: number) => void;
  theme: 'yellow' | 'midnight';
}

interface Product {
  id: string;
  name: string;
  price: number;
  cashback: string;
  category: string;
  image: string;
  description: string;
}

export default function ShopView({ accountBalance, onPurchaseComplete, theme }: ShopViewProps) {
  const [cashbackBalance, setCashbackBalance] = useState<number>(() => {
    const saved = localStorage.getItem('volt_cashback_balance');
    return saved ? parseFloat(saved) : 42.50;
  });

  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const EXCHANGE_RATE = 5.40;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Selected product for the Checkout Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'credit'>('balance');
  const [installments, setInstallments] = useState<number>(1);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Pet Modal State
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [redeemModal, setRedeemModal] = useState<{ type: 'success' | 'empty'; amount: number } | null>(null);
  const [petSubscribed, setPetSubscribed] = useState(() => {
    return localStorage.getItem('volt_pet_subscribed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('volt_cashback_balance', cashbackBalance.toString());
  }, [cashbackBalance]);

  const formatCurrency = (valInBRL: number) => {
    if (currency === 'USD') {
      const valInUSD = valInBRL / EXCHANGE_RATE;
      return valInUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }
    return valInBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      try {
        const result = await getProducts();
        if (result.success && result.products && active) {
          const mapped: Product[] = result.products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            cashback: p.cashback || '5%',
            category: p.category || 'Geral',
            image: p.imageUrl || p.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600',
            description: p.description || '',
          }));
          setProducts(mapped);
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['Todos', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBuyProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (pin.length !== 4) {
      setCheckoutError('A senha do cartão deve ter exatamente 4 dígitos.');
      return;
    }

    if (paymentMethod === 'balance' && accountBalance < selectedProduct.price) {
      setCheckoutError('Saldo insuficiente para efetuar esta compra.');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const response = await checkout({
        items: [{ productId: selectedProduct.id, quantity: 1 }],
        paymentMethod: paymentMethod === 'balance' ? 'debit' : 'credit',
        cashbackUsed: 0,
        installments: paymentMethod === 'credit' ? installments : 1,
        pin: pin,
      });

      if (response.success && response.purchase) {
        const now = new Date();
        const formatNumber = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
        const weekdays = [
          'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
        ];

        const percentVal = parseFloat(selectedProduct.cashback) / 100 || 0.05;
        const cashbackEarned = selectedProduct.price * percentVal;

        const serverTx = response.purchase.transaction || {};
        const newTx: Transaction = {
          id: serverTx.id || Math.random().toString(36).substring(2, 11),
          title: serverTx.description || response.purchase.productsDescription || `${selectedProduct.name} adquirido`,
          amount: -response.purchase.totalAmount,
          type: 'expense',
          category: 'outros',
          date: serverTx.date || now.toISOString(),
          formattedDate: `${weekdays[now.getDay()]} • ${formattedDate}`,
          time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
        };

        // Complete purchase
        onPurchaseComplete(newTx, -response.purchase.totalAmount);
        setCashbackBalance(prev => prev + cashbackEarned);
        setPurchaseSuccess(true);
        setPin(''); // Limpa a senha inserida
      } else {
        setCheckoutError(response.message || 'Falha ao processar checkout.');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Erro ao efetuar checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePetSubscribe = () => {
    const petPrice = 11.99;
    if (accountBalance < petPrice) {
      alert('Saldo de conta insuficiente para ativar o plano pet.');
      return;
    }

    setCheckoutLoading(true);

    setTimeout(() => {
      const now = new Date();
      const formatNumber = (num: number) => String(num).padStart(2, '0');
      const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
      const weekdays = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
      ];

      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 11),
        title: 'Ativação Fintech Pet Plan',
        amount: -petPrice,
        type: 'expense',
        category: 'saude',
        date: now.toISOString(),
        formattedDate: `${weekdays[now.getDay()]} • ${formattedDate}`,
        time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
      };

      // Add as recurring bill in localstorage if it exists
      try {
        const storedBills = localStorage.getItem('volt_recurring_bills');
        const bills = storedBills ? JSON.parse(storedBills) : [];
        const isAlreadyAdded = bills.some((b: any) => b.title.includes('Fintech Pet'));
        if (!isAlreadyAdded) {
          bills.push({
            id: 'rec_pet',
            title: 'Plano Fintech Pet + Shop',
            amount: -petPrice,
            category: 'saude',
            dueDate: '24/07/2026',
            status: 'paid',
            paidAtDate: formattedDate
          });
          localStorage.setItem('volt_recurring_bills', JSON.stringify(bills));
        }
      } catch (e) {
        console.error(e);
      }

      onPurchaseComplete(newTx, -petPrice);
      setPetSubscribed(true);
      localStorage.setItem('volt_pet_subscribed', 'true');
      setCheckoutLoading(false);
      setIsPetModalOpen(false);
    }, 1200);
  };

  const handleRedeemCashback = () => {
    if (cashbackBalance <= 0) {
      setRedeemModal({ type: 'empty', amount: 0 });
      return;
    }

    const redeemAmount = cashbackBalance;
    const now = new Date();
    const formatNumber = (num: number) => String(num).padStart(2, '0');
    const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
    const weekdays = [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      title: 'Resgate de Cashback Volt',
      amount: redeemAmount,
      type: 'income',
      category: 'outros',
      date: now.toISOString(),
      formattedDate: `${weekdays[now.getDay()]} • ${formattedDate}`,
      time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
    };

    onPurchaseComplete(newTx, redeemAmount);
    setCashbackBalance(0);
    setRedeemModal({ type: 'success', amount: redeemAmount });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-8 h-8 border-4 border-volt-green border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">Carregando ofertas...</p>
      </div>
    );
  }

  const isMidnight = theme === 'midnight';

  return (
    <div className={`space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto ${isMidnight ? 'text-white' : 'text-black'}`}>
      
      {/* Title Header & Currency Toggle */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1">
            <h2 className={`text-2xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>Fintech Shop</h2>
            <p className="text-xs text-on-surface-variant">Produtos exclusivos com cashbacks irresistíveis.</p>
          </div>
          {/* Currency Toggle */}
          <div className={`flex rounded-xl overflow-hidden p-0.5 shrink-0 ${
            isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <button
              onClick={() => setCurrency('BRL')}
              style={currency === 'BRL' && !isMidnight ? { color: 'white' } : undefined}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                currency === 'BRL'
                  ? isMidnight
                    ? 'bg-volt-green text-black font-extrabold shadow-sm'
                    : 'bg-black text-white'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              BRL
            </button>
            <button
              onClick={() => setCurrency('USD')}
              style={currency === 'USD' && !isMidnight ? { color: 'white' } : undefined}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                currency === 'USD'
                  ? isMidnight
                    ? 'bg-volt-green text-black font-extrabold shadow-sm'
                    : 'bg-black text-white'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </section>

      {/* Cashback Stats Card */}
      <div className={`border rounded-2xl p-5 flex justify-between items-center transition-all ${
        isMidnight 
          ? 'bg-zinc-900/80 border-zinc-800/80 shadow-lg shadow-black/30' 
          : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
      }`}>
        <div className="space-y-1">
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-on-surface-variant flex items-center gap-1">
            <Sparkles size={10} className="text-volt-green" /> Meu Cashback Acumulado
          </span>
          <p className={`text-2xl font-black ${isMidnight ? 'text-volt-green drop-shadow-[0_0_12px_rgba(0,255,157,0.2)]' : 'text-black'}`}>
            {formatCurrency(cashbackBalance)}
          </p>
        </div>
        <button
          onClick={handleRedeemCashback}
          className="font-black px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer btn-primary"
        >
          Resgatar Saldo
        </button>
      </div>

      {/* Fintech Pet + Shop Promo Banner (Matches beautiful image mock and details) */}
      <div 
        onClick={() => setIsPetModalOpen(true)}
        className={`relative overflow-hidden rounded-2xl p-5 flex items-center justify-between cursor-pointer border hover:scale-[1.01] transition-all duration-200 ${
          isMidnight 
            ? 'bg-gradient-to-r from-zinc-900 to-zinc-950 border-zinc-800 shadow-xl shadow-black/20 group hover:border-volt-green/30' 
            : 'bg-gradient-to-r from-yellow-50 to-amber-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
            isMidnight ? 'bg-volt-green/15 text-volt-green' : 'bg-[#A2FF00] text-black border-2 border-black'
          }`}>
            🐾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className={`text-xs font-black ${isMidnight ? 'text-white' : 'text-black'}`}>Plano Fintech Pet + Shop</h5>
              {!petSubscribed ? (
                <span className="text-[8px] bg-red-500/10 text-red-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">PROMO</span>
              ) : (
                <span className="text-[8px] bg-volt-green/20 text-volt-green font-black px-2 py-0.5 rounded-full uppercase tracking-wider">ATIVO</span>
              )}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">Saúde completa para seu cão ou gato a partir de R$ 11,99/mês</p>
          </div>
        </div>
        <ChevronRight className="text-on-surface-variant transition-transform group-hover:translate-x-1 shrink-0" size={18} />
      </div>

      {/* Search Bar & Categories Selection (Robust improvements!) */}
      <div className="space-y-3">
        {/* Search input */}
        <div className={`p-3 rounded-xl flex items-center gap-2 border transition-all ${
          isMidnight 
            ? 'bg-zinc-900 border-zinc-850 focus-within:border-volt-green' 
            : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          <Search className="text-on-surface-variant" size={16} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por smartphones, áudio, móveis..."
            className="bg-transparent border-none outline-none text-xs w-full focus:ring-0 placeholder-zinc-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Categories Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={(!isMidnight && isSelected) ? { color: 'white' } : {}}
                className={`py-1.5 px-3 rounded-xl text-[10px] font-black tracking-wide uppercase shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? isMidnight
                      ? 'bg-volt-green text-black font-extrabold shadow-md'
                      : 'bg-black'
                    : isMidnight
                      ? 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-850'
                      : 'bg-white border-2 border-black hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product List Heading */}
      <div className="flex justify-between items-center pl-1 border-t pt-4 border-zinc-900">
        <h3 className={`text-xs font-black uppercase tracking-wider ${isMidnight ? 'text-zinc-400' : 'text-zinc-600'}`}>
          Nossas Ofertas
        </h3>
        <span className="text-[9px] font-bold text-on-surface-variant">
          {filteredProducts.length} itens encontrados
        </span>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-3.5">
        {filteredProducts.map((product) => (
          <motion.div
            key={product.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedProduct(product);
              setPurchaseSuccess(false);
              setInstallments(1);
              setPaymentMethod('balance');
            }}
            className={`relative h-56 rounded-2xl overflow-hidden cursor-pointer flex flex-col border transition-all duration-300 ${
              isMidnight 
                ? 'bg-zinc-900 border-2 border-zinc-800 hover:border-volt-green/50 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]' 
                : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50'
            }`}
          >
            {/* Image Section */}
            <div className={`relative h-32 w-full overflow-hidden ${isMidnight ? 'border-b-2 border-zinc-800' : 'border-b-2 border-black'}`}>
              <img 
                src={product.image} 
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
              {/* Cashback pill */}
              <div className={`absolute top-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                isMidnight 
                  ? 'bg-black/80 text-volt-green border border-volt-green/30 backdrop-blur-md'
                  : 'bg-[#A2FF00] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <Percent size={8} /> {product.cashback}
              </div>
            </div>

            {/* Product Details */}
            <div className="p-3 flex flex-col flex-1 justify-between">
              <div>
                <span className={`text-[8px] font-extrabold uppercase tracking-widest ${isMidnight ? 'text-volt-green' : 'text-gray-500'}`}>
                  {product.category}
                </span>
                <h4 className={`text-[11px] font-black leading-tight line-clamp-2 mt-0.5 ${isMidnight ? 'text-white' : 'text-black'}`}>
                  {product.name}
                </h4>
              </div>
              <p className={`text-xs font-black mt-2 ${isMidnight ? 'text-volt-green' : 'text-black'}`}>
                {formatCurrency(product.price)}
              </p>
            </div>
          </motion.div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="col-span-2 text-center py-8 text-on-surface-variant text-xs">
            Nenhum produto encontrado com estes filtros.
          </div>
        )}
      </div>

      {/* Product Purchase Detail Modal (Slide-up Glass Drawer or Centered Card) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm rounded-[2rem] overflow-hidden p-6 flex flex-col bg-white border-4 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full transition-colors z-50 text-black hover:bg-black/10"
              >
                <X size={18} />
              </button>

              {!purchaseSuccess ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-wider block">
                      🛍️ {selectedProduct.category}
                    </span>
                    <h3 className="text-lg font-black pr-6 leading-tight">
                      {selectedProduct.name}
                    </h3>
                  </div>

                  {/* Product Image Preview */}
                  <div className="relative h-44 rounded-2xl overflow-hidden border border-black/5">
                    <img 
                      src={selectedProduct.image} 
                      alt={selectedProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 bg-volt-green text-black font-black text-[10px] px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                      💝 Cashback de {selectedProduct.cashback} de volta!
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {selectedProduct.description}
                  </p>

                  {/* Payment Form */}
                  <form onSubmit={handleBuyProduct} className="space-y-4 pt-1">
                    {/* Price and Cashback calculation */}
                    <div className="p-4 rounded-xl flex justify-between items-center bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div>
                        <span className="text-[9px] text-on-surface-variant uppercase block font-bold">Valor do Produto</span>
                        <span className="text-base font-black text-volt-green">
                          {formatCurrency(selectedProduct.price)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-on-surface-variant uppercase block font-bold">Cashback gerado</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded bg-volt-green/10 text-volt-green inline-block`}>
                          +{formatCurrency(selectedProduct.price * (parseFloat(selectedProduct.cashback) / 100))}
                        </span>
                      </div>
                    </div>

                    {/* Method Toggle */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase text-on-surface-variant block tracking-wider pl-1">
                        Forma de Pagamento
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('balance')}
                          className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                            paymentMethod === 'balance'
                              ? isMidnight
                                ? 'border-volt-green bg-volt-green/10 text-volt-green'
                                : 'border-black bg-[#A2FF00] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-extrabold'
                              : isMidnight
                                ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-[10px] font-black">Saldo de Conta</span>
                          <span className="text-[9px] opacity-80 font-bold">R$ {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('credit')}
                          className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                            paymentMethod === 'credit'
                              ? isMidnight
                                ? 'border-volt-green bg-volt-green/10 text-volt-green'
                                : 'border-black bg-[#00E5FF] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-extrabold'
                              : isMidnight
                                ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-[10px] font-black">Cartão Volt</span>
                          <span className="text-[9px] opacity-80 font-bold">Limite de Crédito</span>
                        </button>
                      </div>
                    </div>

                    {/* Installments selection for credit cards */}
                    {paymentMethod === 'credit' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase text-on-surface-variant block tracking-wider pl-1">
                          Parcelamento no Cartão
                        </label>
                        <select
                          value={installments}
                          onChange={(e) => setInstallments(parseInt(e.target.value))}
                          className="w-full p-2.5 text-xs rounded-xl border-2 border-black focus:outline-none focus:border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        >
                          {[1, 2, 3, 4, 5, 6, 10, 12].map((i) => (
                            <option key={i} value={i} className="bg-white text-black">
                              {i}x de {formatCurrency(selectedProduct.price / i)} sem juros
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* PIN input field */}
                    <div className="space-y-1.5 mt-3">
                      <label className="text-[10px] font-extrabold uppercase text-on-surface-variant block tracking-wider pl-1">
                        Senha de 4 dígitos do Cartão
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => {
                          setPin(e.target.value.replace(/\D/g, ''));
                          setCheckoutError(null);
                        }}
                        required
                        placeholder="••••"
                        className="w-full p-2.5 text-center text-lg rounded-xl border-2 border-black focus:outline-none focus:border-black bg-white text-black tracking-[0.5em] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      />
                    </div>

                    {/* Error display */}
                    {checkoutError && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs mt-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="font-semibold">{checkoutError}</span>
                      </div>
                    )}

                    {/* Confirm Button */}
                    <button
                      type="submit"
                      disabled={checkoutLoading}
                      className="w-full mt-2 font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer btn-primary"
                    >
                      {checkoutLoading ? (
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        `Confirmar Compra`
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-center py-6 space-y-5">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-volt-green/15 flex items-center justify-center text-volt-green">
                      <CheckCircle2 size={40} className="stroke-[2.5]" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-lg font-black">Compra Concluída!</h4>
                    <p className="text-xs text-on-surface-variant">Sua transação foi realizada e o cashback já foi creditado.</p>
                  </div>

                  <div className="rounded-2xl p-4 text-left text-xs space-y-2.5 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Produto:</span>
                      <span className="font-extrabold truncate max-w-[150px]">{selectedProduct.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Valor debitado:</span>
                      <span className="font-black text-volt-green">{formatCurrency(selectedProduct.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Cashback Recebido:</span>
                      <span className="font-extrabold text-volt-green">+{formatCurrency(selectedProduct.price * (parseFloat(selectedProduct.cashback) / 100))}</span>
                    </div>
                    <div className="flex justify-between border-t border-black/5 pt-2 text-[10px] text-on-surface-variant">
                      <span>Forma de Pagamento:</span>
                      <span className="font-bold">{paymentMethod === 'balance' ? 'Saldo de Conta' : `Crédito em ${installments}x`}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="w-full font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer btn-primary"
                  >
                    Voltar para o Shop
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fintech Pet + Shop Promo Modal (Outstanding styling aligned perfectly with mock & details) */}
      <AnimatePresence>
        {isPetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPetModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, y: 25, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 25, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white border-4 border-black text-black rounded-[2.5rem] overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col"
            >
              {/* Header Gradient Pill */}
              <div className="bg-gradient-to-r from-volt-green to-[#00A86B] py-7 px-4 flex flex-col items-center justify-center text-center relative">
                {/* Close Button in header */}
                <button
                  onClick={() => setIsPetModalOpen(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full bg-black/20 hover:bg-black/35 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>

                {/* Pill icon */}
                <div className="bg-white/15 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-1 text-xs font-black text-white">
                  <span>🐾</span>
                  <span>+</span>
                  <span>🛍️</span>
                </div>

                <h3 className="text-xs font-black text-white uppercase tracking-wider mt-3">
                  Fintech Pet + Shop
                </h3>
              </div>

              {/* Modal Content */}
              <div className="p-6 flex flex-col items-center text-center space-y-5">
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-black px-2 leading-snug">
                    Do primeiro sintoma até a solução, a gente te ajuda a cuidar do seu pet.
                  </h4>
                  <p className="text-[11px] text-gray-700 leading-normal px-4">
                    Coberturas completas para cães e gatos de todas as idades, incluindo consultas, vacinas e exames.
                  </p>
                </div>

                {/* Pricing component */}
                <div className="space-y-0.5">
                  <span className="text-[9px] text-gray-700 block uppercase tracking-wider font-extrabold">
                    Plano mensal por apenas
                  </span>
                  <p className="text-3xl font-black text-black flex items-baseline justify-center gap-1">
                    <span className="text-sm font-bold text-black">R$</span>
                    11,99
                  </p>
                </div>

                {/* Pets Image in Modal */}
                <div className="w-full h-28 rounded-2xl overflow-hidden border border-zinc-800 relative shadow-inner">
                  <img 
                    src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400" 
                    alt="Cão e Gato"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* Button actions */}
                {petSubscribed ? (
                  <div className="w-full bg-volt-green/10 text-volt-green font-black py-3 rounded-2xl text-xs border border-volt-green/20 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} /> Plano Ativo & Seguro Garantido
                  </div>
                ) : (
                  <button
                    onClick={handlePetSubscribe}
                    disabled={checkoutLoading}
                    className="w-full bg-volt-green text-black font-extrabold py-3.5 rounded-2xl text-xs uppercase tracking-wider hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-volt-green/20 cursor-pointer"
                  >
                    {checkoutLoading ? (
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      'Quero aproveitar'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cashback Redeem Modal (neo-brutalista, substitui alert()) */}
      <AnimatePresence>
        {redeemModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRedeemModal(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={`relative z-10 w-full max-w-xs p-6 rounded-2xl text-center flex flex-col items-center gap-4 ${
                isMidnight
                  ? 'bg-zinc-950 border border-zinc-800 text-white'
                  : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                redeemModal.type === 'success'
                  ? isMidnight ? 'bg-volt-green/10 border-2 border-volt-green' : 'bg-volt-lime border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : isMidnight ? 'bg-zinc-800 border border-zinc-700' : 'bg-volt-yellow-pastel border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                {redeemModal.type === 'success' ? '🎉' : '💸'}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-black uppercase tracking-tight">
                  {redeemModal.type === 'success' ? 'Cashback resgatado!' : 'Sem saldo de cashback'}
                </h3>
                <p className={`text-xs font-bold leading-relaxed ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>
                  {redeemModal.type === 'success'
                    ? `${formatCurrency(redeemModal.amount)} foram creditados no seu saldo principal.`
                    : 'Você ainda não acumulou cashback para resgatar. Compre na Shop Volt e volte aqui!'}
                </p>
              </div>
              <button
                onClick={() => setRedeemModal(null)}
                style={!isMidnight ? { color: 'white' } : undefined}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isMidnight
                    ? 'bg-volt-green text-black hover:opacity-90'
                    : 'bg-black text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
