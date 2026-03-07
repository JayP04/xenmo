# RemitX — Cross-Border P2P Payments on XRPL

Send money anywhere in the world, instantly, with near-zero fees. Built on the XRP Ledger.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
Copy your bootstrap `config.json` into the project:
```bash
cp /path/to/your/config.json lib/config.json
```

Create `.env.local` with:
```
MONGODB_URI=mongodb+srv://your_connection_string
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_TESTNET_URL=wss://s.altnet.rippletest.net:51233
NEXT_PUBLIC_EXPLORER_URL=https://testnet.xrpl.org
```

### 3. Run
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Demo login
Use the demo user seeds from your bootstrap config.json to import a pre-funded wallet.

## Features

- **QR Payments** — Scan a QR code to pay anyone, in any currency
- **Escrow Codes** — Generate a 6-digit code to send money to someone without the app
- **Request Money** — Request payment from any wallet address
- **Real-time Updates** — WebSocket subscriptions for instant balance changes
- **Fee Comparison** — Side-by-side comparison vs Western Union, Wise, bank wires
- **Transaction History** — Full balance change breakdown with XRPL Explorer links
- **AI Chatbot** — Gemini-powered assistant for user help

## XRPL Features Used

1. **Cross-currency payments** — Atomic USD→XRP→INR conversion
2. **DEX order book** — OfferCreate with bid-ask spread for liquidity
3. **Conditional escrow** — PREIMAGE-SHA-256 for code-based transfers
4. **Issued tokens** — Simulated fiat stablecoins (USD, INR, EUR, NGN)
5. **Trust lines** — Opt-in security preventing unauthorized transfers
6. **WebSocket subscriptions** — Real-time transaction notifications
7. **XRP auto-bridging** — Manual path through XRP connects any currency pair

## Tech Stack

- Next.js 14 (App Router)
- xrpl.js
- Supabase
- Tailwind CSS
- Google Gemini API
- XRPL Testnet

## Architecture

```
User → Next.js Frontend → API Routes → xrpl.js → XRPL Testnet
                                      ↓
                                  Supabase
                              (users, transactions,
                               requests, escrow codes)
```

## Team

Built for the Ripple XRPL Real-World Impact hackathon track.
