import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { code, name } = await request.json()
  const supabase = createAdminClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, status, player_count')
    .eq('code', code)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.status !== 'lobby') {
    return NextResponse.json({ error: 'Game already in progress' }, { status: 400 })
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({ room_id: room.id, name: name.trim(), is_imposter: false, word: '', has_voted: false })
    .select('id')
    .single()

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 })
  }

  await supabase
    .from('rooms')
    .update({ player_count: room.player_count + 1 })
    .eq('id', room.id)

  return NextResponse.json({ playerId: player.id, roomId: room.id })
}
