import React from 'react';
// FIX: Corrected import path for PurchasedItem type from parent directory.
import { PurchasedItem } from '../types';

// FIX: Added onAddToCart to props interface
interface ProductPageProps {
  product: PurchasedItem;
  onBack: () => void;
  // FIX: Corrected typo in type name from PurchasedasedItem to PurchasedItem.
  onPurchase: (product: PurchasedItem) => void;
  onAddToCart: (product: PurchasedItem) => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ product, onBack, onPurchase, onAddToCart }) => {
  if (!product) return null;

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">
      <header className="absolute top-0 left-0 right-0 z-10 p-2 flex items-center justify-between">
        <button onClick={onBack} className="m-2 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar">
        <div className="relative">
          <img src={product.imageUrl} alt={product.name} className="w-full h-80 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/50 to-transparent"></div>
        </div>

        <div className="p-6 space-y-4 -mt-16 relative z-10">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-3xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
          <p className="text-gray-300 leading-relaxed">{product.description}</p>
        </div>
      </main>

      {/* FIX: Added a grid layout for two buttons: Add to Cart and Buy Now */}
      <footer className="p-4 border-t border-subtle-dark/50 grid grid-cols-2 gap-4">
        <button
          onClick={() => onAddToCart(product)}
          className="w-full py-4 font-semibold text-primary bg-primary/20 rounded-lg hover:bg-primary/30"
        >
          Adicionar ao Carrinho
        </button>
        <button
          onClick={() => onPurchase(product)}
          className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90"
        >
          Comprar Agora
        </button>
      </footer>
    </div>
  );
};

export default ProductPage;