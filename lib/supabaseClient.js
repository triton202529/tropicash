import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://opbhcndlibbcsmoaeymq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmhjbmRsaWJiY3Ntb2FleW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTM4NjIsImV4cCI6MjA2NzU4OTg2Mn0.Scy3QTema-fyccjeado4ZHoL2s5fjND8useCatvJRyA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
