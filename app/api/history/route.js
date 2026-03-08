// app/api/history/route.js
// GET: transaction history pulled directly from XRPL ledger (no DB needed)
import { NextResponse } from 'next/server';
import * as xrpl from 'xrpl';
import { getClient } from '@/lib/xrpl-client';
import config from '@/lib/config.json';

const MID_RATES_TO_XRP = { USD: 1.36, INR: 125, EUR: 1.17, NGN: 1878 };
const CURRENCY_SYMBOLS = { USD: '$', INR: '\u20b9', EUR: '\u20ac', NGN: '\u20a6' };

// Only show these transaction types in history
const SHOW_TYPES = new Set(['Payment', 'EscrowCreate', 'EscrowFinish']);

function parseDate(tx, wrapper) {
  // API v2: close_time_iso at top level; API v1: date inside tx
  if (wrapper.close_time_iso) return wrapper.close_time_iso;
  if (tx.date) return new Date((tx.date + 946684800) * 1000).toISOString();
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    const client = await getClient();

    // Fetch more than we need so we can filter out TrustSet/setup noise
    const response = await client.request({
      command: 'account_tx',
      account: address,
      limit: 50,
      ledger_index_min: -1,
      ledger_index_max: -1,
    });

    const metaOf = (t) => typeof t.meta === 'object' ? t.meta : null;

    const transactions = response.result.transactions
      .filter((t) => {
        const meta = metaOf(t);
        if (!meta || meta.TransactionResult !== 'tesSUCCESS') return false;
        // validated can be at transaction level or implied by the response range
        if (t.validated === false) return false;
        const tx = t.tx_json || t.tx || t;
        return SHOW_TYPES.has(tx.TransactionType);
      })
      .map((t) => {
        const tx = t.tx_json || t.tx || t;
        const meta = t.meta;
        const type = tx.TransactionType;
        const hash = tx.hash || t.hash;
        const date = parseDate(tx, t);
        const fee = tx.Fee ? xrpl.dropsToXrp(tx.Fee) : '0.000012';

        if (type === 'Payment') {
          const delivered = meta.delivered_amount;
          const deliveredValue = typeof delivered === 'string'
            ? xrpl.dropsToXrp(delivered)
            : delivered?.value || '0';
          const deliveredCurrency = typeof delivered === 'string'
            ? 'XRP'
            : delivered?.currency || 'XRP';

          // Figure out what the sender spent (hide XRP from users)
          const balanceChanges = xrpl.getBalanceChanges(meta);
          const senderChanges = balanceChanges.find((c) => c.account === tx.Account);

          let amountSent = '0';
          let currencySent = deliveredCurrency;
          if (senderChanges) {
            const nonFeeChange = senderChanges.balances.find(
              (b) => b.currency !== 'XRP' && parseFloat(b.value) < 0
            );
            if (nonFeeChange) {
              amountSent = Math.abs(parseFloat(nonFeeChange.value)).toFixed(2);
              currencySent = nonFeeChange.currency;
            } else {
              // AMM routed through XRP — convert back to a user currency
              const xrpChange = senderChanges.balances.find((b) => b.currency === 'XRP');
              if (xrpChange) {
                const xrpSpent = Math.abs(parseFloat(xrpChange.value));
                const guessedCurrency = deliveredCurrency !== 'XRP' ? deliveredCurrency : 'USD';
                amountSent = (xrpSpent * (MID_RATES_TO_XRP[guessedCurrency] || 1)).toFixed(2);
                currencySent = guessedCurrency;
              }
            }
          }

          if (parseFloat(amountSent) === 0 && parseFloat(deliveredValue) > 0) {
            amountSent = parseFloat(deliveredValue).toFixed(2);
            currencySent = deliveredCurrency;
          }

          const effectiveRate = parseFloat(amountSent) > 0
            ? (parseFloat(deliveredValue) / parseFloat(amountSent)).toFixed(4)
            : '1';

          // Fee = spread from mid-market in sender's currency
          let feeDisplay = `${CURRENCY_SYMBOLS[currencySent] || ''}0.00`;
          if (currencySent !== deliveredCurrency && parseFloat(amountSent) > 0) {
            const midRate = (MID_RATES_TO_XRP[deliveredCurrency] || 1) / (MID_RATES_TO_XRP[currencySent] || 1);
            const midReceive = parseFloat(amountSent) * midRate;
            const spreadLoss = midReceive - parseFloat(deliveredValue);
            const feeInSender = midRate > 0 ? Math.max(0, spreadLoss / midRate) : 0;
            feeDisplay = `${CURRENCY_SYMBOLS[currencySent] || ''}${feeInSender.toFixed(2)}`;
          }

          return {
            txHash: hash,
            type,
            sender: tx.Account,
            receiver: tx.Destination,
            amountSent,
            currencySent,
            amountReceived: parseFloat(deliveredValue).toFixed(2),
            currencyReceived: deliveredCurrency,
            effectiveRate,
            fee: feeDisplay,
            explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
            createdAt: date,
          };
        }

        // EscrowCreate / EscrowFinish — extract XRP amount from balance changes
        const balanceChanges = xrpl.getBalanceChanges(meta);

        // For EscrowCreate: Amount is on the tx itself (XRP locked)
        // For EscrowFinish: Amount is NOT on tx — must be read from balance changes
        let escrowAmount = '0';
        let escrowSender = tx.Account;
        let escrowReceiver = tx.Destination || tx.Owner || tx.Account;

        if (type === 'EscrowCreate' && tx.Amount) {
          escrowAmount = typeof tx.Amount === 'string'
            ? xrpl.dropsToXrp(tx.Amount)
            : tx.Amount.value;
        } else if (type === 'EscrowFinish') {
          // The escrow destination receives XRP — find the positive XRP change
          // that isn't the fee. Owner field = escrow creator.
          escrowSender = tx.Owner || tx.Account;
          // Find who gained XRP (the escrow destination)
          for (const change of balanceChanges) {
            if (change.account === tx.Account && tx.Account === escrowSender) continue; // skip fee payer if same as owner
            const xrpGain = change.balances.find(
              (b) => b.currency === 'XRP' && parseFloat(b.value) > 0
            );
            if (xrpGain) {
              escrowAmount = parseFloat(xrpGain.value).toFixed(6);
              escrowReceiver = change.account;
              break;
            }
          }
          // Fallback: if claimer is also the destination, look at owner's negative change
          if (escrowAmount === '0') {
            const ownerChange = balanceChanges.find((c) => c.account === escrowSender);
            if (ownerChange) {
              const xrpLoss = ownerChange.balances.find(
                (b) => b.currency === 'XRP' && parseFloat(b.value) < 0
              );
              if (xrpLoss) {
                // Subtract fee (12 drops) to get approximate escrow amount
                escrowAmount = (Math.abs(parseFloat(xrpLoss.value)) - 0.000012).toFixed(6);
                escrowReceiver = tx.Account;
              }
            }
          }
        }

        return {
          txHash: hash,
          type,
          sender: escrowSender,
          receiver: escrowReceiver,
          amountSent: escrowAmount,
          currencySent: 'XRP',
          amountReceived: escrowAmount,
          currencyReceived: 'XRP',
          effectiveRate: '1',
          xrplFee: fee,
          explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
          balanceChanges,
          createdAt: date,
        };
      })
      .slice(0, 20); // Return at most 20 meaningful entries

    return NextResponse.json({ success: true, transactions });
  } catch (err) {
    console.error('History fetch failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
