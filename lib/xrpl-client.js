// lib/xrpl-client.js
// Singleton XRPL client — all API routes share one connection
import * as xrpl from 'xrpl';
import config from './config.json' assert { type: 'json' };

let client = null;
let connecting = false;

export async function getClient() {
  if (client && client.isConnected()) return client;

  // Prevent multiple simultaneous connection attempts
  if (connecting) {
    await new Promise((r) => setTimeout(r, 1000));
    return getClient();
  }

  connecting = true;
  try {
    client = new xrpl.Client(config.testnetUrl);
    client.on('disconnected', () => {
      console.log('XRPL client disconnected — will reconnect on next request');
      client = null;
    });
    await client.connect();
    console.log('XRPL client connected to testnet');
    return client;
  } finally {
    connecting = false;
  }
}
