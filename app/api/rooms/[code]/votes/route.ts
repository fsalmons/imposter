import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const { searchParams } = new URL(request.url)
  const reveal = searchParams.get('reveal') === 'true'
  const hostId = searchParams.get('hostId')

  const supabase = createAdminClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, host_id, round')
    .eq('code', code)
    .single()

  if (roomError || !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const { data: players } = await supabase
    .from('players')
    .select('id, name, is_imposter')
    .eq('room_id', room.id)

  const { data: votes } = await supabase
    .from('votes')
    .select('target_id')
    .eq('room_id', room.id)
    .eq('round', room.round)

  const tallies: Record<string, number> = {}
  for (const p of players ?? []) tallies[p.id] = 0
  for (const v of votes ?? []) {
    if (v.target_id in tallies) tallies[v.target_id]++
  }

  const isHost = reveal && hostId === room.host_id

  const result = (players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    voteCount: tallies[p.id] ?? 0,
    ...(isHost ? { is_imposter: p.is_imposter } : {}),
  }))

  return NextResponse.json({ players: result })
}
