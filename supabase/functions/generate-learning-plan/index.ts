import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// --- Mirrored app data (keep in sync) ------------------------------------
// Minimal mirror of content/es-MX/*.js — id/title/type only. Gemini picks
// lesson_ids from here and the result is filtered against it, so a stale
// mirror can only ever DROP recommendations, never surface a broken link.
// When lessons are added in content/, add them here too.
const LESSON_REGISTRY: Record<string, { id: string; title: string; type: string }[]> = {
  'es-MX': [
    { id: 'es-MX/food-1', title: 'Ordering Food', type: 'scenario' },
    { id: 'es-MX/transport-1', title: 'Getting Around', type: 'scenario' },
    { id: 'es-MX/market-1', title: 'At the Market', type: 'scenario' },
    { id: 'es-MX/numbers-1', title: 'Numbers & Prices', type: 'numbers' },
    { id: 'es-MX/letters-1', title: 'Sounds of Spanish', type: 'letters' },
  ],
};

// Mirror of lib/onboarding.js (keep in sync) — baseline weeks by level and
// the daily-minutes multiplier, used to seed Gemini's pacing.
const BASE_WEEKS: Record<string, number> = {
  beginner: 16,
  some_words: 10,
  simple_conversations: 6,
};
const MINUTES_MULTIPLIER: Record<number, number> = { 5: 1.5, 10: 1.0, 20: 0.7 };

const estimateWeeks = (level: string, minutes: number): number => {
  const base = BASE_WEEKS[level] ?? 12;
  const mult = MINUTES_MULTIPLIER[minutes] ?? 1.0;
  return Math.round(base * mult);
};

// --- Reusable Gemini block (Phase 3 voice tutor will lift this) ----------
// Self-contained: reads the secret, calls Gemini in JSON mode with a response
// schema, and returns parsed JSON. No app/Supabase coupling.
//
// Google deprecates Flash models fast (2.5-flash was pulled from new accounts
// with little notice), and newly-GA models get congested / free-tier
// deprioritized (3.5-flash returns persistent 503s). THESE CONSTANTS ARE THE
// SINGLE PLACE TO UPDATE THE MODELS — when the primary 404s with "no longer
// available" or is chronically busy, bump it here. callGemini falls back to
// GEMINI_FALLBACK_MODEL when the primary is exhausted by 503/429. Phase 3's
// voice tutor should read from its own equivalent single-source constants.
// Note: no thinkingConfig is set here; if one is added, Gemini 3.x uses
// `thinkingLevel` (e.g. "HIGH"), not the 2.5-era `thinkingBudget`.
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    estimated_weeks: { type: 'number' },
    weekly_minutes_target: { type: 'number' },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          week: { type: 'number' },
          title: { type: 'string' },
          focus: { type: 'string' },
          recommended_lessons: { type: 'array', items: { type: 'string' } },
        },
        required: ['week', 'title', 'focus', 'recommended_lessons'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['summary', 'estimated_weeks', 'weekly_minutes_target', 'milestones'],
};

// Transient statuses worth resending the IDENTICAL request for — Gemini was
// busy/throttled, not "the response was malformed" (that's the caller's
// separate schema-validation retry). 503 = UNAVAILABLE/high demand, 429 =
// rate limit; both are common on newly-GA models.
const TRANSIENT_STATUSES = new Set([429, 503]);
// Primary gets 3 attempts (~1s/2s backoff); the fallback is already the
// reliable model, so it gets a shorter 2 attempts (~1s). Even both exhausted
// stays well inside the Edge Function's ~60s budget.
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_FALLBACK_MAX_ATTEMPTS = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Thrown only when transient retries are exhausted, so the handler can show a
// demand-specific "try again shortly" message distinct from a hard failure.
class GeminiBusyError extends Error {}

// One model, with 503/429 (and network) backoff. Throws GeminiBusyError when
// its own attempts are exhausted transiently; throws a plain Error on a
// non-transient failure (which won't be helped by a fallback).
async function callGeminiModel(
  model: string,
  maxAttempts: number,
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PLAN_RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    }),
  };

  let lastTransient = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, requestInit);
    } catch (networkError) {
      // A thrown fetch (connection reset/timeout) is the same "resend it"
      // class as a 503 — retry with backoff.
      lastTransient = `network error: ${networkError instanceof Error ? networkError.message : networkError}`;
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
        continue;
      }
      break;
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no content');
      console.log(`[generate-learning-plan] generated with ${model}`);
      return JSON.parse(text); // JSON mode guarantees parseable text
    }

    const detail = await res.text().catch(() => '');
    // Non-transient (400/401/500/…) won't be fixed by resending — fail fast.
    if (!TRANSIENT_STATUSES.has(res.status)) {
      throw new Error(`Gemini request failed (${model}, ${res.status}): ${detail.slice(0, 300)}`);
    }
    // Transient: back off and retry the identical request, unless exhausted.
    lastTransient = `status ${res.status}`;
    if (attempt < maxAttempts - 1) {
      await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }

  throw new GeminiBusyError(`${model} unavailable after ${maxAttempts} attempts (${lastTransient})`);
}

// Public entry: try the primary model; if it's exhausted by transient
// busy/throttle (GeminiBusyError), run the same request once against the
// fallback model. Only if BOTH are busy does GeminiBusyError propagate. A
// non-transient error from the primary is not "busy" and is surfaced as-is.
async function callGemini(systemPrompt: string, userPrompt: string): Promise<unknown> {
  try {
    return await callGeminiModel(GEMINI_MODEL, GEMINI_MAX_ATTEMPTS, systemPrompt, userPrompt);
  } catch (primaryError) {
    if (!(primaryError instanceof GeminiBusyError)) throw primaryError;
    console.log(`[generate-learning-plan] primary ${GEMINI_MODEL} busy, falling back to ${GEMINI_FALLBACK_MODEL}`);
    return await callGeminiModel(
      GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MAX_ATTEMPTS, systemPrompt, userPrompt,
    );
  }
}
// --- end reusable Gemini block -------------------------------------------

