import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchIncomingRequestCount } from '../lib/friends';
import { fetchIncomingChallenges, fetchMyActiveBattles } from '../lib/battles';

const SocialBadgeContext = createContext({
  pendingRequestCount: 0,
  battleAwaitingCount: 0,
  badgeTotal: 0,
  refreshPendingRequestCount: () => {},
  refreshBattleAwaitingCount: () => {},
});

export function SocialBadgeProvider({ children }) {
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [battleAwaitingCount, setBattleAwaitingCount] = useState(0);

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

  // Battles waiting on me = incoming challenges + active battles where it's
  // my turn.
  const refreshBattleAwaitingCount = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const uid = userData.user.id;

    const [
      { data: incoming, error: incomingError },
      { data: active, error: activeError },
    ] = await Promise.all([
      fetchIncomingChallenges(uid),
      fetchMyActiveBattles(uid),
    ]);
    if (incomingError || activeError) return;

    const myTurnCount = active.filter((b) => b.turn_user === uid).length;
    setBattleAwaitingCount(incoming.length + myTurnCount);
  }, []);

  useEffect(() => {
    refreshPendingRequestCount();
    refreshBattleAwaitingCount();

    // No filter: postgres_changes respects RLS, so only battles I'm a
    // participant in (or created) ever reach this handler — each event just
    // triggers a cheap recount. Realtime auth is kept in sync globally by
    // the onAuthStateChange -> realtime.setAuth listener in lib/supabase.js.
    const channel = supabase
      .channel('social-badge-battles')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'battles' },
        () => refreshBattleAwaitingCount(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battles' },
        () => refreshBattleAwaitingCount(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshPendingRequestCount, refreshBattleAwaitingCount]);

  const badgeTotal = pendingRequestCount + battleAwaitingCount;

  return (
    <SocialBadgeContext.Provider
      value={{
        pendingRequestCount,
        battleAwaitingCount,
        badgeTotal,
        refreshPendingRequestCount,
        refreshBattleAwaitingCount,
      }}
    >
      {children}
    </SocialBadgeContext.Provider>
  );
}

export const useSocialBadge = () => useContext(SocialBadgeContext);
