import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import Card from '../components/Card';
import {
  createGroup, fetchMyGroups, searchPublicGroups,
  findGroupByCode, fetchMembership, joinGroup,
} from '../lib/groups';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

export default function GroupsScreen({ navigation, headerContent }) {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState(null);
  const [language, setLanguage] = useState(getLanguage());
  const [loading, setLoading] = useState(true);
  const [myGroups, setMyGroups] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState('');

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningLookup, setJoiningLookup] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinMatch, setJoinMatch] = useState(null);
  const [confirmingJoin, setConfirmingJoin] = useState(false);

  const [findQuery, setFindQuery] = useState('');
  const [findSearching, setFindSearching] = useState(false);
  const [findError, setFindError] = useState('');
  const [findResults, setFindResults] = useState([]);

  const loadGroupsData = useCallback(async () => {
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

    const { data: groups, error } = await fetchMyGroups(uid);
    if (error) console.log('Error fetching my groups:', error);
    setMyGroups(groups);

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroupsData();
    }, [loadGroupsData]),
  );

  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setCreateError('Enter a group name.');
      return;
    }

    setCreatingGroup(true);
    setCreateError('');

    const { data, error } = await createGroup({ ownerId: userId, name: trimmed, isPublic: newGroupIsPublic });
    setCreatingGroup(false);

    if (error) {
      console.log('Error creating group:', error);
      setCreateError('Something went wrong. Please try again.');
      return;
    }

    setNewGroupName('');
    setNewGroupIsPublic(true);
    loadGroupsData();
    navigation.navigate('GroupDetail', { groupId: data.id });
  };

  const handleJoinLookup = async () => {
    const trimmed = joinCodeInput.trim();
    if (!trimmed) {
      setJoinError('Enter a join code.');
      return;
    }

    setJoiningLookup(true);
    setJoinError('');
    setJoinMatch(null);

    const { data: found, error } = await findGroupByCode(trimmed);
    if (error) {
      console.log('Error looking up group code:', error);
      setJoiningLookup(false);
      setJoinError('Something went wrong. Please try again.');
      return;
    }
    if (!found) {
      setJoiningLookup(false);
      setJoinError('No group found with that code.');
      return;
    }

    const { data: membership, error: memberError } = await fetchMembership(found.id, userId);
    if (memberError) {
      console.log('Error checking membership:', memberError);
      setJoiningLookup(false);
      setJoinError('Something went wrong. Please try again.');
      return;
    }
    if (membership) {
      setJoiningLookup(false);
      setJoinError("You're already in this group.");
      return;
    }

    setJoiningLookup(false);
    setJoinMatch(found);
  };

  const handleConfirmJoin = async () => {
    if (!joinMatch) return;
    setConfirmingJoin(true);
    const { error } = await joinGroup(joinMatch.id, userId);
    setConfirmingJoin(false);

    if (error) {
      console.log('Error joining group:', error);
      setJoinError("Can't join this group.");
      setJoinMatch(null);
      return;
    }

    setJoinCodeInput('');
    setJoinMatch(null);
    setJoinError('');
    loadGroupsData();
  };

  const handleFindSearch = async () => {
    const trimmed = findQuery.trim();
    if (!trimmed) {
      setFindError('Enter a group name.');
      return;
    }

    setFindSearching(true);
    setFindError('');
    setFindResults([]);

    const { data, error } = await searchPublicGroups(trimmed);
    setFindSearching(false);

    if (error) {
      console.log('Error searching groups:', error);
      setFindError('Something went wrong. Please try again.');
      return;
    }
    if (data.length === 0) {
      setFindError('No public groups found.');
      return;
    }
    setFindResults(data);
  };

  const handleJoinFromSearch = async (group) => {
    setActioningId(group.id);
    const { error } = await joinGroup(group.id, userId);
    setActioningId(null);

    if (error) {
      console.log('Error joining group:', error);
      return;
    }

    setFindResults((prev) => prev.filter((g) => g.id !== group.id));
    loadGroupsData();
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
            <Text style={styles.headerTitle}>Groups</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* My Groups */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          {loading ? (
            <ActivityIndicator color={colors.accentCoral} />
          ) : myGroups.length === 0 ? (
            <Text style={styles.emptyText}>You&apos;re not in any groups yet.</Text>
          ) : (
            myGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
              >
                <Card style={styles.groupRow}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                    {group.memberCount != null && (
                      <Text style={styles.groupMeta}>
                        {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                      </Text>
                    )}
                  </View>
                  {group.owner_id === userId && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerBadgeText}>Owner</Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Create a group */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Create a group</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Group name"
            placeholderTextColor={colors.textMuted}
            value={newGroupName}
            onChangeText={setNewGroupName}
            editable={!creatingGroup}
          />
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, newGroupIsPublic && styles.toggleBtnActive]}
              onPress={() => setNewGroupIsPublic(true)}
            >
              <Text style={[styles.toggleBtnText, newGroupIsPublic && styles.toggleBtnTextActive]}>
                Public
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !newGroupIsPublic && styles.toggleBtnActive]}
              onPress={() => setNewGroupIsPublic(false)}
            >
              <Text style={[styles.toggleBtnText, !newGroupIsPublic && styles.toggleBtnTextActive]}>
                Private
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hintText}>
            {newGroupIsPublic
              ? 'Public groups can be found in search and joined by code.'
              : 'Private groups are joinable by code only.'}
          </Text>
          {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateGroup} disabled={creatingGroup}>
            {creatingGroup ? (
              <ActivityIndicator color={colors.onGradient} />
            ) : (
              <Text style={styles.primaryBtnText}>Create</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Join a group */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Join a group</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="GP-XXXXX"
              placeholderTextColor={colors.textMuted}
              value={joinCodeInput}
              onChangeText={setJoinCodeInput}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!joiningLookup}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleJoinLookup} disabled={joiningLookup}>
              {joiningLookup ? (
                <ActivityIndicator color={colors.onGradient} />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

          {joinMatch && (
            <View style={styles.matchRow}>
              <Text style={styles.matchName} numberOfLines={1}>{joinMatch.name}</Text>
              <TouchableOpacity style={styles.sendBtn} onPress={handleConfirmJoin} disabled={confirmingJoin}>
                {confirmingJoin ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.sendBtnText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Find groups */}
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Find groups</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name"
              placeholderTextColor={colors.textMuted}
              value={findQuery}
              onChangeText={setFindQuery}
              autoCorrect={false}
              editable={!findSearching}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleFindSearch} disabled={findSearching}>
              {findSearching ? (
                <ActivityIndicator color={colors.onGradient} />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {findError ? <Text style={styles.errorText}>{findError}</Text> : null}

          {findResults.map((group, index) => (
            <View key={group.id} style={[styles.resultRow, index > 0 && styles.resultRowDivider]}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => handleJoinFromSearch(group)}
                disabled={actioningId === group.id}
              >
                {actioningId === group.id ? (
                  <ActivityIndicator color={colors.onGradient} />
                ) : (
                  <Text style={styles.sendBtnText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </Card>
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
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: fontWeight.medium, marginBottom: 14 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  groupRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 },
  groupInfo: { flex: 1, marginRight: 8 },
  groupName: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  groupMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  ownerBadge: {
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 5,
  },
  ownerBadgeText: { color: colors.accentCoral, fontSize: 11, fontWeight: fontWeight.medium },
  card: { marginBottom: spacing.lg },
  cardLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  nameInput: {
    height: 48,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 14, color: colors.text, fontSize: 15, marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row', backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 4, marginBottom: 10,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius - 4, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accentCoral },
  toggleBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: fontWeight.medium },
  toggleBtnTextActive: { color: colors.onGradient },
  hintText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  primaryBtn: {
    height: 48, backgroundColor: colors.accentCoral,
    borderRadius: radius, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 48,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 14, color: colors.text, fontSize: 15,
  },
  searchBtn: {
    height: 48, backgroundColor: colors.accentCoral,
    borderRadius: radius, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: fontWeight.medium, marginTop: 12 },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  matchName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
  },
  resultRowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  sendBtn: {
    backgroundColor: colors.accentCoral,
    borderRadius: radius, paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 13 },
});
