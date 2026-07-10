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

// supabase-js only forwards the auth token to the realtime socket on
// SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT — it skips INITIAL_SESSION, which is
// what fires for a returning user whose session loads from storage. Without
// this, postgres_changes subscriptions connect unauthenticated and RLS
// silently filters out every row for that user.
supabase.auth.onAuthStateChange((_event, session) => {
  supabase.realtime.setAuth(session?.access_token ?? null);
});
