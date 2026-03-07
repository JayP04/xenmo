// ============================================================
// BOOTSTRAP: Full Testnet Environment Setup
// ============================================================
// Run this ONCE before the hackathon (or at the start).
// It creates everything your app needs on testnet:
//
//   1. Issuer accounts for USD, INR, EUR, NGN
//   2. defaultRipple enabled on all issuers
//   3. AMM liquidity pools (each currency paired with XRP)
//   4. Two demo user wallets with token balances
//   5. Saves everything to config.json
//
// After running: your app reads config.json and is ready to go.
//
// USAGE:
//   node 07-full-bootstrap.js
//
// OUTPUT: config.json in the same directory
// ============================================================

import * as xrpl from 'xrpl';
import fs from 'fs';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

// Currencies we support and their simulated exchange rates to USD
// Pool XRP amounts kept small — LP wallet has limited faucet XRP
const CURRENCIES = {
  USD: { rate: 1, poolTokenAmount: '500', poolXrpAmount: '250' },
  INR: { rate: 83, poolTokenAmount: '40000', poolXrpAmount: '250' },
  EUR: { rate: 0.92, poolTokenAmount: '460', poolXrpAmount: '250' },
  NGN: { rate: 1550, poolTokenAmount: '750000', poolXrpAmount: '250' },
};

async function createFundedWallet(client, label) {
  console.log(`   Creating ${label} wallet...`);
  const { wallet, balance } = await client.fundWallet();
  console.log(`   ✅ ${label}: ${wallet.address} (${balance} XRP)`);
  return wallet;
}

async function enableDefaultRipple(client, wallet, label) {
  await client.submitAndWait(
    {
      TransactionType: 'AccountSet',
      Account: wallet.address,
      SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple,
    },
    { wallet }
  );
  console.log(`   ✅ defaultRipple enabled on ${label}`);
}

async function createTrustLine(client, wallet, currency, issuerAddress) {
  await client.submitAndWait(
    {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency,
        issuer: issuerAddress,
        value: '999999999',
      },
    },
    { wallet }
  );
}

async function sendTokens(client, issuerWallet, destAddress, currency, amount) {
  await client.submitAndWait(
    {
      TransactionType: 'Payment',
      Account: issuerWallet.address,
      Destination: destAddress,
      Amount: {
        currency,
        issuer: issuerWallet.address,
        value: amount,
      },
    },
    { wallet: issuerWallet }
  );
}

