// app/history/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function History() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [expanded, setExpanded] = useState(null); // tx hash of expanded item
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) { router.push('/'); return; }
    fetchHistory();
  }, [wallet, router]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history?address=${wallet.address}`);
      const data = await res.json();
      if (data.success) setTransactions(data.transactions);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  if (!wallet) return null;

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction History</h2>

      {loading && <p className="text-center text-gray-400 py-8 animate-pulse">Loading...</p>}

      {!loading && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">No transactions yet</p>
          <button
            onClick={() => router.push('/send')}
            className="text-brand-600 text-sm font-medium"
          >
            Send your first payment →
          </button>
        </div>
      )}

      <div className="space-y-3">
        {transactions.map((tx) => {
          const isSender = tx.sender === wallet.address;
          const isExpanded = expanded === tx.txHash;

          return (
            <div
              key={tx.txHash}
              className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
            >
              {/* Summary row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : tx.txHash)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${isSender ? 'text-red-400' : 'text-green-500'}`}>
                      {isSender ? '↗' : '↙'}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {isSender ? 'Sent' : 'Received'} {tx.currencyReceived}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isSender ? 'text-red-500' : 'text-green-600'}`}>
                      {isSender ? '-' : '+'}{isSender ? tx.amountSent : tx.amountReceived} {isSender ? tx.currencySent : tx.currencyReceived}
                    </p>
                  </div>
                </div>
              </button>

              {/* Expanded details (like test 4 output) */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Amount sent</span>
                    <span className="font-medium">{tx.amountSent} {tx.currencySent}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Amount received</span>
                    <span className="font-medium text-green-600">{tx.amountReceived} {tx.currencyReceived}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Effective rate</span>
                    <span>1 {tx.currencySent} = {tx.effectiveRate} {tx.currencyReceived}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">XRPL fee</span>
                    <span className="text-green-600">{tx.xrplFee} XRP (~$0.00)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Path</span>
                    <span>{tx.pathSource || 'auto'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Sender</span>
                    <span className="font-mono">{tx.sender?.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Receiver</span>
                    <span className="font-mono">{tx.receiver?.slice(0, 12)}...</span>
                  </div>

                  {/* Balance changes breakdown */}
                  {tx.balanceChanges && tx.balanceChanges.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-2">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Balance Changes:</p>
                      {tx.balanceChanges.map((change, i) => (
                        <div key={i}>
                          {change.balances.map((bal, j) => (
                            <div key={j} className="flex justify-between text-xs font-mono">
                              <span className="text-gray-400">{change.account?.slice(0, 8)}...</span>
                              <span className={parseFloat(bal.value) >= 0 ? 'text-green-600' : 'text-red-400'}>
                                {parseFloat(bal.value) >= 0 ? '+' : ''}{bal.value} {bal.currency === 'drops' ? 'XRP' : bal.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-brand-600 text-xs font-medium pt-2"
                  >
                    View on XRPL Explorer →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
