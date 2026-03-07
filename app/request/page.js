// app/request/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Request() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [tab, setTab] = useState('splits'); // 'splits' | 'incoming' | 'create'
  const [requests, setRequests] = useState([]);
  const [splits, setSplits] = useState([]);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Inline claim state
  const [claimingId, setClaimingId] = useState(null);
  const [claimCode, setClaimCode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState(null); // { id, amount, explorerUrl }

  const fetchRequests = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/request?address=${wallet.address}`);
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch (e) { /* ignore */ }
  }, [wallet]);

  const fetchSplits = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/split?address=${wallet.address}`);
      const data = await res.json();
      if (data.success) setSplits(data.splits);
    } catch (e) { /* ignore */ }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) { router.push('/'); return; }
    fetchRequests();
    fetchSplits();
  }, [wallet, router, fetchRequests, fetchSplits]);

  const createRequest = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: wallet.address,
          toAddress,
          amount,
          currency,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToAddress('');
        setAmount('');
        setTab('incoming');
        fetchRequests();
      } else setError(data.error);
    } catch (e) { setError('Failed to create request'); }
    setSending(false);
  };

  const approveRequest = async (req) => {
    setSending(true);
    try {
      const payRes = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          destAddress: req.fromAddress,
          amount: req.amount,
          destCurrency: req.currency,
          sendMaxCurrency: req.currency,
        }),
      });
      const payData = await payRes.json();

      await fetch('/api/request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          action: payData.success ? 'approved' : 'declined',
          txHash: payData.hash,
        }),
      });
      fetchRequests();
    } catch (e) { setError('Failed to process request'); }
    setSending(false);
  };

  const declineRequest = async (req) => {
    await fetch('/api/request', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: req.id, action: 'declined' }),
    });
    fetchRequests();
  };

  const handleClaim = async (split) => {
    setClaimError('');
    setSending(true);
    try {
      const res = await fetch('/api/split', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escrowId: split.id,
          code: claimCode,
          claimerSeed: wallet.seed,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClaimSuccess({ id: split.id, amount: data.amount, explorerUrl: data.explorerUrl });
        setClaimingId(null);
        setClaimCode('');
        fetchSplits();
      } else {
        setClaimError(data.error || 'Claim failed');
      }
    } catch (e) {
      setClaimError('Claim failed');
    }
    setSending(false);
  };

  if (!wallet) return null;

  const incoming = requests.filter((r) => r.toAddress === wallet.address && r.status === 'pending');
  const pendingSplits = splits.filter((s) => s.status === 'pending');
  const pastSplits = splits.filter((s) => s.status !== 'pending');

  const splitsBadge = pendingSplits.length;

  return (
    <div className="px-4 pt-6 pb-24">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Requests</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('splits')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium relative ${tab === 'splits' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Splits
          {splitsBadge > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${tab === 'splits' ? 'bg-white text-brand-600' : 'bg-brand-600 text-white'}`}>
              {splitsBadge}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('incoming')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'incoming' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Incoming ({incoming.length})
        </button>
        <button
          onClick={() => setTab('create')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'create' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Request
        </button>
      </div>

      {/* ───── SPLITS TAB ───── */}
      {tab === 'splits' && (
        <div className="space-y-3">
          {pendingSplits.length === 0 && pastSplits.length === 0 && (
            <p className="text-center text-gray-400 py-8">No split payments yet</p>
          )}

          {/* Claim success banner */}
          {claimSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎉</span>
                <span className="font-semibold text-green-700">{claimSuccess.amount} XRP claimed!</span>
              </div>
              <a
                href={claimSuccess.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 font-medium"
              >
                View on XRPL Explorer →
              </a>
              <button onClick={() => setClaimSuccess(null)} className="block text-xs text-gray-400 mt-1">Dismiss</button>
            </div>
          )}

          {/* Pending splits */}
          {pendingSplits.length > 0 && (
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Pending</p>
          )}
          {pendingSplits.map((split) => {
            const expired = new Date() > new Date(split.expiresAt);
            const isClaiming = claimingId === split.id;
            const timeLeft = Math.max(0, Math.floor((new Date(split.expiresAt) - Date.now()) / 1000));
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;

            return (
              <div key={split.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Split from <span className="text-brand-600">@{split.senderUsername}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {expired
                        ? <span className="text-red-500">Expired — funds returned to sender</span>
                        : <>Expires in <span className="font-mono font-semibold text-brand-600">{mins}:{secs.toString().padStart(2, '0')}</span></>
                      }
                    </p>
                  </div>
                  <p className="font-bold text-lg text-gray-900">{split.amount} <span className="text-sm text-gray-400">XRP</span></p>
                </div>

                {!isClaiming && !expired && (
                  <button
                    onClick={() => { setClaimingId(split.id); setClaimCode(''); setClaimError(''); }}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold"
                  >
                    Claim
                  </button>
                )}

                {isClaiming && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">Enter the 6-digit code from the sender:</p>
                    <input
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-center text-2xl font-mono tracking-[0.3em] focus:outline-none focus:border-brand-500"
                      autoFocus
                    />
                    {claimError && <p className="text-xs text-red-500">{claimError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleClaim(split)}
                        disabled={sending || claimCode.length !== 6}
                        className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        {sending ? 'Claiming...' : 'Confirm & Claim'}
                      </button>
                      <button
                        onClick={() => { setClaimingId(null); setClaimCode(''); setClaimError(''); }}
                        className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Past splits */}
          {pastSplits.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-4">History</p>
              {pastSplits.map((split) => (
                <div key={split.id} className="bg-gray-50 rounded-xl p-4 opacity-70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        From <span className="font-medium">@{split.senderUsername}</span>
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{split.status}</p>
                    </div>
                    <p className="font-semibold text-gray-600">{split.amount} XRP</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ───── INCOMING TAB ───── */}
      {tab === 'incoming' && (
        <div className="space-y-3">
          {incoming.length === 0 && (
            <p className="text-center text-gray-400 py-8">No pending requests</p>
          )}
          {incoming.map((req) => (
            <div key={req.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-mono text-gray-500">{req.fromAddress.slice(0, 12)}...</p>
                <p className="font-bold text-gray-900">{req.amount} {req.currency}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => approveRequest(req)}
                  disabled={sending}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Approve & Pay
                </button>
                <button
                  onClick={() => declineRequest(req)}
                  className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-semibold"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ───── CREATE TAB ───── */}
      {tab === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Request from (their address)</label>
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="rXXXXXXXXX..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-500"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl bg-white"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="NGN">NGN</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={createRequest}
            disabled={sending || !toAddress || !amount}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      )}
    </div>
  );
}
