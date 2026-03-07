// lib/xrpl-wallet.js
// Wallet creation, import, balance queries, trust line setup
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';
import config from './config.json' assert { type: 'json' };

const SUPPORTED_CURRENCIES = ['USD', 'INR', 'EUR', 'NGN'];

// Create a brand new wallet funded via testnet faucet
// Sets up trust lines for all supported currencies automatically
export async function createWallet() {
  const client = await getClient();

  // Fund new wallet from faucet (~100 XRP)
  const { wallet, balance } = await client.fundWallet();

  // Create trust lines for all currencies so this wallet can hold them
  for (const currency of SUPPORTED_CURRENCIES) {
    const issuer = config.issuers[currency];
    if (!issuer || issuer.address === 'REPLACE_ME') continue;

    await client.submitAndWait(
      {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency,
          issuer: issuer.address,
          value: '999999999',
        },
      },
      { wallet }
    );
  }

  return {
    address: wallet.address,
    seed: wallet.seed,
    xrpBalance: balance,
  };
}

// Restore wallet from seed and ensure trust lines exist
export async function importWallet(seed) {
  const client = await getClient();
  const wallet = xrpl.Wallet.fromSeed(seed);

  // Verify account exists on ledger
  try {
    await client.request({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated',
    });
  } catch (err) {
    throw new Error('Account not found on XRPL testnet. Make sure it is funded.');
  }

  // Check and create any missing trust lines
  const lines = await client.request({
    command: 'account_lines',
    account: wallet.address,
  });
  const existingCurrencies = new Set(lines.result.lines.map((l) => l.currency));

  for (const currency of SUPPORTED_CURRENCIES) {
    const issuer = config.issuers[currency];
    if (!issuer || issuer.address === 'REPLACE_ME') continue;
    if (existingCurrencies.has(currency)) continue;

    await client.submitAndWait(
      {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency,
          issuer: issuer.address,
          value: '999999999',
        },
      },
      { wallet }
    );
  }

  return { address: wallet.address, seed: wallet.seed };
}

// Get all token balances for an address
// Returns: { XRP: '98.5', USD: '500', INR: '0', EUR: '200', NGN: '0' }
export async function getBalances(address) {
  const client = await getClient();

  // XRP balance
  const accInfo = await client.request({
    command: 'account_info',
    account: address,
    ledger_index: 'validated',
  });
  const xrpBalance = xrpl.dropsToXrp(accInfo.result.account_data.Balance);

  // Token balances from trust lines
  const lines = await client.request({
    command: 'account_lines',
    account: address,
  });

  const balances = { XRP: xrpBalance };
  for (const currency of SUPPORTED_CURRENCIES) {
    const issuer = config.issuers[currency];
    if (!issuer) { balances[currency] = '0'; continue; }

    const line = lines.result.lines.find(
      (l) => l.currency === currency && l.account === issuer.address
    );
    balances[currency] = line ? line.balance : '0';
  }

  return balances;
}

// Simulate depositing fiat by minting tokens from issuer to user
export async function mintTokens(userAddress, currency, amount) {
  const client = await getClient();
  const issuer = config.issuers[currency];
  if (!issuer || issuer.address === 'REPLACE_ME') {
    throw new Error(`No issuer configured for ${currency}`);
  }

  const issuerWallet = xrpl.Wallet.fromSeed(issuer.seed);

  const result = await client.submitAndWait(
    {
      TransactionType: 'Payment',
      Account: issuerWallet.address,
      Destination: userAddress,
      Amount: {
        currency,
        issuer: issuerWallet.address,
        value: amount,
      },
    },
    { wallet: issuerWallet }
  );

  return {
    hash: result.result.hash,
    delivered: result.result.meta.delivered_amount,
  };
}
