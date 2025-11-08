
import React from 'react';

interface CouponTicketProps {
    title: string;
    description: string;
    brandLogo: string;
}

const CouponTicket: React.FC<CouponTicketProps> = ({ title, description, brandLogo }) => {
    return (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl flex items-center p-4 relative cursor-pointer group hover:border-green-500 transition-all">
            {/* Left circle cutout */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-black rounded-full"></div>
            {/* Right circle cutout */}
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-black rounded-full"></div>

            <div className="flex-shrink-0 mr-4">
                <img src={brandLogo} alt="Brand" className="w-12 h-12 object-contain" />
            </div>
            <div className="flex-grow">
                <h4 className="text-lg font-bold text-green-400">{title}</h4>
                <p className="text-sm text-gray-300">{description}</p>
            </div>
             <div className="ml-4 flex-shrink-0">
                <svg className="w-6 h-6 text-gray-500 group-hover:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        </div>
    );
};

export default CouponTicket;
