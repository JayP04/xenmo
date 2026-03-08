// app/api/user/route.js
// GET: lookup user by username or wallet address
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const address = searchParams.get('address');

    if (!username && !address) {
      return NextResponse.json({ error: 'username or address required' }, { status: 400 });
    }

    let query = supabase.from('users').select('wallet_address, display_name, username, base_currency');

    if (username) {
      query = query.eq('username', username.toLowerCase());
    } else {
      query = query.eq('wallet_address', address);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        address: data.wallet_address,
        username: data.username,
        displayName: data.display_name,
        baseCurrency: data.base_currency,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
