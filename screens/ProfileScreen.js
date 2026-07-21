import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import {
  fetchProfile, createProfile, updateAvatar, updateDiscoverable,
} from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import { fetchBlockedUsers, unblockUser, fetchPublicProfiles } from '../lib/friends';
import { fetchMyPointsTotal } from '../lib/battles';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import AvatarPicker from '../components/AvatarPicker';
import UsernameField from '../components/UsernameField';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

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
  const [draftUsername, setDraftUsername] = useState('');
  const [draftUsernameStatus, setDraftUsernameStatus] = useState('idle');
  const [draftAvatarId, setDraftAvatarId] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);

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
    if (draftUsernameStatus !== 'available') {
      setProfileError(
        draftUsernameStatus === 'checking'
          ? 'One moment — still checking that username.'
          : 'Please choose an available username.',
      );
      return;
    }
    setSavingProfile(true);
    const { data, error, usernameTaken } = await createProfile({
      userId,
      firstName: draftFirstName.trim(),
      avatarId: draftAvatarId,
      username: draftUsername.trim(),
    });
    setSavingProfile(false);
    if (usernameTaken) {
      setProfileError('Someone just took that username — try another.');
      return;
    }
    if (error) {
      console.log('Error completing profile:', error);
      setProfileError('Something went wrong. Please try again.');
      return;
    }
    setProfile(data);
  };

  const handleToggleDiscoverable = async (value) => {
    if (!userId || savingDiscoverable) return;
    setSavingDiscoverable(true);
    // Optimistic flip; revert if the write fails.
    const previous = profile;
    setProfile((prev) => (prev ? { ...prev, discoverable: value } : prev));
    const { data, error } = await updateDiscoverable(userId, value);
    setSavingDiscoverable(false);
    if (error) {
      console.log('Error updating discoverable:', error);
      setProfile(previous);
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
    <View style={styles.screen}>
      {/* Fuller gradient: title + identity block sit on the gradient. */}
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <Text style={styles.headerTitle}>Profile</Text>
        {profile && (
          <View style={styles.identityRow}>
            <Image source={getAvatarSource(profile.avatar_id)} style={styles.identityAvatar} />
            <View style={styles.identityCol}>
              <Text style={styles.identityName}>{profile.first_name}</Text>
              {profile.username ? (
                <Text style={styles.identityUsername} numberOfLines={1}>@{profile.username}</Text>
              ) : null}
            </View>
            <View style={styles.pointsPill}>
              <Ionicons name="star" size={14} color={colors.onGradient} style={styles.pointsIcon} />
              <Text style={styles.pointsPillText}>{pointsTotal}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Complete your profile (old accounts with no profiles row) */}
        {profileLoaded && !profile && (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Complete your profile</Text>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              value={draftFirstName}
              onChangeText={setDraftFirstName}
              editable={!savingProfile}
            />
            <UsernameField
              value={draftUsername}
              onChangeText={setDraftUsername}
              editable={!savingProfile}
              onStatusChange={setDraftUsernameStatus}
            />
            <Text style={styles.avatarPickerLabel}>Choose an avatar</Text>
            <AvatarPicker selected={draftAvatarId} onSelect={setDraftAvatarId} />
            {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
            <SolidButton
              label={savingProfile ? '' : 'Save'}
              onPress={handleCompleteProfile}
              disabled={savingProfile}
            />
            {savingProfile ? <ActivityIndicator color={colors.accentCoral} style={styles.savingSpinner} /> : null}
          </Card>
        )}

        {/* Account */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Text style={styles.emailText}>{email}</Text>
          <View style={styles.languageRow}>
            <Text style={styles.languageFlag}>{language.flag}</Text>
            <Text style={styles.languageName}>{language.name}</Text>
          </View>
        </Card>

        {/* Friend ID */}
        {profile && (
          <Card style={styles.card}>
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
          </Card>
        )}

        {/* Privacy */}
        {profile && (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Privacy</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Discoverable by username</Text>
                <Text style={styles.settingHint}>
                  When off, nobody can find you by searching your username. Friend codes still work.
                </Text>
              </View>
              <Switch
                value={profile.discoverable !== false}
                onValueChange={handleToggleDiscoverable}
                disabled={savingDiscoverable}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.card}
              />
            </View>
          </Card>
        )}

        {/* Change avatar */}
        {profile && (
          <Card style={styles.card}>
            <Text style={styles.cardLabel}>Avatar</Text>
            <AvatarPicker selected={profile.avatar_id} onSelect={handleChangeAvatar} />
          </Card>
        )}

        {/* Change language */}
        <TouchableOpacity onPress={() => navigation.navigate('LanguageSelect', { fromProfile: true })}>
          <Card style={styles.row}>
            <Text style={styles.rowText}>Change language</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>

        {/* Speech speed */}
        <Card style={styles.card}>
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
                Slow
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Upcoming reviews */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Upcoming reviews</Text>
          {loadingReviews ? (
            <ActivityIndicator color={colors.accentCoral} />
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
        </Card>

        {/* Blocked users */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Blocked users</Text>
          {loadingBlocked ? (
            <ActivityIndicator color={colors.accentCoral} />
          ) : blockedUsers.length === 0 ? (
            <Text style={styles.emptyText}>You haven&apos;t blocked anyone.</Text>
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
                    <ActivityIndicator color={colors.accentCoral} />
                  ) : (
                    <Text style={styles.unblockBtnText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        {/* Log out */}
        <TouchableOpacity onPress={handleLogout}>
          <Card style={styles.row}>
            <Text style={styles.logoutText}>Log out</Text>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  identityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl },
  identityAvatar: {
    width: 56, height: 56, borderRadius: 28, marginRight: 14,
    borderColor: colors.glassBorder, borderWidth: 1,
  },
  identityCol: { flex: 1, marginRight: 10 },
  identityName: { color: colors.onGradient, fontSize: 22, fontWeight: fontWeight.medium },
  identityUsername: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 6,
  },
  pointsIcon: { marginRight: 5 },
  pointsPillText: { color: colors.onGradient, fontSize: 14, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.lg },
  cardLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  emailText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium, marginBottom: 12 },
  languageRow: { flexDirection: 'row', alignItems: 'center' },
  languageFlag: { fontSize: 22, marginRight: 8 },
  languageName: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 14, color: colors.text, marginBottom: 14, fontSize: 15,
  },
  avatarPickerLabel: { color: colors.text, fontSize: 14, fontWeight: fontWeight.medium, marginBottom: 12 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: fontWeight.medium, marginBottom: 12 },
  savingSpinner: { marginTop: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingInfo: { flex: 1, marginRight: 12 },
  settingTitle: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  settingHint: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
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
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rowText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium },
  speedRow: { flexDirection: 'row', gap: 12 },
  speedPill: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingVertical: 12,
  },
  speedPillActive: { backgroundColor: colors.accentCoral, borderColor: colors.accentCoral },
  speedPillText: { color: colors.text, fontSize: 14, fontWeight: fontWeight.medium },
  speedPillTextActive: { color: colors.onGradient },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8,
  },
  reviewRowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  reviewPhrase: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, flexShrink: 1, marginRight: 12 },
  reviewDue: { color: colors.textMuted, fontSize: 13 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  blockedAvatar: {
    width: 36, height: 36, borderRadius: 18, marginRight: 12,
    borderColor: colors.border, borderWidth: 1,
  },
  blockedName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, marginRight: 8 },
  unblockBtn: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7,
  },
  unblockBtnText: { color: colors.text, fontSize: 12, fontWeight: fontWeight.medium },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: fontWeight.medium },
});
