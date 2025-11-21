import React from 'react';
import { PurchasedItem } from '../types';

interface ProductPageProps {
    product: PurchasedItem;
    onBack: () => void;
    onPurchase: (item: PurchasedItem) => void;
    onAddToCart: (item: PurchasedItem) => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ product, onBack, onPurchase, onAddToCart }) => {
    return (
        <div>
            <h1>{product.name}</h1>
            <button onClick={onBack}>Back</button>
            <button onClick={() => onPurchase(product)}>Purchase</button>
            <button onClick={() => onAddToCart(product)}>Add to Cart</button>
        </div>
    );
};

export default ProductPage;