// app/dashboard/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';
import { QRCodeSVG } from 'qrcode.react';

const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', NGN: '₦', XRP: '' };
const CURRENCY_FLAGS = { USD: '🇺🇸', INR: '🇮🇳', EUR: '🇪🇺', NGN: '🇳🇬', XRP: '⚡' };

export default function Dashboard() {
  const { wallet, loading, logout } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/wallet?address=${wallet.address}`);
      const data = await res.json();
      if (data.success) setBalances(data.balances);
    } catch (e) { console.error(e); }
  }, [wallet]);

  useEffect(() => {
    if (!loading && !wallet) { router.push('/'); return; }
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [loading, wallet, router, fetchBalances]);

  const copyAddress = () => {
    navigator.clipboard?.writeText(wallet?.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !wallet) return <div className="flex items-center justify-center h-screen text-[#8E8E93]">Loading...</div>;

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F5F7]">
            Remit<span className="text-[#0A84FF]">X</span>
          </h1>
        </div>
        <button onClick={logout} className="text-xs text-[#8E8E93]">
          Sign Out
        </button>
      </div>

      {/* Wallet address */}
      <div className="card rounded-2xl p-4 mb-4">
        {wallet.username && (
          <p className="text-sm font-semibold text-[#0A84FF] mb-1">@{wallet.username}</p>
        )}
        <p className="text-xs text-[#8E8E93] mb-1">Your wallet</p>
        <div className="flex items-center gap-2">
          <code className="text-xs text-[#8E8E93] font-mono flex-1 truncate">{wallet.address}</code>
          <button onClick={copyAddress} className="text-xs text-[#0A84FF] font-medium shrink-0">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={() => setShowQR(!showQR)} className="text-xs text-[#0A84FF] font-medium shrink-0">
            {showQR ? 'Hide' : 'QR'}
          </button>
        </div>
        {showQR && (
          <div className="flex justify-center mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={wallet.address} size={Math.min(180, 320)} level="M" className="w-full max-w-[180px] h-auto" />
          </div>
        )}
      </div>

      {/* Balances */}
      <div className="space-y-2 mb-6">
        {balances ? (
          Object.entries(balances)
            .filter(([currency]) => currency !== 'XRP')
            .map(([currency, amount]) => (
              <div key={currency} className="card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CURRENCY_FLAGS[currency] || '💰'}</span>
                  <div>
                    <p className="font-semibold text-[#F5F5F7]">{currency}</p>
                    <p className="text-xs text-[#8E8E93]">Balance</p>
                  </div>
                </div>
                <p className="font-bold text-[#F5F5F7] text-lg">
                  {CURRENCY_SYMBOLS[currency]}{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))
        ) : (
          <div className="text-center text-[#8E8E93] py-8 animate-pulse">Loading balances...</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => router.push('/send')}
          className="py-4 rounded-2xl font-semibold bg-[#0A84FF] text-white active:opacity-80 transition-opacity"
        >
          ↗ Send
        </button>
        <button
          onClick={() => router.push('/scan')}
          className="py-4 rounded-2xl font-semibold text-[#F5F5F7] active:opacity-80 transition-opacity card"
        >
          ⊞ Scan QR
        </button>
        <button
          onClick={() => router.push('/split')}
          className="py-4 rounded-2xl font-semibold text-[#F5F5F7] active:opacity-80 transition-opacity card"
        >
          ✂ Split
        </button>
        <button
          onClick={() => router.push('/send-code')}
          className="py-4 rounded-2xl font-semibold text-[#F5F5F7] active:opacity-80 transition-opacity card"
        >
          🔑 Send Code
        </button>
        <button
          onClick={() => router.push('/request')}
          className="col-span-2 py-4 rounded-2xl font-semibold text-[#F5F5F7] active:opacity-80 transition-opacity card"
        >
          ↙ Request
        </button>
      </div>
    </div>
  );
}
