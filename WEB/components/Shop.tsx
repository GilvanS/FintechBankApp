
import React from 'react';
import { PurchasedItem } from '../types';
import CouponTicket from './CouponTicket';

interface ShopProps {
  onBack: () => void;
  onProductSelect: (product: PurchasedItem) => void;
}

const mockProducts: PurchasedItem[] = [
    { id: 'prod1', name: 'Fone de Ouvido Bluetooth TWS Pro', price: 249.90, imageUrl: 'https://i.imgur.com/8KW344e.png', description: 'Experimente a liberdade do som sem fios com cancelamento de ruído ativo e até 24 horas de bateria.' },
    { id: 'prod2', name: 'Carregador Portátil 20000mAh', price: 149.00, imageUrl: 'https://i.imgur.com/cBuw22s.png', description: 'Nunca mais fique sem bateria. Carregue até 3 dispositivos simultaneamente com alta velocidade.' },
    { id: 'prod3', name: 'Smartwatch Fitness Tracker X2', price: 399.00, imageUrl: 'https://i.imgur.com/sC5I7oG.png', description: 'Monitore sua saúde e atividades físicas com estilo. GPS integrado, medidor de oxigênio e mais.' },
    { id: 'prod4', name: 'Câmera de Segurança Wi-Fi 360°', price: 299.90, imageUrl: 'https://i.imgur.com/G5g3fA0.png', description: 'Monitore sua casa de qualquer lugar com visão noturna, áudio bidirecional e detecção de movimento.' },
    { id: 'prod5', name: 'Luminária de Mesa LED Inteligente', price: 129.90, imageUrl: 'https://i.imgur.com/v1uAb2S.png', description: 'Ajuste a cor e a intensidade da luz pelo celular. Perfeita para trabalho e leitura.' },
    { id: 'prod6', name: 'Teclado Mecânico Gamer RGB', price: 459.90, imageUrl: 'https://i.imgur.com/jM8vD3x.png', description: 'Alta performance para seus jogos com switches mecânicos e iluminação RGB customizável.' },
];

const ProductCard: React.FC<{ product: PurchasedItem, onClick: () => void }> = ({ product, onClick }) => (
    <button onClick={onClick} className="bg-gray-900 rounded-lg overflow-hidden text-left group">
        <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover group-hover:opacity-80 transition-opacity" />
        <div className="p-3">
            <p className="text-sm text-gray-300 h-10 line-clamp-2">{product.name}</p>
            <p className="text-lg font-bold text-white mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
        </div>
    </button>
);


const Shop: React.FC<ShopProps> = ({ onBack, onProductSelect }) => {
  return (
    <div className="bg-black text-white min-h-full flex flex-col">
       <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-gray-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-2xl font-bold text-white">Fintech Shop</h2>
      </header>
       <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
            <div className="relative">
                <input 
                    type="text"
                    placeholder="Busque por produtos ou lojas"
                    className="w-full bg-gray-800 text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="space-y-3">
                <CouponTicket title="10% OFF" description="Em produtos selecionados" brandLogo="https://i.imgur.com/sFo4fJg.png" />
                <CouponTicket title="R$ 50 OFF" description="Em compras acima de R$ 500" brandLogo="https://i.imgur.com/Xyq4x2I.png" />
            </div>

            <div>
                <h3 className="text-xl font-bold mb-4">Recomendado para você</h3>
                <div className="grid grid-cols-2 gap-4">
                    {mockProducts.map(prod => (
                        <ProductCard key={prod.id} product={prod} onClick={() => onProductSelect(prod)} />
                    ))}
                </div>
            </div>
       </main>
       <style>{`.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }`}</style>
    </div>
  );
};

export default Shop;
