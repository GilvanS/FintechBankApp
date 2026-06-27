import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Transaction } from '../types';
import PixModal from '../components/PixModal';
import DepositModal from '../components/DepositModal';
import BiometricModal from '../components/BiometricModal';

type PixProps = {
  accountBalance: number;
  onTransactionComplete: (tx: Transaction, amount: number) => void;
};

type DepositProps = {
  onDepositComplete: (tx: Transaction, amount: number) => void;
};

type BiometricProps = {
  onSuccess: () => void;
  theme: 'yellow' | 'midnight';
};

interface GlobalModalContextValue {
  openPix(props: PixProps): void;
  openDeposit(props: DepositProps): void;
  openBiometric(props: BiometricProps): void;
}

const GlobalModalContext = createContext<GlobalModalContextValue | null>(null);

export function useGlobalModal(): GlobalModalContextValue {
  const ctx = useContext(GlobalModalContext);
  if (!ctx) throw new Error('useGlobalModal must be used inside GlobalModalProvider');
  return ctx;
}

const NOOP: (tx: Transaction, amount: number) => void = () => {};

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [pixIsOpen, setPixIsOpen] = useState(false);
  const [pixProps, setPixProps] = useState<PixProps>({ accountBalance: 0, onTransactionComplete: NOOP });

  const [depositIsOpen, setDepositIsOpen] = useState(false);
  const [depositProps, setDepositProps] = useState<DepositProps>({ onDepositComplete: NOOP });

  const [bioIsOpen, setBioIsOpen] = useState(false);
  const [bioProps, setBioProps] = useState<BiometricProps>({ onSuccess: () => {}, theme: 'yellow' });

  const openPix = useCallback((props: PixProps) => {
    setPixProps(props);
    setPixIsOpen(true);
  }, []);

  const openDeposit = useCallback((props: DepositProps) => {
    setDepositProps(props);
    setDepositIsOpen(true);
  }, []);

  const openBiometric = useCallback((props: BiometricProps) => {
    setBioProps(props);
    setBioIsOpen(true);
  }, []);

  return (
    <GlobalModalContext.Provider value={{ openPix, openDeposit, openBiometric }}>
      {children}
      <PixModal
        isOpen={pixIsOpen}
        onClose={() => setPixIsOpen(false)}
        accountBalance={pixProps.accountBalance}
        onTransactionComplete={pixProps.onTransactionComplete}
      />
      <DepositModal
        isOpen={depositIsOpen}
        onClose={() => setDepositIsOpen(false)}
        onDepositComplete={depositProps.onDepositComplete}
      />
      <BiometricModal
        isOpen={bioIsOpen}
        onClose={() => setBioIsOpen(false)}
        onSuccess={bioProps.onSuccess}
        theme={bioProps.theme}
      />
    </GlobalModalContext.Provider>
  );
}
