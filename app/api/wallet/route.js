// app/api/wallet/route.js
// POST: create new wallet  |  PUT: import existing  |  GET: balances
import { NextResponse } from 'next/server';
import { createWallet, importWallet, getBalances, mintTokens } from '@/lib/xrpl-wallet';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { displayName, baseCurrency } = await req.json().catch(() => ({}));
    const currency = baseCurrency || 'USD';

    const wallet = await createWallet();

    const startingAmounts = { USD: '500', INR: '25000', EUR: '400', NGN: '100000' };
    await mintTokens(wallet.address, currency, startingAmounts[currency] || '500');

    await supabase.from('users').insert({
      wallet_address: wallet.address,
      wallet_seed: wallet.seed,
      display_name: displayName || '',
      base_currency: currency,
    });

    return NextResponse.json({
      success: true,
      address: wallet.address,
      seed: wallet.seed,
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
    const { seed, displayName, baseCurrency } = await req.json();
    if (!seed) return NextResponse.json({ error: 'Seed is required' }, { status: 400 });

    const wallet = await importWallet(seed);

    await supabase.from('users').upsert(
      {
        wallet_address: wallet.address,
        wallet_seed: wallet.seed,
        display_name: displayName || '',
        base_currency: baseCurrency || 'USD',
      },
      { onConflict: 'wallet_address' }
    );

    return NextResponse.json({ success: true, address: wallet.address });
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
