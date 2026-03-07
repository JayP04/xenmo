// app/components/WalletProvider.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null); // { address, seed }
  const [loading, setLoading] = useState(true);

  // Restore wallet from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('remitx_wallet');
    if (saved) {
      try { setWallet(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = (address, seed) => {
    const w = { address, seed };
    setWallet(w);
    sessionStorage.setItem('remitx_wallet', JSON.stringify(w));
  };

  const logout = () => {
    setWallet(null);
    sessionStorage.removeItem('remitx_wallet');
  };

  return (
    <WalletContext.Provider value={{ wallet, loading, login, logout }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
