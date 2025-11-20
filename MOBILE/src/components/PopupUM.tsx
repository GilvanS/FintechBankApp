import React from 'react';

/**
 * Interface for PopupUM props. This defines the data the popup needs.
 * @param isOpen - Controls if the popup is visible.
 * @param onClose - Function to call when the user clicks the close button or the overlay.
 * @param onConfirm - Function to call when the user clicks the main action button.
 * @param logo1Url - URL for the first logo (e.g., 'meu pet club').
 * @param logo2Url - URL for the second logo (e.g., 'ifood').
 * @param mainText - The main marketing text.
 * @param title - The main headline (e.g., 'Coberturas completas').
 * @param price - The main price value (e.g., '11,99').
 * @param priceDetails - Text that goes with the price (e.g., 'a partir de').
 * @param imageUrl - URL for the main visual image.
 * @param ctaText - Text for the call-to-action button (e.g., 'Quero aproveitar').
 */
interface PopupUMProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  logo1Url: string;
  logo2Url: string;
  mainText: string;
  title: string;
  price: string;
  priceDetails: string;
  imageUrl: string;
  ctaText: string;
}

/**
 * PopupUM: A reusable, standardized popup component based on the provided design.
 * It's designed to be flexible and can be used for various promotional offers.
 *
 * To use it, import it and render it with the required props:
 * 
 * <PopupUM
 *   isOpen={isPopupVisible}
 *   onClose={() => setIsPopupVisible(false)}
 *   onConfirm={() => { alert('Confirmed!'); setIsPopupVisible(false); }}
 *   logo1Url="https://i.imgur.com/sSGPk2N.png" // Example logo
 *   logo2Url="https://logodownload.org/wp-content/uploads/2017/05/ifood-logo-white-3.png"
 *   mainText="Do primeiro sintoma até a solução, a gente te ajuda a cuidar do seu pet."
 *   title="Coberturas completas"
 *   price="11,99"
 *   priceDetails="a partir de"
 *   imageUrl="https://images.unsplash.com/photo-1568605117036-5fe5e7185743"
 *   ctaText="Quero aproveitar"
 * />
 */
const PopupUM: React.FC<PopupUMProps> = ({
  isOpen,
  onClose,
  onConfirm,
  logo1Url,
  logo2Url,
  mainText,
  title,
  price,
  priceDetails,
  imageUrl,
  ctaText
}) => {
  // If the popup is not open, render nothing.
  if (!isOpen) {
    return null;
  }

  return (
    // Overlay: covers the entire screen with a semi-transparent background.
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-end sm:items-center z-50 p-4 animate-fade-in"
      onClick={onClose} // Allows closing the popup by clicking the overlay.
    >
      {/* Popup Container: Stops click events from bubbling up to the overlay. */}
      <div 
        className="bg-[#8A053A] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm text-white text-center relative animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button 'X' */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white z-10 p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          aria-label="Fechar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Section with Logos */}
        <div className="bg-[#A40F4C] p-6 rounded-t-2xl flex justify-center items-center gap-4">
          <img src={logo1Url} alt="Logo Parceiro 1" className="h-10 object-contain" />
          <span className="text-2xl font-light">+</span>
          <img src={logo2Url} alt="Logo Parceiro 2" className="h-10 object-contain" />
        </div>
        
        {/* Main Content Area */}
        <div className="p-6">
          <p className="text-lg font-medium leading-tight mb-4">{mainText}</p>
          <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
          
          {/* Price Display */}
          <div className="flex justify-center items-end my-4">
            <span className="text-sm self-start mr-2 mt-2">{priceDetails}</span>
            <div className="flex items-baseline font-bold text-[#A4F4A5]">
              <span className="text-2xl mr-1">R$</span>
              <span className="text-5xl leading-none">{price}</span>
            </div>
          </div>
        </div>

        {/* Image and Call-to-Action (CTA) Button */}
        <div className="relative text-left px-4 pb-6">
          <div className="relative">
            <img src={imageUrl} alt="Oferta" className="w-full h-48 object-cover rounded-lg shadow-inner" />
            <div className="absolute inset-x-0 bottom-4 px-4">
              <button 
                onClick={onConfirm}
                className="w-full bg-[#A4F4A5] text-[#1D3E1D] font-bold py-4 rounded-lg text-lg shadow-lg hover:bg-opacity-90 transition-all transform hover:scale-105"
              >
                {ctaText}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Embedded CSS for animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        @media (min-width: 640px) {
            @keyframes slide-up { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        }
      `}</style>
    </div>
  );
};

export default PopupUM;
