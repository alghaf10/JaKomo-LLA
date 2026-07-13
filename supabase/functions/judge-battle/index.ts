import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_MOVES_PER_PLAYER = 7;

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  try {
    const { battle_id: battleId } = await req.json();
    if (!battleId) {
      return jsonResponse({ error: 'battle_id is required' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // Caller-scoped client: respects RLS, used only to confirm the caller is
    // actually a participant in this battle before doing anything privileged.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Invalid session' }, 401);
    }

    const { data: membership } = await callerClient
      .from('battle_players')
      .select('user_id')
      .eq('battle_id', battleId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) {
      return jsonResponse({ error: 'Not a participant in this battle' }, 403);
    }

    // Service-role client: bypasses RLS for the privileged reads/writes below.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: battle, error: battleError } = await adminClient
      .from('battles')
      .select('id, status')
      .eq('id', battleId)
      .single();
    if (battleError || !battle) {
      return jsonResponse({ error: 'Battle not found' }, 404);
    }
    if (battle.status === 'finished') {
      return jsonResponse({ finished: true, alreadyProcessed: true }, 200);
    }

    const { data: lastMove } = await adminClient
      .from('battle_moves')
      .select('user_id')
      .eq('battle_id', battleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastMove) {
      return jsonResponse({ finished: false }, 200);
    }

    // 3-in-a-row is checked BEFORE the move limit: it wins instantly, even
    // on the final move. The last mover's own moves, newest first, must have
    // at least 3 and the most recent 3 must all be correct.
    const { data: recentMoves } = await adminClient
      .from('battle_moves')
      .select('is_correct')
      .eq('battle_id', battleId)
      .eq('user_id', lastMove.user_id)
      .order('round_number', { ascending: false })
      .limit(3);

    const hasStreak = (recentMoves?.length === 3) && recentMoves.every((m) => m.is_correct === true);

    if (hasStreak) {
      const { data: winnerPlayer } = await adminClient
        .from('battle_players')
        .select('side')
        .eq('battle_id', battleId)
        .eq('user_id', lastMove.user_id)
        .single();
      const winnerSide = winnerPlayer!.side;

      const { error: updateError } = await adminClient
        .from('battles')
        .update({ status: 'finished', winner_side: winnerSide })
        .eq('id', battleId)
        .neq('status', 'finished');
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      const { data: winningPlayers } = await adminClient
        .from('battle_players')
        .select('user_id')
        .eq('battle_id', battleId)
        .eq('side', winnerSide);

      const pointsRows = (winningPlayers || []).map((p: { user_id: string }) => ({
        user_id: p.user_id,
        amount: 50,
        reason: 'battle_win',
      }));
      if (pointsRows.length > 0) {
        await adminClient.from('points_history').insert(pointsRows);
      }

      return jsonResponse({ finished: true, winnerSide, tie: false }, 200);
    }

    // No streak: tie when both players have exhausted their questions.
    // winner_side stays NULL and no points are awarded.
    const { data: allMoves } = await adminClient
      .from('battle_moves')
      .select('user_id')
      .eq('battle_id', battleId);

    const movesByUser: Record<string, number> = {};
    (allMoves || []).forEach((m: { user_id: string }) => {
      movesByUser[m.user_id] = (movesByUser[m.user_id] || 0) + 1;
    });

    const { data: players } = await adminClient
      .from('battle_players')
      .select('user_id')
      .eq('battle_id', battleId);

    const everyoneExhausted = (players?.length ?? 0) >= 2
      && players!.every((p: { user_id: string }) => (movesByUser[p.user_id] || 0) >= MAX_MOVES_PER_PLAYER);

    if (everyoneExhausted) {
      const { error: tieError } = await adminClient
        .from('battles')
        .update({ status: 'finished' })
        .eq('id', battleId)
        .neq('status', 'finished');
      if (tieError) {
        return jsonResponse({ error: tieError.message }, 500);
      }
      return jsonResponse({ finished: true, winnerSide: null, tie: true }, 200);
    }

    return jsonResponse({ finished: false }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
