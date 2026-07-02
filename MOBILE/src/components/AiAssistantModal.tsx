import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bot, User, Send, Sparkles, Home, ChevronRight } from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'yellow' | 'midnight';
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isTyping?: boolean;
}

export default function AiAssistantModal({ isOpen, onClose, theme }: AiAssistantModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen) {
      setMessages([
        { id: 'msg-1', sender: 'ai', text: 'Olá! Sou a Volt IA. Como posso ajudar com suas finanças hoje?' }
      ]);
      setInputValue('');
      setIsAiTyping(false);
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiTyping]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isAiTyping) return;

    const userText = inputValue.trim();
    setInputValue('');

    const newUserMsg: Message = { id: `msg-u-${Date.now()}`, sender: 'user', text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsAiTyping(true);

    // Simulate AI thinking and mock response
    setTimeout(() => {
      setIsAiTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          sender: 'ai',
          text: 'Modo de simulação: Esta é uma prévia do Assistente IA. Baseado no seu perfil, recomendo sempre manter pelo menos 15% da sua renda em reservas seguras!'
        }
      ]);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.93, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
            className={`relative w-full max-w-md h-[500px] max-h-[90vh] z-10 p-4 rounded-2xl flex flex-col shadow-2xl overflow-hidden select-none ${
              theme === 'midnight'
                ? 'bg-zinc-950 border border-zinc-800 text-white'
                : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {/* Draggable Handle Pill */}
            <div className="w-12 h-1.5 bg-black/10 dark:bg-white/15 rounded-full mx-auto -mt-1 mb-3 cursor-grab shrink-0" />

            {/* Breadcrumb Navigation Bar */}
            <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border w-fit shrink-0 mb-3 ${
              theme === 'midnight'
                ? 'text-zinc-500 bg-black/20 border-white/5'
                : 'text-zinc-500 bg-gray-50 border-black/10 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-volt-green transition-colors flex items-center gap-1 cursor-pointer text-zinc-500"
              >
                <Home size={10} />
                Início
              </button>
              <ChevronRight size={8} className="text-zinc-400" />
              <span className="text-volt-green animate-pulse">Assistente IA</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b-2 border-black/5 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border border-black/10 dark:border-white/15 ${
                  theme === 'midnight' ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-cyan-100 text-cyan-600'
                }`}>
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Volt IA</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sempre online</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1 scrollbar-none select-text">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                      msg.sender === 'user'
                        ? theme === 'midnight' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-200 border-gray-300 text-black'
                        : theme === 'midnight' ? 'bg-cyan-900/50 border-cyan-800 text-cyan-400' : 'bg-cyan-100 border-cyan-200 text-cyan-600'
                    }`}>
                      {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs font-bold leading-relaxed ${
                      msg.sender === 'user'
                        ? theme === 'midnight' 
                          ? 'bg-zinc-800 text-white border border-zinc-700 rounded-tr-sm' 
                          : 'bg-black text-white border-2 border-black rounded-tr-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : theme === 'midnight'
                          ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
                          : 'bg-white border-2 border-black text-gray-800 rounded-tl-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%] flex-row">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                      theme === 'midnight' ? 'bg-cyan-900/50 border-cyan-800 text-cyan-400' : 'bg-cyan-100 border-cyan-200 text-cyan-600'
                    }`}>
                      <Bot size={14} />
                    </div>
                    <div className={`p-3 rounded-2xl flex items-center gap-1 ${
                      theme === 'midnight' ? 'bg-zinc-900 border border-zinc-800 rounded-tl-sm' : 'bg-white border-2 border-black rounded-tl-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className={`mt-2 p-1.5 rounded-xl border flex items-center gap-2 ${
              theme === 'midnight' ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-black/10'
            }`}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Pergunte algo para a IA..."
                className={`flex-1 bg-transparent border-none outline-none text-xs font-bold px-3 py-2 ${
                  theme === 'midnight' ? 'text-white placeholder:text-zinc-600' : 'text-black placeholder:text-gray-400'
                }`}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isAiTyping}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  !inputValue.trim() || isAiTyping
                    ? 'opacity-50 cursor-not-allowed ' + (theme === 'midnight' ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-200 text-gray-400')
                    : theme === 'midnight' ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                <Send size={14} className={inputValue.trim() && !isAiTyping ? 'translate-x-0.5' : ''} />
              </button>
            </form>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
