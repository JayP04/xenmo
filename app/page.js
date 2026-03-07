// app/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from './components/WalletProvider';

export default function Home() {
  const { wallet, loading, login } = useWallet();
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | 'create' | 'import'
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [createdSeed, setCreatedSeed] = useState(''); // show once after creation

  useEffect(() => {
    if (!loading && wallet) router.push('/dashboard');
  }, [loading, wallet, router]);

  const handleCreate = async () => {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, baseCurrency: currency, username }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCreatedSeed(data.seed);
      login(data.address, data.seed, data.username);
    } catch (err) {
      setError(err.message);
    }
    setWorking(false);
  };

  const handleImport = async () => {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/wallet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, displayName: name, baseCurrency: currency, username }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      login(data.address, seed, data.username);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setWorking(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  // Show seed backup screen after wallet creation
  if (createdSeed) {
    return (
      <div className="px-6 pt-16">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h2 className="text-xl font-bold text-gray-900">Save Your Wallet Seed</h2>
          <p className="text-sm text-gray-500 mt-2">
            This is the ONLY way to recover your wallet. Save it somewhere safe.
          </p>
        </div>
        <div className="bg-brand-50 border-2 border-brand-200 rounded-xl p-4 mb-6">
          <code className="text-sm text-brand-800 break-all select-all font-mono">{createdSeed}</code>
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(createdSeed); }}
          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium mb-3 active:bg-gray-200"
        >
          Copy to Clipboard
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold active:bg-brand-700"
        >
          I Saved It — Continue
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 pt-16">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Remit<span className="text-brand-600">X</span>
        </h1>
        <p className="text-gray-500 mt-2">Send money anywhere. Instantly. Almost free.</p>
      </div>

      {/* Mode selection */}
      {!mode && (
        <div className="space-y-4">
          <button
            onClick={() => setMode('create')}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold text-lg shadow-md active:bg-brand-700 transition-colors"
          >
            Create New Wallet
          </button>
          <button
            onClick={() => setMode('import')}
            className="w-full py-4 bg-white text-gray-700 rounded-2xl font-semibold text-lg border-2 border-gray-200 active:bg-gray-50 transition-colors"
          >
            I Have a Wallet
          </button>
          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by the XRP Ledger — transactions settle in 3-5 seconds
          </p>
        </div>
      )}

      {/* Create form */}
      {mode === 'create' && (
        <div className="space-y-4">
          <button onClick={() => setMode(null)} className="text-sm text-gray-400 mb-2">← Back</button>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Choose a username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                placeholder="jayp"
                maxLength={20}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">3-20 characters. Letters, numbers, underscores.</p>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
          />
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Your local currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500 bg-white"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="INR">INR — Indian Rupee</option>
              <option value="EUR">EUR — Euro</option>
              <option value="NGN">NGN — Nigerian Naira</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={working || !username || username.length < 3}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold disabled:opacity-50"
          >
            {working ? 'Creating wallet (30-60s)...' : 'Create Wallet'}
          </button>
        </div>
      )}

      {/* Import form */}
      {mode === 'import' && (
        <div className="space-y-4">
          <button onClick={() => setMode(null)} className="text-sm text-gray-400 mb-2">← Back</button>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Wallet seed</label>
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="sEdXXXXXXXXXXXXXXXX..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Choose a username (if first time)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                placeholder="jayp"
                maxLength={20}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave blank if you already have an account.</p>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="EUR">EUR — Euro</option>
            <option value="NGN">NGN — Nigerian Naira</option>
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleImport}
            disabled={working || !seed}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold disabled:opacity-50"
          >
            {working ? 'Importing...' : 'Import Wallet'}
          </button>
        </div>
      )}
    </div>
  );
}
