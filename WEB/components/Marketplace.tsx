import React from 'react';

interface MarketplaceProps {
  onBack: () => void;
  isPreview?: boolean;
}

const Marketplace: React.FC<MarketplaceProps> = ({ onBack, isPreview = false }) => {
  if (isPreview) {
    return (
      <div
        className="bg-[#1C1C1E] rounded-2xl shadow-lg p-4 test-marketplace-preview"
        id="marketplace-preview"
        data-testid="marketplace-preview"
        data-cy="marketplace-preview"
        data-playwright="marketplace-preview"
      >
        <div className="flex items-center space-x-3">
            <div className="text-2xl">🛍️</div>
            <div>
              <h3 className="text-md font-bold text-white">Marketplace</h3>
              <p className="text-xs text-gray-400">Ofertas exclusivas em breve.</p>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-[#1C1C1E] rounded-2xl shadow-lg p-6 my-4 test-marketplace"
      id="marketplace"
      data-testid="marketplace"
      data-cy="marketplace"
      data-playwright="marketplace"
      role="main"
    >
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="mr-4 p-2 rounded-full hover:bg-gray-800 test-back-button"
          id="btn-marketplace-back"
          name="marketplace-back"
          data-testid="marketplace-back-button"
          data-cy="marketplace-back-button"
          data-playwright="marketplace-back-button"
          aria-label="Voltar"
          type="button"
        >
          <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-white" id="marketplace-title" data-testid="marketplace-title">Marketplace</h2>
      </div>
      <div
        className="text-center py-16 test-product-grid"
        id="marketplace-product-grid"
        data-testid="product-grid"
        data-cy="product-grid"
        data-playwright="product-grid"
      >
        <div className="text-5xl mb-4">🛍️</div>
        <h3 className="text-xl font-bold text-white">Em breve!</h3>
        <p className="text-gray-400 mt-2">
          Uma nova experiência de compras está chegando para você.
        </p>
      </div>
    </div>
  );
};

export default Marketplace;