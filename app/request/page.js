// app/request/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Request() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [tab, setTab] = useState('incoming'); // 'incoming' | 'create'
  const [requests, setRequests] = useState([]);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/request?address=${wallet.address}`);
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch (e) { /* ignore */ }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) { router.push('/'); return; }
    fetchRequests();
  }, [wallet, router, fetchRequests]);

  const createRequest = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: wallet.address, // I'm requesting
          toAddress,                   // from this person
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
      // First, execute the payment
      const payRes = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          destAddress: req.fromAddress,
          amount: req.amount,
          destCurrency: req.currency,
          sendMaxCurrency: req.currency, // same currency for simplicity
        }),
      });
      const payData = await payRes.json();

      // Then update the request status
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

  if (!wallet) return null;

  const incoming = requests.filter((r) => r.toAddress === wallet.address && r.status === 'pending');
  const outgoing = requests.filter((r) => r.fromAddress === wallet.address);

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Requests</h2>

      <div className="flex gap-2 mb-6">
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
          Request Money
        </button>
      </div>

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
