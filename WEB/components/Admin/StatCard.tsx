import React from 'react';
import { LucideIcon } from 'lucide-react';

const StatCard: React.FC<{ title: string; value: string | number; icon: LucideIcon; isMidnight: boolean }> = ({ title, value, icon: Icon, isMidnight }) => (
    <div className={`p-6 rounded-2xl flex flex-col justify-between border transition-colors ${
        isMidnight
            ? 'bg-volt-surface border-white/5 shadow-md text-white hover:border-volt-green/20'
            : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black hover:bg-gray-50'
    }`}>
        <div className="flex items-center space-x-3 mb-3">
            <Icon className={`w-6 h-6 ${isMidnight ? 'text-volt-green' : 'text-black'}`} />
            <p className={`text-[10px] break-words leading-tight ${isMidnight ? 'font-semibold text-white/80' : 'font-black uppercase tracking-wider text-black/60'}`}>{title}</p>
        </div>
        <p className={`text-2xl ${isMidnight ? 'font-bold text-white' : 'font-black text-black'}`}>{value}</p>
    </div>
);

export default StatCard;
