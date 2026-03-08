// app/api/split/route.js
// POST: create a split payment (multiple escrows from one sender)
// GET: get pending splits for a recipient (by address)
// PUT: claim a split escrow with code
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as xrpl from 'xrpl';
import { generateEscrowCode, codeToCondition, createEscrow, finishEscrow } from '@/lib/xrpl-escrow';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { senderSeed, splits, cancelSeconds } = await req.json();
    // splits: [{ username, amount }]

    if (!senderSeed || !splits || !Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json({ error: 'senderSeed and splits[] required' }, { status: 400 });
    }

    if (splits.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 recipients per split' }, { status: 400 });
    }

    // Resolve sender username from seed
    const senderWallet = xrpl.Wallet.fromSeed(senderSeed);
    const { data: senderUser } = await supabase
      .from('users')
      .select('username, display_name')
      .eq('wallet_address', senderWallet.address)
      .single();
    const senderUsername = senderUser?.username || senderWallet.address.slice(0, 8);

    // Resolve all usernames to addresses
    const resolvedSplits = [];
    for (const split of splits) {
      if (!split.username || !split.amount || parseFloat(split.amount) <= 0) {
        return NextResponse.json({ error: `Invalid split entry: ${JSON.stringify(split)}` }, { status: 400 });
      }

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('wallet_address, username, display_name')
        .eq('username', split.username.toLowerCase())
        .single();

      if (userErr || !user) {
        return NextResponse.json({ error: `User @${split.username} not found` }, { status: 404 });
      }

      resolvedSplits.push({
        username: user.username,
        displayName: user.display_name,
        address: user.wallet_address,
        amount: split.amount,
      });
    }

    const totalAmount = resolvedSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const groupId = crypto.randomBytes(8).toString('hex');
    const results = [];

    // Create an escrow for each recipient
    for (const split of resolvedSplits) {
      const codeData = generateEscrowCode();

      const escrow = await createEscrow(
        senderSeed,
        split.address,
        split.amount,
        codeData.conditionHex,
        cancelSeconds || 600 // 10 min default for splits
      );

      const { error: insertErr } = await supabase.from('escrow_codes').insert({
        human_code: codeData.humanCode,
        preimage_hex: '',
        condition_hex: codeData.conditionHex,
        fulfillment_hex: '',
        owner_address: escrow.ownerAddress,
        destination_address: split.address,
        escrow_sequence: escrow.sequence,
        amount: split.amount,
        status: 'pending',
        expires_at: new Date(escrow.expiresAt).toISOString(),
        tx_hash_create: escrow.hash,
        split_group_id: groupId,
        split_recipient_username: split.username,
        sender_username: senderUsername,
      });

      if (insertErr) {
        console.error('Split escrow DB insert failed:', insertErr);
        throw new Error('Failed to save escrow code: ' + insertErr.message);
      }

      results.push({
        username: split.username,
        displayName: split.displayName,
        amount: split.amount,
        code: codeData.humanCode,
        expiresAt: escrow.expiresAt,
        txHash: escrow.hash,
      });
    }

    return NextResponse.json({
      success: true,
      groupId,
      totalAmount: totalAmount.toFixed(2),
      splitCount: results.length,
      splits: results,
    });
  } catch (err) {
    console.error('Split payment failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const groupId = searchParams.get('groupId');

    // Fetch by group ID (sender viewing their split)
    if (groupId) {
      const { data: escrows, error } = await supabase
        .from('escrow_codes')
        .select('human_code, split_recipient_username, amount, status, expires_at, destination_address, sender_username')
        .eq('split_group_id', groupId)
        .order('created_at', { ascending: true });

      if (error || !escrows || escrows.length === 0) {
        return NextResponse.json({ error: 'Split group not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        groupId,
        splits: escrows.map((e) => ({
          username: e.split_recipient_username,
          amount: e.amount,
          code: e.human_code,
          status: e.status,
          expiresAt: e.expires_at,
        })),
      });
    }

    // Fetch pending splits for a recipient (by wallet address)
    if (!address) {
      return NextResponse.json({ error: 'address or groupId required' }, { status: 400 });
    }

    const { data: escrows, error } = await supabase
      .from('escrow_codes')
      .select('id, split_group_id, split_recipient_username, sender_username, amount, status, expires_at, created_at')
      .eq('destination_address', address)
      .not('split_group_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      splits: (escrows || []).map((e) => ({
        id: e.id,
        groupId: e.split_group_id,
        senderUsername: e.sender_username,
        amount: e.amount,
        status: e.status,
        expiresAt: e.expires_at,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { escrowId, code, claimerSeed } = await req.json();

    if (!escrowId || !code || !claimerSeed) {
      return NextResponse.json({ error: 'escrowId, code, and claimerSeed required' }, { status: 400 });
    }

    // Derive condition + fulfillment from the code — DB is never consulted for the preimage
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const { conditionHex: derivedCondition, fulfillmentHex } = codeToCondition(normalizedCode);

    const { data: escrowRecord, error: dbErr } = await supabase
      .from('escrow_codes')
      .select('id, owner_address, escrow_sequence, condition_hex, expires_at, amount, status')
      .eq('id', escrowId)
      .eq('status', 'pending')
      .single();

    if (dbErr || !escrowRecord) {
      return NextResponse.json({ error: 'Split not found or already claimed' }, { status: 404 });
    }

    // Cryptographic verification: code must produce the condition committed on-chain
    if (derivedCondition !== escrowRecord.condition_hex) {
      return NextResponse.json({ error: 'Incorrect code' }, { status: 403 });
    }

    if (new Date() > new Date(escrowRecord.expires_at)) {
      await supabase.from('escrow_codes').update({ status: 'expired' }).eq('id', escrowRecord.id);
      return NextResponse.json({ error: 'This split has expired. Funds returned to sender.' }, { status: 410 });
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
    console.error('Split claim failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
