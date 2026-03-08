// app/send/page.js
'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';
import dynamic from 'next/dynamic';

const TransferGlobe = dynamic(() => import('../components/TransferGlobe'), { ssr: false });

const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', NGN: '₦' };

function SendInner() {
  const { wallet } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dest, setDest] = useState(searchParams.get('to') || '');
  const [resolvedUser, setResolvedUser] = useState(null);
  const [amount, setAmount] = useState(searchParams.get('amount') || '');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState(searchParams.get('currency') || 'INR');
  const [rate, setRate] = useState(null);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [globeDone, setGlobeDone] = useState(false);

  // Resolve @username to wallet address
  const resolveRecipient = async () => {
    const value = dest.trim();
    if (!value) return;
    if (!value.startsWith('r')) {
      const username = value.replace(/^@/, '');
      setLookingUp(true);
      try {
        const res = await fetch(`/api/user?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (data.success) {
          setResolvedUser(data.user);
          setDest(data.user.address);
          setError('');
        } else {
          setResolvedUser(null);
          setError(`User @${username} not found`);
        }
      } catch {
        setError('Lookup failed');
      }
      setLookingUp(false);
    } else {
      setResolvedUser(null);
    }
  };

  const checkRate = async () => {
    setError('');
    try {
      const res = await fetch(`/api/payment?from=${fromCurrency}&to=${toCurrency}&amount=${amount}&sender=${wallet.address}&receiver=${dest}`);
      const data = await res.json();
      if (data.success) setRate(data);
      else setError(data.error);
    } catch (e) { setError('Failed to get rate'); }
  };

  const handleSend = async () => {
    setSending(true);
    setShowGlobe(true);
    setGlobeDone(false);
    setError('');
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          destAddress: dest,
          amount: rate?.estimatedReceive || amount,
          destCurrency: toCurrency,
          sendMaxCurrency: fromCurrency,
          sendAmount: amount,
        }),
      });
      const data = await res.json();
      if (data.success) setReceipt(data);
      else { setError(data.error); setShowGlobe(false); }
    } catch (e) { setError('Payment failed'); setShowGlobe(false); }
    setSending(false);
  };

  if (!wallet) { router.push('/'); return null; }

  // Globe animation screen (shows during/after payment)
  if (showGlobe && !globeDone) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center" style={{ background: '#161618' }}>
        <div className="w-full h-[60vh]">
          <TransferGlobe
            fromCurrency={fromCurrency}
            toCurrency={toCurrency}
            onComplete={() => setTimeout(() => setGlobeDone(true), 1200)}
          />
        </div>
        <div className="text-center mt-4 animate-slide-up">
          <p className="text-[#8E8E93] text-sm mb-1">Sending money via XRPL</p>
          <p className="text-[#F5F5F7] text-2xl font-bold">{amount} {fromCurrency}</p>
          <p className="text-[#636366] text-xs mt-2">Settlement in ~3 seconds</p>
        </div>
      </div>
    );
  }

  // Receipt screen
  if (receipt && globeDone) {
    return (
      <div className="px-4 pt-6 animate-slide-up">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-[#F5F5F7]">Payment Sent!</h2>
        </div>
        <div className="card rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">You sent</span>
            <span className="font-semibold text-[#F5F5F7]">{receipt.amountSent} {receipt.currencySent}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">They received</span>
            <span className="font-semibold text-[#30D158]">{receipt.amountReceived} {receipt.currencyReceived}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Rate</span>
            <span className="text-[#F5F5F7]">1 {receipt.currencySent} = {receipt.effectiveRate} {receipt.currencyReceived}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Fee</span>
            <span className="text-[#30D158]">{receipt.fee}</span>
          </div>
          <div className="border-t border-[#2C2C2E] pt-3">
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[#0A84FF] text-sm font-medium"
            >
              View on XRPL Explorer →
            </a>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-6 py-3 rounded-xl font-semibold bg-[#0A84FF] text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-[#F5F5F7] mb-6">Send Money</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-[#8E8E93] mb-1 block">Recipient (@username or address)</label>
          <input
            value={resolvedUser ? `@${resolvedUser.username}` : dest}
            onChange={(e) => { setDest(e.target.value); setResolvedUser(null); setRate(null); }}
            onBlur={resolveRecipient}
            onKeyDown={(e) => e.key === 'Enter' && resolveRecipient()}
            placeholder="@jayp or rXXXXXXXXX..."
            className="w-full px-4 py-3 rounded-xl text-sm input-field"
          />
          {lookingUp && <p className="text-xs text-[#8E8E93] mt-1 animate-pulse">Looking up user...</p>}
          {resolvedUser && (
            <p className="text-xs text-[#30D158] mt-1">
              ✓ {resolvedUser.displayName || resolvedUser.username} — <span className="font-mono text-[#8E8E93]">{resolvedUser.address.slice(0, 12)}...</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-[#8E8E93] mb-1 block">You send</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setRate(null); }}
              placeholder="50.00"
              className="w-full px-4 py-3 rounded-xl input-field"
            />
          </div>
          <div>
            <label className="text-sm text-[#8E8E93] mb-1 block">Currency</label>
            <select
              value={fromCurrency}
              onChange={(e) => { setFromCurrency(e.target.value); setRate(null); }}
              className="w-full px-4 py-3 rounded-xl input-field"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="NGN">NGN</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-[#8E8E93] mb-1 block">They receive in</label>
          <select
            value={toCurrency}
            onChange={(e) => { setToCurrency(e.target.value); setRate(null); }}
            className="w-full px-4 py-3 rounded-xl input-field"
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
            <option value="EUR">EUR</option>
            <option value="NGN">NGN</option>
          </select>
        </div>

        {/* Rate preview */}
        {!rate && amount && dest && (
          <button
            onClick={checkRate}
            className="w-full py-3 rounded-xl font-semibold text-[#0A84FF] card"
          >
            Check Rate
          </button>
        )}

        {rate && (
          <div className="card rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#8E8E93]">They receive (est.)</span>
              <span className="font-bold text-lg text-[#F5F5F7]">~{parseFloat(rate.estimatedReceive).toFixed(2)} {toCurrency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8E8E93]">Rate</span>
              <span className="text-[#F5F5F7]">1 {fromCurrency} = {rate.rate.toFixed(2)} {toCurrency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8E8E93]">RemitX fee</span>
              <span className="font-medium text-[#30D158]">{rate.fee}</span>
            </div>
            <div className="border-t border-[#2C2C2E] pt-2 mt-2">
              <p className="text-xs text-[#8E8E93] font-medium mb-1">Fees to send {amount} {fromCurrency}:</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between text-[#8E8E93]"><span>Western Union</span><span className="text-[#FF453A]">~${rate.competitors.westernUnion.total} in fees</span></div>
                <div className="flex justify-between text-[#8E8E93]"><span>Wise</span><span className="text-[#FF9F0A]">~${rate.competitors.wise.total} in fees</span></div>
                <div className="flex justify-between text-[#8E8E93]"><span>Bank Wire</span><span className="text-[#FF453A]">~${rate.competitors.bankWire.total} in fees</span></div>
                <div className="flex justify-between font-semibold text-[#F5F5F7]"><span>RemitX</span><span className="text-[#30D158]">{CURRENCY_SYMBOLS[fromCurrency]}{rate.competitors.remitx.total} in fees</span></div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-[#FF453A] text-sm">{error}</p>}

        {rate && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full py-4 rounded-2xl font-semibold disabled:opacity-50 bg-[#0A84FF] text-white"
          >
            {sending ? 'Sending...' : `Send ${amount} ${fromCurrency}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Send() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-[#8E8E93]">Loading...</div>}>
      <SendInner />
    </Suspense>
  );
}
