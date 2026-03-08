// lib/supabase.js
// Supabase client for server-side API routes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase env vars not set — database features will not work');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');