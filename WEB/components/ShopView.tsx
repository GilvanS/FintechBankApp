import React, { useState, useEffect } from 'react';
import { ShoppingBag, Zap, CreditCard, CheckCircle2, AlertCircle, ShoppingCart, Sparkles, Shield, Gift, Lock, ArrowRight, Heart, ExternalLink, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../types';
import { useAppState } from '../contexts/AppStateContext';
import { checkout, getProducts } from '../services/api';

interface ShopViewProps {
  /** Opcional: quando não vem do pai, a própria tela busca o catálogo. */
  products?: Product[];
  accountBalance: number;
}

export const ShopView: React.FC<ShopViewProps> = ({ products: productsProp, accountBalance }) => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';

  // O Dashboard renderiza esta tela sem passar `products`, então o catálogo é
  // carregado aqui — mesmo padrão já usado na versão mobile. A lista começa
  // vazia para a primeira renderização não quebrar no map.
  const [fetchedProducts, setFetchedProducts] = useState<Product[]>([]);
  const products = productsProp ?? fetchedProducts;

  useEffect(() => {
    if (productsProp) return;
    let active = true;

    (async () => {
      try {
        const result = await getProducts();
        if (!active || !result.success || !result.products) return;
        setFetchedProducts(result.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          cashback: p.cashback || '5%',
          category: p.category || 'Geral',
          image: p.imageUrl || p.image || '',
          description: p.description || '',
        })));
      } catch (err) {
        console.error('[ShopView] Falha ao carregar catálogo:', err);
      }
    })();

    return () => { active = false; };
  }, [productsProp]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'credit'>('balance');
  const [isRecurringDebit, setIsRecurringDebit] = useState<boolean>(false);
  const [installments, setInstallments] = useState<number>(1);
  const [pin, setPin] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const [cashbackBalance] = useState(() => {
    return parseFloat(localStorage.getItem('volt_cashback_balance') || '0.00');
  });

  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [isPetPasswordOpen, setIsPetPasswordOpen] = useState(false);
  const [redeemModal, setRedeemModal] = useState<{ type: 'success' | 'empty'; amount: number } | null>(null);
  const [petSubscribed, setPetSubscribed] = useState(() => {
    return localStorage.getItem('volt_pet_subscribed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('volt_cashback_balance', cashbackBalance.toString());
  }, [cashbackBalance]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (!pin || pin.length !== 4) {
      setCheckoutError('Digite a sua senha de 4 dígitos do cartão para confirmar.');
      return;
    }

    if (paymentMethod === 'balance' && !isRecurringDebit && accountBalance < selectedProduct.price) {
      setCheckoutError('Saldo insuficiente para efetuar esta compra.');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const response = await checkout({
        items: [{ productId: selectedProduct.id, quantity: 1 }],
        paymentMethod: isRecurringDebit ? 'ACCOUNT_DEBIT' : (paymentMethod === 'balance' ? 'debit' : 'credit'),
        type: isRecurringDebit ? 'SUBSCRIPTION' : undefined,
        frequency: isRecurringDebit ? 'MONTHLY' : undefined,
        cashbackUsed: 0,
        installments: paymentMethod === 'credit' ? installments : 1,
        pin: pin,
      });

      if (response.success && response.purchase) {
        const now = new Date();
        const formatNumber = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
        const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        const percentVal = parseFloat(selectedProduct.cashback) / 100 || 0.05;
        const cashbackEarned = selectedProduct.price * percentVal;

        const serverTx = response.purchase.transaction || {};

        setReceiptData({
          productName: selectedProduct.name,
          price: selectedProduct.price,
          date: formattedDate,
          weekday: weekdays[now.getDay()],
          paymentMethod: isRecurringDebit ? 'Débito Recorrente (Conta)' : (paymentMethod === 'balance' ? 'Saldo de Conta' : `Crédito em ${installments}x`),
          cashbackEarned,
          transactionId: serverTx.id || response.purchase.id || `SHOP-${Date.now()}`,
          authCode: serverTx.id ? String(serverTx.id).slice(0, 8).toUpperCase() : 'AUTH-' + Math.floor(100000 + Math.random() * 900000),
          installments: installments,
          status: 'APROVADA'
        });

        setPurchaseSuccess(true);
        setPin('');

        window.dispatchEvent(new CustomEvent('app-toast', {
          detail: {
            message: isRecurringDebit ? '🎉 Assinatura em Débito Recorrente iniciada!' : `🎉 Compra de ${selectedProduct.name} realizada!`,
            type: 'success'
          }
        }));
      } else {
        setCheckoutError(response.message || 'Erro ao processar checkout.');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior */}
      <div className={`relative overflow-hidden rounded-3xl p-6 md:p-8 ${
        isMidnight 
          ? 'bg-zinc-900 border-2 border-zinc-800 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]' 
          : 'bg-[#A2FF00] border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black text-white">
              <Sparkles size={12} className="text-volt-green" /> Volt Store
            </div>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight">Loja Oficial & Ofertas</h1>
            <p className="text-xs md:text-sm font-bold opacity-80 max-w-xl">
              Adquira produtos exclusivos e serviços financeiros diretamente pelo saldo da sua conta ou cartão Volt.
            </p>
          </div>

          {/* Janelas nomeadas: clicar de novo reaproveita a que já está aberta,
              em vez de espalhar cópias pela área de trabalho. */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.open('/FintechBankApp/shop', 'volt-vitrine', 'width=1280,height=900')}
              title="Abrir a vitrine completa em outra janela"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white font-bold text-xs uppercase hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={14} /> Abrir vitrine
            </button>
            <button
              type="button"
              onClick={() => window.open('/FintechBankApp/monitor', 'volt-monitor', 'width=520,height=900')}
              title="Acompanhar os eventos desta compra em tempo real"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white font-bold text-xs uppercase hover:opacity-90 transition-opacity"
            >
              <Activity size={14} /> Monitor ao vivo
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => {
              setSelectedProduct(product);
              setCheckoutError(null);
              setPin('');
              setPurchaseSuccess(false);
              setInstallments(1);
              setPaymentMethod('balance');
              setIsRecurringDebit(false);
            }}
            className={`relative rounded-2xl overflow-hidden cursor-pointer flex flex-col border transition-all duration-300 ${
              isMidnight 
                ? 'bg-zinc-900 border-2 border-zinc-800 hover:border-volt-green/50 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]' 
                : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50'
            }`}
          >
            <div className={`relative h-40 w-full overflow-hidden ${isMidnight ? 'border-b-2 border-zinc-800' : 'border-b-2 border-black'}`}>
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-black text-sm uppercase">{product.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{product.description}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-black/10">
                <span className="font-black text-base">{formatCurrency(product.price)}</span>
                <span className="text-xs font-bold text-volt-green bg-black px-2 py-1 rounded-lg">Comprar</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Checkout */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl ${
                isMidnight ? 'bg-zinc-900 border-2 border-zinc-800 text-white' : 'bg-white border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {!purchaseSuccess ? (
                <form onSubmit={handleCheckout} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-black/10 pb-3">
                    <h3 className="font-black uppercase text-sm flex items-center gap-2">
                      <ShoppingCart size={18} /> Confirmar Compra
                    </h3>
                    <button type="button" onClick={() => setSelectedProduct(null)} className="p-1 opacity-60 hover:opacity-100 font-bold">✕</button>
                  </div>

                  <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-2xl">
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-12 h-12 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-black text-xs uppercase">{selectedProduct.name}</h4>
                      <p className="font-black text-sm text-volt-green">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                  </div>

                  {/* Seleção de Forma de Pagamento */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase block tracking-wider">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setPaymentMethod('balance'); setIsRecurringDebit(false); }}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-0.5 ${
                          paymentMethod === 'balance' && !isRecurringDebit ? 'border-black bg-[#A2FF00] text-black font-extrabold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        <span className="text-[10px] font-black">Saldo de Conta</span>
                        <span className="text-[9px] opacity-80 font-bold">{formatCurrency(accountBalance)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPaymentMethod('credit'); setIsRecurringDebit(false); }}
                        className={`py-2 px-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-0.5 ${
                          paymentMethod === 'credit' ? 'border-black bg-[#00E5FF] text-black font-extrabold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        <span className="text-[10px] font-black">Cartão Volt</span>
                        <span className="text-[9px] opacity-80 font-bold">Limite de Crédito</span>
                      </button>
                    </div>
                  </div>

                  {/* Toggle de Débito Recorrente (visível quando selecionado Saldo de Conta) */}
                  {paymentMethod === 'balance' && (
                    <div className="flex items-center justify-between p-3 rounded-2xl border-2 border-black/20 bg-volt-green/10">
                      <div>
                        <span className="font-black text-xs block">Débito Recorrente (Mensal)</span>
                        <span className="text-[10px] opacity-70">Cadastrar como assinatura em saldo</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRecurringDebit(!isRecurringDebit)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${isRecurringDebit ? 'bg-volt-green' : 'bg-gray-400'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black transition-transform ${isRecurringDebit ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Parcelamento no Crédito */}
                  {paymentMethod === 'credit' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase block">Parcelamento</label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(parseInt(e.target.value))}
                        className="w-full p-2 text-xs rounded-xl border-2 border-black bg-white text-black font-bold"
                      >
                        {[1, 2, 3, 4, 5, 6, 10, 12].map((i) => (
                          <option key={i} value={i}>{i}x de {formatCurrency(selectedProduct.price / i)} sem juros</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* PIN */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase block">Senha do Cartão (4 dígitos)</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-2.5 text-center text-base tracking-widest rounded-xl border-2 border-black font-mono"
                      required
                    />
                  </div>

                  {checkoutError && <p className="text-xs text-red-500 font-bold">{checkoutError}</p>}

                  <button
                    type="submit"
                    disabled={checkoutLoading}
                    className="w-full font-black py-3 rounded-2xl text-xs uppercase tracking-wider bg-volt-green border-2 border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none"
                  >
                    {checkoutLoading ? 'Processando...' : 'Confirmar e Pagar'}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle2 size={48} className="text-volt-green mx-auto" />
                  <h3 className="font-black text-lg uppercase">Sucesso!</h3>
                  <p className="text-xs opacity-80">{receiptData?.productName} - {formatCurrency(receiptData?.price)}</p>
                  <button onClick={() => setSelectedProduct(null)} className="w-full py-3 font-black rounded-2xl bg-black text-white text-xs uppercase">
                    Voltar para a Loja
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default ShopView;
