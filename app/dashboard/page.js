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

  if (loading || !wallet) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Remit<span className="text-brand-600">X</span>
          </h1>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
          Sign Out
        </button>
      </div>

      {/* Wallet address */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
        {wallet.username && (
          <p className="text-sm font-semibold text-brand-600 mb-1">@{wallet.username}</p>
        )}
        <p className="text-xs text-gray-400 mb-1">Your wallet</p>
        <div className="flex items-center gap-2">
          <code className="text-xs text-gray-600 font-mono flex-1 truncate">{wallet.address}</code>
          <button onClick={copyAddress} className="text-xs text-brand-600 font-medium shrink-0">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={() => setShowQR(!showQR)} className="text-xs text-brand-600 font-medium shrink-0">
            {showQR ? 'Hide' : 'QR'}
          </button>
        </div>
        {showQR && (
          <div className="flex justify-center mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={wallet.address} size={180} level="M" />
          </div>
        )}
      </div>

      {/* Balances */}
      <div className="space-y-2 mb-6">
        {balances ? (
          Object.entries(balances).map(([currency, amount]) => {
            const value = parseFloat(amount);
            if (currency === 'XRP' && value < 1) return null; // hide tiny XRP dust
            return (
              <div key={currency} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CURRENCY_FLAGS[currency] || '💰'}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{currency}</p>
                    <p className="text-xs text-gray-400">{currency === 'XRP' ? 'XRP Ledger' : 'Issued Token'}</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-lg">
                  {CURRENCY_SYMBOLS[currency]}{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-400 py-8 animate-pulse">Loading balances...</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => router.push('/send')}
          className="bg-brand-600 text-white py-4 rounded-2xl font-semibold active:bg-brand-700"
        >
          ↗ Send
        </button>
        <button
          onClick={() => router.push('/scan')}
          className="bg-gray-900 text-white py-4 rounded-2xl font-semibold active:bg-gray-800"
        >
          ⊞ Scan QR
        </button>
        <button
          onClick={() => router.push('/split')}
          className="bg-brand-600 text-white py-4 rounded-2xl font-semibold active:bg-brand-700"
        >
          ✂ Split
        </button>
        <button
          onClick={() => router.push('/send-code')}
          className="bg-white text-gray-700 py-4 rounded-2xl font-semibold border-2 border-gray-200 active:bg-gray-50"
        >
          🔑 Send Code
        </button>
        <button
          onClick={() => router.push('/request')}
          className="bg-white text-gray-700 py-4 rounded-2xl font-semibold border-2 border-gray-200 active:bg-gray-50 col-span-2"
        >
          ↙ Request
        </button>
      </div>
    </div>
  );
}
