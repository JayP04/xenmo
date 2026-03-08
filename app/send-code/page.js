// app/send-code/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function SendCode() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [creating, setCreating] = useState(false);
  const [escrow, setEscrow] = useState(null); // { code, expiresAt, amount }
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!escrow) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(escrow.expiresAt) - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [escrow]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          amount,
          currency,
          recipientUsername: recipientUsername.trim() || undefined,
          cancelSeconds: 300,
        }),
      });
      const data = await res.json();
      if (data.success) setEscrow(data);
      else setError(data.error);
    } catch (e) { setError('Failed to create escrow'); }
    setCreating(false);
  };

  if (!wallet) { router.push('/'); return null; }

  // Show code screen
  if (escrow) {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    return (
      <div className="px-4 pt-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-xl font-bold text-gray-900">Share This Code</h2>
          <p className="text-sm text-gray-500 mt-1">
            {escrow.recipientUsername
              ? <>Code sent — it&apos;ll appear on <span className="font-semibold text-brand-600">@{escrow.recipientUsername}</span>&apos;s requests page</>
              : <>Recipient enters this at <span className="font-mono text-brand-600">/claim</span></>}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm text-center mb-4">
          <p className="text-5xl font-mono font-bold tracking-[0.3em] text-gray-900 mb-4">
            {escrow.code}
          </p>
          <p className="text-sm text-gray-400">
            {timeLeft > 0 ? (
              <>Expires in <span className="font-mono font-semibold text-brand-600">{mins}:{secs.toString().padStart(2, '0')}</span></>
            ) : (
              <span className="text-red-500 font-semibold">Expired — funds returned to you</span>
            )}
          </p>
          <p className="text-lg font-semibold mt-3">{escrow.displayAmount} {escrow.currency}</p>
        </div>

        <button
          onClick={() => { navigator.clipboard?.writeText(escrow.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium mb-3"
        >
          {copied ? '✓ Code Copied' : 'Copy Code'}
        </button>

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
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Send via Code</h2>
      <p className="text-sm text-gray-500 mb-6">
        Generate a secure code. If you specify a recipient, it&apos;ll show on their Requests page. Otherwise, share the code and they claim at /claim.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Recipient username (optional)</label>
          <input
            value={recipientUsername}
            onChange={(e) => setRecipientUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
            placeholder="e.g. jayp"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank to send to anyone with the code.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="NGN">NGN</option>
            </select>
          </div>
          <p className="text-xs text-gray-400 col-span-2">Funds locked for 5 minutes. Auto-refunded if unclaimed.</p>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating || !amount}
          className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold disabled:opacity-50"
        >
          {creating ? 'Creating escrow...' : 'Generate Code'}
        </button>
      </div>
    </div>
  );
}
