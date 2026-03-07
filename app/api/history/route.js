// app/api/history/route.js
// GET: transaction history pulled directly from XRPL ledger (no DB needed)
import { NextResponse } from 'next/server';
import * as xrpl from 'xrpl';
import { getClient } from '@/lib/xrpl-client';
import config from '@/lib/config.json';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    const client = await getClient();
    const response = await client.request({
      command: 'account_tx',
      account: address,
      limit: 20,
      ledger_index_min: -1,
      ledger_index_max: -1,
    });

    const transactions = response.result.transactions
      .filter((t) => t.validated && t.meta?.TransactionResult === 'tesSUCCESS')
      .map((t) => {
        const tx = t.tx_json || t.tx || t;
        const meta = t.meta;
        const type = tx.TransactionType;
        const hash = tx.hash || t.hash;
        const date = tx.date
          ? new Date((tx.date + 946684800) * 1000).toISOString() // ripple epoch → JS date
          : null;
        const fee = tx.Fee ? xrpl.dropsToXrp(tx.Fee) : '0.000012';

        if (type === 'Payment') {
          const delivered = meta.delivered_amount;
          const deliveredValue = typeof delivered === 'string'
            ? xrpl.dropsToXrp(delivered)
            : delivered?.value || '0';
          const deliveredCurrency = typeof delivered === 'string'
            ? 'XRP'
            : delivered?.currency || 'XRP';

          // Figure out what the sender spent
          const balanceChanges = xrpl.getBalanceChanges(meta);
          const senderChanges = balanceChanges.find((c) => c.account === tx.Account);

          // Find the non-XRP currency the sender lost (or XRP if same-currency)
          let amountSent = '0';
          let currencySent = 'XRP';
          if (senderChanges) {
            const nonFeeChange = senderChanges.balances.find(
              (b) => b.currency !== 'XRP' && parseFloat(b.value) < 0
            );
            if (nonFeeChange) {
              amountSent = Math.abs(parseFloat(nonFeeChange.value)).toFixed(6);
              currencySent = nonFeeChange.currency;
            } else {
              // XRP-only payment
              const xrpChange = senderChanges.balances.find((b) => b.currency === 'XRP');
              if (xrpChange) {
                amountSent = Math.abs(parseFloat(xrpChange.value)).toFixed(6);
                currencySent = 'XRP';
              }
            }
          }

          const effectiveRate = parseFloat(amountSent) > 0
            ? (parseFloat(deliveredValue) / parseFloat(amountSent)).toFixed(4)
            : '0';

          return {
            txHash: hash,
            type,
            sender: tx.Account,
            receiver: tx.Destination,
            amountSent,
            currencySent,
            amountReceived: deliveredValue,
            currencyReceived: deliveredCurrency,
            effectiveRate,
            xrplFee: fee,
            explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
            balanceChanges,
            createdAt: date,
          };
        }

        // EscrowCreate / EscrowFinish / other tx types — show as simple entries
        return {
          txHash: hash,
          type,
          sender: tx.Account,
          receiver: tx.Destination || tx.Account,
          amountSent: tx.Amount ? (typeof tx.Amount === 'string' ? xrpl.dropsToXrp(tx.Amount) : tx.Amount.value) : '0',
          currencySent: tx.Amount ? (typeof tx.Amount === 'string' ? 'XRP' : tx.Amount.currency) : 'XRP',
          amountReceived: '0',
          currencyReceived: 'XRP',
          effectiveRate: '0',
          xrplFee: fee,
          explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
          balanceChanges: [],
          createdAt: date,
        };
      });

    return NextResponse.json({ success: true, transactions });
  } catch (err) {
    console.error('History fetch failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
