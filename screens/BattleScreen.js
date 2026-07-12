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
import { getAvatarSource } from '../lib/avatars';
import { fetchProfile } from '../lib/profiles';
import { fetchPublicProfiles } from '../lib/friends';
import GlassCard, { textShadow } from '../components/GlassCard';
import {
  fetchBattleById, fetchBattlePlayers, fetchBattleMoves, buildQuestion, submitMove,
} from '../lib/battles';

const computeStreak = (playerMoves) => {
  let streak = 0;
  for (let i = playerMoves.length - 1; i >= 0; i--) {
    if (playerMoves[i].is_correct) streak++;
    else break;
  }
  return Math.min(streak, 3);
};

const StreakDots = ({ streak }) => (
  <Text style={styles.streakDots}>
    {[0, 1, 2].map((i) => (i < streak ? '●' : '○')).join(' ')}
  </Text>
);

export default function BattleScreen({ route, navigation }) {
  const { battleId } = route.params;
  const language = getLanguage();
  const backgrounds = getBackgrounds(language.code);

  const [userId, setUserId] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [mySide, setMySide] = useState(null);
  const [battle, setBattle] = useState(null);
  const [opponentProfile, setOpponentProfile] = useState(null);
  const [myMoves, setMyMoves] = useState([]);
  const [opponentMoves, setOpponentMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justWon, setJustWon] = useState(false);

  const loadBattle = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: profileData } = await fetchProfile(uid);
    setMyProfile(profileData);

    const { data: battleData, error: battleError } = await fetchBattleById(battleId);
    if (battleError) console.log('Error fetching battle:', battleError);
    setBattle(battleData);

    const { data: players, error: playersError } = await fetchBattlePlayers(battleId);
    if (playersError) console.log('Error fetching battle players:', playersError);
    setMySide(players.find((p) => p.user_id === uid)?.side ?? null);
    const opponentPlayer = players.find((p) => p.user_id !== uid);

    if (opponentPlayer) {
      const { data: profiles, error: profilesError } = await fetchPublicProfiles([opponentPlayer.user_id]);
      if (profilesError) console.log('Error fetching opponent profile:', profilesError);
      setOpponentProfile(profiles[0] || null);
    }

    const { data: moves, error: movesError } = await fetchBattleMoves(battleId);
    if (movesError) console.log('Error fetching battle moves:', movesError);
    const mine = moves.filter((m) => m.user_id === uid);
    const theirs = opponentPlayer ? moves.filter((m) => m.user_id === opponentPlayer.user_id) : [];
    setMyMoves(mine);
    setOpponentMoves(theirs);

    setAnswered(false);
    setJustWon(false);

    if (battleData?.status === 'active' && battleData?.turn_user === uid && opponentPlayer) {
      const { data: q, error: qError } = await buildQuestion(
        opponentPlayer.user_id, battleData.language, mine.map((m) => m.question),
      );
      if (qError) console.log('Error building question:', qError);
      setQuestion(q);
    } else {
      setQuestion(null);
    }

    setLoading(false);
  }, [battleId]);

  useFocusEffect(
    useCallback(() => {
      loadBattle();
    }, [loadBattle]),
  );

  const handleAnswer = async (option) => {
    if (answered || submitting || !question) return;
    setAnswered(true);
    const isCorrect = option === question.correctPhrase;
    setWasCorrect(isCorrect);

    setSubmitting(true);
    const { error, result } = await submitMove({
      battleId, userId, question: question.correctPhrase, answer: option, isCorrect,
    });
    setSubmitting(false);
    if (error) {
      console.log('Error submitting move:', error);
      return;
    }
    // A move that finishes the battle can only do so via the mover's own
    // streak, so a finished result here always means I just won.
    if (result?.finished) setJustWon(true);
  };

  const opponentName = opponentProfile?.first_name || 'Opponent';
  const myStreak = computeStreak(myMoves);
  const opponentStreak = computeStreak(opponentMoves);
  const isMyTurn = battle?.status === 'active' && battle?.turn_user === userId;
  const isFinished = battle?.status === 'finished' || justWon;
  const won = justWon || battle?.winner_side === mySide;

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>vs {opponentName}</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : !battle ? (
              <Text style={styles.emptyText}>This battle is no longer available.</Text>
            ) : (
              <>
                <GlassCard style={styles.playersCard}>
                  <View style={styles.playerRow}>
                    <Image source={getAvatarSource(opponentProfile?.avatar_id)} style={styles.playerAvatar} />
                    <Text style={styles.playerName} numberOfLines={1}>{opponentName}</Text>
                    <StreakDots streak={opponentStreak} />
                  </View>
                  <View style={styles.playerRow}>
                    <Image source={getAvatarSource(myProfile?.avatar_id)} style={styles.playerAvatar} />
                    <Text style={styles.playerName}>You</Text>
                    <StreakDots streak={myStreak} />
                  </View>
                </GlassCard>

                {isFinished ? (
                  <GlassCard style={styles.resultCard}>
                    <Text style={styles.resultEmoji}>{won ? '🏆' : '😔'}</Text>
                    <Text style={styles.resultText}>{won ? 'You won!' : 'You lost this one'}</Text>
                  </GlassCard>
                ) : answered ? (
                  <>
                    <GlassCard
                      style={styles.feedbackCard}
                      overlayColor={wasCorrect ? 'rgba(76,217,100,0.25)' : 'rgba(255,59,48,0.25)'}
                      borderColor={wasCorrect ? 'rgba(76,217,100,0.8)' : 'rgba(255,59,48,0.8)'}
                    >
                      <Text style={styles.feedbackText}>
                        {wasCorrect ? '¡Correcto!' : `Not quite — it was "${question?.correctPhrase}"`}
                      </Text>
                    </GlassCard>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                      <Text style={styles.primaryBtnText}>Done</Text>
                    </TouchableOpacity>
                  </>
                ) : isMyTurn && question ? (
                  <GlassCard style={styles.questionCard}>
                    <Text style={styles.cardLabel}>Your turn</Text>
                    <Text style={styles.question}>What's the Spanish for "{question.prompt}"?</Text>
                    {question.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => handleAnswer(option)}
                        disabled={submitting}
                      >
                        <GlassCard style={styles.option}>
                          <Text style={styles.optionText}>{option}</Text>
                        </GlassCard>
                      </TouchableOpacity>
                    ))}
                  </GlassCard>
                ) : isMyTurn && !question ? (
                  <GlassCard style={styles.card}>
                    <Text style={styles.emptyText}>
                      {opponentName} doesn't have any new words left to quiz you on right now.
                    </Text>
                  </GlassCard>
                ) : (
                  <GlassCard style={styles.card}>
                    <Text style={styles.emptyText}>Waiting for their move...</Text>
                  </GlassCard>
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
  playersCard: { padding: 18, marginBottom: 16 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
  },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18, marginRight: 12,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
  },
  playerName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  streakDots: { color: '#fff', fontSize: 16, letterSpacing: 2 },
  card: { padding: 18, marginBottom: 16 },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  questionCard: { padding: 18, marginBottom: 16 },
  question: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  option: { padding: 14, marginBottom: 10 },
  optionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  feedbackCard: { padding: 16, marginBottom: 16 },
  feedbackText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
  resultCard: {
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  resultEmoji: { fontSize: 48, marginBottom: 10 },
  resultText: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
});
