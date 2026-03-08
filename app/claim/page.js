// app/claim/page.js
'use client';
import { useState } from 'react';

export default function Claim() {
  const [code, setCode] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState('existing'); // 'existing' or 'new'
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);
  const [newWallet, setNewWallet] = useState(null);
  const [error, setError] = useState('');

  const createWalletFirst = async () => {
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseCurrency: 'USD' }),
      });
      const data = await res.json();
      if (data.success) {
        setNewWallet(data);
        setSeed(data.seed);
      } else throw new Error(data.error);
    } catch (e) { setError(e.message); }
    setClaiming(false);
  };

  const handleClaim = async () => {
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/escrow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), claimerSeed: seed.trim() }),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error || 'Failed to claim');
    } catch (e) { setError('Claim failed'); }
    setClaiming(false);
  };

  // Success screen
  if (result) {
    return (
      <div className="px-4 pt-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-[#F5F5F7]">Funds Claimed!</h2>
          <p className="text-lg font-semibold text-[#30D158] mt-2">{result.amount} {result.currency || 'USD'} received</p>
        </div>
        <div className="card rounded-2xl p-4">
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0A84FF] text-sm font-medium block text-center"
          >
            View on XRPL Explorer →
          </a>
        </div>
        {newWallet && (
          <div className="card rounded-2xl p-4 mt-4">
            <p className="text-sm font-semibold text-[#F5F5F7] mb-2">Your new wallet seed (save this!):</p>
            <code className="text-xs font-mono text-[#FF9F0A] break-all select-all">{newWallet.seed}</code>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#F5F5F7]">
          Xen<span className="text-[#0A84FF]">mo</span> Claim
        </h1>
        <p className="text-sm text-[#8E8E93] mt-2">Enter your 6-digit code to receive funds.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-[#8E8E93] mb-1 block">6-digit code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="847291"
            maxLength={6}
            className="input-field w-full px-4 py-4 rounded-xl text-center font-mono text-responsive-code"
          />
        </div>

        {/* Wallet selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('existing')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'existing' ? 'bg-[#0A84FF] text-white' : 'card text-[#8E8E93]'}`}
          >
            I have a wallet
          </button>
          <button
            onClick={() => { setMode('new'); if (!newWallet) createWalletFirst(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'new' ? 'bg-[#0A84FF] text-white' : 'card text-[#8E8E93]'}`}
          >
            Create new wallet
          </button>
        </div>

        {mode === 'existing' && (
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Your wallet seed (sEdXXX...)"
            className="input-field w-full px-4 py-3 rounded-xl font-mono text-sm"
          />
        )}

        {mode === 'new' && newWallet && (
          <div className="card rounded-xl p-3">
            <p className="text-xs text-[#30D158]">Wallet created: <span className="font-mono">{newWallet.address.slice(0, 12)}...</span></p>
          </div>
        )}

        {error && <p className="text-[#FF453A] text-sm">{error}</p>}

        <button
          onClick={handleClaim}
          disabled={claiming || code.length !== 6 || !seed}
          className="w-full py-4 rounded-2xl font-semibold bg-[#0A84FF] text-white disabled:opacity-50"
        >
          {claiming ? 'Claiming...' : 'Claim Funds'}
        </button>
      </div>
    </div>
  );
}
