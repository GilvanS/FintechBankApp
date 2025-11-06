
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PixContact } from '../types';

interface QuickTransferProps {
    contacts: PixContact[];
    onSelectContact: (contact: PixContact) => void;
}

const EMOJI_LIST = ['🧑', '👩', '👨‍🦰', '👱‍♀️', '👨‍🦳', '🧔', '😎', '🤓', '🤖', '👻', '👽', '🦊', '🐻', '🐼', '🐨'];

const getEmojiForContact = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % EMOJI_LIST.length);
    return EMOJI_LIST[index];
};

const QuickTransfer: React.FC<QuickTransferProps> = ({ contacts, onSelectContact }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeftStart = useRef(0);

    const checkArrows = useCallback(() => {
        const el = scrollContainerRef.current;
        if (el) {
            const isScrollable = el.scrollWidth > el.clientWidth;
            setShowLeftArrow(isScrollable && el.scrollLeft > 0);
            setShowRightArrow(isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
        }
    }, []);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (el) {
            checkArrows();
            el.addEventListener('scroll', checkArrows);
            window.addEventListener('resize', checkArrows);
            return () => {
                el.removeEventListener('scroll', checkArrows);
                window.removeEventListener('resize', checkArrows);
            };
        }
    }, [contacts, checkArrows]);

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (el) {
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
        }
    };
    
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!scrollContainerRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeftStart.current = scrollContainerRef.current.scrollLeft;
        scrollContainerRef.current.style.cursor = 'grabbing';
        scrollContainerRef.current.style.userSelect = 'none';
    };

    const onMouseUp = () => {
        if (!scrollContainerRef.current) return;
        isDragging.current = false;
        scrollContainerRef.current.style.cursor = 'grab';
        scrollContainerRef.current.style.userSelect = '';
    };
    
    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
    };

    return (
        <div className="my-6">
            <h2 className="text-xl font-bold text-white mb-4">Transferência Rápida</h2>
            <div className="relative group">
                {showLeftArrow && (
                    <button onClick={() => handleScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                )}
                <div
                    ref={scrollContainerRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseUp}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                    className="flex items-center space-x-4 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar cursor-grab"
                >
                    {contacts.slice(0, 5).map(contact => (
                        <button key={contact.key} onClick={() => onSelectContact(contact)} className="flex flex-col items-center flex-shrink-0 w-20 text-center group">
                            <div className="w-16 h-16 text-3xl flex items-center justify-center rounded-full object-cover mb-2 border-2 border-white/20 bg-white/10 group-hover:border-purple-400 transition-all">
                               {getEmojiForContact(contact.name)}
                            </div>
                            <span className="text-xs font-medium text-gray-300 truncate w-full">{contact.name}</span>
                        </button>
                    ))}
                     <button className="flex flex-col items-center flex-shrink-0 w-20 text-center group">
                        <div className="w-16 h-16 rounded-full mb-2 bg-white/10 flex items-center justify-center border-2 border-white/20 group-hover:border-purple-400 transition-all">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </div>
                         <span className="text-xs font-medium text-gray-300">Adicionar</span>
                    </button>
                </div>
                 {showRightArrow && (
                    <button onClick={() => handleScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default QuickTransfer;
