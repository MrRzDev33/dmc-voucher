
import { createClient } from '@supabase/supabase-js';

// =================================================================================
// KONFIGURASI SUPABASE
// Masukkan URL dan Key project Supabase Anda di sini.
// Anda bisa mendapatkannya di Dashboard Supabase -> Project Settings -> API
// =================================================================================

const SUPABASE_URL = 'https://pewydczjsqxzrvcowgqm.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3lkY3pqc3F4enJ2Y293Z3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTQ2MTYsImV4cCI6MjA3OTE3MDYxNn0.AoswmBCEP1mXgiN7ye8a37dTAhlh5bzkLmf5I_lAFk4';

// Mengaktifkan Supabase Client
// Pastikan URL dan KEY di atas sesuai dengan project Supabase Anda.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
