// app/api/payment/route.js
// GET: exchange rate  |  POST: send payment
import { NextResponse } from 'next/server';
import { getRate, sendPayment } from '@/lib/xrpl-payment';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const amount = searchParams.get('amount');

    if (!from || !to || !amount) {
      return NextResponse.json({ error: 'from, to, and amount required' }, { status: 400 });
    }

    const rate = await getRate(from, to, amount);
    return NextResponse.json({ success: true, ...rate });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { senderSeed, destAddress, amount, destCurrency, sendMaxCurrency } = await req.json();

    if (!senderSeed || !destAddress || !amount || !destCurrency || !sendMaxCurrency) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const result = await sendPayment(senderSeed, destAddress, amount, destCurrency, sendMaxCurrency);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Payment failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
