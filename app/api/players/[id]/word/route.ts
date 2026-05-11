import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('players')
    .select('word')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  return NextResponse.json({ word: data.word })
}
