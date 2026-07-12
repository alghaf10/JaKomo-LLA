import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import { fetchPublicProfiles } from '../lib/friends';
import GlassCard, { textShadow } from '../components/GlassCard';
import {
  fetchIncomingChallenges, fetchMyActiveBattles, fetchFinishedBattles,
  fetchPlayersForBattles, acceptChallenge, declineChallenge,
} from '../lib/battles';

export default function BattlesScreen({ navigation, headerContent }) {
  const [userId, setUserId] = useState(null);
  const [language, setLanguage] = useState(getLanguage());
  const [loading, setLoading] = useState(true);
  const [incomingChallenges, setIncomingChallenges] = useState([]);
  const [activeBattles, setActiveBattles] = useState([]);
  const [finishedBattles, setFinishedBattles] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const backgrounds = getBackgrounds(language.code);

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
  }, []);

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
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            {headerContent || <Text style={styles.headerTitle}>Battles</Text>}
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                {incomingChallenges.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Challenges</Text>
                    {incomingChallenges.map((battle) => (
                      <GlassCard key={battle.id} style={styles.personRow}>
                        <Image
                          source={getAvatarSource(battle.opponent?.avatar_id)}
                          style={styles.personAvatar}
                        />
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
                      </GlassCard>
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
                          <GlassCard style={styles.personRow}>
                            <Image
                              source={getAvatarSource(battle.opponent?.avatar_id)}
                              style={styles.personAvatar}
                            />
                            <View style={styles.personInfo}>
                              <Text style={styles.personName} numberOfLines={1}>
                                {battle.opponent?.first_name || 'Someone'}
                              </Text>
                            </View>
                            <View style={myTurn ? styles.turnBadge : styles.waitingBadge}>
                              <Text style={myTurn ? styles.turnBadgeText : styles.waitingBadgeText}>
                                {myTurn ? 'Your turn' : "Their turn"}
                              </Text>
                            </View>
                          </GlassCard>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {finishedBattles.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Finished</Text>
                    {finishedBattles.map((battle) => {
                      const won = battle.winner_side === battle.mySide;
                      return (
                        <TouchableOpacity
                          key={battle.id}
                          onPress={() => navigation.navigate('Battle', { battleId: battle.id })}
                        >
                          <GlassCard style={styles.personRow}>
                            <Image
                              source={getAvatarSource(battle.opponent?.avatar_id)}
                              style={styles.personAvatar}
                            />
                            <View style={styles.personInfo}>
                              <Text style={styles.personName} numberOfLines={1}>
                                {battle.opponent?.first_name || 'Someone'}
                              </Text>
                            </View>
                            <View style={won ? styles.wonBadge : styles.lostBadge}>
                              <Text style={won ? styles.wonBadgeText : styles.lostBadgeText}>
                                {won ? 'Won' : 'Lost'}
                              </Text>
                            </View>
                          </GlassCard>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14, ...textShadow,
  },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  personRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginBottom: 12,
  },
  personAvatar: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  personInfo: { flex: 1, marginRight: 8 },
  personName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  personMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtn: {
    backgroundColor: 'rgba(76,217,100,0.9)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  neutralBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  neutralBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  turnBadge: {
    backgroundColor: 'rgba(255,196,0,0.9)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  turnBadgeText: { color: '#1a1a1a', fontSize: 11, fontWeight: '700' },
  waitingBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  waitingBadgeText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  wonBadge: {
    backgroundColor: 'rgba(76,217,100,0.9)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  wonBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  lostBadge: {
    backgroundColor: 'rgba(255,90,90,0.2)',
    borderColor: 'rgba(255,90,90,0.6)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  lostBadgeText: { color: '#ff8080', fontSize: 11, fontWeight: '700' },
});
