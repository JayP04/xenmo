// lib/xrpl-payment.js
// Rate lookup via book_offers + cross-currency payment with pathfind fallback
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';
import config from './config.json' assert { type: 'json' };

// Mid-market rates (same as bootstrap) — used as display reference
const MID_RATES_TO_XRP = {
  USD: 2,      // 1 XRP = 2 USD
  INR: 166,    // 1 XRP = 166 INR
  EUR: 1.84,   // 1 XRP = 1.84 EUR
  NGN: 3100,   // 1 XRP = 3100 NGN
};

// Get estimated conversion rate between two currencies
// Tries ripple_path_find first, falls back to calculated rate from mid-rates
export async function getRate(fromCurrency, toCurrency, amount) {
  const client = await getClient();
  const fromIssuer = config.issuers[fromCurrency]?.address;
  const toIssuer = config.issuers[toCurrency]?.address;

  if (!fromIssuer || !toIssuer) {
    throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
  }

  // Calculate rate from mid-market rates (always available)
  const fromPerXrp = MID_RATES_TO_XRP[fromCurrency];
  const toPerXrp = MID_RATES_TO_XRP[toCurrency];
  const calculatedRate = toPerXrp / fromPerXrp;
  const estimatedReceive = (parseFloat(amount) * calculatedRate).toFixed(4);

  // Try pathfinding for a more accurate rate (may fail on testnet)
  let pathfindRate = null;
  try {
    const pathResult = await client.request({
      command: 'ripple_path_find',
      source_account: config.lp.address, // use LP as reference account
      source_currencies: [{ currency: fromCurrency, issuer: fromIssuer }],
      destination_account: config.lp.address,
      destination_amount: {
        currency: toCurrency,
        issuer: toIssuer,
        value: estimatedReceive,
      },
    });

    if (pathResult.result.alternatives.length > 0) {
      const sourceAmount = pathResult.result.alternatives[0].source_amount;
      const cost = typeof sourceAmount === 'string'
        ? xrpl.dropsToXrp(sourceAmount)
        : sourceAmount.value;
      pathfindRate = parseFloat(estimatedReceive) / parseFloat(cost);
    }
  } catch (e) {
    // Pathfinding failed — use calculated rate (this is expected on testnet)
  }

  return {
    fromCurrency,
    toCurrency,
    amount,
    estimatedReceive,
    rate: pathfindRate || calculatedRate,
    rateSource: pathfindRate ? 'pathfind' : 'mid-market',
    // Fee comparison data
    competitors: {
      westernUnion: { fee: 12, fxMarkup: 0.04, total: (parseFloat(amount) * 1.04 + 12).toFixed(2) },
      wise: { fee: 1.50, fxMarkup: 0.005, total: (parseFloat(amount) * 1.005 + 1.50).toFixed(2) },
      bankWire: { fee: 35, fxMarkup: 0.03, total: (parseFloat(amount) * 1.03 + 35).toFixed(2) },
      remitx: { fee: 0, fxMarkup: 0, total: parseFloat(amount).toFixed(2) },
    },
  };
}

// Execute a cross-currency payment
// Tries pathfind for optimal paths, falls back to manual XRP bridge
export async function sendPayment(senderSeed, destAddress, amount, destCurrency, sendMaxCurrency) {
  const client = await getClient();
  const wallet = xrpl.Wallet.fromSeed(senderSeed);

  const destIssuer = config.issuers[destCurrency]?.address;
  const srcIssuer = config.issuers[sendMaxCurrency]?.address;

  if (!destIssuer || !srcIssuer) {
    throw new Error(`Unsupported currency: ${destCurrency} or ${sendMaxCurrency}`);
  }

  // Calculate SendMax with 10% buffer for slippage
  const fromPerXrp = MID_RATES_TO_XRP[sendMaxCurrency];
  const toPerXrp = MID_RATES_TO_XRP[destCurrency];
  const rate = toPerXrp / fromPerXrp;
  const sendMaxValue = ((parseFloat(amount) / rate) * 1.10).toFixed(6);

  // Try pathfinding first
  let paths = null;
  try {
    const pathResult = await client.request({
      command: 'ripple_path_find',
      source_account: wallet.address,
      source_currencies: [{ currency: sendMaxCurrency, issuer: srcIssuer }],
      destination_account: destAddress,
      destination_amount: {
        currency: destCurrency,
        issuer: destIssuer,
        value: amount,
      },
    });

    if (pathResult.result.alternatives.length > 0) {
      paths = pathResult.result.alternatives[0].paths_computed;
    }
  } catch (e) {
    // Pathfinding unavailable — will use manual path
  }

  // Fallback: manual XRP bridge path (proven in testing)
  if (!paths) {
    paths = [[{ currency: 'XRP' }]];
  }

  // Build and submit payment
  const payment = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: destAddress,
    Amount: {
      currency: destCurrency,
      issuer: destIssuer,
      value: amount,
    },
    SendMax: {
      currency: sendMaxCurrency,
      issuer: srcIssuer,
      value: sendMaxValue,
    },
    Paths: paths,
  };

  const result = await client.submitAndWait(payment, { wallet });
  const meta = result.result.meta;

  if (meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Payment failed: ${meta.TransactionResult}`);
  }

  const delivered = meta.delivered_amount;
  const balanceChanges = xrpl.getBalanceChanges(meta);
  const hash = result.result.hash;

  // Find actual cost from balance changes
  const senderChanges = balanceChanges.find((c) => c.account === wallet.address);
  const srcChange = senderChanges?.balances.find((b) => b.currency === sendMaxCurrency);
  const actualCost = srcChange ? Math.abs(parseFloat(srcChange.value)).toFixed(6) : sendMaxValue;

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
    pathSource: paths[0]?.[0]?.currency === 'XRP' ? 'manual-bridge' : 'pathfind',
  };
}
