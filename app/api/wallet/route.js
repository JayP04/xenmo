// app/api/wallet/route.js
// POST: create new wallet  |  PUT: import existing  |  GET: balances
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createWallet, importWallet, getBalances, mintTokens } from '@/lib/xrpl-wallet';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { displayName, baseCurrency, username } = await req.json().catch(() => ({}));
    const currency = baseCurrency || 'USD';

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscores)' }, { status: 400 });
    }

    // Check username uniqueness
    const { data: existing } = await supabase.from('users').select('id').eq('username', username.toLowerCase()).single();
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const wallet = await createWallet();

    const startingAmounts = { USD: '500', INR: '25000', EUR: '400', NGN: '100000' };
    await mintTokens(wallet.address, currency, startingAmounts[currency] || '500');

    await supabase.from('users').insert({
      wallet_address: wallet.address,
      wallet_seed: wallet.seed,
      display_name: displayName || '',
      username: username.toLowerCase(),
      base_currency: currency,
    });

    return NextResponse.json({
      success: true,
      address: wallet.address,
      seed: wallet.seed,
      username: username.toLowerCase(),
      baseCurrency: currency,
      startingBalance: startingAmounts[currency],
    });
  } catch (err) {
    console.error('Wallet creation failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { seed, displayName, baseCurrency, username } = await req.json();
    if (!seed) return NextResponse.json({ error: 'Seed is required' }, { status: 400 });

    const wallet = await importWallet(seed);

    // Check if user already exists (re-login)
    const { data: existingUser } = await supabase.from('users').select('*').eq('wallet_address', wallet.address).single();

    if (existingUser) {
      return NextResponse.json({ success: true, address: wallet.address, username: existingUser.username });
    }

    // New import — require username
    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Username required for new wallets (3-20 chars, letters/numbers/underscores)' }, { status: 400 });
    }

    const { data: taken } = await supabase.from('users').select('id').eq('username', username.toLowerCase()).single();
    if (taken) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    await supabase.from('users').insert({
      wallet_address: wallet.address,
      wallet_seed: wallet.seed,
      display_name: displayName || '',
      username: username.toLowerCase(),
      base_currency: baseCurrency || 'USD',
    });

    return NextResponse.json({ success: true, address: wallet.address, username: username.toLowerCase() });
  } catch (err) {
    console.error('Wallet import failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    const balances = await getBalances(address);
    return NextResponse.json({ success: true, balances });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
