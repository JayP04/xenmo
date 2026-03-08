// lib/supabase.js
// Supabase client for server-side API routes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase env vars not set — database features will not work');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

/*
  Run this SQL in your Supabase SQL Editor to create the required tables:

  CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    wallet_seed TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    username TEXT UNIQUE NOT NULL,
    base_currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE payment_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE escrow_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    human_code TEXT NOT NULL,
    preimage_hex TEXT NOT NULL DEFAULT '',
    condition_hex TEXT NOT NULL,
    fulfillment_hex TEXT NOT NULL DEFAULT '',
    owner_address TEXT NOT NULL,
    destination_address TEXT DEFAULT '',
    escrow_sequence INTEGER NOT NULL,
    amount TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    tx_hash_create TEXT,
    tx_hash_finish TEXT,
    split_group_id TEXT,
    split_recipient_username TEXT,
    sender_username TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
*/
