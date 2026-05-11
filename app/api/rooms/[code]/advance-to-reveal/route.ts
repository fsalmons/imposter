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
    .select('id, host_id')
    .eq('code', code)
    .single()

  if (error || !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.host_id !== hostId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  await supabase.from('rooms').update({ status: 'reveal' }).eq('id', room.id)

  return NextResponse.json({ ok: true })
}
