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

  const { data: room, error } = await supabase
    .from('rooms')
    .select('id, host_id, round')
    .eq('code', code)
    .single()

  if (error || !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.host_id !== hostId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const nextRound = room.round + 1

  if (nextRound > 5) {
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    return NextResponse.json({ round: 5, status: 'finished' })
  }

  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', room.id)

  if (!players || players.length < 2) {
    return NextResponse.json({ error: 'Not enough players' }, { status: 400 })
  }

  // Reset all players first
  await supabase
    .from('players')
    .update({ has_voted: false, word: '', is_imposter: false })
    .eq('room_id', room.id)

  // Assign new words for the next round
  const pair = WORD_PAIRS[nextRound]
  const imposterIndex = Math.floor(Math.random() * players.length)
  const flip = Math.random() < 0.5
  const [wordA, wordB] = flip ? [pair[1], pair[0]] : pair

  for (let i = 0; i < players.length; i++) {
    const isImposter = i === imposterIndex
    await supabase
      .from('players')
      .update({ is_imposter: isImposter, word: isImposter ? wordB : wordA })
      .eq('id', players[i].id)
  }

  // Update round and status after words are assigned
  await supabase
    .from('rooms')
    .update({ round: nextRound, status: 'word_reveal' })
    .eq('id', room.id)

  return NextResponse.json({ round: nextRound, status: 'word_reveal' })
}
