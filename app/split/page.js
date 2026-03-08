// app/split/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Split() {
  const { wallet, loading } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !wallet) router.push('/');
  }, [loading, wallet, router]);

  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
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
        body: JSON.stringify({ senderSeed: wallet.seed, splits, currency }),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error);
    } catch {
      setError('Split payment failed');
    }
    setSending(false);
  };

  if (!wallet) return <div className="flex items-center justify-center h-screen text-[#8E8E93]">Loading...</div>;

  // Result screen
  if (result) {
    return (
      <div className="px-4 pt-6 pb-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-xl font-bold text-[#F5F5F7]">Split Created!</h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            {result.splitCount} escrows created · {result.totalAmount} {result.currency || 'USD'} total
          </p>
        </div>

        <div className="card rounded-xl p-3 mb-4">
          <p className="text-sm text-[#8E8E93] text-center">
            Share each code with the recipient. They&apos;ll see the split in their <strong className="text-[#0A84FF]">Requests → Splits</strong> tab and claim it with the code.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {result.splits.map((s, i) => (
            <div key={i} className="card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-[#F5F5F7]">@{s.username}</span>
                  {s.displayName && <span className="text-sm text-[#8E8E93] ml-2">{s.displayName}</span>}
                </div>
                <span className="font-bold text-[#F5F5F7]">{s.amount} {result.currency || 'USD'}</span>
              </div>
              <div className="card-elevated rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#8E8E93] mb-0.5">Their claim code</p>
                  <code className="text-xl font-mono font-bold tracking-[0.25em] text-[#F5F5F7]">{s.code}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(s.code)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[#0A84FF] text-white"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#636366] text-center mb-4">
          Unclaimed splits auto-refund to you in 10 minutes.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 rounded-xl font-semibold bg-[#0A84FF] text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h2 className="text-xl font-bold text-[#F5F5F7] mb-1">Split Payment</h2>
      <p className="text-sm text-[#8E8E93] mb-6">
        Split money between multiple people. Each gets a claim code.
      </p>

      {/* Split mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setSplitMode('equal')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${splitMode === 'equal' ? 'bg-[#0A84FF] text-white' : 'card text-[#8E8E93]'}`}
        >
          Equal Split
        </button>
        <button
          onClick={() => setSplitMode('custom')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${splitMode === 'custom' ? 'bg-[#0A84FF] text-white' : 'card text-[#8E8E93]'}`}
        >
          Custom Amounts
        </button>
      </div>

      {/* Total amount (only for equal mode) */}
      {splitMode === 'equal' && (
        <div className="mb-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-sm text-[#8E8E93] mb-1 block">Total Amount</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="100"
                className="input-field w-full px-4 py-3 rounded-xl text-lg"
              />
            </div>
            <div>
              <label className="text-sm text-[#8E8E93] mb-1 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field w-full px-4 py-3 rounded-xl text-lg"
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
                <option value="NGN">NGN</option>
              </select>
            </div>
          </div>
          {equalAmount && recipients.length > 0 && (
            <p className="text-xs text-[#636366] mt-1">
              = {equalAmount} {currency} each × {recipients.length} {recipients.length === 1 ? 'person' : 'people'}
            </p>
          )}
        </div>
      )}

      {/* Currency selector for custom mode */}
      {splitMode === 'custom' && (
        <div className="mb-5">
          <label className="text-sm text-[#8E8E93] mb-1 block">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-field w-full px-4 py-3 rounded-xl"
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
            <option value="NGN">NGN</option>
          </select>
        </div>
      )}

      {/* Recipients */}
      <div className="space-y-3 mb-4">
        <label className="text-sm text-[#8E8E93] block">Recipients</label>
        {recipients.map((r, i) => (
          <div key={i} className="card rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636366] text-sm">@</span>
                <input
                  value={r.username}
                  onChange={(e) => updateRecipient(i, 'username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  onBlur={() => lookupUser(i)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupUser(i)}
                  placeholder="username"
                  className="input-field w-full pl-8 pr-3 py-2 rounded-lg text-sm"
                />
              </div>
              {splitMode === 'custom' && (
                <input
                  type="number"
                  value={r.amount}
                  onChange={(e) => updateRecipient(i, 'amount', e.target.value)}
                  placeholder={currency}
                  className="input-field w-24 px-3 py-2 rounded-lg text-sm"
                />
              )}
              {recipients.length > 1 && (
                <button onClick={() => removeRecipient(i)} className="text-[#636366] hover:text-[#FF453A] text-lg px-1">×</button>
              )}
            </div>

            {/* Status */}
            {lookingUp[i] && (
              <p className="text-xs text-[#636366] animate-pulse">Looking up...</p>
            )}
            {r.resolved && (
              <div className="flex items-center gap-2 text-xs text-[#30D158]">
                <span>✓</span>
                <span>{r.resolved.displayName || r.resolved.username}</span>
                <span className="text-[#636366]">·</span>
                <span className="text-[#636366] font-mono">{r.resolved.address.slice(0, 8)}...</span>
                <span className="text-[#636366]">·</span>
                <span className="text-[#636366]">{r.resolved.baseCurrency}</span>
              </div>
            )}
            {r.error && (
              <p className="text-xs text-[#FF453A]">{r.error}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addRecipient}
        disabled={recipients.length >= 10}
        className="w-full py-2 border-2 border-dashed border-[#2C2C2E] rounded-xl text-sm font-medium mb-5 disabled:opacity-30 text-[#8E8E93]"
      >
        + Add Recipient {recipients.length >= 10 && '(max 10)'}
      </button>

      {/* Summary */}
      {parseFloat(computedTotal) > 0 && allResolved && (
        <div className="card rounded-xl p-4 mb-5">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#8E8E93]">Total</span>
            <span className="font-bold text-[#F5F5F7]">{computedTotal} {currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Recipients</span>
            <span className="text-[#F5F5F7]">{recipients.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Each gets</span>
            <span className="text-[#F5F5F7]">{splitMode === 'equal' ? equalAmount : 'Custom'} {currency}</span>
          </div>
          <p className="text-xs text-[#636366] mt-2">
            Each person gets a 6-digit claim code. Unclaimed funds auto-refund in 10 min.
          </p>
        </div>
      )}

      {error && <p className="text-[#FF453A] text-sm mb-3">{error}</p>}

      <button
        onClick={handleSplit}
        disabled={!canSend}
        className="w-full py-4 rounded-2xl font-semibold bg-[#0A84FF] text-white disabled:opacity-50"
      >
        {sending ? 'Creating escrows...' : `Split ${computedTotal || '0'} ${currency}`}
      </button>
    </div>
  );
}