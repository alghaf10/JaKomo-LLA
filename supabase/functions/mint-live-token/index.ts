import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// --- Gemini Live model ----------------------------------------------------
// SINGLE PLACE TO UPDATE THE LIVE MODEL. Google deprecates preview models
// fast, so keep this as one constant. This is the native-audio Live model
// (audio-in / audio-out). Alternative if this is pulled/congested:
// 'gemini-3.1-flash-live-preview'. Unlike the text models in
// generate-learning-plan, Live is a separate model family — do not reuse
// GEMINI_MODEL here.
const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// The client connects with this token to the *Constrained* Live endpoint:
//   wss://generativelanguage.googleapis.com/ws/
//     google.ai.generativelanguage.v1alpha.GenerativeService
//     .BidiGenerateContentConstrained?access_token=<name>
// The constraints below are enforced server-side so a leaked token can only
// open an AUDIO session on this one model — not arbitrary text generation.

// --- Transient-error backoff (COPIED from generate-learning-plan) ---------
// TODO(phase3b): unify this backoff with the reusable Gemini block in
// generate-learning-plan/index.ts — copied verbatim for the spike rather
// than prematurely factoring a shared module across two edge functions.
const TRANSIENT_STATUSES = new Set([429, 503]);
const MINT_MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mint an ephemeral Live auth token from Gemini's provisioning service.
// Returns the token `name` the client passes as ?access_token=. Retries the
// identical request on 503/429 (and network) with 1s/2s backoff + jitter,
// staying well inside the Edge Function's ~60s budget.
async function mintEphemeralToken(): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  // Ephemeral tokens are v1alpha-only. Body fields are top-level on the
  // AuthToken resource (the SDK's `config` wrapper is an SDK-ism, not REST).
  // - uses: 1                    -> single Live session per token
  // - expireTime                 -> token unusable to START a session after this
  // - newSessionExpireTime       -> must OPEN the socket within this short window
  // - bidiGenerateContentSetup   -> locks the session config server-side. NOTE:
  //   the raw REST field is `bidiGenerateContentSetup` (a BidiGenerateContentSetup,
  //   same shape as the client's `setup` message), NOT the SDK-only
  //   `liveConnectConstraints` — that name 400s with "Unknown name" against REST.
  //   Present-and-non-empty here means these fields are LOCKED: a leaked token
  //   can only open an AUDIO session on this one model. `model` takes the
  //   `models/` prefix to match what the client sends in its setup.
  const now = Date.now();
  const url = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      bidiGenerateContentSetup: {
        model: `models/${GEMINI_LIVE_MODEL}`,
        generationConfig: { responseModalities: ['AUDIO'] },
      },
    }),
  };

  let lastError = '';
  for (let attempt = 0; attempt < MINT_MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, requestInit);
    } catch (networkError) {
      lastError = `network error: ${networkError instanceof Error ? networkError.message : networkError}`;
      if (attempt < MINT_MAX_ATTEMPTS - 1) {
        await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
        continue;
      }
      break;
    }

    if (res.ok) {
      const data = await res.json();
      const name = data?.name;
      if (!name) throw new Error('Token response missing name');
      return name;
    }

    const detail = await res.text().catch(() => '');
    // GOTCHA: minting fails with 400 INVALID_ARGUMENT for new-format API keys
    // (AQ.xxx); it requires a legacy key (AIzaSy...). If mint 400s, check the
    // GEMINI_API_KEY format FIRST. Non-transient errors won't be fixed by a
    // resend — surface immediately.
    if (!TRANSIENT_STATUSES.has(res.status)) {
      throw new Error(`Token mint failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    lastError = `status ${res.status}`;
    if (attempt < MINT_MAX_ATTEMPTS - 1) {
      await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }

  throw new Error(`Token provisioning unavailable after ${MINT_MAX_ATTEMPTS} attempts (${lastError})`);
}

Deno.serve(async (req: Request) => {
  try {
    // Authed users only — reject anon. Mirror of generate-learning-plan.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ error: 'Invalid session' }, 401);

    const token = await mintEphemeralToken();
    // Return the token name plus the model, so the client's setup message and
    // the (server-locked) constraint stay in sync from one source.
    return jsonResponse({ token, model: GEMINI_LIVE_MODEL }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.log('mint-live-token error:', message);
    return jsonResponse({ error: "Couldn't start a voice session right now — try again in a moment" }, 502);
  }
});
