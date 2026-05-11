import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { roomId, voterId, targetId, round } = await request.json()
  const supabase = createAdminClient()

  const { error: voteError } = await supabase
    .from('votes')
    .insert({ room_id: roomId, voter_id: voterId, target_id: targetId, round })

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 })
  }

  await supabase
    .from('players')
    .update({ has_voted: true })
    .eq('id', voterId)

  return NextResponse.json({ ok: true })
}
