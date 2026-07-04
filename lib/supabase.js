import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hbgjyttyfaaxqzuszdby.supabase.co';
const supabaseAnonKey = 'sb_publishable_VGgJIQcX9rdeqjY6dMbpbg_I0Fbk3B9';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
