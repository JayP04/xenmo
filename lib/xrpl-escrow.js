// lib/xrpl-escrow.js
// Code-based escrow: generate condition/fulfillment, create and finish escrow
import crypto from 'crypto';
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';

// Generate a 6-digit human code mapped to a PREIMAGE-SHA-256 condition
// Returns: { preimageHex, conditionHex, fulfillmentHex, humanCode }
export function generateEscrowCode() {
  const preimageBytes = crypto.randomBytes(32);

  // PREIMAGE-SHA-256 fulfillment: type prefix + length + preimage
  const fulfillmentHex = ('A0228020' + preimageBytes.toString('hex')).toUpperCase();

  // Condition: type prefix + SHA-256(preimage) + length encoding
  const hash = crypto.createHash('sha256').update(preimageBytes).digest();
  const conditionHex = ('A0258020' + hash.toString('hex') + '810120').toUpperCase();

  // Map first 3 bytes to a 6-digit code
  const codeNum = (preimageBytes[0] * 256 * 256 + preimageBytes[1] * 256 + preimageBytes[2]) % 1000000;
  const humanCode = codeNum.toString().padStart(6, '0');

  return { preimageHex: preimageBytes.toString('hex'), conditionHex, fulfillmentHex, humanCode };
}

// Reconstruct fulfillment hex from stored preimage
export function reconstructFulfillment(preimageHex) {
  return ('A0228020' + preimageHex).toUpperCase();
}

// Create a conditional escrow on XRPL
// Locks XRP with a condition that can be unlocked with the human code
export async function createEscrow(senderSeed, destinationAddress, xrpAmount, conditionHex, cancelSeconds = 300) {
  const client = await getClient();
  const wallet = xrpl.Wallet.fromSeed(senderSeed);

  const cancelAfterDate = new Date();
  cancelAfterDate.setSeconds(cancelAfterDate.getSeconds() + cancelSeconds);
  const cancelAfterRipple = xrpl.isoTimeToRippleTime(cancelAfterDate.toISOString());

  const escrowTx = {
    TransactionType: 'EscrowCreate',
    Account: wallet.address,
    Destination: destinationAddress,
    Amount: xrpl.xrpToDrops(xrpAmount),
    Condition: conditionHex,
    CancelAfter: cancelAfterRipple,
  };

  const result = await client.submitAndWait(escrowTx, { wallet });
  const meta = result.result.meta;

  if (meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Escrow creation failed: ${meta.TransactionResult}`);
  }

  // Get sequence number (xrpl.js version-safe)
  const sequence = result.result.Sequence
    || result.result.tx_json?.Sequence
    || result.result.tx_json?.sequence;

  return {
    hash: result.result.hash,
    ownerAddress: wallet.address,
    sequence,
    expiresAt: cancelAfterDate.toISOString(),
  };
}

// Finish (claim) an escrow with the fulfillment code
export async function finishEscrow(claimerSeed, ownerAddress, sequence, conditionHex, fulfillmentHex) {
  const client = await getClient();
  const wallet = xrpl.Wallet.fromSeed(claimerSeed);

  const finishTx = {
    TransactionType: 'EscrowFinish',
    Account: wallet.address,
    Owner: ownerAddress,
    OfferSequence: sequence,
    Condition: conditionHex,
    Fulfillment: fulfillmentHex,
  };

  const result = await client.submitAndWait(finishTx, { wallet });
  const meta = result.result.meta;

  if (meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Escrow finish failed: ${meta.TransactionResult}`);
  }

  return {
    hash: result.result.hash,
    explorerUrl: `https://testnet.xrpl.org/transactions/${result.result.hash}`,
    result: meta.TransactionResult,
  };
}
