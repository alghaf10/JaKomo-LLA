import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchIncomingRequestCount } from '../lib/friends';

const SocialBadgeContext = createContext({
  pendingRequestCount: 0,
  refreshPendingRequestCount: () => {},
});

export function SocialBadgeProvider({ children }) {
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const refreshPendingRequestCount = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { count, error } = await fetchIncomingRequestCount(userData.user.id);
    if (error) {
      console.log('Error refreshing pending request count:', error);
      return;
    }
    setPendingRequestCount(count || 0);
  }, []);

  return (
    <SocialBadgeContext.Provider value={{ pendingRequestCount, refreshPendingRequestCount }}>
      {children}
    </SocialBadgeContext.Provider>
  );
}

export const useSocialBadge = () => useContext(SocialBadgeContext);
