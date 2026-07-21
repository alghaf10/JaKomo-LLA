import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { getAvatarSource } from '../lib/avatars';
import { fetchProfile } from '../lib/profiles';
import { fetchPublicProfiles } from '../lib/friends';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import BattleHelpOverlay from '../components/BattleHelpOverlay';
import {
  fetchBattleById, fetchBattlePlayers, fetchBattleMoves, buildQuestion, submitMove,
  subscribeToBattle, unsubscribeFromBattle, judgeBattle, checkOpponentEligibility,
  createChallenge, isDuplicateBattleError, MAX_MOVES_PER_PLAYER,
} from '../lib/battles';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

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

const ANSWER_TIMER_SECONDS = 5;
// A string no real option can ever equal, so it flows through handleAnswer's
// normal path and is judged incorrect like any wrong tap.
const TIMEOUT_ANSWER = '(no answer)';

export default function BattleScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { battleId } = route.params;
  const isFocused = useIsFocused();

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
  const [justFinished, setJustFinished] = useState(null);
  const [sendingRematch, setSendingRematch] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [wasTimeout, setWasTimeout] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  const channelRef = useRef(null);
  const answeredRef = useRef(false);
  const loadSeqRef = useRef(0);

  const loadBattle = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const wasAnsweredAtStart = answeredRef.current;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const uid = userData.user.id;

    const { data: profileData } = await fetchProfile(uid);

    const { data: battleData, error: battleError } = await fetchBattleById(battleId);
    if (battleError) console.log('Error fetching battle:', battleError);

    const { data: players, error: playersError } = await fetchBattlePlayers(battleId);
    if (playersError) console.log('Error fetching battle players:', playersError);
    const myPlayer = players.find((p) => p.user_id === uid);
    const opponentPlayer = players.find((p) => p.user_id !== uid);

    let opponentProfileData = null;
    if (opponentPlayer) {
      const { data: profiles, error: profilesError } = await fetchPublicProfiles([opponentPlayer.user_id]);
      if (profilesError) console.log('Error fetching opponent profile:', profilesError);
      opponentProfileData = profiles[0] || null;
    }

    const { data: moves, error: movesError } = await fetchBattleMoves(battleId);
    if (movesError) console.log('Error fetching battle moves:', movesError);
    const mine = moves.filter((m) => m.user_id === uid);
    const theirs = opponentPlayer ? moves.filter((m) => m.user_id === opponentPlayer.user_id) : [];

    let currentBattle = battleData;

    if (
      currentBattle?.status === 'active'
      && mine.length >= MAX_MOVES_PER_PLAYER
      && theirs.length >= MAX_MOVES_PER_PLAYER
    ) {
      const { result } = await judgeBattle(battleId);
      if (result?.finished) {
        const { data: settled } = await fetchBattleById(battleId);
        if (settled) currentBattle = settled;
      }
    }

    let nextQuestion = null;
    if (
      currentBattle?.status === 'active'
      && currentBattle?.turn_user === uid
      && opponentPlayer
      && mine.length < MAX_MOVES_PER_PLAYER
    ) {
      const { data: q, error: qError } = await buildQuestion(
        opponentPlayer.user_id, currentBattle.language, mine.map((m) => m.question),
      );
      if (qError) console.log('Error building question:', qError);
      nextQuestion = q;
    }

    if (seq !== loadSeqRef.current) return;
    if (!wasAnsweredAtStart && answeredRef.current) return;

    setUserId(uid);
    setMyProfile(profileData);
    setBattle(currentBattle);
    setMySide(myPlayer?.side ?? null);
    setOpponentProfile(opponentProfileData);
    setMyMoves(mine);
    setOpponentMoves(theirs);
    setQuestion(nextQuestion);
    setAnswered(false);
    answeredRef.current = false;
    setJustFinished(null);
    setWasTimeout(false);
    setContinuing(false);
    setLoading(false);
  }, [battleId]);

  const handleLiveUpdate = useCallback(() => {
    if (answeredRef.current) return;
    loadBattle();
  }, [loadBattle]);

  useFocusEffect(
    useCallback(() => {
      loadBattle();
      channelRef.current = subscribeToBattle(battleId, {
        onMoveInsert: handleLiveUpdate,
        onBattleUpdate: handleLiveUpdate,
      });

      return () => {
        unsubscribeFromBattle(channelRef.current);
        channelRef.current = null;
      };
    }, [loadBattle, battleId, handleLiveUpdate]),
  );

  const handleAnswer = async (option) => {
    if (answeredRef.current || submitting || !question) return;
    setAnswered(true);
    answeredRef.current = true;
    const isCorrect = option === question.correctPhrase;
    setWasCorrect(isCorrect);
    setWasTimeout(option === TIMEOUT_ANSWER);

    setSubmitting(true);
    const { error, result } = await submitMove({
      battleId, userId, question: question.correctPhrase, answer: option, isCorrect,
    });
    setSubmitting(false);
    if (error) {
      console.log('Error submitting move:', error);
      return;
    }
    setMyMoves((prev) => [...prev, { question: question.correctPhrase, is_correct: isCorrect }]);
    if (result?.finished && !result?.alreadyProcessed) {
      setJustFinished(result.winnerSide === null ? 'tie' : 'won');
    }
  };

  const opponentName = opponentProfile?.first_name || 'Opponent';

  const handlePlayAgain = async () => {
    const opponentId = opponentProfile?.user_id;
    if (!opponentId || sendingRematch) return;
    setSendingRematch(true);
    const { eligible, error: eligError } = await checkOpponentEligibility(opponentId, battle.language);
    if (eligError || !eligible) {
      setSendingRematch(false);
      if (eligError) console.log('Error checking rematch eligibility:', eligError);
      Alert.alert(
        eligError ? 'Something went wrong' : 'Not ready yet',
        eligError ? 'Please try again.' : `${opponentName} doesn't have enough words to battle right now.`,
      );
      return;
    }
    const { error: createError } = await createChallenge({
      opponentId, language: battle.language,
    });
    setSendingRematch(false);
    if (createError) {
      console.log('Error creating rematch:', createError);
      if (isDuplicateBattleError(createError)) {
        Alert.alert('Battle in progress', `You already have a battle with ${opponentName} — check your Battles list.`);
        return;
      }
      Alert.alert('Something went wrong', 'Please try again.');
      return;
    }
    Alert.alert('Challenge sent!', `${opponentName} will see it in Battles.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleContinue = () => {
    if (continuing) return;
    setContinuing(true);
    loadBattle();
  };

  const helpCheckedRef = useRef(false);
  useEffect(() => {
    if (!userId || helpCheckedRef.current) return;
    helpCheckedRef.current = true;
    AsyncStorage.getItem(`battle-help-seen:${userId}`)
      .then((seen) => { if (!seen) setHelpVisible(true); })
      .catch((e) => console.log('Error reading battle help flag:', e));
  }, [userId]);

  const handleCloseHelp = () => {
    setHelpVisible(false);
    if (userId) {
      AsyncStorage.setItem(`battle-help-seen:${userId}`, 'true')
        .catch((e) => console.log('Error saving battle help flag:', e));
    }
  };

  useEffect(() => {
    if (!isFocused || !question || answered || helpVisible) {
      setTimeLeft(null);
      return undefined;
    }
    const deadline = Date.now() + ANSWER_TIMER_SECONDS * 1000;
    setTimeLeft(ANSWER_TIMER_SECONDS);
    const interval = setInterval(() => {
      const remaining = Math.max(0, (deadline - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (!answeredRef.current) handleAnswer(TIMEOUT_ANSWER);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isFocused, question, answered, helpVisible]);

  const myStreak = computeStreak(myMoves);
  const opponentStreak = computeStreak(opponentMoves);
  const isMyTurn = battle?.status === 'active' && battle?.turn_user === userId;

  let outcome = justFinished;
  if (!outcome && battle?.status === 'finished') {
    if (battle.winner_side === null) outcome = 'tie';
    else outcome = battle.winner_side === mySide ? 'won' : 'lost';
  }
  const isFinished = outcome !== null;

  // Result emoji kept — expressive content.
  const RESULT_CONTENT = {
    won: { emoji: '🏆', text: 'You won!' },
    lost: { emoji: '😔', text: 'You lost this one' },
    tie: { emoji: '🤝', text: "It's a tie!" },
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
        <Text style={styles.headerTitle} numberOfLines={1}>vs {opponentName}</Text>
        <TouchableOpacity style={styles.glassBtn} onPress={() => setHelpVisible(true)}>
          <Ionicons name="help" size={18} color={colors.onGradient} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={colors.accentCoral} />
        ) : !battle ? (
          <Text style={styles.emptyText}>This battle is no longer available.</Text>
        ) : (
          <>
            <Card style={styles.playersCard}>
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
            </Card>

            {isFinished ? (
              <>
                <Card style={styles.resultCard}>
                  <Text style={styles.resultEmoji}>{RESULT_CONTENT[outcome].emoji}</Text>
                  <Text style={styles.resultText}>{RESULT_CONTENT[outcome].text}</Text>
                </Card>
                <SolidButton
                  label={sendingRematch ? '' : 'Play Again'}
                  onPress={handlePlayAgain}
                  disabled={sendingRematch}
                />
                {sendingRematch ? <ActivityIndicator color={colors.accentCoral} style={styles.inlineSpinner} /> : null}
                <SolidButton
                  label="Back to Battles"
                  variant="secondary"
                  onPress={() => navigation.goBack()}
                  style={styles.secondaryBtn}
                />
              </>
            ) : answered ? (
              <>
                <View style={[styles.feedbackCard, wasCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
                  <Text style={styles.feedbackText}>
                    {wasCorrect
                      ? '¡Correcto!'
                      : wasTimeout
                        ? `Time's up — it was "${question?.correctPhrase}"`
                        : `Not quite — it was "${question?.correctPhrase}"`}
                  </Text>
                </View>
                <SolidButton
                  label={continuing ? '' : 'Continue'}
                  onPress={handleContinue}
                  disabled={continuing}
                />
                {continuing ? <ActivityIndicator color={colors.accentCoral} style={styles.inlineSpinner} /> : null}
              </>
            ) : isMyTurn && question ? (
              <Card style={styles.questionCard}>
                <View style={styles.timerRow}>
                  <Text style={styles.cardLabel}>Your turn</Text>
                  {timeLeft !== null && (
                    <Text style={styles.timerText}>{Math.ceil(timeLeft)}</Text>
                  )}
                </View>
                {timeLeft !== null && (
                  <View style={styles.timerTrack}>
                    <View style={[styles.timerFill, { width: `${(timeLeft / ANSWER_TIMER_SECONDS) * 100}%` }]} />
                  </View>
                )}
                <Text style={styles.question}>What&apos;s the Spanish for &quot;{question.prompt}&quot;?</Text>
                {question.options.map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleAnswer(option)}
                    disabled={answered || submitting}
                  >
                    <View style={styles.option}>
                      <Text style={styles.optionText}>{option}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            ) : isMyTurn && !question ? (
              <Card style={styles.card}>
                <Text style={styles.emptyText}>
                  {opponentName} doesn&apos;t have any new words left to quiz you on right now.
                </Text>
              </Card>
            ) : (
              <Card style={styles.card}>
                <Text style={styles.emptyText}>Waiting for their move...</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <BattleHelpOverlay visible={helpVisible} onClose={handleCloseHelp} />
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
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium,
    marginHorizontal: 14,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  playersCard: { marginBottom: spacing.lg },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18, marginRight: 12,
    borderColor: colors.border, borderWidth: 1,
  },
  playerName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  streakDots: { color: colors.accentCoral, fontSize: 16, letterSpacing: 2 },
  card: { marginBottom: spacing.lg },
  cardLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  questionCard: { marginBottom: spacing.lg },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerText: { color: colors.accentCoral, fontSize: 18, fontWeight: fontWeight.medium, marginBottom: 10 },
  timerTrack: {
    height: 6, borderRadius: 3, marginBottom: 14,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  timerFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accentCoral },
  question: { fontSize: 18, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 16 },
  option: {
    padding: 14, marginBottom: 10, borderRadius: radius,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
  },
  optionText: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  feedbackCard: { padding: 16, marginBottom: 16, borderRadius: radius, borderWidth: 1 },
  feedbackCorrect: { backgroundColor: colors.successTint, borderColor: colors.success },
  feedbackWrong: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  inlineSpinner: { marginTop: 10 },
  secondaryBtn: { marginTop: 12 },
  resultCard: { alignItems: 'center', paddingVertical: 24, marginBottom: spacing.lg },
  resultEmoji: { fontSize: 48, marginBottom: 10 },
  resultText: { color: colors.text, fontSize: 20, fontWeight: fontWeight.medium },
});
