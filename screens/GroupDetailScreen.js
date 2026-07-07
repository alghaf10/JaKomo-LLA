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
import { getAvatarSource } from '../lib/avatars';
import { fetchPublicProfiles } from '../lib/friends';
import GlassCard, { textShadow } from '../components/GlassCard';
import {
  fetchGroupById, fetchGroupMemberRows, renameGroup,
  toggleGroupVisibility, leaveGroup, deleteGroup,
} from '../lib/groups';

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const language = getLanguage();
  const backgrounds = getBackgrounds(language.code);

  const [myUserId, setMyUserId] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadGroupDetail = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setMyUserId(uid);

    const { data: groupData, error } = await fetchGroupById(groupId);
    if (error) console.log('Error fetching group:', error);
    setGroup(groupData);

    const { data: memberRows, error: rosterError } = await fetchGroupMemberRows(groupId);
    if (rosterError) console.log('Error fetching group members:', rosterError);

    const { data: profilesData, error: profilesError } = await fetchPublicProfiles(
      memberRows.map((m) => m.user_id),
    );
    if (profilesError) console.log('Error fetching member profiles:', profilesError);

    const profileById = {};
    profilesData.forEach((p) => { profileById[p.user_id] = p; });

    setMembers(memberRows.map((m) => ({ ...m, profile: profileById[m.user_id] })));
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadGroupDetail();
    }, [loadGroupDetail]),
  );

  const isOwner = group && myUserId && group.owner_id === myUserId;

  const handleCopyCode = async () => {
    if (!group?.join_code) return;
    await Clipboard.setStringAsync(group.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartRename = () => {
    setDraftName(group?.name || '');
    setRenaming(true);
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setSavingName(true);
    const { data, error } = await renameGroup(groupId, trimmed);
    setSavingName(false);

    if (error) {
      console.log('Error renaming group:', error);
      return;
    }
    setGroup(data);
    setRenaming(false);
  };

  const handleToggleVisibility = async () => {
    setTogglingVisibility(true);
    const { data, error } = await toggleGroupVisibility(groupId, !group.is_public);
    setTogglingVisibility(false);

    if (error) {
      console.log('Error toggling group visibility:', error);
      return;
    }
    setGroup(data);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Leave ${group?.name || 'this group'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            const { error } = await leaveGroup(groupId, myUserId);
            setLeaving(false);
            if (error) {
              console.log('Error leaving group:', error);
              return;
            }
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      `Delete ${group?.name || 'this group'}? This removes all members and can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await deleteGroup(groupId);
            setDeleting(false);
            if (error) {
              console.log('Error deleting group:', error);
              return;
            }
            navigation.goBack();
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
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{group?.name || 'Group'}</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : !group ? (
              <Text style={styles.emptyText}>This group is no longer available.</Text>
            ) : (
              <>
                {/* Join code */}
                <GlassCard style={styles.card}>
                  <Text style={styles.cardLabel}>Join Code</Text>
                  <View style={styles.friendCodeRow}>
                    <Text style={styles.friendCodeText}>{group.join_code}</Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
                      <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.friendHintText}>Share this so friends can join</Text>
                </GlassCard>

                {/* Owner controls */}
                {isOwner && (
                  <GlassCard style={styles.card}>
                    <Text style={styles.cardLabel}>Manage Group</Text>

                    {renaming ? (
                      <View style={styles.searchRow}>
                        <TextInput
                          style={styles.searchInput}
                          value={draftName}
                          onChangeText={setDraftName}
                          editable={!savingName}
                          autoFocus
                        />
                        <TouchableOpacity style={styles.searchBtn} onPress={handleSaveName} disabled={savingName}>
                          {savingName ? (
                            <ActivityIndicator color="#1a1a1a" />
                          ) : (
                            <Text style={styles.searchBtnText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.neutralBtn} onPress={handleStartRename}>
                        <Text style={styles.neutralBtnText}>Rename Group</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.visibilityRow}>
                      <View style={styles.groupInfo}>
                        <Text style={styles.visibilityLabel}>
                          {group.is_public ? 'Public' : 'Private'}
                        </Text>
                        <Text style={styles.friendHintText}>
                          {group.is_public
                            ? 'Findable in search and joinable by code.'
                            : 'Joinable by code only.'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.neutralBtn}
                        onPress={handleToggleVisibility}
                        disabled={togglingVisibility}
                      >
                        {togglingVisibility ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.neutralBtnText}>
                            Make {group.is_public ? 'Private' : 'Public'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                )}

                {/* Members */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Members</Text>
                  {/*
                    No kick-member affordance: group_members DELETE RLS is
                    self-only, so an owner can't remove other members.
                  */}
                  {members.map((member) => (
                    <GlassCard key={member.user_id} style={styles.personRow}>
                      <Image
                        source={getAvatarSource(member.profile?.avatar_id)}
                        style={styles.personAvatar}
                      />
                      <View style={styles.personInfo}>
                        <Text style={styles.personName} numberOfLines={1}>
                          {member.profile?.first_name || 'Someone'}
                        </Text>
                      </View>
                      {member.user_id === group.owner_id && (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>Owner</Text>
                        </View>
                      )}
                    </GlassCard>
                  ))}
                </View>

                {/* Leave / Delete */}
                {isOwner ? (
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={handleDeleteGroup}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator color="#ff8080" />
                    ) : (
                      <Text style={styles.dangerBtnText}>Delete Group</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={handleLeaveGroup}
                    disabled={leaving}
                  >
                    {leaving ? (
                      <ActivityIndicator color="#ff8080" />
                    ) : (
                      <Text style={styles.dangerBtnText}>Leave Group</Text>
                    )}
                  </TouchableOpacity>
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
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
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
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
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
  neutralBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  neutralBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  visibilityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  groupInfo: { flex: 1, marginRight: 8 },
  visibilityLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  ownerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  ownerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: 'rgba(255,90,90,0.2)',
    borderColor: 'rgba(255,90,90,0.6)', borderWidth: 1,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnText: { color: '#ff8080', fontSize: 14, fontWeight: '700' },
});
