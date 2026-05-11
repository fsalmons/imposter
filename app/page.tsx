'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    router.push(`/room/${code.toUpperCase().trim()}?name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-4xl font-black text-white tracking-tight">IMPOSTER</h1>
          <p className="text-emerald-400 font-medium mt-1">Football Edition</p>
        </div>

        {!joining ? (
          <div className="space-y-3">
            <button
              onClick={() => router.push('/host')}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Host a Game
            </button>
            <button
              onClick={() => setJoining(true)}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Join a Game
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Room Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full py-4 px-4 bg-gray-800 text-white text-center text-2xl font-mono font-bold rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase tracking-widest"
              autoFocus
            />
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full py-4 px-4 bg-gray-800 text-white text-center text-lg font-bold rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {error && <p className="text-red-400 text-center text-sm">{error}</p>}
            <button
              type="submit"
              disabled={!code.trim() || !name.trim()}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors"
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => { setJoining(false); setError('') }}
              className="w-full py-3 text-gray-400 hover:text-white font-medium transition-colors"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
