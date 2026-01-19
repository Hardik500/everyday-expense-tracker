import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    if (import.meta.env.PROD) {
        console.error('CRITICAL: Supabase environment variables are missing in production!');
    } else {
        console.warn('Supabase environment variables are missing. Auth will not work correctly.');
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
