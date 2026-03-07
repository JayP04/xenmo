// app/split/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Split() {
  const { wallet, loading } = useWallet();
  const router = useRouter();

  const [totalAmount, setTotalAmount] = useState('');
  const [recipients, setRecipients] = useState([{ username: '', amount: '', resolved: null, error: '' }]);
  const [splitMode, setSplitMode] = useState('equal'); // 'equal' | 'custom'
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState({});

  // Lookup a username
  const lookupUser = async (index) => {
    const username = recipients[index].username.trim().replace(/^@/, '');
    if (!username || username.length < 3) return;

    setLookingUp((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/user?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      const updated = [...recipients];
      if (data.success) {
        updated[index].resolved = data.user;
        updated[index].error = '';
        updated[index].username = data.user.username;
      } else {
        updated[index].resolved = null;
        updated[index].error = 'User not found';
      }
      setRecipients(updated);
    } catch {
      const updated = [...recipients];
      updated[index].error = 'Lookup failed';
      setRecipients(updated);
    }
    setLookingUp((prev) => ({ ...prev, [index]: false }));
  };

  const addRecipient = () => {
    if (recipients.length >= 10) return;
    setRecipients([...recipients, { username: '', amount: '', resolved: null, error: '' }]);
  };

  const removeRecipient = (index) => {
    if (recipients.length <= 1) return;
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index, field, value) => {
    const updated = [...recipients];
    updated[index][field] = value;
    if (field === 'username') {
      updated[index].resolved = null;
      updated[index].error = '';
    }
    setRecipients(updated);
  };

  // Auto-calculate equal splits
  const equalAmount = totalAmount && recipients.length > 0
    ? (parseFloat(totalAmount) / recipients.length).toFixed(2)
    : '';

  const computedTotal = splitMode === 'equal'
    ? totalAmount
    : recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toFixed(2);

  const allResolved = recipients.every((r) => r.resolved);
  const canSend = allResolved && parseFloat(computedTotal) > 0 && !sending;

  const handleSplit = async () => {
    setSending(true);
    setError('');
    try {
      const splits = recipients.map((r) => ({
        username: r.username,
        amount: splitMode === 'equal' ? equalAmount : r.amount,
      }));

      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderSeed: wallet.seed, splits }),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error);
    } catch {
      setError('Split payment failed');
    }
    setSending(false);
  };

  if (!wallet) { if (!loading) router.push('/'); return null; }

  // Result screen
  if (result) {
    return (
      <div className="px-4 pt-6 pb-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Split Created!</h2>
          <p className="text-sm text-gray-500 mt-1">
            {result.splitCount} escrows locked on-chain · {result.totalAmount} XRP total
          </p>
        </div>

        <div className="bg-brand-50 rounded-xl p-3 mb-4">
          <p className="text-sm text-brand-800 text-center">
            Share each code with the recipient. They&apos;ll see the split in their <strong>Requests → Splits</strong> tab and claim it with the code.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {result.splits.map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900">@{s.username}</span>
                  {s.displayName && <span className="text-sm text-gray-400 ml-2">{s.displayName}</span>}
                </div>
                <span className="font-bold text-brand-600">{s.amount} XRP</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Their claim code</p>
                  <code className="text-xl font-mono font-bold tracking-[0.25em] text-gray-900">{s.code}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(s.code)}
                  className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          Unclaimed splits auto-refund to you in 10 minutes.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Split Payment</h2>
      <p className="text-sm text-gray-500 mb-6">
        Split XRP between multiple people. Each gets a claim code.
      </p>

      {/* Split mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setSplitMode('equal')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${splitMode === 'equal' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Equal Split
        </button>
        <button
          onClick={() => setSplitMode('custom')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${splitMode === 'custom' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Custom Amounts
        </button>
      </div>

      {/* Total amount (only for equal mode) */}
      {splitMode === 'equal' && (
        <div className="mb-5">
          <label className="text-sm text-gray-500 mb-1 block">Total Amount (XRP)</label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="100"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500 text-lg"
          />
          {equalAmount && recipients.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              = {equalAmount} XRP each × {recipients.length} {recipients.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </div>
      )}

      {/* Recipients */}
      <div className="space-y-3 mb-4">
        <label className="text-sm text-gray-500 block">Recipients</label>
        {recipients.map((r, i) => (
          <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input
                  value={r.username}
                  onChange={(e) => updateRecipient(i, 'username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  onBlur={() => lookupUser(i)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupUser(i)}
                  placeholder="username"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              {splitMode === 'custom' && (
                <input
                  type="number"
                  value={r.amount}
                  onChange={(e) => updateRecipient(i, 'amount', e.target.value)}
                  placeholder="XRP"
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                />
              )}
              {recipients.length > 1 && (
                <button onClick={() => removeRecipient(i)} className="text-gray-300 hover:text-red-400 text-lg px-1">×</button>
              )}
            </div>

            {/* Status */}
            {lookingUp[i] && (
              <p className="text-xs text-gray-400 animate-pulse">Looking up...</p>
            )}
            {r.resolved && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <span>✓</span>
                <span>{r.resolved.displayName || r.resolved.username}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400 font-mono">{r.resolved.address.slice(0, 8)}...</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400">{r.resolved.baseCurrency}</span>
              </div>
            )}
            {r.error && (
              <p className="text-xs text-red-500">{r.error}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addRecipient}
        disabled={recipients.length >= 10}
        className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 font-medium mb-5 disabled:opacity-30"
      >
        + Add Recipient {recipients.length >= 10 && '(max 10)'}
      </button>

      {/* Summary */}
      {parseFloat(computedTotal) > 0 && allResolved && (
        <div className="bg-brand-50 rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total</span>
            <span className="font-bold text-brand-700">{computedTotal} XRP</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Recipients</span>
            <span>{recipients.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Each gets</span>
            <span>{splitMode === 'equal' ? equalAmount : 'Custom'} XRP</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Escrow locks funds on-chain. Each person gets a 6-digit claim code. Unclaimed funds auto-refund in 10 min.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        onClick={handleSplit}
        disabled={!canSend}
        className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold disabled:opacity-50"
      >
        {sending ? 'Creating escrows...' : `Split ${computedTotal || '0'} XRP`}
      </button>
    </div>
  );
}
