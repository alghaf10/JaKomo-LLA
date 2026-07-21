import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { getAvatarSource } from '../lib/avatars';
import { fetchPublicProfiles } from '../lib/friends';
import Card from '../components/Card';
import {
  fetchGroupById, fetchGroupMemberRows, renameGroup,
  toggleGroupVisibility, leaveGroup, deleteGroup,
} from '../lib/groups';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

export default function GroupDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;

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
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.onGradient} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group?.name || 'Group'}</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={colors.accentCoral} />
        ) : !group ? (
          <Text style={styles.emptyText}>This group is no longer available.</Text>
        ) : (
          <>
            {/* Join code */}
            <Card style={styles.card}>
              <Text style={styles.cardLabel}>Join Code</Text>
              <View style={styles.friendCodeRow}>
                <Text style={styles.friendCodeText}>{group.join_code}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
                  <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>Share this so friends can join</Text>
            </Card>

            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => navigation.navigate('GroupChat', {
                groupId, groupName: group.name, isOwner,
              })}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.onGradient} style={styles.chatIcon} />
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>

            {/* Owner controls */}
            {isOwner && (
              <Card style={styles.card}>
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
                        <ActivityIndicator color={colors.onGradient} />
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
                    <Text style={styles.hintText}>
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
                      <ActivityIndicator color={colors.accentCoral} />
                    ) : (
                      <Text style={styles.neutralBtnText}>
                        Make {group.is_public ? 'Private' : 'Public'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Card>
            )}

            {/* Members */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              {/*
                No kick-member affordance: group_members DELETE RLS is
                self-only, so an owner can't remove other members.
              */}
              {members.map((member) => (
                <Card key={member.user_id} style={styles.personRow}>
                  <Image source={getAvatarSource(member.profile?.avatar_id)} style={styles.avatar} />
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
                </Card>
              ))}
            </View>

            {/* Leave / Delete */}
            {isOwner ? (
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteGroup} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={styles.dangerBtnText}>Delete Group</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.dangerBtn} onPress={handleLeaveGroup} disabled={leaving}>
                {leaving ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={styles.dangerBtnText}>Leave Group</Text>
                )}
              </TouchableOpacity>
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
  glassBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
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
  hintText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  chatBtn: {
    flexDirection: 'row', backgroundColor: colors.accentCoral,
    borderRadius: radius, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  chatIcon: { marginRight: 8 },
  chatBtnText: { color: colors.onGradient, fontSize: 15, fontWeight: fontWeight.medium },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
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
  neutralBtn: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  neutralBtnText: { color: colors.text, fontSize: 13, fontWeight: fontWeight.medium },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupInfo: { flex: 1, marginRight: 8 },
  visibilityLabel: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: fontWeight.medium, marginBottom: 14 },
  personRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, marginRight: 12,
    borderColor: colors.border, borderWidth: 1,
  },
  personInfo: { flex: 1, marginRight: 8 },
  personName: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  ownerBadge: {
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 5,
  },
  ownerBadgeText: { color: colors.accentCoral, fontSize: 11, fontWeight: fontWeight.medium },
  dangerBtn: {
    backgroundColor: colors.dangerTint,
    borderColor: colors.danger, borderWidth: 0.5,
    borderRadius: radius, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnText: { color: colors.danger, fontSize: 14, fontWeight: fontWeight.medium },
});
