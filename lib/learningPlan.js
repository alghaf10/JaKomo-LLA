import { supabase } from './supabase';

const PLAN_COLUMNS = 'id, user_id, language, plan_json, generated_at, source_snapshot';

// Client-side regen rate limit, enforced against the server's generated_at
// (cross-device, survives reinstalls) rather than a local timestamp.
export const REGEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export const fetchLearningPlan = async (userId, language) => {
  const { data, error } = await supabase
    .from('learning_plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('language', language)
    .maybeSingle();

  if (error) {
    console.log('Error fetching learning plan:', error);
    return { data: null, error };
  }
  return { data, error: null };
};

// Defensive parse mirrors judgeBattle: functions.invoke can hand back a
// string if a proxy strips Content-Type.
export const generateLearningPlan = async () => {
  const { data, error } = await supabase.functions.invoke('generate-learning-plan', { body: {} });
  if (error) {
    let message = "Couldn't generate your plan right now — try again in a moment";
    if (error.context) {
      try {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      } catch (e) { /* keep default */ }
    }
    return { plan: null, error: message };
  }
  let parsed = data;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
  }
  return { plan: parsed?.plan || null, error: null };
};

// How long until the plan can be regenerated again (ms), 0 if allowed now.
export const regenCooldownRemaining = (plan) => {
  if (!plan?.generated_at) return 0;
  const elapsed = Date.now() - new Date(plan.generated_at).getTime();
  return Math.max(0, REGEN_COOLDOWN_MS - elapsed);
};

// True when the onboarding fields have drifted from what the plan was built
// on: level/goal/goal_date changed, or daily_minutes moved by >= 5 minutes.
export const shouldOfferRegeneration = (plan, profile) => {
  if (!plan?.source_snapshot || !profile) return false;
  const snap = plan.source_snapshot;
  if (snap.level_estimate !== profile.level_estimate) return true;
  if (snap.goal !== profile.goal) return true;
  if ((snap.goal_date || null) !== (profile.goal_date || null)) return true;
  const snapMin = snap.daily_minutes || 0;
  const curMin = profile.daily_minutes || 0;
  return Math.abs(snapMin - curMin) >= 5;
};
