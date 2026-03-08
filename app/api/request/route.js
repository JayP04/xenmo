// app/api/request/route.js
// GET: list requests for an address
// POST: create a new request
// PUT: approve or decline a request
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 });

    const { data: requests, error: dbErr } = await supabase
      .from('payment_requests')
      .select('*')
      .or(`to_address.eq.${address},from_address.eq.${address}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (dbErr) throw dbErr;

    // Map snake_case to camelCase for frontend compatibility
    const mapped = (requests || []).map((r) => ({
      id: r.id,
      fromAddress: r.from_address,
      toAddress: r.to_address,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      txHash: r.tx_hash,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ success: true, requests: mapped });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { fromAddress, toAddress, amount, currency } = await req.json();
    if (!fromAddress || !toAddress || !amount || !currency) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const { data, error: dbErr } = await supabase
      .from('payment_requests')
      .insert({ from_address: fromAddress, to_address: toAddress, amount, currency })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { requestId, action, txHash } = await req.json();
    if (!requestId || !action) {
      return NextResponse.json({ error: 'requestId and action required' }, { status: 400 });
    }

    const update = { status: action };
    if (txHash) update.tx_hash = txHash;

    const { data, error: dbErr } = await supabase
      .from('payment_requests')
      .update(update)
      .eq('id', requestId)
      .select()
      .single();

    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
