import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile, findUserByUsername } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import Card from '../components/Card';
import { useSocialBadge } from '../contexts/SocialBadgeContext';
import {
  lookupProfileByFriendCode, fetchPublicProfiles, fetchFriendshipBetween,
  sendFriendRequest, acceptFriendRequest, deleteFriendship, blockUser,
  fetchIncomingRequests, fetchOutgoingRequests, fetchAcceptedFriendships,
} from '../lib/friends';
import {
  checkOpponentEligibility, createChallenge, findExistingBattleWith, isDuplicateBattleError,
} from '../lib/battles';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

export default function FriendsScreen({ navigation, headerContent }) {
  const insets = useSafeAreaInsets();
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
  // { friendship, profile } of the friend whose overflow menu is open.
  const [menuTarget, setMenuTarget] = useState(null);

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
      if (isDuplicateBattleError(createError)) {
        Alert.alert('Battle in progress', `You already have a battle with ${name} — check your Battles list.`);
        return;
      }
      Alert.alert('Something went wrong', 'Please try again.');
      return;
    }
    Alert.alert('Challenge sent!', `${profile.first_name || 'They'} will see it in Battles.`);
  };

  const closeMenu = () => setMenuTarget(null);

  // Both actions carry their own Alert confirmation (handleUnfriend /
  // handleBlock) — Block's confirm restores the friction it lost by moving
  // out of the always-visible row into this menu.
  const menuUnfriend = () => {
    const target = menuTarget;
    closeMenu();
    if (target) handleUnfriend(target.friendship, target.profile);
  };
  const menuBlock = () => {
    const target = menuTarget;
    closeMenu();
    if (target) handleBlock(target.friendship, target.profile);
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
        {headerContent || (
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color={colors.onGradient} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Friends</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* My friend code */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Your Friend ID</Text>
          <View style={styles.friendCodeRow}>
            <Text style={styles.friendCodeText}>{myProfile?.friend_code || '—'}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyMyCode}>
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.friendHintText}>Share this so friends can add you</Text>
        </Card>

        {/* Add a friend */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Add a friend</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!searching}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleUsernameSearch} disabled={searching}>
              {searching ? (
                <ActivityIndicator color={colors.onGradient} />
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
                placeholderTextColor={colors.textMuted}
                value={codeInput}
                onChangeText={setCodeInput}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!searching}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleCodeSearch} disabled={searching}>
                {searching ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.searchBtnText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

          {searchResult && (
            <View style={styles.matchRow}>
              <Image source={getAvatarSource(searchResult.avatar_id)} style={styles.avatar} />
              <View style={styles.personInfo}>
                <Text style={styles.personName} numberOfLines={1}>{searchResult.first_name}</Text>
                {searchResult.username ? (
                  <Text style={styles.personSub} numberOfLines={1}>@{searchResult.username}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendRequest} disabled={sendingRequest}>
                {sendingRequest ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.sendBtnText}>Send Request</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Requests */}
        {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requests</Text>

            {incomingRequests.map(({ friendship, profile }) => (
              <Card key={friendship.id} style={styles.personRow}>
                <Image source={getAvatarSource(profile?.avatar_id)} style={styles.avatar} />
                <View style={styles.personInfo}>
                  <Text style={styles.personName} numberOfLines={1}>{profile?.first_name || 'Someone'}</Text>
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
              </Card>
            ))}

            {outgoingRequests.map(({ friendship, profile }) => (
              <Card key={friendship.id} style={styles.personRow}>
                <Image source={getAvatarSource(profile?.avatar_id)} style={styles.avatar} />
                <View style={styles.personInfo}>
                  <Text style={styles.personName} numberOfLines={1}>{profile?.first_name || 'Someone'}</Text>
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
              </Card>
            ))}
          </View>
        )}

        {/* Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friends</Text>
          {loading ? (
            <ActivityIndicator color={colors.accentCoral} />
          ) : friendsList.length === 0 ? (
            <Text style={styles.emptyText}>No friends yet — add one above!</Text>
          ) : (
            friendsList.map(({ friendship, profile }) => (
              <Card key={friendship.id} style={styles.personRow}>
                <Image source={getAvatarSource(profile?.avatar_id)} style={styles.avatar} />
                <View style={styles.personInfo}>
                  <Text style={styles.personName} numberOfLines={1}>{profile?.first_name || 'Someone'}</Text>
                </View>
                <View style={styles.rowRight}>
                  <TouchableOpacity
                    style={styles.battleBtn}
                    onPress={() => handleBattle(profile)}
                    disabled={battlingId === profile?.user_id}
                  >
                    {battlingId === profile?.user_id ? (
                      <ActivityIndicator color={colors.onGradient} />
                    ) : (
                      <View style={styles.battleBtnInner}>
                        <Ionicons name="flash" size={13} color={colors.onGradient} style={styles.battleIcon} />
                        <Text style={styles.battleBtnText}>Battle</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.overflowBtn}
                    onPress={() => setMenuTarget({ friendship, profile })}
                    disabled={actioningId === friendship.id}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Overflow menu for a friend row — Unfriend / Block (both destructive). */}
      <Modal
        visible={!!menuTarget}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.sheetRoot}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeMenu} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            {menuTarget?.profile?.first_name ? (
              <Text style={styles.sheetName}>{menuTarget.profile.first_name}</Text>
            ) : null}
            <TouchableOpacity style={styles.sheetAction} onPress={menuUnfriend}>
              <Ionicons name="person-remove-outline" size={18} color={colors.danger} style={styles.sheetIcon} />
              <Text style={styles.sheetDangerText}>Unfriend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetAction} onPress={menuBlock}>
              <Ionicons name="ban-outline" size={18} color={colors.danger} style={styles.sheetIcon} />
              <Text style={styles.sheetDangerText}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={closeMenu}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.lg },
  cardLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  friendCodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  friendCodeText: { color: colors.text, fontSize: 22, fontWeight: fontWeight.medium, letterSpacing: 1 },
  copyBtn: {
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 14, paddingVertical: 8,
  },
  copyBtnText: { color: colors.accentCoral, fontSize: 13, fontWeight: fontWeight.medium },
  friendHintText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 48,
    backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 14, color: colors.text, fontSize: 15,
  },
  searchBtn: {
    height: 48, backgroundColor: colors.accentCoral,
    borderRadius: radius, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: fontWeight.medium, marginTop: 12 },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  codeToggleText: {
    color: colors.accentCoral, fontSize: 13, fontWeight: fontWeight.medium,
    marginTop: 12, marginBottom: 4,
  },
  codeSearchRow: { marginTop: 8 },
  sendBtn: {
    backgroundColor: colors.accentCoral,
    borderRadius: radius, paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: fontWeight.medium, marginBottom: 14 },
  personRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    borderColor: colors.border, borderWidth: 1,
  },
  personInfo: { flex: 1, marginRight: 8 },
  personName: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  personSub: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  // flexShrink:0 keeps the button cluster its natural width so the name
  // (flex:1) always wins the remaining space and never truncates.
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  rowRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  overflowBtn: {
    width: 32, height: 32, marginLeft: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: { backgroundColor: colors.success, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7 },
  acceptBtnText: { color: colors.onGradient, fontSize: 12, fontWeight: fontWeight.medium },
  battleBtn: { backgroundColor: colors.accentCoral, borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7 },
  battleBtnInner: { flexDirection: 'row', alignItems: 'center' },
  battleIcon: { marginRight: 4 },
  battleBtnText: { color: colors.onGradient, fontSize: 12, fontWeight: fontWeight.medium },
  neutralBtn: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7,
  },
  neutralBtnText: { color: colors.text, fontSize: 12, fontWeight: fontWeight.medium },
  pendingBadge: {
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 7,
  },
  pendingBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: fontWeight.medium },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  // Overflow action sheet.
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius * 2, borderTopRightRadius: radius * 2,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  sheetName: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: spacing.md,
  },
  sheetAction: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
    borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetIcon: { marginRight: 12 },
  sheetDangerText: { color: colors.danger, fontSize: 16, fontWeight: fontWeight.medium },
  sheetCancel: { paddingVertical: 16, alignItems: 'center', marginTop: spacing.xs },
  sheetCancelText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium },
});
