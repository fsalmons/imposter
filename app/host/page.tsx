'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Player = { id: string; name: string; voteCount?: number; is_imposter?: boolean }
type Room = { id: string; code: string; status: string; round: number }

export default function HostPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [hostId, setHostId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [voteTallies, setVoteTallies] = useState<Player[]>([])
  const [showImposters, setShowImposters] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchPlayers = useCallback(async (roomId: string, sb: SupabaseClient) => {
    const { data } = await sb.from('players').select('id, name').eq('room_id', roomId)
    if (data) setPlayers(data)
  }, [])

  const fetchVotes = useCallback(async (code: string, hId: string) => {
    const res = await fetch(`/api/rooms/${code}/votes?reveal=true&hostId=${hId}`)
    const data = await res.json()
    if (data.players) setVoteTallies(data.players)
  }, [])

  const subscribeToRoom = useCallback((roomId: string, code: string, hId: string, sb: SupabaseClient) => {
    sb.channel(`host-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
        fetchPlayers(roomId, sb)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new as Room
        setRoom(updated)
        localStorage.setItem('hostRoom', JSON.stringify(updated))
        setShowImposters(false)
        if (updated.status === 'reveal') fetchVotes(code, hId)
      })
      .subscribe()
  }, [fetchPlayers, fetchVotes])

  useEffect(() => {
    const init = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      setSupabase(sb)

      const stored = localStorage.getItem('hostId')
      const storedRoom = localStorage.getItem('hostRoom')
      if (stored && storedRoom) {
        const r = JSON.parse(storedRoom)
        setHostId(stored)
        setRoom(r)
        setLoading(false)
        subscribeToRoom(r.id, r.code, stored, sb)
        fetchPlayers(r.id, sb)
      } else {
        const res = await fetch('/api/rooms/create', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { setError(data.error); setLoading(false); return }
        const r = { id: data.roomId, code: data.code, status: 'lobby', round: 1 }
        setRoom(r)
        setHostId(data.hostId)
        localStorage.setItem('hostId', data.hostId)
        localStorage.setItem('hostRoom', JSON.stringify(r))
        setLoading(false)
        subscribeToRoom(data.roomId, data.code, data.hostId, sb)
      }
    }
    init()
  }, [subscribeToRoom, fetchPlayers])

  async function startGame() {
    if (!room || !hostId) return
    await fetch(`/api/rooms/${room.code}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId }),
    })
  }

  async function advanceTo(endpoint: string) {
    if (!room || !hostId) return
    await fetch(`/api/rooms/${room.code}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId }),
    })
  }

  async function nextRound() {
    if (!room || !hostId) return
    await fetch(`/api/rooms/${room.code}/next-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId }),
    })
    setVoteTallies([])
    setShowImposters(false)
  }

  function newGame() {
    localStorage.removeItem('hostId')
    localStorage.removeItem('hostRoom')
    window.location.reload()
  }

  function copyCode() {
    if (!room) return
    navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-lg">Setting up room...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <p className="text-red-400 text-center">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 p-6 flex flex-col">
      <div className="max-w-sm mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">HOST VIEW</p>
            <p className="text-emerald-400 text-sm">Round {room?.round ?? 1} / 5</p>
          </div>
          <button onClick={newGame} className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
            New Game
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 text-center">
          <p className="text-gray-400 text-sm mb-2">Room Code</p>
          <button onClick={copyCode} className="group">
            <span className="text-5xl font-black font-mono text-white tracking-widest group-hover:text-emerald-400 transition-colors">
              {room?.code}
            </span>
          </button>
          <p className="text-gray-500 text-xs mt-2">{copied ? 'Copied!' : 'Tap to copy'}</p>
        </div>

        {room?.status === 'lobby' && (
          <>
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-gray-400 text-sm mb-3">Players ({players.length})</p>
              {players.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">Waiting for players to join...</p>
              ) : (
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-white font-medium">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={startGame}
              disabled={players.length < 2}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
            >
              Start Game
            </button>
            {players.length < 2 && <p className="text-gray-500 text-sm text-center">Need at least 2 players</p>}
          </>
        )}

        {room?.status === 'word_reveal' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-6 text-center">
              <p className="text-emerald-400 text-lg font-bold">Players are reading their words</p>
              <p className="text-gray-400 text-sm mt-2">When everyone&apos;s ready, start voting</p>
            </div>
            <button
              onClick={() => advanceTo('advance-to-voting')}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Start Voting
            </button>
          </div>
        )}

        {room?.status === 'voting' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-6 text-center">
              <p className="text-emerald-400 text-lg font-bold">Voting in progress...</p>
              <p className="text-gray-400 text-sm mt-2">Players are casting their votes</p>
            </div>
            <button
              onClick={() => advanceTo('advance-to-reveal')}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-xl transition-colors"
            >
              End Voting
            </button>
          </div>
        )}

        {room?.status === 'reveal' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-4">
              <p className="text-gray-400 text-sm mb-3">Vote Results</p>
              {voteTallies
                .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{p.name}</span>
                      {showImposters && p.is_imposter && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">IMPOSTER</span>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold">{p.voteCount ?? 0} votes</span>
                  </div>
                ))}
            </div>
            {!showImposters ? (
              <button
                onClick={() => setShowImposters(true)}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-colors"
              >
                Reveal Imposters
              </button>
            ) : (
              room.round < 5 ? (
                <button
                  onClick={nextRound}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-xl transition-colors"
                >
                  Next Round
                </button>
              ) : (
                <button
                  onClick={newGame}
                  className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-xl transition-colors"
                >
                  End Game
                </button>
              )
            )}
          </div>
        )}

        {room?.status === 'finished' && (
          <div className="text-center space-y-4">
            <p className="text-4xl">🏆</p>
            <p className="text-white text-2xl font-black">Game Over!</p>
            <button
              onClick={newGame}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
