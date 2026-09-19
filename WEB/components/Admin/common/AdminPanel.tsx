import React from 'react';

interface AdminPanelProps {
    children: React.ReactNode;
    elevation?: 'surface' | 'surface-high';
    title?: string;
    className?: string;
    as?: 'div' | 'section';
}

// Não lê isMidnight de propósito: .bg-volt-surface / .bg-volt-surface-high já
// têm os dois temas resolvidos via cascata em WEB/styles/global.css
// (body.theme-midnight vs body:not(.theme-midnight)). Não adicionar ternário aqui.
const AdminPanel: React.FC<AdminPanelProps> = ({ children, elevation = 'surface', title, className, as: Tag = 'div' }) => {
    const bgClass = elevation === 'surface-high' ? 'bg-volt-surface-high' : 'bg-volt-surface';
    return (
        <Tag className={`${bgClass} rounded-xl p-3 ${className ?? ''}`}>
            {title && <p className="text-xs font-black uppercase opacity-60 mb-2">{title}</p>}
            {children}
        </Tag>
    );
};

export default AdminPanel;
