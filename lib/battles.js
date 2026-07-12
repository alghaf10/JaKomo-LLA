import { supabase } from './supabase';
import { getLessons } from '../content';

const BATTLE_COLUMNS = 'id, mode, language, group_id, status, turn_user, winner_side, created_by, created_at';
const MOVE_COLUMNS = 'id, battle_id, round_number, user_id, question, answer, is_correct, created_at';

export const checkOpponentEligibility = async (opponentId, language) => {
  const { data, error } = await supabase.rpc('count_review_cards_for_battle', {
    target_user_id: opponentId, target_language: language,
  });
  if (error) return { eligible: false, error };
  return { eligible: (data || 0) >= 5, error: null };
};

// battle_players' INSERT policy is self-insert-only, but creating a
// challenge requires writing the opponent's row too before they've acted --
// so this goes through a SECURITY DEFINER RPC that creates the battle and
// both player rows atomically (friend-gated inside the function itself).
export const createChallenge = async ({ opponentId, language }) => {
  const { data, error } = await supabase.rpc('create_battle_challenge', {
    opponent_id: opponentId, battle_language: language,
  });
  return { data, error };
};

export const acceptChallenge = async (battleId, challengerId) => {
  const { data, error } = await supabase
    .from('battles')
    .update({ status: 'active', turn_user: challengerId })
    .eq('id', battleId)
    .select(BATTLE_COLUMNS)
    .single();
  return { data, error };
};

export const declineChallenge = async (battleId) => {
  const { error } = await supabase.from('battles').update({ status: 'declined' }).eq('id', battleId);
  return { error };
};

const fetchMyBattlesByStatus = async (userId, status) => {
  const { data: memberships, error: membershipError } = await supabase
    .from('battle_players')
    .select('battle_id, side')
    .eq('user_id', userId);
  if (membershipError) return { data: [], error: membershipError };

  const battleIds = memberships.map((m) => m.battle_id);
  if (battleIds.length === 0) return { data: [], error: null };

  const { data: battles, error } = await supabase
    .from('battles')
    .select(BATTLE_COLUMNS)
    .in('id', battleIds)
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error };

  const sideByBattleId = {};
  memberships.forEach((m) => { sideByBattleId[m.battle_id] = m.side; });

  return { data: (battles || []).map((b) => ({ ...b, mySide: sideByBattleId[b.id] })), error: null };
};

export const fetchIncomingChallenges = async (userId) => {
  const { data, error } = await fetchMyBattlesByStatus(userId, 'pending');
  if (error) return { data: [], error };
  return { data: data.filter((b) => b.created_by !== userId), error: null };
};

export const fetchMyActiveBattles = (userId) => fetchMyBattlesByStatus(userId, 'active');
export const fetchFinishedBattles = (userId) => fetchMyBattlesByStatus(userId, 'finished');

export const fetchBattlePlayers = async (battleId) => {
  const { data, error } = await supabase
    .from('battle_players')
    .select('battle_id, user_id, side')
    .eq('battle_id', battleId);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchPlayersForBattles = async (battleIds) => {
  if (battleIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('battle_players')
    .select('battle_id, user_id, side')
    .in('battle_id', battleIds);
  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchBattleMoves = async (battleId) => {
  const { data, error } = await supabase
    .from('battle_moves')
    .select(MOVE_COLUMNS)
    .eq('battle_id', battleId)
    .order('created_at', { ascending: true });
  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchBattleById = async (battleId) => {
  const { data, error } = await supabase
    .from('battles')
    .select(BATTLE_COLUMNS)
    .eq('id', battleId)
    .maybeSingle();
  return { data, error };
};

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// "Not yet used in this battle" is scoped to MY OWN prior moves — my questions
// are always drawn from the opponent's deck, theirs from mine, so the pools
// are naturally disjoint and exclusion only needs to consider my own history.
export const buildQuestion = async (opponentId, language, excludePhrases) => {
  const { data: hardCards, error } = await supabase.rpc('get_hard_review_cards_for_battle', {
    target_user_id: opponentId, target_language: language,
  });
  if (error) return { data: null, error };

  const available = (hardCards || []).filter((c) => !excludePhrases.includes(c.phrase));
  if (available.length === 0) return { data: null, error: null };

  const target = available[Math.floor(Math.random() * available.length)];

  const distractorPool = (hardCards || [])
    .filter((c) => c.phrase !== target.phrase)
    .map((c) => c.phrase);

  if (distractorPool.length < 3) {
    const lessonPhrases = getLessons(language)
      .flatMap((lesson) => lesson.steps || [])
      .filter((s) => (s.type === 'word' || s.type === 'teach') && s.phrase !== target.phrase)
      .map((s) => s.phrase);
    const needed = 3 - distractorPool.length;
    const extra = shuffle(lessonPhrases.filter((p) => !distractorPool.includes(p))).slice(0, needed);
    distractorPool.push(...extra);
  }

  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([target.phrase, ...distractors]);

  return { data: { prompt: target.translation, correctPhrase: target.phrase, options }, error: null };
};

export const submitMove = async ({ battleId, userId, question, answer, isCorrect }) => {
  const { count, error: countError } = await supabase
    .from('battle_moves')
    .select('*', { count: 'exact', head: true })
    .eq('battle_id', battleId)
    .eq('user_id', userId);
  if (countError) return { error: countError };

  const roundNumber = (count || 0) + 1;

  const { error: insertError } = await supabase.from('battle_moves').insert({
    battle_id: battleId, round_number: roundNumber, user_id: userId,
    question, answer, is_correct: isCorrect,
  });
  if (insertError) return { error: insertError };

  const { data: players, error: playersError } = await fetchBattlePlayers(battleId);
  if (playersError) return { error: playersError };
  const opponent = players.find((p) => p.user_id !== userId);

  const { error: flipError } = await supabase
    .from('battles')
    .update({ turn_user: opponent?.user_id })
    .eq('id', battleId);
  if (flipError) return { error: flipError };

  const { data: functionData, error: functionError } = await supabase.functions.invoke('judge-battle', {
    body: { battle_id: battleId },
  });
  if (functionError) console.log('Error invoking judge-battle:', functionError);

  return { error: null, result: functionData || null };
};

export const fetchMyPointsTotal = async (userId) => {
  const { data, error } = await supabase
    .from('points_history')
    .select('amount')
    .eq('user_id', userId);
  if (error) return { total: 0, error };
  const total = (data || []).reduce((sum, row) => sum + row.amount, 0);
  return { total, error: null };
};
