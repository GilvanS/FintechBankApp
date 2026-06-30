import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, TrendingUp, CreditCard } from 'lucide-react';

interface PreLoginDashboardProps {
    onNavigateToLogin: () => void;
    onNavigateToSignUp: () => void;
}

const features = [
  { icon: Zap, label: 'PIX instantâneo' },
  { icon: Shield, label: 'Segurança total' },
  { icon: TrendingUp, label: 'Rendimento CDI' },
  { icon: CreditCard, label: 'Cartão sem anuidade' },
];

export default function PreLoginDashboard({ onNavigateToLogin, onNavigateToSignUp }: PreLoginDashboardProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 text-white bg-black">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-6xl font-black tracking-tight" style={{ fontFamily: 'system-ui, sans-serif' }}>VOLT</h1>
        <p className="text-gray-400 text-sm">O banco digital que acelera sua vida.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 w-full max-w-xs"
      >
        {features.map(({ icon: Icon, label }) => (
          <div key={label} className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
            <Icon size={20} className="text-[#00ff9d]" />
            <span className="text-xs font-bold text-gray-300">{label}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-xs space-y-3"
      >
        <button 
          onClick={onNavigateToLogin}
          className="w-full py-3 rounded-xl text-sm font-bold text-center block bg-[#00ff9d] text-black hover:bg-[#00cc7d] transition-colors"
        >
          ENTRAR
        </button>
        <button 
          onClick={onNavigateToSignUp}
          className="w-full py-3 rounded-xl text-sm text-center block border border-white/20 text-white font-bold hover:bg-white/5 transition-colors"
        >
          CRIAR CONTA
        </button>
      </motion.div>
    </div>
  );
}