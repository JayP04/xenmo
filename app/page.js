// app/page.js
'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from './components/WalletProvider';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('./components/Globe'), { ssr: false });

// Floating transfer card component
function TransferCard({ transfer, index }) {
  const positions = useMemo(() => [
    'top-20 left-3', 'top-36 right-3', 'top-52 left-4',
    'top-16 right-5', 'top-44 left-2', 'top-28 right-4',
  ], []);
  const pos = positions[index % positions.length];

  return (
    <div
      className={`absolute ${pos} animate-fade-in-out pointer-events-none z-10`}
      style={{ animationDelay: `${index * 0.2}s` }}
    >
      <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl px-3 py-2 shadow-lg max-w-[180px]">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]" />
          <span className="text-[10px] text-[#8E8E93] truncate">{transfer.from}</span>
          <span className="text-[10px] text-[#8E8E93]">→</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A]" />
          <span className="text-[10px] text-[#8E8E93] truncate">{transfer.to}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-[#F5F5F7]">{transfer.amt}</span>
          <span className="text-[9px] text-[#30D158] ml-2">{transfer.cur}</span>
        </div>
        <div className="text-[8px] text-[#636366] mt-0.5">via XRPL • 3s settlement</div>
      </div>
    </div>
  );
}

// Stars background
function Stars() {
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      size: Math.random() * 2 + 0.5,
      left: Math.random() * 100,
      top: Math.random() * 100,
      dur: Math.random() * 3 + 2,
      opacity: Math.random() * 0.5 + 0.3,
      delay: Math.random() * 3,
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            width: s.size, height: s.size,
            left: `${s.left}%`, top: `${s.top}%`,
            '--tw-dur': `${s.dur}s`, '--tw-opacity': s.opacity,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

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
  const [createdSeed, setCreatedSeed] = useState('');
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    if (!loading && wallet) router.push('/dashboard');
  }, [loading, wallet, router]);

  const handleTransfer = useCallback((t) => {
    setTransfers(prev => {
      const next = [...prev, t];
      return next.length > 4 ? next.slice(-4) : next;
    });
    // Auto-remove after 8s
    setTimeout(() => {
      setTransfers(prev => prev.filter(x => x.id !== t.id));
    }, 8000);
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#161618]">
        <div className="w-10 h-10 border-3 border-[#2C2C2E] border-t-[#0A84FF] rounded-full animate-spin" />
      </div>
    );
  }

  // Seed backup screen
  if (createdSeed) {
    return (
      <div className="min-h-screen bg-[#161618] relative overflow-hidden">
        <Stars />
        <div className="relative z-10 px-6 pt-16 max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🔐</div>
            <h2 className="text-xl font-bold text-[#F5F5F7]">Save Your Wallet Seed</h2>
            <p className="text-sm text-[#8E8E93] mt-2">
              This is the ONLY way to recover your wallet. Save it somewhere safe.
            </p>
          </div>
          <div className="card rounded-xl p-4 mb-6">
            <code className="text-sm text-[#0A84FF] break-all select-all font-mono">{createdSeed}</code>
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(createdSeed); }}
            className="w-full py-3 card text-[#8E8E93] rounded-xl text-sm font-medium mb-3"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-[#0A84FF] text-white rounded-xl font-bold active:opacity-90"
          >
            I Saved It — Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#161618] overflow-hidden">
      <Stars />

      {/* Globe background */}
      <Globe onTransfer={handleTransfer} />

      {/* Floating transfer cards */}
      {transfers.map((t, i) => (
        <TransferCard key={t.id} transfer={t} index={i} />
      ))}

      {/* Content overlay */}
      <div className="relative z-20 flex flex-col h-full">
        {/* Header */}
        <div className="text-center pt-12 pb-2 flex-shrink-0">
          <h1 className="text-4xl font-bold">
            <span className="text-[#F5F5F7]">
              Remit
            </span>
            <span className="text-[#0A84FF]">X</span>
          </h1>
          <p className="text-[#8E8E93] text-sm mt-1">Send money anywhere. Instantly. Almost free.</p>
        </div>

        {/* Spacer to push panel to bottom */}
        <div className="flex-1" />

        {/* Bottom panel */}
        <div className="bg-[#1C1C1E] border-t border-[#2C2C2E] px-5 pt-5 pb-8 rounded-t-3xl flex-shrink-0">
          {/* Mode selection */}
          {!mode && (
            <div className="space-y-3 max-w-sm mx-auto">
              {/* Live stats bar */}
              <div className="flex justify-center gap-6 mb-4">
                <div className="text-center">
                  <div className="text-[#F5F5F7] text-lg font-bold">3-5s</div>
                  <div className="text-[#636366] text-[10px] uppercase tracking-wider">Settlement</div>
                </div>
                <div className="w-px bg-[#2C2C2E]" />
                <div className="text-center">
                  <div className="text-[#30D158] text-lg font-bold">&lt;$0.01</div>
                  <div className="text-[#636366] text-[10px] uppercase tracking-wider">Fee</div>
                </div>
                <div className="w-px bg-[#2C2C2E]" />
                <div className="text-center">
                  <div className="text-[#0A84FF] text-lg font-bold">24/7</div>
                  <div className="text-[#636366] text-[10px] uppercase tracking-wider">Uptime</div>
                </div>
              </div>

              <button
                onClick={() => setMode('create')}
                className="w-full py-3.5 bg-[#0A84FF] text-white rounded-xl font-bold text-base active:scale-[0.98] transition-transform"
              >
                Create New Wallet
              </button>
              <button
                onClick={() => setMode('import')}
                className="w-full py-3.5 card text-[#F5F5F7] rounded-xl font-semibold text-base active:opacity-80 transition-colors"
              >
                I Have a Wallet
              </button>
              <p className="text-center text-[10px] text-[#636366] mt-3">
                Powered by the XRP Ledger
              </p>
            </div>
          )}

          {/* Create form */}
          {mode === 'create' && (
            <div className="space-y-3 max-w-sm mx-auto">
              <button onClick={() => setMode(null)} className="text-sm text-[#0A84FF] mb-1">← Back</button>
              <div>
                <label className="text-xs text-[#8E8E93] mb-1 block uppercase tracking-wider">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636366]">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                    placeholder="jayp"
                    maxLength={20}
                    className="input-field w-full pl-8 pr-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="input-field w-full px-3 py-2.5 rounded-lg text-sm"
              />
              <div>
                <label className="text-xs text-[#8E8E93] mb-1 block uppercase tracking-wider">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input-field w-full px-3 py-2.5 rounded-lg text-sm"
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="NGN">NGN — Nigerian Naira</option>
                </select>
              </div>
              {error && <p className="text-[#FF453A] text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={working || !username || username.length < 3}
                className="w-full py-3 bg-[#0A84FF] text-white rounded-xl font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {working ? 'Creating wallet (30-60s)...' : 'Create Wallet'}
              </button>
            </div>
          )}

          {/* Import form */}
          {mode === 'import' && (
            <div className="space-y-3 max-w-sm mx-auto">
              <button onClick={() => setMode(null)} className="text-sm text-[#0A84FF] mb-1">← Back</button>
              <div>
                <label className="text-xs text-[#8E8E93] mb-1 block uppercase tracking-wider">Wallet Seed</label>
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="sEdXXXXXXXXXXXXXXXX..."
                  className="input-field w-full px-3 py-2.5 rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#8E8E93] mb-1 block uppercase tracking-wider">Username (if first time)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636366]">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                    placeholder="jayp"
                    maxLength={20}
                    className="input-field w-full pl-8 pr-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field w-full px-3 py-2.5 rounded-lg text-sm"
              >
                <option value="USD">USD — US Dollar</option>
                <option value="INR">INR — Indian Rupee</option>
                <option value="EUR">EUR — Euro</option>
                <option value="NGN">NGN — Nigerian Naira</option>
              </select>
              {error && <p className="text-[#FF453A] text-sm">{error}</p>}
              <button
                onClick={handleImport}
                disabled={working || !seed}
                className="w-full py-3 bg-[#0A84FF] text-white rounded-xl font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
              >
                {working ? 'Importing...' : 'Import Wallet'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
