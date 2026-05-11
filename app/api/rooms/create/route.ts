import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST() {
  const supabase = createAdminClient()
  const hostId = randomUUID()
  const code = generateCode()

  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, host_id: hostId, status: 'lobby', round: 1, player_count: 0 })
    .select('id, code')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ code: data.code, roomId: data.id, hostId })
}
