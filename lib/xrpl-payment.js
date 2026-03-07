// lib/xrpl-payment.js
// AMM-powered pathfind payments with DEX offer fallback
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';
import config from './config.json' assert { type: 'json' };

// Mid-market rates — fallback only when pathfind AND DEX both fail
const MID_RATES_TO_XRP = {
  USD: 2,      // 1 XRP = 2 USD
  INR: 166,    // 1 XRP = 166 INR
  EUR: 1.84,   // 1 XRP = 1.84 EUR
  NGN: 3100,   // 1 XRP = 3100 NGN
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
export async function getRate(fromCurrency, toCurrency, amount) {
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

  // Try live pathfind for real AMM/DEX rate
  let liveRate = null;
  let liveReceive = null;
  let rateSource = 'mid-market';

  const destAmount = {
    currency: toCurrency,
    issuer: toIssuer,
    value: fallbackReceive,
  };

  const pathData = await findPath(client, config.lp.address, config.lp.address, destAmount);

  if (pathData) {
    const cost = typeof pathData.sourceAmount === 'string'
      ? parseFloat(xrpl.dropsToXrp(pathData.sourceAmount))
      : parseFloat(pathData.sourceAmount.value);

    if (cost > 0) {
      liveRate = parseFloat(fallbackReceive) / cost;
      liveReceive = fallbackReceive;
      rateSource = 'pathfind-amm';
    }
  }

  const finalRate = liveRate || fallbackRate;
  const estimatedReceive = liveReceive || fallbackReceive;

  return {
    fromCurrency,
    toCurrency,
    amount,
    estimatedReceive,
    rate: finalRate,
    rateSource,
    competitors: {
      westernUnion: { fee: 12, fxMarkup: 0.04, total: (parseFloat(amount) * 1.04 + 12).toFixed(2) },
      wise: { fee: 1.50, fxMarkup: 0.005, total: (parseFloat(amount) * 1.005 + 1.50).toFixed(2) },
      bankWire: { fee: 35, fxMarkup: 0.03, total: (parseFloat(amount) * 1.03 + 35).toFixed(2) },
      remitx: { fee: 0, fxMarkup: 0, total: parseFloat(amount).toFixed(2) },
    },
  };
}

// ─── SEND PAYMENT ───
// Strategy: pathfind (AMM) → manual XRP bridge fallback
export async function sendPayment(senderSeed, destAddress, amount, destCurrency, sendMaxCurrency) {
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

  // ── ATTEMPT 1: Live pathfind (discovers AMM pools + DEX offers) ──
  let sendMax = null;
  let paths = null;
  let pathSource = 'pathfind-amm';

  const pathData = await findPath(client, wallet.address, destAddress, destinationAmount);

  if (pathData) {
    sendMax = pathData.sourceAmount;
    paths = pathData.paths;

    // Add 5% slippage buffer to pathfind's SendMax
    if (typeof sendMax === 'string') {
      // XRP drops
      sendMax = Math.ceil(parseInt(sendMax) * 1.05).toString();
    } else {
      sendMax = { ...sendMax, value: (parseFloat(sendMax.value) * 1.05).toFixed(6) };
    }
  }

  // ── FALLBACK: Manual XRP bridge using mid-market rates ──
  if (!paths) {
    pathSource = 'manual-bridge';
    paths = [[{ currency: 'XRP' }]];
    const fromPerXrp = MID_RATES_TO_XRP[sendMaxCurrency];
    const toPerXrp = MID_RATES_TO_XRP[destCurrency];
    const rate = toPerXrp / fromPerXrp;
    const sendMaxValue = ((parseFloat(amount) / rate) * 1.15).toFixed(6);
    sendMax = { currency: sendMaxCurrency, issuer: srcIssuer, value: sendMaxValue };
  }

  // ── SUBMIT ──
  const payment = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: destAddress,
    Amount: destinationAmount,
    SendMax: sendMax,
    Paths: paths,
  };

  let result;
  try {
    result = await client.submitAndWait(payment, { autofill: true, wallet });
  } catch (submitErr) {
    // If pathfind path failed, retry with manual bridge
    if (pathSource !== 'manual-bridge') {
      console.log('Pathfind path failed, retrying with manual bridge...');
      const fromPerXrp = MID_RATES_TO_XRP[sendMaxCurrency];
      const toPerXrp = MID_RATES_TO_XRP[destCurrency];
      const rate = toPerXrp / fromPerXrp;
      const retryMax = ((parseFloat(amount) / rate) * 1.15).toFixed(6);
      payment.Paths = [[{ currency: 'XRP' }]];
      payment.SendMax = { currency: sendMaxCurrency, issuer: srcIssuer, value: retryMax };
      result = await client.submitAndWait(payment, { autofill: true, wallet });
    } else {
      throw submitErr;
    }
  }

  const meta = result.result.meta;
  if (meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Payment failed: ${meta.TransactionResult}`);
  }

  const delivered = meta.delivered_amount;
  const balanceChanges = xrpl.getBalanceChanges(meta);
  const hash = result.result.hash;

  const senderChanges = balanceChanges.find((c) => c.account === wallet.address);
  const srcChange = senderChanges?.balances.find((b) => b.currency === sendMaxCurrency);
  const actualCost = srcChange ? Math.abs(parseFloat(srcChange.value)).toFixed(6) : '0';

  const deliveredValue = typeof delivered === 'string'
    ? xrpl.dropsToXrp(delivered)
    : delivered.value;

  return {
    hash,
    explorerUrl: `${config.explorerUrl}/transactions/${hash}`,
    sender: wallet.address,
    receiver: destAddress,
    amountSent: actualCost,
    currencySent: sendMaxCurrency,
    amountReceived: deliveredValue,
    currencyReceived: destCurrency,
    effectiveRate: (parseFloat(deliveredValue) / parseFloat(actualCost)).toFixed(4),
    xrplFee: '0.000012',
    balanceChanges,
    pathSource,
  };
}