const isValidPlan = (plan: any): boolean => {
  if (!plan || typeof plan !== 'object') return false;
  if (typeof plan.summary !== 'string' || !plan.summary.trim()) return false;
  if (typeof plan.estimated_weeks !== 'number') return false;
  if (typeof plan.weekly_minutes_target !== 'number') return false;
  if (!Array.isArray(plan.milestones) || plan.milestones.length === 0) return false;
  return plan.milestones.every((m: any) =>
    m && typeof m.week === 'number'
    && typeof m.title === 'string' && m.title.trim()
    && typeof m.focus === 'string' && m.focus.trim()
    && Array.isArray(m.recommended_lessons));
};

const buildSystemPrompt = (validIds: string[]) => `You are the learning coach for JaKomo, a culture-first Mexican Spanish app. \
JaKomo teaches practical, warm, locally-authentic Spanish for real situations in Mexico — not textbook Spanish. \
Your job is to produce a personalized, encouraging learning plan as strict JSON matching the provided schema.

Rules:
- Recommend lessons ONLY by choosing lesson_ids from this exact list — never invent an id:
${validIds.map((id) => `  - ${id}`).join('\n')}
- The library is intentionally small right now (only these lessons). Do NOT invent new lessons to fill later weeks. \
Instead, deliberately REUSE these lessons in later-week milestones as spaced review and reinforcement — frame that reuse \
as intentional spaced practice that deepens mastery, never as filler.
- Respect the learner's level, goal, and daily time budget. Keep milestones realistic for the weekly minutes available.
- For a trip goal with a date, work backward from that date so the most travel-useful lessons come first.
- Keep summary to one warm, motivating sentence. Keep focus fields concrete and skimmable.
- Output must be valid JSON only, matching the schema exactly.`;

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    // User-scoped client: RLS covers the profile read and the plan upsert
    // (both the caller's own rows), so no service-role client is needed.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ error: 'Invalid session' }, 401);
    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, level_estimate, goal, goal_date, daily_minutes, active_language')
      .eq('user_id', userId)
      .maybeSingle();
    if (profileError || !profile) return jsonResponse({ error: 'Profile not found' }, 404);
    if (!profile.level_estimate || !profile.daily_minutes) {
      return jsonResponse({ error: 'Onboarding not complete' }, 400);
    }

    const language = profile.active_language || 'es-MX';
    const lessons = LESSON_REGISTRY[language] || LESSON_REGISTRY['es-MX'];
    const validIds = lessons.map((l) => l.id);
    const baselineWeeks = estimateWeeks(profile.level_estimate, profile.daily_minutes);

    const systemPrompt = buildSystemPrompt(validIds);
    const userPrompt = JSON.stringify({
      first_name: profile.first_name || 'there',
      level_estimate: profile.level_estimate,
      goal: profile.goal,
      goal_date: profile.goal_date,
      daily_minutes: profile.daily_minutes,
      baseline_estimated_weeks: baselineWeeks,
      available_lessons: lessons,
      today: new Date().toISOString().slice(0, 10),
    });

    // Generate, validate, and retry once with a stricter reminder. This
    // schema-validation retry is distinct from the transport-level 503/429
    // backoff inside callGemini — here we resend because the response was
    // MALFORMED, not because Gemini was busy.
    let plan: any = null;
    try {
      plan = await callGemini(systemPrompt, userPrompt);
      if (!isValidPlan(plan)) {
        plan = await callGemini(
          `${systemPrompt}\n\nYour previous response did not match the schema. Return ONLY valid JSON matching every required field.`,
          userPrompt,
        );
        if (!isValidPlan(plan)) {
          return jsonResponse({ error: "Couldn't generate your plan right now — try again in a moment" }, 502);
        }
      }
    } catch (genError) {
      console.log('Gemini generation error:', genError);
      // Transient demand/throttle exhausted after backoff — tell the user it's
      // temporary, distinct from the generic failure message.
      if (genError instanceof GeminiBusyError) {
        return jsonResponse(
          { error: "Our AI is in high demand right now — please try again in a few moments." },
          503,
        );
      }
      return jsonResponse({ error: "Couldn't generate your plan right now — try again in a moment" }, 502);
    }

    // Drop any lesson_ids Gemini invented despite instructions.
    const idSet = new Set(validIds);
    plan.milestones = plan.milestones.map((m: any) => ({
      ...m,
      recommended_lessons: (m.recommended_lessons || []).filter((id: string) => idSet.has(id)),
    }));

    const sourceSnapshot = {
      level_estimate: profile.level_estimate,
      goal: profile.goal,
      goal_date: profile.goal_date,
      daily_minutes: profile.daily_minutes,
    };

    // Upsert only after full validation — never a partial insert.
    const { data: saved, error: upsertError } = await supabase
      .from('learning_plans')
      .upsert(
        {
          user_id: userId,
          language,
          plan_json: plan,
          source_snapshot: sourceSnapshot,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,language' },
      )
      .select('id, language, plan_json, generated_at, source_snapshot')
      .single();

    if (upsertError) {
      console.log('Plan upsert error:', upsertError);
      return jsonResponse({ error: "Couldn't save your plan — try again in a moment" }, 500);
    }

    return jsonResponse({ plan: saved }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.log('generate-learning-plan error:', message);
    return jsonResponse({ error: "Couldn't generate your plan right now — try again in a moment" }, 500);
  }
});
