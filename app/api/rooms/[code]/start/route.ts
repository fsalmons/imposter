import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WORD_PAIRS } from '@/lib/words.server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const { hostId } = await request.json()
  const supabase = createAdminClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, host_id, round')
    .eq('code', code)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.host_id !== hostId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', room.id)

  if (playersError || !players || players.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 })
  }

  const pair = WORD_PAIRS[room.round]
  const imposterIndex = Math.floor(Math.random() * players.length)
  // Randomly assign which word goes to majority vs imposter
  const flip = Math.random() < 0.5
  const [wordA, wordB] = flip ? [pair[1], pair[0]] : pair

  for (let i = 0; i < players.length; i++) {
    const isImposter = i === imposterIndex
    await supabase
      .from('players')
      .update({ is_imposter: isImposter, word: isImposter ? wordB : wordA, has_voted: false })
      .eq('id', players[i].id)
  }

  await supabase
    .from('rooms')
    .update({ status: 'word_reveal' })
    .eq('id', room.id)

  return NextResponse.json({ ok: true })
}
