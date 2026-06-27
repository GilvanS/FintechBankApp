import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Zap, Shield, TrendingUp, CreditCard } from 'lucide-react';

const features = [
  { icon: Zap, label: 'PIX instantâneo' },
  { icon: Shield, label: 'Segurança total' },
  { icon: TrendingUp, label: 'Rendimento CDI' },
  { icon: CreditCard, label: 'Cartão sem anuidade' },
];

export default function PreLoginDashboard() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-6xl font-black font-display tracking-tight">VOLT</h1>
        <p className="text-on-surface-variant text-sm">O banco digital que acelera sua vida.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 w-full max-w-xs"
      >
        {features.map(({ icon: Icon, label }) => (
          <div key={label} className="bg-volt-surface border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
            <Icon size={20} className="text-volt-green" />
            <span className="text-xs font-bold text-on-surface-variant">{label}</span>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-xs space-y-3"
      >
        <Link to="/login" className="btn-primary w-full py-3 rounded-xl text-sm text-center block">
          ENTRAR
        </Link>
        <Link to="/signup" className="w-full py-3 rounded-xl text-sm text-center block border border-white/20 text-white font-bold hover:bg-white/5 transition-colors">
          CRIAR CONTA
        </Link>
      </motion.div>
    </div>
  );
}
