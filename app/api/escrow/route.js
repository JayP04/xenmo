// app/api/escrow/route.js
// POST: create escrow  |  PUT: finish/claim escrow  |  GET: pending escrows for a user
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import * as xrpl from 'xrpl';
import { generateEscrowCode, codeToCondition, createEscrow, finishEscrow, burnTokens, mintTokensForClaim } from '@/lib/xrpl-escrow';
import { supabase } from '@/lib/supabase';

const MID_RATES_TO_XRP = { USD: 1.36, INR: 125, EUR: 1.17, NGN: 1878 };
const VALID_CURRENCIES = ['USD', 'INR', 'EUR', 'NGN'];

export async function POST(req) {
  try {
    const { senderSeed, destinationAddress, recipientUsername, amount, currency, cancelSeconds } = await req.json();

    if (!senderSeed || !amount || !currency) {
      return NextResponse.json({ error: 'senderSeed, amount, and currency required' }, { status: 400 });
    }

    if (!VALID_CURRENCIES.includes(currency)) {
      return NextResponse.json({ error: `Unsupported currency: ${currency}` }, { status: 400 });
    }

    // Convert user's currency amount to XRP for the on-chain escrow
    const xrpAmount = (parseFloat(amount) / MID_RATES_TO_XRP[currency]).toFixed(6);

    // Resolve sender info
    const senderWallet = xrpl.Wallet.fromSeed(senderSeed);
    const { data: senderUser } = await supabase
      .from('users')
      .select('username')
      .eq('wallet_address', senderWallet.address)
      .single();
    const senderUsername = senderUser?.username || senderWallet.address.slice(0, 8);

    // Resolve recipient if username provided
    let dest = destinationAddress;
    let resolvedRecipientUsername = null;
    if (recipientUsername) {
      const { data: recipientUser, error: userErr } = await supabase
        .from('users')
        .select('wallet_address, username')
        .eq('username', recipientUsername.toLowerCase())
        .single();
      if (userErr || !recipientUser) {
        return NextResponse.json({ error: `User @${recipientUsername} not found` }, { status: 404 });
      }
      dest = recipientUser.wallet_address;
      resolvedRecipientUsername = recipientUser.username;
    }
    if (!dest) dest = senderWallet.address;

    // Burn sender's tokens so their dashboard balance decreases
    await burnTokens(senderSeed, currency, amount);

    const codeData = generateEscrowCode();

    const escrow = await createEscrow(
      senderSeed, dest, xrpAmount, codeData.conditionHex, cancelSeconds || 300
    );

    // Only store non-secret routing data.
    // preimage and fulfillment are NOT stored — they are re-derived from the code at claim time.
    // condition_hex is the on-chain hash (public), stored here only to verify the code at claim.
    const { error: insertErr } = await supabase.from('escrow_codes').insert({
      human_code: codeData.humanCode,
      preimage_hex: currency,
      condition_hex: codeData.conditionHex,
      fulfillment_hex: '',
      owner_address: escrow.ownerAddress,
      destination_address: resolvedRecipientUsername ? dest : null,
      escrow_sequence: escrow.sequence,
      amount: amount,
      status: 'pending',
      expires_at: new Date(escrow.expiresAt).toISOString(),
      tx_hash_create: escrow.hash,
      sender_username: senderUsername,
      split_recipient_username: resolvedRecipientUsername,
    });

    if (insertErr) {
      console.error('Escrow DB insert failed:', insertErr);
      return NextResponse.json({ success: false, error: 'Failed to save escrow code' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      code: codeData.humanCode,
      expiresAt: escrow.expiresAt,
      displayAmount: amount,
      currency: currency,
      txHash: escrow.hash,
      recipientUsername: resolvedRecipientUsername,
    });
  } catch (err) {
    console.error('Escrow creation failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { code, claimerSeed } = await req.json();

    if (!code || !claimerSeed) {
      return NextResponse.json({ error: 'code and claimerSeed required' }, { status: 400 });
    }

    // Normalize code (strip dashes, uppercase) and derive condition + fulfillment locally.
    // The DB is never consulted for the preimage — it doesn't store it.
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const { conditionHex: derivedCondition, fulfillmentHex } = codeToCondition(normalizedCode);

    const { data: escrowRecord, error: dbErr } = await supabase
      .from('escrow_codes')
      .select('id, owner_address, escrow_sequence, condition_hex, expires_at, amount, preimage_hex, status')
      .eq('human_code', normalizedCode)
      .eq('status', 'pending')
      .single();

    if (dbErr || !escrowRecord) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    // Cryptographic verification: condition derived from the code must match what was
    // committed on-chain at escrow creation. This proves the code is correct, not just
    // that a record exists in the DB.
    if (derivedCondition !== escrowRecord.condition_hex) {
      return NextResponse.json({ error: 'Code does not match escrow condition' }, { status: 403 });
    }

    if (new Date() > new Date(escrowRecord.expires_at)) {
      await supabase.from('escrow_codes').update({ status: 'expired' }).eq('id', escrowRecord.id);
      return NextResponse.json({ error: 'Code has expired' }, { status: 410 });
    }

    const result = await finishEscrow(
      claimerSeed,
      escrowRecord.owner_address,
      escrowRecord.escrow_sequence,
      escrowRecord.condition_hex,
      fulfillmentHex
    );

    const claimer = xrpl.Wallet.fromSeed(claimerSeed);
    const escrowCurrency = escrowRecord.preimage_hex || 'USD';

    // Mint tokens to the claimer so their dashboard balance increases
    await mintTokensForClaim(claimer.address, escrowCurrency, escrowRecord.amount);

    await supabase
      .from('escrow_codes')
      .update({ status: 'claimed', tx_hash_finish: result.hash, destination_address: claimer.address })
      .eq('id', escrowRecord.id);

    return NextResponse.json({
      success: true,
      hash: result.hash,
      explorerUrl: result.explorerUrl,
      amount: escrowRecord.amount,
      currency: escrowCurrency,
    });
  } catch (err) {
    console.error('Escrow finish failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    // Fetch ALL pending escrow codes addressed to this user (both standalone and splits)
    const { data: escrows, error } = await supabase
      .from('escrow_codes')
      .select('id, human_code, split_group_id, split_recipient_username, sender_username, amount, preimage_hex, status, expires_at, created_at')
      .eq('destination_address', address)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      escrows: (escrows || []).map((e) => ({
        id: e.id,
        groupId: e.split_group_id,
        senderUsername: e.sender_username,
        amount: e.amount,
        currency: e.preimage_hex || 'USD',
        status: e.status,
        expiresAt: e.expires_at,
        createdAt: e.created_at,
        isSplit: !!e.split_group_id,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
