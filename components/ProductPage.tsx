
import React from 'react';
import { PurchasedItem } from '../types';

interface ProductPageProps {
  product: PurchasedItem;
  onBack: () => void;
  onPurchase: (product: PurchasedItem) => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ product, onBack, onPurchase }) => {
  if (!product) return null;

  return (
    <div className="bg-black text-white min-h-full flex flex-col">
      <header className="absolute top-0 left-0 right-0 z-10 p-2 flex items-center justify-between">
        <button onClick={onBack} className="m-2 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar">
        <div className="relative">
          <img src={product.imageUrl} alt={product.name} className="w-full h-80 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        </div>

        <div className="p-6 space-y-4 -mt-16 relative z-10">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-3xl font-bold text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
          <p className="text-gray-300 leading-relaxed">{product.description}</p>
        </div>
      </main>

      <footer className="p-4 border-t border-gray-800">
        <button
          onClick={() => onPurchase(product)}
          className="w-full py-4 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500"
        >
          Comprar Agora
        </button>
      </footer>
    </div>
  );
};

export default ProductPage;
