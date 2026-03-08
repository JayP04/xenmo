// app/send-code/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function SendCode() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [xrpAmount, setXrpAmount] = useState('');
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
          xrpAmount,
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
          <h2 className="text-xl font-bold text-[#F5F5F7]">Share This Code</h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            {escrow.recipientUsername
              ? <>Code sent — it&apos;ll appear on <span className="font-semibold text-[#0A84FF]">@{escrow.recipientUsername}</span>&apos;s requests page</>
              : <>Recipient enters this at <span className="font-mono text-[#0A84FF]">/claim</span></>}
          </p>
        </div>

        <div className="card rounded-2xl p-8 text-center mb-4">
          <p className="text-5xl font-mono font-bold tracking-[0.3em] text-[#F5F5F7] mb-4">
            {escrow.code}
          </p>
          <p className="text-sm text-[#8E8E93]">
            {timeLeft > 0 ? (
              <>Expires in <span className="font-mono font-semibold text-[#0A84FF]">{mins}:{secs.toString().padStart(2, '0')}</span></>
            ) : (
              <span className="text-[#FF453A] font-semibold">Expired — funds returned to you</span>
            )}
          </p>
          <p className="text-lg font-semibold mt-3 text-[#F5F5F7]">{escrow.amount} XRP</p>
        </div>

        <button
          onClick={() => { navigator.clipboard?.writeText(escrow.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="w-full py-3 rounded-xl text-sm font-medium mb-3 text-[#8E8E93] card"
        >
          {copied ? '✓ Code Copied' : 'Copy Code'}
        </button>

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
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-[#F5F5F7] mb-2">Send via Code</h2>
      <p className="text-sm text-[#8E8E93] mb-6">
        Generate a secure code. If you specify a recipient, it&apos;ll show on their Requests page. Otherwise, share the code and they claim at /claim.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-[#8E8E93] mb-1 block">Recipient username (optional)</label>
          <input
            value={recipientUsername}
            onChange={(e) => setRecipientUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
            placeholder="e.g. jayp"
            className="w-full px-4 py-3 rounded-xl text-sm input-field"
          />
          <p className="text-xs text-[#636366] mt-1">Leave blank to send to anyone with the code.</p>
        </div>
        <div>
          <label className="text-sm text-[#8E8E93] mb-1 block">Amount (XRP)</label>
          <input
            type="number"
            value={xrpAmount}
            onChange={(e) => setXrpAmount(e.target.value)}
            placeholder="25"
            className="w-full px-4 py-3 rounded-xl input-field"
          />
          <p className="text-xs text-[#636366] mt-1">Escrow locks XRP for 5 minutes. Auto-refunded if unclaimed.</p>
        </div>

        {error && <p className="text-[#FF453A] text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating || !xrpAmount}
          className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50 bg-[#0A84FF] text-white"
        >
          {creating ? 'Creating escrow...' : 'Generate Code'}
        </button>
      </div>
    </div>
  );
}
