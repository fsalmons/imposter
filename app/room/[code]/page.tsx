'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

type RoomStatus = 'lobby' | 'word_reveal' | 'voting' | 'reveal' | 'finished'
type Player = { id: string; name: string; has_voted: boolean }

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()

  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('lobby')
  const [roomRound, setRoomRound] = useState(1)
  const [word, setWord] = useState('')
  const [wordHidden, setWordHidden] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [voteTallies, setVoteTallies] = useState<{ id: string; name: string; voteCount: number }[]>([])
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [initialized, setInitialized] = useState(false)

  const fetchWord = useCallback(async (pid: string) => {
    const res = await fetch(`/api/players/${pid}/word`)
    const data = await res.json()
    if (data.word) setWord(data.word)
  }, [])

  const fetchPlayers = useCallback(async (rId: string, sb: SupabaseClient) => {
    const { data } = await sb.from('players').select('id, name, has_voted').eq('room_id', rId)
    if (data) setPlayers(data)
  }, [])

  const fetchVoteTallies = useCallback(async (roomCode: string) => {
    const res = await fetch(`/api/rooms/${roomCode}/votes`)
    const data = await res.json()
    if (data.players) setVoteTallies(data.players)
  }, [])

  const subscribeToRoom = useCallback((roomCode: string, pid: string, rId: string, sb: SupabaseClient) => {
    sb.channel(`player-room-${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${rId}` }, (payload) => {
        const updated = payload.new as { status: RoomStatus; round: number }
        setRoomStatus(updated.status)
        setRoomRound(updated.round)
        setHasVoted(false)
        setSelectedVote(null)
        setWord('')
        setWordHidden(false)
        if (updated.status === 'word_reveal') fetchWord(pid)
        if (updated.status === 'voting') fetchPlayers(rId, sb)
        if (updated.status === 'reveal') fetchVoteTallies(roomCode)
      })
      .subscribe()
  }, [fetchWord, fetchPlayers, fetchVoteTallies])

  const fetchRoomState = useCallback(async (roomCode: string, pid: string, rId: string, sb: SupabaseClient) => {
    const { data: room } = await sb
      .from('rooms')
      .select('id, status, round')
      .eq('code', roomCode)
      .single()
    if (room) {
      setRoomStatus(room.status as RoomStatus)
      setRoomRound(room.round)
      if (room.status === 'word_reveal') fetchWord(pid)
      if (room.status === 'voting') fetchPlayers(rId, sb)
      if (room.status === 'reveal') fetchVoteTallies(roomCode)
    }
  }, [fetchWord, fetchPlayers, fetchVoteTallies])

  useEffect(() => {
    const initName = searchParams.get('name') ?? ''
    setNameInput(initName)

    const init = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      setSupabase(sb)

      const storedId = localStorage.getItem(`player-${code}`)
      const storedName = localStorage.getItem(`player-${code}-name`)
      const storedRoomId = localStorage.getItem(`room-${code}`)

      if (storedId && storedName && storedRoomId) {
        setPlayerId(storedId)
        setPlayerName(storedName)
        setRoomId(storedRoomId)
        subscribeToRoom(code, storedId, storedRoomId, sb)
        fetchRoomState(code, storedId, storedRoomId, sb)
      } else if (initName) {
        await doJoin(initName, sb)
      }
      setInitialized(true)
    }
    init()
  }, [])

  async function doJoin(name: string, sb: SupabaseClient) {
    setJoining(true)
    setError('')
    const res = await fetch('/api/players/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), name: name.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setJoining(false); return }

    setPlayerId(data.playerId)
    setPlayerName(name.trim())
    setRoomId(data.roomId)
    localStorage.setItem(`player-${code}`, data.playerId)
    localStorage.setItem(`player-${code}-name`, name.trim())
    localStorage.setItem(`room-${code}`, data.roomId)
    setJoining(false)
    subscribeToRoom(code, data.playerId, data.roomId, sb)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !nameInput.trim()) return
    await doJoin(nameInput, supabase)
  }

  async function submitVote() {
    if (!playerId || !roomId || !selectedVote) return
    const res = await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, voterId: playerId, targetId: selectedVote, round: roomRound }),
    })
    if (res.ok) setHasVoted(true)
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-2">⚽</div>
            <h1 className="text-3xl font-black text-white">IMPOSTER</h1>
            <p className="text-gray-400 font-mono text-lg mt-1">
              Room <span className="text-emerald-400">{code}</span>
            </p>
          </div>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full py-4 px-4 bg-gray-800 text-white text-center text-lg font-bold rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={!nameInput.trim() || joining}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-bold text-lg rounded-xl transition-colors"
            >
              {joining ? 'Joining...' : 'Join Game'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (roomStatus === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="text-5xl animate-pulse">⚽</div>
          <p className="text-white text-2xl font-black">Hey, {playerName}!</p>
          <p className="text-gray-400 text-lg">Waiting for the host to start...</p>
          <div className="flex gap-1 justify-center mt-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (roomStatus === 'word_reveal') {
    return (
      <div
        className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 cursor-pointer select-none"
        onClick={() => setWordHidden(!wordHidden)}
      >
        {wordHidden ? (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto">
              <span className="text-3xl">🫣</span>
            </div>
            <p className="text-gray-400 text-lg">Tap to reveal your word</p>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <p className="text-gray-400 text-sm uppercase tracking-widest font-medium">Your player is</p>
            <p className="text-white font-black leading-none" style={{ fontSize: 'clamp(2.5rem, 12vw, 5rem)' }}>
              {word || '...'}
            </p>
            <p className="text-gray-500 text-sm">Tap to hide</p>
          </div>
        )}
      </div>
    )
  }

  if (roomStatus === 'voting') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col p-6">
        <div className="max-w-sm mx-auto w-full space-y-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Round {roomRound}</p>
            <h2 className="text-white text-2xl font-black">Who&apos;s the Imposter?</h2>
          </div>

          {hasVoted ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="text-4xl">✅</div>
              <p className="text-white font-bold text-lg">Vote cast!</p>
              <p className="text-gray-400 text-sm">Waiting for others...</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {players
                  .filter(p => p.id !== playerId)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedVote(selectedVote === p.id ? null : p.id)}
                      className={`w-full py-4 px-5 rounded-xl font-bold text-lg transition-colors text-left ${
                        selectedVote === p.id
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-800 text-white hover:bg-gray-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
              <button
                onClick={submitVote}
                disabled={!selectedVote}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
              >
                Submit Vote
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (roomStatus === 'reveal') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col p-6">
        <div className="max-w-sm mx-auto w-full space-y-6">
          <div className="text-center">
            <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Results</p>
            <h2 className="text-white text-2xl font-black">Round {roomRound} Votes</h2>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
            {voteTallies
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-emerald-400 font-bold">{p.voteCount} votes</span>
                </div>
              ))}
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-sm">Waiting for host to reveal...</p>
          </div>
        </div>
      </div>
    )
  }

  if (roomStatus === 'finished') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="text-6xl">🏆</div>
          <p className="text-white text-3xl font-black">Game Over!</p>
          <p className="text-gray-400">Thanks for playing, {playerName}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return null
}
