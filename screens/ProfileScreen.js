import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile, createProfile, updateAvatar } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import { fetchBlockedUsers, unblockUser, fetchPublicProfiles } from '../lib/friends';
import { fetchMyPointsTotal } from '../lib/battles';
import GlassCard, { textShadow } from '../components/GlassCard';
import AvatarPicker from '../components/AvatarPicker';

const formatDueLabel = (dueAt) => {
  const due = new Date(dueAt);
  const now = new Date();
  if (due <= now) return 'due now';
  const diffDays = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  if (diffDays <= 1) return 'tomorrow';
  return `in ${diffDays} days`;
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [reviewCards, setReviewCards] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);
  const [pointsTotal, setPointsTotal] = useState(0);

  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftAvatarId, setDraftAvatarId] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [copied, setCopied] = useState(false);

  const backgrounds = getBackgrounds(language.code);

  useFocusEffect(
    useCallback(() => {
      const fetchAll = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setLoadingReviews(false);
          return;
        }

        setUserId(userData.user.id);
        setEmail(userData.user.email);
        setSpeechRate(userData.user.user_metadata?.speechRate ?? 0.85);

        const { data: profileData } = await fetchProfile(userData.user.id);
        setProfile(profileData);
        setProfileLoaded(true);

        const activeLanguage = profileData?.active_language
          || userData.user.user_metadata?.language;
        setLanguage(getLanguage(activeLanguage));

        const { data, error } = await supabase
          .from('review_cards')
          .select('phrase, due_at')
          .eq('user_id', userData.user.id)
          .eq('language', getLanguage(activeLanguage).code)
          .order('due_at', { ascending: true })
          .limit(10);

        if (error) {
          console.log('Error fetching upcoming reviews:', error);
          setLoadingReviews(false);
          return;
        }

        setReviewCards(data || []);
        setLoadingReviews(false);

        const { data: blockedIds, error: blockedError } = await fetchBlockedUsers(userData.user.id);
        if (blockedError) {
          console.log('Error fetching blocked users:', blockedError);
          setLoadingBlocked(false);
          return;
        }
        const { data: blockedProfiles, error: profilesError } = await fetchPublicProfiles(blockedIds);
        if (profilesError) console.log('Error fetching blocked user profiles:', profilesError);
        setBlockedUsers(blockedProfiles);
        setLoadingBlocked(false);

        const { total, error: pointsError } = await fetchMyPointsTotal(userData.user.id);
        if (pointsError) console.log('Error fetching points total:', pointsError);
        setPointsTotal(total);
      };

      fetchAll();
    }, []),
  );

  const handleSpeechRateChange = async (rate) => {
    setSpeechRate(rate);
    const { error } = await supabase.auth.updateUser({ data: { speechRate: rate } });
    if (error) console.log('Error saving speech rate:', error);
  };

  const handleChangeAvatar = async (avatarId) => {
    if (!userId) return;
    const { data, error } = await updateAvatar(userId, avatarId);
    if (error) {
      console.log('Error updating avatar:', error);
      return;
    }
    setProfile(data);
  };

  const handleCompleteProfile = async () => {
    setProfileError('');
    if (!draftFirstName.trim()) {
      setProfileError('Please enter your first name.');
      return;
    }
    setSavingProfile(true);
    const { data, error } = await createProfile({
      userId,
      firstName: draftFirstName.trim(),
      avatarId: draftAvatarId,
    });
    setSavingProfile(false);
    if (error) {
      console.log('Error completing profile:', error);
      setProfileError('Something went wrong. Please try again.');
      return;
    }
    setProfile(data);
  };

  const handleCopyFriendCode = async () => {
    if (!profile?.friend_code) return;
    await Clipboard.setStringAsync(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const handleUnblock = (blockedProfile) => {
    Alert.alert(
      'Unblock',
      `Unblock ${blockedProfile.first_name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(blockedProfile.user_id);
            const { error } = await unblockUser(userId, blockedProfile.user_id);
            setUnblockingId(null);
            if (error) {
              console.log('Error unblocking user:', error);
              return;
            }
            setBlockedUsers((prev) => prev.filter((p) => p.user_id !== blockedProfile.user_id));
          },
        },
      ],
    );
  };

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {profile && (
              <View style={styles.profileHeaderRow}>
                <Image source={getAvatarSource(profile.avatar_id)} style={styles.profileAvatar} />
                <Text style={styles.profileName}>{profile.first_name}</Text>
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsPillText}>⭐ {pointsTotal}</Text>
                </View>
              </View>
            )}

            {/* Complete your profile (old accounts with no profiles row) */}
            {profileLoaded && !profile && (
              <GlassCard style={styles.card}>
                <Text style={styles.cardLabel}>Complete your profile</Text>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={draftFirstName}
                  onChangeText={setDraftFirstName}
                  editable={!savingProfile}
                />
                <Text style={styles.avatarPickerLabel}>Choose an avatar</Text>
                <AvatarPicker selected={draftAvatarId} onSelect={setDraftAvatarId} />
                {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleCompleteProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </GlassCard>
            )}

            {/* Account */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Account</Text>
              <Text style={styles.emailText}>{email}</Text>
              <View style={styles.languageRow}>
                <Text style={styles.languageFlag}>{language.flag}</Text>
                <Text style={styles.languageName}>{language.name}</Text>
              </View>
            </GlassCard>

            {/* Friend ID */}
            {profile && (
              <GlassCard style={styles.card}>
                <Text style={styles.cardLabel}>Friend ID</Text>
                <View style={styles.friendCodeRow}>
                  <Text style={styles.friendCodeText}>{profile.friend_code}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={handleCopyFriendCode}>
                    <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.friendHintText}>
                  Share this so friends can find and add you
                </Text>
              </GlassCard>
            )}

            {/* Change avatar */}
            {profile && (
              <GlassCard style={styles.card}>
                <Text style={styles.cardLabel}>Avatar</Text>
                <AvatarPicker selected={profile.avatar_id} onSelect={handleChangeAvatar} />
              </GlassCard>
            )}

            {/* Change language */}
            <TouchableOpacity onPress={() => navigation.navigate('LanguageSelect')}>
              <GlassCard style={styles.row}>
                <Text style={styles.rowText}>Change language</Text>
                <Text style={styles.rowChevron}>›</Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Speech speed */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Speech speed</Text>
              <View style={styles.speedRow}>
                <TouchableOpacity
                  style={[styles.speedPill, speechRate === 0.85 && styles.speedPillActive]}
                  onPress={() => handleSpeechRateChange(0.85)}
                >
                  <Text style={[styles.speedPillText, speechRate === 0.85 && styles.speedPillTextActive]}>
                    Normal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.speedPill, speechRate === 0.6 && styles.speedPillActive]}
                  onPress={() => handleSpeechRateChange(0.6)}
                >
                  <Text style={[styles.speedPillText, speechRate === 0.6 && styles.speedPillTextActive]}>
                    Slow 🐢
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* Upcoming reviews */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Upcoming reviews</Text>
              {loadingReviews ? (
                <ActivityIndicator color="#fff" />
              ) : reviewCards.length === 0 ? (
                <Text style={styles.emptyText}>Complete lessons to build your review deck!</Text>
              ) : (
                reviewCards.map((card, index) => (
                  <View
                    key={card.phrase}
                    style={[styles.reviewRow, index > 0 && styles.reviewRowDivider]}
                  >
                    <Text style={styles.reviewPhrase}>{card.phrase}</Text>
                    <Text style={styles.reviewDue}>{formatDueLabel(card.due_at)}</Text>
                  </View>
                ))
              )}
            </GlassCard>

            {/* Blocked users */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Blocked users</Text>
              {loadingBlocked ? (
                <ActivityIndicator color="#fff" />
              ) : blockedUsers.length === 0 ? (
                <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
              ) : (
                blockedUsers.map((blockedProfile) => (
                  <View key={blockedProfile.user_id} style={styles.blockedRow}>
                    <Image
                      source={getAvatarSource(blockedProfile.avatar_id)}
                      style={styles.blockedAvatar}
                    />
                    <Text style={styles.blockedName} numberOfLines={1}>
                      {blockedProfile.first_name || 'Someone'}
                    </Text>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleUnblock(blockedProfile)}
                      disabled={unblockingId === blockedProfile.user_id}
                    >
                      {unblockingId === blockedProfile.user_id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.unblockBtnText}>Unblock</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </GlassCard>

            {/* Log out */}
            <TouchableOpacity onPress={handleLogout}>
              <GlassCard style={styles.row}>
                <Text style={styles.logoutText}>Log out</Text>
              </GlassCard>
            </TouchableOpacity>
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
  profileHeaderRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28, marginRight: 14,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  profileName: {
    color: '#fff', fontSize: 22, fontWeight: '800', flexShrink: 1, marginRight: 10, ...textShadow,
  },
  pointsPill: {
    backgroundColor: 'rgba(255,196,0,0.2)',
    borderColor: 'rgba(255,196,0,0.6)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  pointsPillText: { color: '#ffc400', fontSize: 14, fontWeight: '700' },
  card: {
    padding: 18, marginBottom: 16,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  emailText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  languageRow: { flexDirection: 'row', alignItems: 'center' },
  languageFlag: { fontSize: 22, marginRight: 8 },
  languageName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 14, color: '#fff',
    marginBottom: 14, fontSize: 15,
  },
  avatarPickerLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  errorText: {
    color: '#ffb4b4', fontSize: 13, fontWeight: '600', marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
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
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, marginBottom: 16,
  },
  rowText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowChevron: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700' },
  speedRow: { flexDirection: 'row', gap: 12 },
  speedPill: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1,
    borderRadius: 20, paddingVertical: 12,
  },
  speedPillActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  speedPillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  speedPillTextActive: { color: '#1a1a1a' },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reviewRowDivider: {
    borderTopColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1,
  },
  reviewPhrase: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1, marginRight: 12 },
  reviewDue: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
  },
  blockedAvatar: {
    width: 36, height: 36, borderRadius: 18, marginRight: 12,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  blockedName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginRight: 8 },
  unblockBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  unblockBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutText: { color: '#ff8080', fontSize: 16, fontWeight: '700' },
});
