import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { getAvatarSource } from '../lib/avatars';
import { fetchProfile } from '../lib/profiles';
import { fetchPublicProfiles } from '../lib/friends';
import GlassCard, { textShadow } from '../components/GlassCard';
import BattleHelpOverlay from '../components/BattleHelpOverlay';
import {
  fetchBattleById, fetchBattlePlayers, fetchBattleMoves, buildQuestion, submitMove,
  subscribeToBattle, unsubscribeFromBattle, judgeBattle, checkOpponentEligibility,
  createChallenge, isDuplicateBattleError, MAX_MOVES_PER_PLAYER,
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

const ANSWER_TIMER_SECONDS = 5;
// A string no real option can ever equal, so it flows through handleAnswer's
// normal path and is judged incorrect like any wrong tap.
const TIMEOUT_ANSWER = '(no answer)';

export default function BattleScreen({ route, navigation }) {
  const { battleId } = route.params;
  const isFocused = useIsFocused();
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
  // 'won' | 'tie' | null — outcome of a battle finished by MY OWN move this
  // session (a loss can only arrive via the opponent's move → battle state).
  const [justFinished, setJustFinished] = useState(null);
  const [sendingRematch, setSendingRematch] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [wasTimeout, setWasTimeout] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  const channelRef = useRef(null);
  // Mirrors `answered`, but readable synchronously from the realtime
  // handlers below without depending on a stale closure over state.
  const answeredRef = useRef(false);
  // Monotonic id per loadBattle call, so a superseded load discards its
  // result instead of applying stale data.
  const loadSeqRef = useRef(0);

  // Everything is gathered into locals first and applied as ONE synchronous
  // state batch at the end — a single coherent render. The old version
  // staggered setState across six await boundaries, which flashed stale
  // questions/timers between frames (the "next question leaks before
  // feedback" bug).
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

    // Deadlock guard: a tie is normally recorded by the judge invoked on the
    // final move — if that invocation was lost (network blip), the battle
    // would sit 'active' forever with no playable moves. Settle it here.
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

    // Discard stale results: a newer load has started, or the player tapped
    // an answer while this load was in flight (their feedback must not be
    // overwritten by data gathered before the tap).
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

  // A live event while the player is looking at their own just-answered
  // feedback would otherwise yank it away mid-read (loadBattle resets
  // `answered` and rebuilds the question) -- so skip the refresh until
  // they've moved on themselves via the Done button.
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
    // Reflect my own move in the streak dots immediately — the realtime echo
    // of it is suppressed while the feedback card is up (answeredRef guard).
    setMyMoves((prev) => [...prev, { question: question.correctPhrase, is_correct: isCorrect }]);
    // My own move can end the battle as my win (streak) or as a tie (final
    // move exhausted with no streak) — never as my loss.
    if (result?.finished && !result?.alreadyProcessed) {
      setJustFinished(result.winnerSide === null ? 'tie' : 'won');
    }
  };

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

  // Leave the feedback card and re-enter the live flow: feedback stays on
  // screen (button spinner) until loadBattle's single atomic batch swaps in
  // the next coherent view — clearing `answered` here first is what used to
  // flash a stale question card during the reload.
  const handleContinue = () => {
    if (continuing) return;
    setContinuing(true);
    loadBattle();
  };

  // First-time help: shown once per user (device-local flag) before their
  // first battle; the (?) header button reopens it anytime.
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

  // Soft client-side answer timer. Deadline-based (not tick-counting) so it
  // can't drift; cancels on answer (`answered` dep + cleanup), on blur
  // (`isFocused`), on unmount, and while the help overlay is up (a
  // first-timer must not lose their first question while reading the rules).
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

  const opponentName = opponentProfile?.first_name || 'Opponent';
  const myStreak = computeStreak(myMoves);
  const opponentStreak = computeStreak(opponentMoves);
  const isMyTurn = battle?.status === 'active' && battle?.turn_user === userId;

  let outcome = justFinished;
  if (!outcome && battle?.status === 'finished') {
    if (battle.winner_side === null) outcome = 'tie';
    else outcome = battle.winner_side === mySide ? 'won' : 'lost';
  }
  const isFinished = outcome !== null;

  const RESULT_CONTENT = {
    won: { emoji: '🏆', text: 'You won!' },
    lost: { emoji: '😔', text: 'You lost this one' },
    tie: { emoji: '🤝', text: "It's a tie!" },
  };

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>vs {opponentName}</Text>
            <TouchableOpacity style={styles.helpBtn} onPress={() => setHelpVisible(true)}>
              <Text style={styles.helpBtnText}>?</Text>
            </TouchableOpacity>
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
                  <>
                    <GlassCard style={styles.resultCard}>
                      <Text style={styles.resultEmoji}>{RESULT_CONTENT[outcome].emoji}</Text>
                      <Text style={styles.resultText}>{RESULT_CONTENT[outcome].text}</Text>
                    </GlassCard>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handlePlayAgain}
                      disabled={sendingRematch}
                    >
                      {sendingRematch ? (
                        <ActivityIndicator color="#1a1a1a" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Play Again</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
                      <Text style={styles.secondaryBtnText}>Back to Battles</Text>
                    </TouchableOpacity>
                  </>
                ) : answered ? (
                  <>
                    <GlassCard
                      style={styles.feedbackCard}
                      overlayColor={wasCorrect ? 'rgba(76,217,100,0.25)' : 'rgba(255,59,48,0.25)'}
                      borderColor={wasCorrect ? 'rgba(76,217,100,0.8)' : 'rgba(255,59,48,0.8)'}
                    >
                      <Text style={styles.feedbackText}>
                        {wasCorrect
                          ? '¡Correcto!'
                          : wasTimeout
                            ? `⏱ Time's up — it was "${question?.correctPhrase}"`
                            : `Not quite — it was "${question?.correctPhrase}"`}
                      </Text>
                    </GlassCard>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} disabled={continuing}>
                      {continuing ? (
                        <ActivityIndicator color="#1a1a1a" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : isMyTurn && question ? (
                  <GlassCard style={styles.questionCard}>
                    <View style={styles.timerRow}>
                      <Text style={styles.cardLabel}>Your turn</Text>
                      {timeLeft !== null && (
                        <Text style={styles.timerText}>{Math.ceil(timeLeft)}</Text>
                      )}
                    </View>
                    {timeLeft !== null && (
                      <View style={styles.timerTrack}>
                        <View
                          style={[
                            styles.timerFill,
                            { width: `${(timeLeft / ANSWER_TIMER_SECONDS) * 100}%` },
                          ]}
                        />
                      </View>
                    )}
                    <Text style={styles.question}>What's the Spanish for "{question.prompt}"?</Text>
                    {question.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => handleAnswer(option)}
                        disabled={answered || submitting}
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

          <BattleHelpOverlay visible={helpVisible} onClose={handleCloseHelp} />
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
  helpBtn: {
    width: 32, height: 32, borderRadius: 16, marginLeft: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  helpBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
  timerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  timerText: { color: '#ffc400', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  timerTrack: {
    height: 6, borderRadius: 3, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
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
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard: {
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  resultEmoji: { fontSize: 48, marginBottom: 10 },
  resultText: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
});
