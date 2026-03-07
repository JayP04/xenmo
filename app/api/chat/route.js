// app/api/chat/route.js
// Proxies chat messages to Google Gemini API with RemitX context
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are RemitX Assistant, a helpful chatbot for a cross-border payment app built on the XRP Ledger.

About RemitX:
- Send money internationally with near-zero fees using XRPL blockchain
- Supports USD, INR, EUR, NGN currencies
- Three ways to send: QR scan, escrow code (6-digit), or direct address
- Fees: ~$0.00 (0.000012 XRP per transaction) vs Western Union ($12+ per transfer)
- Settlement: 3-5 seconds vs banks (2-5 days)
- Exchange rates come from the XRPL decentralized exchange at market rates

How to use:
- Create a wallet: tap "Create Wallet" on the home screen
- Send money: go to Send, enter address or scan QR, pick amount and currency
- Receive: share your QR code or wallet address
- Escrow code: generate a 6-digit code, share with recipient, they claim at /claim
- Request money: go to Request, enter the payer's address and amount

Security:
- Trust lines ensure you only accept tokens from verified issuers
- Escrow codes auto-expire in 5 minutes — funds return if unclaimed
- All transactions are atomic — fully complete or fully reversed, never stuck

Keep responses short, friendly, and focused on helping the user. If they ask about something unrelated to payments, gently redirect.`;

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "Chat assistant is not configured yet. Add your GEMINI_API_KEY to .env.local to enable it.",
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: message }] }],
        }),
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data, null, 2));
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ reply: 'Chat is temporarily unavailable.' }, { status: 500 });
  }
}
