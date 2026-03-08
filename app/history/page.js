// app/history/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';
import dynamic from 'next/dynamic';

const TransferGlobe = dynamic(() => import('../components/TransferGlobe'), { ssr: false });

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
      <h2 className="text-xl font-bold text-[#F5F5F7] mb-4">Transaction History</h2>

      {loading && <p className="text-center text-[#8E8E93] py-8 animate-pulse">Loading...</p>}

      {!loading && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[#8E8E93] mb-2">No transactions yet</p>
          <button
            onClick={() => router.push('/send')}
            className="text-[#0A84FF] text-sm font-medium"
          >
            Send your first payment →
          </button>
        </div>
      )}

      <div className="space-y-3">
        {transactions.map((tx) => {
          const isSender = tx.sender === wallet.address;
          const isExpanded = expanded === tx.txHash;

          const isEscrow = tx.type === 'EscrowCreate' || tx.type === 'EscrowFinish';
          let label, icon, colorClass, accentColor;
          if (tx.type === 'EscrowCreate') {
            label = isSender ? 'Split Locked' : 'Split Pending';
            icon = '🔒';
            colorClass = 'text-[#FF9F0A]';
            accentColor = '#FF9F0A';
          } else if (tx.type === 'EscrowFinish') {
            label = isSender ? 'Split Released' : 'Split Claimed';
            icon = isSender ? '↗' : '↙';
            colorClass = isSender ? 'text-[#FF453A]' : 'text-[#30D158]';
            accentColor = isSender ? '#FF453A' : '#30D158';
          } else {
            label = isSender ? 'Sent' : 'Received';
            icon = isSender ? '↗' : '↙';
            colorClass = isSender ? 'text-[#FF453A]' : 'text-[#30D158]';
            accentColor = isSender ? '#FF453A' : '#30D158';
          }
          const displayAmount = isEscrow
            ? tx.amountReceived
            : (isSender ? tx.amountSent : tx.amountReceived);
          const displayCurrency = isEscrow
            ? tx.currencyReceived
            : (isSender ? tx.currencySent : tx.currencyReceived);
          const sign = (tx.type === 'EscrowCreate' && isSender) ? '-'
            : (tx.type === 'EscrowFinish' && isSender) ? '-'
            : (isSender && !isEscrow) ? '-' : '+';

          return (
            <div
              key={tx.txHash}
              className="card rounded-xl overflow-hidden"
            >
              {/* Summary row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : tx.txHash)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${colorClass}`}>
                      {icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#F5F5F7]">
                        {label} {displayCurrency}
                      </p>
                      <p className="text-xs text-[#8E8E93]">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${colorClass}`}>
                      {sign}{parseFloat(displayAmount).toFixed(2)} {displayCurrency}
                    </p>
                  </div>
                </div>
              </button>

              {/* Expanded details with globe */}
              {isExpanded && (
                <div className="animate-slide-up">
                  {/* Globe animation for cross-currency transfers */}
                  {tx.currencySent && tx.currencyReceived && tx.currencySent !== tx.currencyReceived && (
                    <div className="h-48 w-full bg-[#161618]">
                      <TransferGlobe
                        fromCurrency={tx.currencySent}
                        toCurrency={tx.currencyReceived}
                      />
                    </div>
                  )}
                  <div className="px-4 pb-4 pt-3 space-y-2" style={{ borderTop: '1px solid #2C2C2E' }}>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8E8E93]">Amount sent</span>
                      <span className="font-medium text-[#F5F5F7]">{parseFloat(tx.amountSent).toFixed(2)} {tx.currencySent}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8E8E93]">Amount received</span>
                      <span className="font-medium text-[#30D158]">{parseFloat(tx.amountReceived).toFixed(2)} {tx.currencyReceived}</span>
                    </div>
                    {tx.currencySent !== tx.currencyReceived && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8E8E93]">Exchange rate</span>
                        <span className="text-[#F5F5F7]">1 {tx.currencySent} = {tx.effectiveRate} {tx.currencyReceived}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8E8E93]">Fee</span>
                      <span className="text-[#30D158]">{tx.fee || '$0.00'}</span>
                    </div>
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-[#0A84FF] text-xs font-medium pt-2"
                    >
                      View on XRPL Explorer →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
