import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';
import {
  createGroup, fetchMyGroups, searchPublicGroups,
  findGroupByCode, fetchMembership, joinGroup,
} from '../lib/groups';

export default function GroupsScreen({ navigation }) {
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

  const backgrounds = getBackgrounds(language.code);

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
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Groups</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* My Groups */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Groups</Text>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : myGroups.length === 0 ? (
                <Text style={styles.emptyText}>You're not in any groups yet.</Text>
              ) : (
                myGroups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
                  >
                    <GlassCard style={styles.groupRow}>
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
                    </GlassCard>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Create a group */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Create a group</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Group name"
                placeholderTextColor="rgba(255,255,255,0.6)"
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
              <Text style={styles.friendHintText}>
                {newGroupIsPublic
                  ? 'Public groups can be found in search and joined by code.'
                  : 'Private groups are joinable by code only.'}
              </Text>
              {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
              >
                {creatingGroup ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Join a group */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Join a group</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="GP-XXXXX"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={joinCodeInput}
                  onChangeText={setJoinCodeInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!joiningLookup}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleJoinLookup} disabled={joiningLookup}>
                  {joiningLookup ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <Text style={styles.searchBtnText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}

              {joinMatch && (
                <View style={styles.matchRow}>
                  <Text style={styles.matchName} numberOfLines={1}>{joinMatch.name}</Text>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleConfirmJoin}
                    disabled={confirmingJoin}
                  >
                    {confirmingJoin ? (
                      <ActivityIndicator color="#1a1a1a" />
                    ) : (
                      <Text style={styles.sendBtnText}>Join</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>

            {/* Find groups */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Find groups</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={findQuery}
                  onChangeText={setFindQuery}
                  autoCorrect={false}
                  editable={!findSearching}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleFindSearch} disabled={findSearching}>
                  {findSearching ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <Text style={styles.searchBtnText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {findError ? <Text style={styles.errorText}>{findError}</Text> : null}

              {findResults.map((group) => (
                <View key={group.id} style={styles.groupRow}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={() => handleJoinFromSearch(group)}
                    disabled={actioningId === group.id}
                  >
                    {actioningId === group.id ? (
                      <ActivityIndicator color="#1a1a1a" />
                    ) : (
                      <Text style={styles.sendBtnText}>Join</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
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
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14, ...textShadow,
  },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  groupRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, marginBottom: 12,
  },
  groupInfo: { flex: 1, marginRight: 8 },
  groupName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  groupMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  ownerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  ownerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: {
    padding: 18, marginBottom: 16,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  nameInput: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, color: '#fff', fontSize: 15,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 4, marginBottom: 10,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  toggleBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  toggleBtnTextActive: { color: '#1a1a1a' },
  friendHintText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  primaryBtn: {
    height: 48, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 14 },
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
  matchName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  sendBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
  },
  sendBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 13 },
});
