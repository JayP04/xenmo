// lib/xrpl-payment.js
// AMM-powered pathfind payments with DEX offer fallback
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';
import config from './config.json' assert { type: 'json' };

// Mid-market rates — fallback only when pathfind AND DEX both fail
const MID_RATES_TO_XRP = {
  USD: 1.36,      // 1 XRP = 2 USD
  INR: 125,    // 1 XRP = 166 INR
  EUR: 1.17,   // 1 XRP = 1.84 EUR
  NGN: 1878,   // 1 XRP = 3100 NGN
};

// ─── PATHFIND HELPER ───
// Runs ripple_path_find against live AMM pools + DEX orderbook.
// Returns { sourceAmount, paths } or null if no path found.
async function findPath(client, sourceAddress, destAddress, destAmount) {
  try {
    const result = await client.request({
      command: 'ripple_path_find',
      source_account: sourceAddress,
      destination_account: destAddress,
      destination_amount: destAmount,
    });

    const alts = result.result.alternatives || [];
    if (alts.length === 0) return null;

    return { sourceAmount: alts[0].source_amount, paths: alts[0].paths_computed };
  } catch (e) {
    console.error('Pathfind error:', e.message);
    return null;
  }
}

// ─── GET RATE ───
// Tries live pathfind first (hits AMM pools), falls back to mid-market math
export async function getRate(fromCurrency, toCurrency, amount, senderAddress, receiverAddress) {
  const client = await getClient();
  const fromIssuer = config.issuers[fromCurrency]?.address;
  const toIssuer = config.issuers[toCurrency]?.address;

  if (!fromIssuer || !toIssuer) {
    throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
  }

  // Mid-market fallback rate (always calculable)
  const fromPerXrp = MID_RATES_TO_XRP[fromCurrency];
  const toPerXrp = MID_RATES_TO_XRP[toCurrency];
  const fallbackRate = toPerXrp / fromPerXrp;
  const fallbackReceive = (parseFloat(amount) * fallbackRate).toFixed(4);

  // Try live pathfind using actual sender/receiver for realistic rates
  let liveRate = null;
  let liveReceive = null;
  let rateSource = 'mid-market';

  if (senderAddress && receiverAddress) {
    const destAmount = {
      currency: toCurrency,
      issuer: toIssuer,
      value: fallbackReceive,
    };

    const pathData = await findPath(client, senderAddress, receiverAddress, destAmount);

    if (pathData) {
      // sourceAmount may be XRP drops (string) if path routes through XRP,
      // or a token object {currency, value} if direct token path exists.
      let costInSenderCurrency;
      if (typeof pathData.sourceAmount === 'string') {
        // XRP drops — convert to sender's currency
        const xrpCost = parseFloat(xrpl.dropsToXrp(pathData.sourceAmount));
        costInSenderCurrency = xrpCost * fromPerXrp;
      } else {
        costInSenderCurrency = parseFloat(pathData.sourceAmount.value);
      }

      if (costInSenderCurrency > 0) {
        liveRate = parseFloat(fallbackReceive) / costInSenderCurrency;
        liveReceive = (parseFloat(amount) * liveRate).toFixed(4);
        rateSource = 'pathfind-amm';
      }
    }
  }

  const estimatedReceive = liveReceive || fallbackReceive;
  const finalRate = parseFloat(estimatedReceive) / parseFloat(amount);

  // Fee = spread between mid-market and actual, in sender's currency
  const midMarketReceive = parseFloat(amount) * fallbackRate;
  const spreadLoss = midMarketReceive - parseFloat(estimatedReceive);
  const feeInSender = fallbackRate > 0 ? Math.max(0, spreadLoss / fallbackRate) : 0;

  const CURRENCY_SYMBOLS = { USD: '$', INR: '\u20b9', EUR: '\u20ac', NGN: '\u20a6' };
  const sym = CURRENCY_SYMBOLS[fromCurrency] || '';

  return {
    fromCurrency,
    toCurrency,
    amount,
    estimatedReceive,
    rate: finalRate,
    fee: `${sym}${feeInSender.toFixed(2)}`,
    rateSource,
    competitors: {
      westernUnion: { fee: 12, fxMarkup: 0.04, total: (parseFloat(amount) * 1.04 + 12).toFixed(2) },
      wise: { fee: 1.50, fxMarkup: 0.005, total: (parseFloat(amount) * 1.005 + 1.50).toFixed(2) },
      bankWire: { fee: 35, fxMarkup: 0.03, total: (parseFloat(amount) * 1.03 + 35).toFixed(2) },
      remitx: { fee: 0, fxMarkup: 0, total: (parseFloat(amount) + feeInSender).toFixed(2) },
    },
  };
}

