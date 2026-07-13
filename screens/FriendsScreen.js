import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile, findUserByUsername } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import GlassCard, { textShadow } from '../components/GlassCard';
import { useSocialBadge } from '../contexts/SocialBadgeContext';
import {
  lookupProfileByFriendCode, fetchPublicProfiles, fetchFriendshipBetween,
  sendFriendRequest, acceptFriendRequest, deleteFriendship, blockUser,
  fetchIncomingRequests, fetchOutgoingRequests, fetchAcceptedFriendships,
} from '../lib/friends';
import {
  checkOpponentEligibility, createChallenge, findExistingBattleWith, isDuplicateBattleError,
} from '../lib/battles';

export default function FriendsScreen({ navigation, headerContent }) {
  const { refreshPendingRequestCount } = useSocialBadge();
  const [userId, setUserId] = useState(null);
  const [language, setLanguage] = useState(getLanguage());
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [battlingId, setBattlingId] = useState(null);

  const [usernameInput, setUsernameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const backgrounds = getBackgrounds(language.code);

  const loadFriendsData = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: profileData } = await fetchProfile(uid);
    setMyProfile(profileData);
    const activeLanguage = profileData?.active_language || userData.user.user_metadata?.language;
    setLanguage(getLanguage(activeLanguage));

    const [
      { data: incoming, error: incomingError },
      { data: outgoing, error: outgoingError },
      { data: accepted, error: acceptedError },
    ] = await Promise.all([
      fetchIncomingRequests(uid),
      fetchOutgoingRequests(uid),
      fetchAcceptedFriendships(uid),
    ]);

    if (incomingError) console.log('Error fetching incoming requests:', incomingError);
    if (outgoingError) console.log('Error fetching outgoing requests:', outgoingError);
    if (acceptedError) console.log('Error fetching friends:', acceptedError);

    const otherIds = new Set();
    incoming.forEach((f) => otherIds.add(f.requester_id));
    outgoing.forEach((f) => otherIds.add(f.addressee_id));
    accepted.forEach((f) => otherIds.add(f.requester_id === uid ? f.addressee_id : f.requester_id));

    const { data: profilesData, error: profilesError } = await fetchPublicProfiles(Array.from(otherIds));
    if (profilesError) console.log('Error fetching friend profiles:', profilesError);

    const profileById = {};
    profilesData.forEach((p) => { profileById[p.user_id] = p; });

    setIncomingRequests(incoming.map((f) => ({ friendship: f, profile: profileById[f.requester_id] })));
    setOutgoingRequests(outgoing.map((f) => ({ friendship: f, profile: profileById[f.addressee_id] })));
    setFriendsList(accepted.map((f) => ({
      friendship: f,
      profile: profileById[f.requester_id === uid ? f.addressee_id : f.requester_id],
    })));

    setLoading(false);
    refreshPendingRequestCount();
  }, [refreshPendingRequestCount]);

  useFocusEffect(
    useCallback(() => {
      loadFriendsData();
    }, [loadFriendsData]),
  );

  const handleCopyMyCode = async () => {
    if (!myProfile?.friend_code) return;
    await Clipboard.setStringAsync(myProfile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Shared tail of both lookup paths (username and JK- code): self-check,
  // existing-relationship check, then surface the match row.
  const processFoundProfile = async (found, selfMessage) => {
    if (found.user_id === userId) {
      setSearching(false);
      setSearchError(selfMessage);
      return;
    }

    const { data: relationship, error: relError } = await fetchFriendshipBetween(userId, found.user_id);
    if (relError) {
      console.log('Error checking friendship status:', relError);
      setSearching(false);
      setSearchError('Something went wrong. Please try again.');
      return;
    }
    if (relationship) {
      setSearching(false);
      if (relationship.status === 'accepted') {
        setSearchError('You are already friends.');
      } else if (relationship.requester_id === userId) {
        setSearchError('You already sent this person a request.');
      } else {
        setSearchError('This person already sent you a request — check Requests below.');
      }
      return;
    }

    setSearching(false);
    setSearchResult(found);
  };

  const handleUsernameSearch = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setSearchError('Enter a username.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    const { data: found, error } = await findUserByUsername(trimmed);
    if (error) {
      console.log('Error looking up username:', error);
      setSearching(false);
      setSearchError('Something went wrong. Please try again.');
      return;
    }
    // Not found and not-discoverable are deliberately the same message —
    // the RPC returns nothing for either, so there's no existence leak.
    if (!found) {
      setSearching(false);
      setSearchError('No one found with that username.');
      return;
    }
    await processFoundProfile(found, "That's you!");
  };

  const handleCodeSearch = async () => {
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setSearchError('Enter a friend code.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    const { data: found, error } = await lookupProfileByFriendCode(trimmed);
    if (error) {
      console.log('Error looking up friend code:', error);
      setSearching(false);
      setSearchError('Something went wrong. Please try again.');
      return;
    }
    if (!found) {
      setSearching(false);
      setSearchError('No one found with that code.');
      return;
    }
    await processFoundProfile(found, "That's your own code!");
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    setSendingRequest(true);
    const { error } = await sendFriendRequest(userId, searchResult.user_id);
    setSendingRequest(false);

    if (error) {
      console.log('Error sending friend request:', error);
      setSearchError("Can't add this user.");
      setSearchResult(null);
      return;
    }

    setUsernameInput('');
    setCodeInput('');
    setSearchResult(null);
    setSearchError('');
    loadFriendsData();
  };

  const handleRemoveFriendship = async (friendshipId) => {
    setActioningId(friendshipId);
    const { error } = await deleteFriendship(friendshipId);
    setActioningId(null);
    if (error) {
      console.log('Error removing friendship:', error);
      return;
    }
    loadFriendsData();
  };

  const handleAccept = async (friendshipId) => {
    setActioningId(friendshipId);
    const { error } = await acceptFriendRequest(friendshipId);
    setActioningId(null);
    if (error) {
      console.log('Error accepting request:', error);
      return;
    }
    loadFriendsData();
  };

  const handleUnfriend = (friendship, profile) => {
    Alert.alert(
      'Unfriend',
      `Remove ${profile?.first_name || 'this person'} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfriend', style: 'destructive', onPress: () => handleRemoveFriendship(friendship.id) },
      ],
    );
  };

  const handleBlock = (friendship, profile) => {
    Alert.alert(
      'Block',
      `Block ${profile?.first_name || 'this person'}? They won't be able to add you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const otherUserId = friendship.requester_id === userId
              ? friendship.addressee_id
              : friendship.requester_id;
            setActioningId(friendship.id);
            const { error: blockError } = await blockUser(userId, otherUserId);
            if (blockError) {
              console.log('Error blocking user:', blockError);
              setActioningId(null);
              return;
            }
            const { error: deleteError } = await deleteFriendship(friendship.id);
            setActioningId(null);
            if (deleteError) console.log('Error deleting friendship after block:', deleteError);
            loadFriendsData();
          },
        },
      ],
    );
  };

  const handleBattle = async (profile) => {
    const name = profile.first_name || 'this friend';
    setBattlingId(profile.user_id);

    const { data: existing, error: existingError } = await findExistingBattleWith(userId, profile.user_id);
    if (existingError) console.log('Error checking for existing battle:', existingError);
    if (existing) {
      setBattlingId(null);
      Alert.alert(
        'Battle in progress',
        `You already have a battle with ${name}.`,
        [
          { text: 'Open Battle', onPress: () => navigation.navigate('Battle', { battleId: existing.id }) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    const { eligible, error: eligError } = await checkOpponentEligibility(profile.user_id, language.code);
    if (eligError) {
      console.log('Error checking battle eligibility:', eligError);
      setBattlingId(null);
      Alert.alert('Something went wrong', 'Please try again.');
      return;
    }
    if (!eligible) {
      setBattlingId(null);
      Alert.alert('Not ready yet', `${profile.first_name || 'They'} haven't learned enough words to battle yet!`);
      return;
    }

    const { error: createError } = await createChallenge({
      opponentId: profile.user_id, language: language.code,
    });
    setBattlingId(null);
    if (createError) {
      console.log('Error creating challenge:', createError);
      // Race fallback: the pre-check missed a simultaneous challenge, but
      // the DB's unique index caught it.
      if (isDuplicateBattleError(createError)) {
        Alert.alert('Battle in progress', `You already have a battle with ${name} — check your Battles list.`);
        return;
      }
      Alert.alert('Something went wrong', 'Please try again.');
      return;
    }
    Alert.alert('Challenge sent!', `${profile.first_name || 'They'} will see it in Battles.`);
  };

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            {headerContent || (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friends</Text>
              </>
            )}
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* My friend code */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Your Friend ID</Text>
              <View style={styles.friendCodeRow}>
                <Text style={styles.friendCodeText}>{myProfile?.friend_code || '—'}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyMyCode}>
                  <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.friendHintText}>Share this so friends can add you</Text>
            </GlassCard>

            {/* Add a friend */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Add a friend</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Username"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!searching}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleUsernameSearch} disabled={searching}>
                  {searching ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <Text style={styles.searchBtnText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setShowCodeInput((prev) => !prev)}>
                <Text style={styles.codeToggleText}>
                  {showCodeInput ? 'Hide friend code' : 'Have a friend code?'}
                </Text>
              </TouchableOpacity>

              {showCodeInput && (
                <View style={[styles.searchRow, styles.codeSearchRow]}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="JK-XXXXX"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={codeInput}
                    onChangeText={setCodeInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!searching}
                  />
                  <TouchableOpacity style={styles.searchBtn} onPress={handleCodeSearch} disabled={searching}>
                    {searching ? (
                      <ActivityIndicator color="#1a1a1a" />
                    ) : (
                      <Text style={styles.searchBtnText}>Search</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

              {searchResult && (
                <View style={styles.matchRow}>
                  <Image source={getAvatarSource(searchResult.avatar_id)} style={styles.matchAvatar} />
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName} numberOfLines={1}>{searchResult.first_name}</Text>
                    {searchResult.username ? (
                      <Text style={styles.matchUsername} numberOfLines={1}>@{searchResult.username}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleSendRequest}
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? (
                      <ActivityIndicator color="#1a1a1a" />
                    ) : (
                      <Text style={styles.sendBtnText}>Send Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>

            {/* Requests */}
            {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Requests</Text>

                {incomingRequests.map(({ friendship, profile }) => (
                  <GlassCard key={friendship.id} style={styles.personRow}>
                    <Image source={getAvatarSource(profile?.avatar_id)} style={styles.personAvatar} />
                    <View style={styles.personInfo}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {profile?.first_name || 'Someone'}
                      </Text>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(friendship.id)}
                        disabled={actioningId === friendship.id}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.neutralBtn}
                        onPress={() => handleRemoveFriendship(friendship.id)}
                        disabled={actioningId === friendship.id}
                      >
                        <Text style={styles.neutralBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}

                {outgoingRequests.map(({ friendship, profile }) => (
                  <GlassCard key={friendship.id} style={styles.personRow}>
                    <Image source={getAvatarSource(profile?.avatar_id)} style={styles.personAvatar} />
                    <View style={styles.personInfo}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {profile?.first_name || 'Someone'}
                      </Text>
                    </View>
                    <View style={styles.actionRow}>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.neutralBtn}
                        onPress={() => handleRemoveFriendship(friendship.id)}
                        disabled={actioningId === friendship.id}
                      >
                        <Text style={styles.neutralBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}

            {/* Friends */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Friends</Text>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : friendsList.length === 0 ? (
                <Text style={styles.emptyText}>No friends yet — add one above!</Text>
              ) : (
                friendsList.map(({ friendship, profile }) => (
                  <GlassCard key={friendship.id} style={styles.personRow}>
                    <Image source={getAvatarSource(profile?.avatar_id)} style={styles.personAvatar} />
                    <View style={styles.personInfo}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {profile?.first_name || 'Someone'}
                      </Text>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.battleBtn}
                        onPress={() => handleBattle(profile)}
                        disabled={battlingId === profile?.user_id}
                      >
                        {battlingId === profile?.user_id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.battleBtnText}>⚔️ Battle</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.neutralBtn}
                        onPress={() => handleUnfriend(friendship, profile)}
                        disabled={actioningId === friendship.id}
                      >
                        <Text style={styles.neutralBtnText}>Unfriend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.blockBtn}
                        onPress={() => handleBlock(friendship, profile)}
                        disabled={actioningId === friendship.id}
                      >
                        <Text style={styles.blockBtnText}>Block</Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))
              )}
            </View>
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
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  card: {
    padding: 18, marginBottom: 16,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  friendCodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  friendCodeText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  copyBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  copyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  friendHintText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, color: '#fff', fontSize: 15,
  },
  searchBtn: {
    height: 48, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 14 },
  errorText: {
    color: '#ffb4b4', fontSize: 13, fontWeight: '600', marginTop: 12,
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  matchAvatar: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  matchInfo: { flex: 1, marginRight: 8 },
  matchName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  matchUsername: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 1 },
  codeToggleText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600',
    marginTop: 12, marginBottom: 4, textDecorationLine: 'underline',
  },
  codeSearchRow: { marginTop: 8 },
  sendBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14, ...textShadow,
  },
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
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptBtn: {
    backgroundColor: 'rgba(76,217,100,0.9)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  battleBtn: {
    backgroundColor: 'rgba(255,196,0,0.2)',
    borderColor: 'rgba(255,196,0,0.6)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  battleBtnText: { color: '#ffc400', fontSize: 12, fontWeight: '700' },
  neutralBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  neutralBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  blockBtn: {
    backgroundColor: 'rgba(255,90,90,0.2)',
    borderColor: 'rgba(255,90,90,0.6)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  blockBtnText: { color: '#ff8080', fontSize: 12, fontWeight: '700' },
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  pendingBadgeText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
});
