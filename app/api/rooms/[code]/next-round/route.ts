import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const newStatus = nextRound > 5 ? 'finished' : 'word_reveal'

  await supabase
    .from('rooms')
    .update({ round: nextRound > 5 ? 5 : nextRound, status: newStatus })
    .eq('id', room.id)

  await supabase
    .from('players')
    .update({ has_voted: false, word: '', is_imposter: false })
    .eq('room_id', room.id)

  return NextResponse.json({ round: nextRound, status: newStatus })
}
