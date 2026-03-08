// lib/xrpl-escrow.js
// Code-based escrow: generate condition/fulfillment, create and finish escrow
import crypto from 'crypto';
import * as xrpl from 'xrpl';
import { getClient } from './xrpl-client.js';

const DERIVATION_PREFIX = 'xenmo-escrow-v1:';

// Derive the PREIMAGE-SHA-256 crypto condition from a user-facing code.
// preimage = SHA256(DERIVATION_PREFIX + normalizedCode)
// condition = SHA256(preimage)
//
// This means: the code IS the secret. Nothing sensitive needs to be stored in the DB.
// The DB only holds condition_hex (the hash of the hash — same as what's on-chain).
export function codeToCondition(code) {
  const normalized = code.replace(/-/g, '').toUpperCase();
  const preimageBytes = crypto.createHash('sha256')
    .update(DERIVATION_PREFIX + normalized)
    .digest();

  // PREIMAGE-SHA-256 fulfillment TLV: A0 22 80 20 <32-byte preimage>
  const fulfillmentHex = ('A0228020' + preimageBytes.toString('hex')).toUpperCase();

  // Condition TLV: A0 25 80 20 <32-byte SHA256(preimage)> 81 01 20
  const conditionHash = crypto.createHash('sha256').update(preimageBytes).digest();
  const conditionHex = ('A0258020' + conditionHash.toString('hex') + '810120').toUpperCase();

  return { conditionHex, fulfillmentHex };
}

// Generate a cryptographically random 6-digit code (000000–999999).
// Returns: { humanCode, conditionHex, fulfillmentHex }
// NOTE: preimage is NOT returned — it is re-derived from the code at claim time.
// 6 digits is acceptable here: escrows expire in 5–10 min, brute-force window is negligible.
export function generateEscrowCode() {
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const humanCode = (randomNum % 1000000).toString().padStart(6, '0');

  const { conditionHex, fulfillmentHex } = codeToCondition(humanCode);
  return { humanCode, conditionHex, fulfillmentHex };
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
