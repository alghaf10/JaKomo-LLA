import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import { fetchPublicProfiles } from '../lib/friends';
import Card from '../components/Card';
import { useSocialBadge } from '../contexts/SocialBadgeContext';
import {
  fetchIncomingChallenges, fetchMyActiveBattles, fetchFinishedBattles,
  fetchPlayersForBattles, acceptChallenge, declineChallenge,
} from '../lib/battles';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

export default function BattlesScreen({ navigation, headerContent }) {
  const insets = useSafeAreaInsets();
  const { refreshBattleAwaitingCount } = useSocialBadge();
  const [userId, setUserId] = useState(null);
  const [language, setLanguage] = useState(getLanguage());
  const [loading, setLoading] = useState(true);
  const [incomingChallenges, setIncomingChallenges] = useState([]);
  const [activeBattles, setActiveBattles] = useState([]);
  const [finishedBattles, setFinishedBattles] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const loadBattlesData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: profileData } = await fetchProfile(uid);
    const activeLanguage = profileData?.active_language || userData.user.user_metadata?.language;
    setLanguage(getLanguage(activeLanguage));

    const [
      { data: incoming, error: incomingError },
      { data: active, error: activeError },
      { data: finished, error: finishedError },
    ] = await Promise.all([
      fetchIncomingChallenges(uid),
      fetchMyActiveBattles(uid),
      fetchFinishedBattles(uid),
    ]);
    if (incomingError) console.log('Error fetching incoming challenges:', incomingError);
    if (activeError) console.log('Error fetching active battles:', activeError);
    if (finishedError) console.log('Error fetching finished battles:', finishedError);

    const allBattles = [...incoming, ...active, ...finished];
    const battleIds = allBattles.map((b) => b.id);
    const { data: players, error: playersError } = await fetchPlayersForBattles(battleIds);
    if (playersError) console.log('Error fetching battle players:', playersError);

    const playersByBattleId = {};
    players.forEach((p) => {
      if (!playersByBattleId[p.battle_id]) playersByBattleId[p.battle_id] = [];
      playersByBattleId[p.battle_id].push(p);
    });

    const opponentIdByBattleId = {};
    const otherIds = new Set();
    allBattles.forEach((b) => {
      const opponent = (playersByBattleId[b.id] || []).find((p) => p.user_id !== uid);
      if (opponent) {
        opponentIdByBattleId[b.id] = opponent.user_id;
        otherIds.add(opponent.user_id);
      }
    });

    const { data: profiles, error: profilesError } = await fetchPublicProfiles(Array.from(otherIds));
    if (profilesError) console.log('Error fetching opponent profiles:', profilesError);
    const profileById = {};
    profiles.forEach((p) => { profileById[p.user_id] = p; });

    const withOpponent = (b) => ({ ...b, opponent: profileById[opponentIdByBattleId[b.id]] });

    setIncomingChallenges(incoming.map(withOpponent));
    setActiveBattles(active.map(withOpponent));
    setFinishedBattles(finished.map(withOpponent));

    setLoading(false);
    refreshBattleAwaitingCount();
  }, [refreshBattleAwaitingCount]);

  useFocusEffect(
    useCallback(() => {
      loadBattlesData();
    }, [loadBattlesData]),
  );

  const handleAccept = async (battle) => {
    setActioningId(battle.id);
    const { error } = await acceptChallenge(battle.id, battle.created_by);
    setActioningId(null);
    if (error) {
      console.log('Error accepting challenge:', error);
      return;
    }
    loadBattlesData();
  };

  const handleDecline = async (battle) => {
    setActioningId(battle.id);
    const { error } = await declineChallenge(battle.id);
    setActioningId(null);
    if (error) {
      console.log('Error declining challenge:', error);
      return;
    }
    loadBattlesData();
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        {headerContent || <Text style={styles.headerTitle}>Battles</Text>}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={colors.accentCoral} />
        ) : (
          <>
            {incomingChallenges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Challenges</Text>
                {incomingChallenges.map((battle) => (
                  <Card key={battle.id} style={styles.personRow}>
                    <Image source={getAvatarSource(battle.opponent?.avatar_id)} style={styles.avatar} />
                    <View style={styles.personInfo}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {battle.opponent?.first_name || 'Someone'}
                      </Text>
                      <Text style={styles.personMeta}>wants to battle</Text>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(battle)}
                        disabled={actioningId === battle.id}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.neutralBtn}
                        onPress={() => handleDecline(battle)}
                        disabled={actioningId === battle.id}
                      >
                        <Text style={styles.neutralBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Battles</Text>
              {activeBattles.length === 0 ? (
                <Text style={styles.emptyText}>No active battles yet.</Text>
              ) : (
                activeBattles.map((battle) => {
                  const myTurn = battle.turn_user === userId;
                  return (
                    <TouchableOpacity
                      key={battle.id}
                      onPress={() => navigation.navigate('Battle', { battleId: battle.id })}
                    >
                      <Card style={styles.personRow}>
                        <Image source={getAvatarSource(battle.opponent?.avatar_id)} style={styles.avatar} />
                        <View style={styles.personInfo}>
                          <Text style={styles.personName} numberOfLines={1}>
                            {battle.opponent?.first_name || 'Someone'}
                          </Text>
                        </View>
                        <View style={myTurn ? styles.turnBadge : styles.neutralBadge}>
                          <Text style={myTurn ? styles.turnBadgeText : styles.neutralBadgeText}>
                            {myTurn ? 'Your turn' : 'Their turn'}
                          </Text>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {finishedBattles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Finished</Text>
                {finishedBattles.map((battle) => {
                  const outcome = battle.winner_side === null
                    ? 'tie'
                    : battle.winner_side === battle.mySide ? 'won' : 'lost';
                  return (
                    <TouchableOpacity
                      key={battle.id}
                      onPress={() => navigation.navigate('Battle', { battleId: battle.id })}
                    >
                      <Card style={styles.personRow}>
                        <Image source={getAvatarSource(battle.opponent?.avatar_id)} style={styles.avatar} />
                        <View style={styles.personInfo}>
                          <Text style={styles.personName} numberOfLines={1}>
                            {battle.opponent?.first_name || 'Someone'}
                          </Text>
                        </View>
                        <View
                          style={
                            outcome === 'won' ? styles.wonBadge
                              : outcome === 'lost' ? styles.lostBadge : styles.neutralBadge
                          }
                        >
                          <Text
                            style={
                              outcome === 'won' ? styles.wonBadgeText
                                : outcome === 'lost' ? styles.lostBadgeText : styles.neutralBadgeText
                            }
                          >
                            {outcome === 'won' ? 'Won' : outcome === 'lost' ? 'Lost' : 'Tie'}
                          </Text>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: fontWeight.medium, marginBottom: 14 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  personRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    borderColor: colors.border, borderWidth: 1,
  },
  personInfo: { flex: 1, marginRight: 8 },
  personName: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  personMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtn: { backgroundColor: colors.success, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7 },
  acceptBtnText: { color: colors.onGradient, fontSize: 12, fontWeight: fontWeight.medium },
  neutralBtn: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7,
  },
  neutralBtnText: { color: colors.text, fontSize: 12, fontWeight: fontWeight.medium },
  neutralBadge: {
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 6,
  },
  neutralBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: fontWeight.medium },
  turnBadge: { backgroundColor: colors.accentCoral, borderRadius: radius, paddingHorizontal: 10, paddingVertical: 6 },
  turnBadgeText: { color: colors.onGradient, fontSize: 11, fontWeight: fontWeight.medium },
  wonBadge: { backgroundColor: colors.success, borderRadius: radius, paddingHorizontal: 10, paddingVertical: 6 },
  wonBadgeText: { color: colors.onGradient, fontSize: 11, fontWeight: fontWeight.medium },
  lostBadge: {
    backgroundColor: colors.dangerTint, borderColor: colors.danger, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 6,
  },
  lostBadgeText: { color: colors.danger, fontSize: 11, fontWeight: fontWeight.medium },
});
