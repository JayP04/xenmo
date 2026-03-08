// app/send/page.js
'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

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

  // Resolve @username to wallet address
  const resolveRecipient = async () => {
    const value = dest.trim();
    if (!value) return;
    // If it looks like a username (not starting with r), look it up
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
      else setError(data.error);
    } catch (e) { setError('Payment failed'); }
    setSending(false);
  };

  if (!wallet) { router.push('/'); return null; }

  // Receipt screen
  if (receipt) {
    return (
      <div className="px-4 pt-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Payment Sent!</h2>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You sent</span>
            <span className="font-semibold">{receipt.amountSent} {receipt.currencySent}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">They received</span>
            <span className="font-semibold text-green-600">{receipt.amountReceived} {receipt.currencyReceived}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Rate</span>
            <span>1 {receipt.currencySent} = {receipt.effectiveRate} {receipt.currencyReceived}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Fee</span>
            <span className="text-green-600">{receipt.fee}</span>
          </div>
          <hr />
          <a
            href={receipt.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-brand-600 text-sm font-medium"
          >
            View on XRPL Explorer →
          </a>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-6 py-3 bg-brand-600 text-white rounded-xl font-semibold"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Send Money</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Recipient (@username or address)</label>
          <input
            value={resolvedUser ? `@${resolvedUser.username}` : dest}
            onChange={(e) => { setDest(e.target.value); setResolvedUser(null); setRate(null); }}
            onBlur={resolveRecipient}
            onKeyDown={(e) => e.key === 'Enter' && resolveRecipient()}
            placeholder="@jayp or rXXXXXXXXX..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
          />
          {lookingUp && <p className="text-xs text-gray-400 mt-1 animate-pulse">Looking up user...</p>}
          {resolvedUser && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {resolvedUser.displayName || resolvedUser.username} — <span className="font-mono text-gray-400">{resolvedUser.address.slice(0, 12)}...</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">You send</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setRate(null); }}
              placeholder="50.00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Currency</label>
            <select
              value={fromCurrency}
              onChange={(e) => { setFromCurrency(e.target.value); setRate(null); }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="NGN">NGN</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">They receive in</label>
          <select
            value={toCurrency}
            onChange={(e) => { setToCurrency(e.target.value); setRate(null); }}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white"
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
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold"
          >
            Check Rate
          </button>
        )}

        {rate && (
          <div className="bg-brand-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">They receive (est.)</span>
              <span className="font-bold text-lg text-brand-700">~{parseFloat(rate.estimatedReceive).toFixed(2)} {toCurrency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Rate</span>
              <span>1 {fromCurrency} = {rate.rate.toFixed(2)} {toCurrency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">RemitX fee</span>
              <span className="font-medium">{rate.fee}</span>
            </div>
            <hr className="border-brand-200" />
            <p className="text-xs text-gray-500 font-medium">Fees to send {amount} {fromCurrency}:</p>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span>Western Union</span><span className="text-red-500">~${rate.competitors.westernUnion.total} in fees</span></div>
              <div className="flex justify-between"><span>Wise</span><span className="text-orange-500">~${rate.competitors.wise.total} in fees</span></div>
              <div className="flex justify-between"><span>Bank Wire</span><span className="text-red-500">~${rate.competitors.bankWire.total} in fees</span></div>
              <div className="flex justify-between font-semibold"><span>RemitX</span><span className="text-green-600">{CURRENCY_SYMBOLS[fromCurrency]}{rate.competitors.remitx.total} in fees</span></div>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {rate && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-semibold disabled:opacity-50"
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>}>
      <SendInner />
    </Suspense>
  );
}
