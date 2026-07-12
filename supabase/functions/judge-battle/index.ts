import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const { battle_id: battleId } = await req.json();
    if (!battleId) {
      return new Response(JSON.stringify({ error: 'battle_id is required' }), { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
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
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    const { data: membership } = await callerClient
      .from('battle_players')
      .select('user_id')
      .eq('battle_id', battleId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a participant in this battle' }), { status: 403 });
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
      return new Response(JSON.stringify({ error: 'Battle not found' }), { status: 404 });
    }
    if (battle.status === 'finished') {
      return new Response(JSON.stringify({ finished: true, alreadyProcessed: true }), { status: 200 });
    }

    const { data: lastMove } = await adminClient
      .from('battle_moves')
      .select('user_id')
      .eq('battle_id', battleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastMove) {
      return new Response(JSON.stringify({ finished: false }), { status: 200 });
    }

    // Exact 3-in-a-row rule: the last mover's own moves, newest first, must
    // have at least 3 and the most recent 3 must all be correct.
    const { data: recentMoves } = await adminClient
      .from('battle_moves')
      .select('is_correct')
      .eq('battle_id', battleId)
      .eq('user_id', lastMove.user_id)
      .order('round_number', { ascending: false })
      .limit(3);

    const hasStreak = (recentMoves?.length === 3) && recentMoves.every((m) => m.is_correct === true);
    if (!hasStreak) {
      return new Response(JSON.stringify({ finished: false }), { status: 200 });
    }

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
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
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

    return new Response(JSON.stringify({ finished: true, winnerSide }), { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
