// app/api/escrow/route.js
// POST: create escrow  |  PUT: finish/claim escrow
import { NextResponse } from 'next/server';
import * as xrpl from 'xrpl';
import { generateEscrowCode, codeToCondition, createEscrow, finishEscrow } from '@/lib/xrpl-escrow';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { senderSeed, destinationAddress, xrpAmount, cancelSeconds } = await req.json();

    if (!senderSeed || !xrpAmount) {
      return NextResponse.json({ error: 'senderSeed and xrpAmount required' }, { status: 400 });
    }

    const codeData = generateEscrowCode();
    const dest = destinationAddress || xrpl.Wallet.fromSeed(senderSeed).address;

    const escrow = await createEscrow(
      senderSeed, dest, xrpAmount, codeData.conditionHex, cancelSeconds || 300
    );

    // Only store non-secret routing data.
    // preimage and fulfillment are NOT stored — they are re-derived from the code at claim time.
    // condition_hex is the on-chain hash (public), stored here only to verify the code at claim.
    await supabase.from('escrow_codes').insert({
      human_code: codeData.humanCode,
      condition_hex: codeData.conditionHex,
      owner_address: escrow.ownerAddress,
      escrow_sequence: escrow.sequence,
      amount: xrpAmount,
      expires_at: new Date(escrow.expiresAt).toISOString(),
      tx_hash_create: escrow.hash,
    });

    return NextResponse.json({
      success: true,
      code: codeData.humanCode,
      expiresAt: escrow.expiresAt,
      amount: xrpAmount,
      txHash: escrow.hash,
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
      .select('id, owner_address, escrow_sequence, condition_hex, expires_at, amount, status')
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
    await supabase
      .from('escrow_codes')
      .update({ status: 'claimed', tx_hash_finish: result.hash, destination_address: claimer.address })
      .eq('id', escrowRecord.id);

    return NextResponse.json({
      success: true,
      hash: result.hash,
      explorerUrl: result.explorerUrl,
      amount: escrowRecord.amount,
    });
  } catch (err) {
    console.error('Escrow finish failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