// ─── FORMAT RESULT HELPER ───
function formatResult(result, wallet, destAddress, sendMaxCurrency, destCurrency, pathSource, sendAmount) {
  const meta = result.result.meta;
  const delivered = meta.delivered_amount;
  const balanceChanges = xrpl.getBalanceChanges(meta);
  const hash = result.result.hash;

  // Use the user's intended send amount when available
  let actualCost;
  if (sendAmount) {
    actualCost = parseFloat(sendAmount).toFixed(2);
  } else {
    // Derive from balance changes, handling XRP bridge
    const senderChanges = balanceChanges.find((c) => c.account === wallet.address);
    const srcChange = senderChanges?.balances.find((b) => b.currency === sendMaxCurrency);
    if (srcChange && Math.abs(parseFloat(srcChange.value)) > 0) {
      actualCost = Math.abs(parseFloat(srcChange.value)).toFixed(2);
    } else {
      // AMM routed through XRP — convert back to sender's currency
      const xrpChange = senderChanges?.balances.find((b) => b.currency === 'XRP');
      if (xrpChange) {
        const xrpSpent = Math.abs(parseFloat(xrpChange.value));
        actualCost = (xrpSpent * (MID_RATES_TO_XRP[sendMaxCurrency] || 1)).toFixed(2);
      } else {
        actualCost = '0';
      }
    }
  }

  const deliveredValue = typeof delivered === 'string'
    ? xrpl.dropsToXrp(delivered)
    : delivered.value;

  // Fee = spread between mid-market and actual, in sender's currency
  const midRate = MID_RATES_TO_XRP[destCurrency] / MID_RATES_TO_XRP[sendMaxCurrency];
  const midMarketReceive = parseFloat(actualCost) * midRate;
  const spreadLoss = midMarketReceive - parseFloat(deliveredValue);
  const feeInSender = midRate > 0 ? Math.max(0, spreadLoss / midRate) : 0;
  const CURRENCY_SYMBOLS = { USD: '$', INR: '\u20b9', EUR: '\u20ac', NGN: '\u20a6' };
  const sym = CURRENCY_SYMBOLS[sendMaxCurrency] || '';

  return {
    hash,
    explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
    sender: wallet.address,
    receiver: destAddress,
    amountSent: actualCost,
    currencySent: sendMaxCurrency,
    amountReceived: parseFloat(deliveredValue).toFixed(2),
    currencyReceived: destCurrency,
    effectiveRate: parseFloat(actualCost) > 0
      ? (parseFloat(deliveredValue) / parseFloat(actualCost)).toFixed(4)
      : '0',
    fee: `${sym}${feeInSender.toFixed(2)}`,
  };
}

// ─── SEND PAYMENT ───
// Strategy: same-currency direct | pathfind (AMM) → manual XRP bridge fallback
export async function sendPayment(senderSeed, destAddress, amount, destCurrency, sendMaxCurrency, sendAmount) {
  const client = await getClient();
  const wallet = xrpl.Wallet.fromSeed(senderSeed);

  const destIssuer = config.issuers[destCurrency]?.address;
  const srcIssuer = config.issuers[sendMaxCurrency]?.address;

  if (!destIssuer || !srcIssuer) {
    throw new Error(`Unsupported currency: ${destCurrency} or ${sendMaxCurrency}`);
  }

  const destinationAmount = {
    currency: destCurrency,
    issuer: destIssuer,
    value: amount,
  };

  // Cap sender's spend at exactly what they typed (partial payment)
  const exactSendMax = sendAmount ? {
    currency: sendMaxCurrency,
    issuer: srcIssuer,
    value: String(sendAmount),
  } : null;

  // ── SAME CURRENCY: Direct ripple transfer (no Paths needed) ──
  if (sendMaxCurrency === destCurrency) {
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destAddress,
      Amount: destinationAmount,
    };
    const result = await client.submitAndWait(payment, { autofill: true, wallet });
    const meta = result.result.meta;
    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Payment failed: ${meta.TransactionResult}`);
    }
    return formatResult(result, wallet, destAddress, sendMaxCurrency, destCurrency, 'direct', sendAmount);
  }

  // ── CROSS CURRENCY ──
  // Attempt 1: Live pathfind (discovers AMM pools + DEX offers)
  const pathData = await findPath(client, wallet.address, destAddress, destinationAmount);

  if (pathData) {
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destAddress,
      Amount: destinationAmount,
      Paths: pathData.paths,
    };

    if (exactSendMax) {
      payment.SendMax = exactSendMax;
      payment.Flags = xrpl.PaymentFlags.tfPartialPayment;
    } else {
      let sendMax = pathData.sourceAmount;
      if (typeof sendMax === 'string') {
        sendMax = Math.ceil(parseInt(sendMax) * 1.05).toString();
      } else {
        sendMax = { ...sendMax, value: (parseFloat(sendMax.value) * 1.05).toFixed(6) };
      }
      payment.SendMax = sendMax;
    }

    try {
      const result = await client.submitAndWait(payment, { autofill: true, wallet });
      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        return formatResult(result, wallet, destAddress, sendMaxCurrency, destCurrency, 'pathfind-amm', sendAmount);
      }
      console.log('Pathfind path returned error:', result.result.meta.TransactionResult, '— trying manual bridge');
    } catch (e) {
      console.log('Pathfind path submit error:', e.message, '— trying manual bridge');
    }
  }

  // Attempt 2: Manual XRP bridge using mid-market rates
  const fromPerXrp = MID_RATES_TO_XRP[sendMaxCurrency];
  const toPerXrp = MID_RATES_TO_XRP[destCurrency];
  const rate = toPerXrp / fromPerXrp;
  const sendMaxValue = ((parseFloat(amount) / rate) * 1.15).toFixed(6);

  const bridgePayment = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: destAddress,
    Amount: destinationAmount,
    Paths: [[{ currency: 'XRP' }]],
  };

  if (exactSendMax) {
    bridgePayment.SendMax = exactSendMax;
    bridgePayment.Flags = xrpl.PaymentFlags.tfPartialPayment;
  } else {
    bridgePayment.SendMax = { currency: sendMaxCurrency, issuer: srcIssuer, value: sendMaxValue };
  }

  const result = await client.submitAndWait(bridgePayment, { autofill: true, wallet });
  const meta = result.result.meta;
  if (meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Payment failed: ${meta.TransactionResult}`);
  }
  return formatResult(result, wallet, destAddress, sendMaxCurrency, destCurrency, 'manual-bridge', sendAmount);
}
