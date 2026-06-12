import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Advertencia: SUPABASE_URL o SUPABASE_SERVICE_KEY no están definidos en las variables de entorno.');
}

// Inicializar el cliente de Supabase usando el Service Key para omitir RLS
export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
