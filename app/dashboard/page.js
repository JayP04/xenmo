// app/dashboard/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';
import { QRCodeSVG } from 'qrcode.react';

const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', NGN: '₦', XRP: '' };
const CURRENCY_FLAGS = { USD: '🇺🇸', INR: '🇮🇳', EUR: '🇪🇺', NGN: '🇳🇬', XRP: '⚡' };
const CURRENCY_NAMES = { USD: 'US Dollar', INR: 'Indian Rupee', EUR: 'Euro', NGN: 'Nigerian Naira' };

export default function Dashboard() {
  const { wallet, loading, logout } = useWallet();
  const router = useRouter();
  const [balance, setBalance] = useState(null);
  const [baseCurrency, setBaseCurrency] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine base currency from wallet context or fetch from API
  useEffect(() => {
    if (!wallet) return;
    if (wallet.baseCurrency) {
      setBaseCurrency(wallet.baseCurrency);
    } else {
      // Fallback: fetch from user API
      fetch(`/api/user?address=${wallet.address}`)
        .then(r => r.json())
        .then(d => { if (d.success) setBaseCurrency(d.user.baseCurrency || 'USD'); })
        .catch(() => setBaseCurrency('USD'));
    }
  }, [wallet]);

  const fetchBalance = useCallback(async () => {
    if (!wallet || !baseCurrency) return;
    try {
      const res = await fetch(`/api/wallet?address=${wallet.address}`);
      const data = await res.json();
      if (data.success && data.balances) {
        setBalance(data.balances[baseCurrency] || '0');
      }
    } catch (e) { console.error(e); }
  }, [wallet, baseCurrency]);

  useEffect(() => {
    if (!loading && !wallet) { router.push('/'); return; }
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [loading, wallet, router, fetchBalance]);

  const copyAddress = () => {
    navigator.clipboard?.writeText(wallet?.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !wallet) return <div className="flex items-center justify-center h-screen text-[#8E8E93]">Loading...</div>;

  const cur = baseCurrency || 'USD';
  const symbol = CURRENCY_SYMBOLS[cur] || '';
  const flag = CURRENCY_FLAGS[cur] || '💰';
  const name = CURRENCY_NAMES[cur] || cur;
  const formatted = balance !== null
    ? parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  return (
    <div className="px-4 pt-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[#F5F5F7]">
          Xen<span className="text-[#0A84FF]">mo</span>
        </h1>
        <button onClick={logout} className="text-xs text-[#8E8E93]">
          Sign Out
        </button>
      </div>

      {/* Balance Card */}
      <div className="card rounded-2xl p-6 mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">{flag}</span>
          <span className="text-sm text-[#8E8E93] font-medium">{name}</span>
        </div>
        {balance !== null ? (
          <p className="text-5xl font-bold text-[#F5F5F7] mt-2 tracking-tight">
            {symbol}{formatted}
          </p>
        ) : (
          <p className="text-3xl text-[#8E8E93] mt-2 animate-pulse">Loading...</p>
        )}
        <p className="text-xs text-[#636366] mt-2 uppercase tracking-wider">Available Balance</p>
      </div>

      {/* Wallet Info */}
      <div className="card rounded-2xl p-4 mb-6">
        {wallet.username && (
          <p className="text-sm font-semibold text-[#0A84FF] mb-2">@{wallet.username}</p>
        )}
        <div className="flex items-center gap-2">
          <code className="text-xs text-[#8E8E93] font-mono flex-1 truncate">{wallet.address}</code>
          <button onClick={copyAddress} className="text-xs text-[#0A84FF] font-medium shrink-0">
            {copied ? '✓' : 'Copy'}
          </button>
          <button onClick={() => setShowQR(!showQR)} className="text-xs text-[#0A84FF] font-medium shrink-0">
            {showQR ? 'Hide' : 'QR'}
          </button>
        </div>
        {showQR && (
          <div className="flex justify-center mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={wallet.address} size={180} level="M" className="w-full max-w-[180px] h-auto" />
          </div>
        )}
      </div>

      {/* Split Button */}
      <button
        onClick={() => router.push('/split')}
        className="w-full py-4 rounded-2xl font-semibold text-[#F5F5F7] active:opacity-80 transition-opacity card text-center"
      >
        ✂ Split Bill
      </button>
    </div>
  );
}
