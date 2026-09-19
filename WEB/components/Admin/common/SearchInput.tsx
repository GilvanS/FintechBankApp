import React from 'react';
import { Search } from 'lucide-react';
import { useAppState } from '../../../contexts/AppStateContext';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

// Único dos 3 componentes que lê isMidnight: global.css só tematiza
// input[type="text"] via seletor de tag bruto, não existe classe tipo
// .bg-volt-surface equivalente pra inputs.
const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder, className }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    return (
        <div className={`relative ${className ?? ''}`}>
            <Search size={12} className="absolute left-2 top-2 opacity-50" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full pl-6 pr-2 py-1.5 rounded-lg text-xs border ${isMidnight ? 'bg-black border-white/20' : 'bg-white border-black/20'}`}
            />
        </div>
    );
};

export default SearchInput;
