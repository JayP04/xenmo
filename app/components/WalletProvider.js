// app/components/WalletProvider.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null); // { address, seed, username }
  const [loading, setLoading] = useState(true);

  // Restore wallet from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('xenmo_wallet');
    if (saved) {
      try { setWallet(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = (address, seed, username, baseCurrency) => {
    const w = { address, seed, username, baseCurrency };
    setWallet(w);
    sessionStorage.setItem('xenmo_wallet', JSON.stringify(w));
  };

  const logout = () => {
    setWallet(null);
    sessionStorage.removeItem('xenmo_wallet');
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