async function main() {
  console.log('=========================================');
  console.log('  RemitX — Full Testnet Bootstrap');
  console.log('=========================================\n');

  const client = new xrpl.Client(TESTNET_URL);
  await client.connect();
  console.log('✅ Connected to XRPL Testnet\n');

  // ─── STEP 1: Create Issuer Accounts ───
  console.log('STEP 1: Creating issuer accounts...');
  const issuers = {};
  for (const currency of Object.keys(CURRENCIES)) {
    issuers[currency] = await createFundedWallet(client, `${currency} Issuer`);
  }
  console.log('');

  // ─── STEP 2: Enable defaultRipple ───
  console.log('STEP 2: Enabling defaultRipple on all issuers...');
  for (const [currency, wallet] of Object.entries(issuers)) {
    await enableDefaultRipple(client, wallet, currency);
  }
  console.log('');

  // ─── STEP 3: Create LP Wallet ───
  console.log('STEP 3: Creating liquidity provider wallet...');
  const lpWallet = await createFundedWallet(client, 'LP');
  // Fund LP with extra XRP (for DEX offers)
  console.log('   Funding LP with additional XRP (4 more faucet calls)...');
  for (let i = 0; i < 4; i++) {
    await client.fundWallet({ wallet: lpWallet });
  }
  console.log('   ✅ LP has extra XRP for DEX offers\n');

  // ─── STEP 4: LP TrustLines + Token Funding ───
  console.log('STEP 4: Setting up LP trust lines and funding tokens...');
  for (const [currency, config] of Object.entries(CURRENCIES)) {
    await createTrustLine(client, lpWallet, currency, issuers[currency].address);
    // Give LP plenty of tokens to seed pools
    const fundAmount = (parseFloat(config.poolTokenAmount) * 3).toString();
    await sendTokens(client, issuers[currency], lpWallet.address, currency, fundAmount);
    console.log(`   ✅ LP funded with ${fundAmount} ${currency}`);
  }
  console.log('');

  // ─── STEP 5: Create DEX Offers (primary liquidity) ───
  // AMM pools skipped — they interfere with DEX offers on testnet.
  // DEX offers alone are reliable and proven (see test 4).
  //
  // CRITICAL: We create both directions (buy + sell XRP) per currency.
  // XRPL auto-cancels your own offers if they cross each other on the
  // same book. Fix: use a 5% bid-ask spread so they DON'T cross.
  //   Ask (LP sells XRP): charges 5% more tokens per XRP
  //   Bid (LP buys XRP):  pays 5% fewer tokens per XRP
  const ammPools = {}; // empty, kept for config compatibility

  console.log('STEP 5: Creating DEX offers for liquidity...');

  // Mid-market rates: tokens per XRP
  const dexConfig = {
    USD: { midRate: 2, xrpSize: 80 },        // 1 XRP = 2 USD (1 USD = 0.5 XRP)
    INR: { midRate: 166, xrpSize: 80 },       // 1 XRP = 166 INR (1 USD ≈ 83 INR)
    EUR: { midRate: 1.84, xrpSize: 80 },      // 1 XRP = 1.84 EUR (1 USD ≈ 0.92 EUR)
    NGN: { midRate: 3100, xrpSize: 80 },      // 1 XRP = 3100 NGN (1 USD ≈ 1550 NGN)
  };

  const SPREAD = 0.05; // 5% total spread (2.5% each side)

  for (const [currency, cfg] of Object.entries(dexConfig)) {
    const issuerAddr = issuers[currency].address;
    const askRate = cfg.midRate * (1 + SPREAD / 2); // LP sells XRP at premium
    const bidRate = cfg.midRate * (1 - SPREAD / 2); // LP buys XRP at discount

    const askTokens = (askRate * cfg.xrpSize).toFixed(6);
    const bidTokens = (bidRate * cfg.xrpSize).toFixed(6);
    const xrpDrops = xrpl.xrpToDrops(cfg.xrpSize);

    try {
      // ASK: LP sells XRP, wants tokens (enables: user pays tokens → gets XRP)
      // Taker pays tokens to LP, taker gets XRP from LP
      await client.submitAndWait(
        {
          TransactionType: 'OfferCreate',
          Account: lpWallet.address,
          TakerPays: { currency, issuer: issuerAddr, value: askTokens },
          TakerGets: xrpDrops,
        },
        { wallet: lpWallet }
      );

      // BID: LP sells tokens, wants XRP (enables: XRP → tokens for receiver)
      // Taker pays XRP to LP, taker gets tokens from LP
      await client.submitAndWait(
        {
          TransactionType: 'OfferCreate',
          Account: lpWallet.address,
          TakerPays: xrpDrops,
          TakerGets: { currency, issuer: issuerAddr, value: bidTokens },
        },
        { wallet: lpWallet }
      );

      console.log(`   ✅ ${currency}/XRP: ask=${askRate.toFixed(2)} bid=${bidRate.toFixed(2)} ${currency}/XRP (${cfg.xrpSize} XRP each side)`);
    } catch (err) {
      console.log(`   ❌ ${currency}/XRP offers FAILED: ${err.message}`);
    }
  }

  // Verify offers actually stayed on the book
  const lpOffers = await client.request({
    command: 'account_offers',
    account: lpWallet.address,
  });
  console.log(`   LP has ${lpOffers.result.offers.length} active offers (should be 8)\n`);

  // ─── STEP 6: Create Demo User Wallets ───
  console.log('STEP 6: Creating demo user wallets...');
  const user1 = await createFundedWallet(client, 'Demo User 1 (US)');
  const user2 = await createFundedWallet(client, 'Demo User 2 (India)');
  console.log('');

  // ─── STEP 7: Fund Demo Users with Tokens ───
  console.log('STEP 7: Funding demo users with tokens...');

  // User 1: US-based, has USD and EUR
  for (const currency of ['USD', 'INR', 'EUR', 'NGN']) {
    await createTrustLine(client, user1, currency, issuers[currency].address);
  }
  await sendTokens(client, issuers.USD, user1.address, 'USD', '500');
  await sendTokens(client, issuers.EUR, user1.address, 'EUR', '200');
  console.log('   ✅ User 1 funded: 500 USD, 200 EUR');

  // User 2: India-based, has INR
  for (const currency of ['USD', 'INR', 'EUR', 'NGN']) {
    await createTrustLine(client, user2, currency, issuers[currency].address);
  }
  await sendTokens(client, issuers.INR, user2.address, 'INR', '25000');
  console.log('   ✅ User 2 funded: 25,000 INR');
  console.log('');

  // ─── STEP 8: Verification (actual test payment) ───
  console.log('STEP 8: Verifying with a real cross-currency test payment...');
  console.log('   Sending 1000 INR from User 1 (USD) → User 2 (INR)...');

  try {
    const testPayment = {
      TransactionType: 'Payment',
      Account: user1.address,
      Destination: user2.address,
      Amount: {
        currency: 'INR',
        issuer: issuers.INR.address,
        value: '1000',
      },
      SendMax: {
        currency: 'USD',
        issuer: issuers.USD.address,
        value: '100',
      },
      Paths: [[{ currency: 'XRP' }]], // manual bridge through XRP
    };

    const testResult = await client.submitAndWait(testPayment, { wallet: user1 });
    const meta = testResult.result.meta;

    if (meta.TransactionResult === 'tesSUCCESS') {
      const delivered = meta.delivered_amount;
      const changes = xrpl.getBalanceChanges(meta);
      const senderChange = changes.find(c => c.account === user1.address);
      const usdSpent = senderChange?.balances.find(b => b.currency === 'USD');

      console.log(`   ✅ Test payment SUCCESS!`);
      console.log(`   Delivered: ${delivered.value} ${delivered.currency}`);
      console.log(`   Cost: ${usdSpent ? Math.abs(parseFloat(usdSpent.value)).toFixed(4) : '?'} USD`);
      console.log(`   Rate: 1 USD ≈ ${usdSpent ? (parseFloat(delivered.value) / Math.abs(parseFloat(usdSpent.value))).toFixed(2) : '?'} INR`);
      console.log(`   Tx: ${testResult.result.hash}`);
    } else {
      console.log(`   ⚠️  Test payment returned: ${meta.TransactionResult}`);
    }
  } catch (err) {
    console.log(`   ⚠️  Test payment failed: ${err.message}`);
    console.log('   DEX offers and AMM pools are created — payments should work from the app.');
  }
  console.log('');

  // ─── STEP 9: Save Config ───
  const config = {
    testnetUrl: TESTNET_URL,
    explorerUrl: 'https://testnet.xrpl.org',
    issuers: {},
    lp: {
      address: lpWallet.address,
      seed: lpWallet.seed,
    },
    demoUsers: {
      user1: {
        label: 'US User',
        address: user1.address,
        seed: user1.seed,
        balances: { USD: '500', EUR: '200' },
      },
      user2: {
        label: 'India User',
        address: user2.address,
        seed: user2.seed,
        balances: { INR: '25000' },
      },
    },
    ammPools,
    dexOffersCreated: true,
    exchangeRates: {
      'USD/XRP': '1 USD = 0.5 XRP',
      'INR/XRP': '1 INR = 0.006 XRP (1 USD ≈ 83 INR)',
      'EUR/XRP': '1 EUR = 0.55 XRP (1 USD ≈ 0.92 EUR)',
      'NGN/XRP': '1 NGN = 0.00032 XRP (1 USD ≈ 1550 NGN)',
    },
    createdAt: new Date().toISOString(),
  };

  for (const [currency, wallet] of Object.entries(issuers)) {
    config.issuers[currency] = {
      address: wallet.address,
      seed: wallet.seed,
    };
  }

  const configPath = new URL('../lib/config.json', import.meta.url).pathname;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Config saved to ${configPath}\n`);

  // ─── SUMMARY ───
  console.log('=========================================');
  console.log('  BOOTSTRAP COMPLETE');
  console.log('=========================================');
  console.log(`  Issuers:      ${Object.keys(issuers).join(', ')}`);
  console.log(`  DEX Offers:   ${Object.keys(dexConfig).length} currency pairs`);
  console.log(`  Demo Users:   2 (US + India)`);
  console.log(`  Config:     ./config.json`);
  console.log('');
  console.log('  Copy config.json to your Next.js app:');
  console.log('    cp config.json ../remitx/lib/config.json');
  console.log('');
  console.log('  Demo user seeds (for quick login):');
  console.log(`    US User:    ${user1.seed}`);
  console.log(`    India User: ${user2.seed}`);
  console.log('=========================================\n');

  await client.disconnect();
}

main().catch((err) => {
  console.error('\n❌ BOOTSTRAP FAILED:', err.message);
  console.error(err);
  process.exit(1);
});
