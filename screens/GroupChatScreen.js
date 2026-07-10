import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image,
  StyleSheet, ImageBackground, FlatList, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { getAvatarSource } from '../lib/avatars';
import { fetchPublicProfiles, fetchFriendshipBetween, deleteFriendship, blockUser } from '../lib/friends';
import { textShadow } from '../components/GlassCard';
import {
  fetchRecentMessages, fetchOlderMessages, sendMessage, softDeleteMessage,
  reportMessage, fetchMyBlockedIds, subscribeToGroupMessages, unsubscribeFromGroupMessages,
  MESSAGE_PAGE_SIZE,
} from '../lib/chat';

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Other'];

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function GroupChatScreen({ route, navigation }) {
  const { groupId, groupName, isOwner } = route.params;
  const language = getLanguage();
  const backgrounds = getBackgrounds(language.code);

  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profileById, setProfileById] = useState({});
  const [blockedIds, setBlockedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);

  const channelRef = useRef(null);

  const mergeProfiles = useCallback(async (senderIds) => {
    setProfileById((prev) => {
      const unseen = senderIds.filter((id) => !prev[id]);
      if (unseen.length === 0) return prev;
      fetchPublicProfiles(unseen).then(({ data, error }) => {
        if (error) {
          console.log('Error fetching sender profiles:', error);
          return;
        }
        setProfileById((current) => {
          const next = { ...current };
          data.forEach((p) => { next[p.user_id] = p; });
          return next;
        });
      });
      return prev;
    });
  }, []);

  const handleIncomingInsert = useCallback((message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [message, ...prev];
    });
    mergeProfiles([message.sender_id]);
  }, [mergeProfiles]);

  const handleIncomingUpdate = useCallback((message) => {
    if (message.deleted_at) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  }, []);

  const loadInitial = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: blocked, error: blockedError } = await fetchMyBlockedIds(uid);
    if (blockedError) console.log('Error fetching blocked users:', blockedError);
    setBlockedIds(new Set(blocked));

    const { data: recent, error } = await fetchRecentMessages(groupId);
    if (error) console.log('Error fetching messages:', error);
    setMessages(recent);
    setHasMore(recent.length === MESSAGE_PAGE_SIZE);

    const { data: profiles, error: profilesError } = await fetchPublicProfiles(
      Array.from(new Set(recent.map((m) => m.sender_id))),
    );
    if (profilesError) console.log('Error fetching sender profiles:', profilesError);
    const map = {};
    profiles.forEach((p) => { map[p.user_id] = p; });
    setProfileById(map);

    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
      channelRef.current = subscribeToGroupMessages(groupId, {
        onInsert: handleIncomingInsert,
        onUpdate: handleIncomingUpdate,
      });

      return () => {
        unsubscribeFromGroupMessages(channelRef.current);
        channelRef.current = null;
      };
    }, [loadInitial, groupId, handleIncomingInsert, handleIncomingUpdate]),
  );

  const handleLoadEarlier = async () => {
    if (!hasMore || loadingEarlier || messages.length === 0) return;
    setLoadingEarlier(true);
    const oldest = messages[messages.length - 1];
    const { data: older, error } = await fetchOlderMessages(groupId, oldest.created_at);
    setLoadingEarlier(false);

    if (error) {
      console.log('Error fetching earlier messages:', error);
      return;
    }
    setHasMore(older.length === MESSAGE_PAGE_SIZE);
    setMessages((prev) => [...prev, ...older]);
    mergeProfiles(Array.from(new Set(older.map((m) => m.sender_id))));
  };

  const handleSend = async () => {
    const trimmed = composerText.trim();
    if (!trimmed || trimmed.length > 2000 || sending) return;

    setSending(true);
    const { error } = await sendMessage(groupId, userId, trimmed);
    setSending(false);

    if (error) {
      console.log('Error sending message:', error);
      return;
    }
    setComposerText('');
  };

  const confirmDelete = (message) => {
    Alert.alert(
      'Delete Message',
      "Delete this message? This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await softDeleteMessage(message.id);
            if (error) {
              console.log('Error deleting message:', error);
              return;
            }
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          },
        },
      ],
    );
  };

  const submitReport = async (message, reason) => {
    const { error } = await reportMessage({
      reporterId: userId, reportedUserId: message.sender_id, messageId: message.id, reason,
    });
    if (error) {
      console.log('Error submitting report:', error);
      return;
    }
    Alert.alert('Reported', "Thanks — we'll take a look.");
  };

  const handleReportFlow = (message) => {
    Alert.alert(
      'Report Message',
      'Why are you reporting this?',
      [
        ...REPORT_REASONS.map((reason) => ({ text: reason, onPress: () => submitReport(message, reason) })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const confirmBlock = (message, profile) => {
    Alert.alert(
      'Block User',
      `Block ${profile?.first_name || 'this user'}? This removes any friendship between you. They'll still be visible in shared groups, but you won't see their messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const { error: blockError } = await blockUser(userId, message.sender_id);
            if (blockError) {
              console.log('Error blocking user:', blockError);
              return;
            }
            const { data: friendship, error: friendshipError } = await fetchFriendshipBetween(
              userId, message.sender_id,
            );
            if (friendshipError) console.log('Error checking friendship:', friendshipError);
            if (friendship) {
              const { error: deleteError } = await deleteFriendship(friendship.id);
              if (deleteError) console.log('Error deleting friendship after block:', deleteError);
            }
            setBlockedIds((prev) => new Set(prev).add(message.sender_id));
          },
        },
      ],
    );
  };

  const handleLongPressMessage = (message) => {
    const profile = profileById[message.sender_id];
    const isMine = message.sender_id === userId;
    const options = [];

    if (isMine || isOwner) {
      options.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDelete(message) });
    }
    if (!isMine) {
      options.push({ text: 'Report', onPress: () => handleReportFlow(message) });
      options.push({ text: 'Block User', style: 'destructive', onPress: () => confirmBlock(message, profile) });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message Options', undefined, options);
  };

  const visibleMessages = messages.filter((m) => !blockedIds.has(m.sender_id));

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === userId;
    const profile = profileById[item.sender_id];

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleLongPressMessage(item)}
        style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}
      >
        {!isMine && (
          <Image source={getAvatarSource(profile?.avatar_id)} style={styles.messageAvatar} />
        )}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {!isMine && (
            <Text style={styles.senderName} numberOfLines={1}>{profile?.first_name || 'Someone'}</Text>
          )}
          <Text style={styles.messageBody}>{item.body}</Text>
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
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
            <Text style={styles.headerTitle} numberOfLines={1}>{groupName || 'Chat'}</Text>
          </View>

          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {loading ? (
              <ActivityIndicator color="#fff" style={styles.loadingIndicator} />
            ) : (
              <FlatList
                data={visibleMessages}
                inverted
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={
                  loadingEarlier ? (
                    <ActivityIndicator color="#fff" style={styles.loadEarlierIndicator} />
                  ) : hasMore ? (
                    <TouchableOpacity style={styles.loadEarlierBtn} onPress={handleLoadEarlier}>
                      <Text style={styles.loadEarlierText}>Load earlier messages</Text>
                    </TouchableOpacity>
                  ) : null
                }
                ListEmptyComponent={<Text style={styles.emptyText}>No messages yet — say hi!</Text>}
              />
            )}

            <View style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                placeholder="Message..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={composerText}
                onChangeText={setComposerText}
                multiline
                maxLength={2000}
                editable={!sending}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSend}
                disabled={sending || !composerText.trim()}
              >
                {sending ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.sendBtnText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
  loadingIndicator: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  emptyText: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center',
    marginTop: 24,
  },
  loadEarlierIndicator: { marginVertical: 12 },
  loadEarlierBtn: { alignItems: 'center', paddingVertical: 12 },
  loadEarlierText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12,
  },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowTheirs: { justifyContent: 'flex-start' },
  messageAvatar: {
    width: 28, height: 28, borderRadius: 14, marginRight: 8,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  bubble: {
    maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
  },
  senderName: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  messageBody: { color: '#fff', fontSize: 15, lineHeight: 20 },
  messageTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  composerRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
  },
  composerInput: {
    flex: 1, maxHeight: 100, minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    color: '#fff', fontSize: 15,
  },
  sendBtn: {
    height: 44, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 14 },
});
