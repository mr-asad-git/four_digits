import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Cloud from '../components/Cloud'
import DigitPicker from './DigitPicker'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)

const HostLobby = ({ userName, onGameStart, onExit }) => {
    const socketRef = useRef(null)
    const transitioningRef = useRef(false)  // KEY FIX: prevent cleanup from killing socket mid-transition
    const roomCodeRef = useRef('')          // avoid stale closure on room code
    const [isRevealing, setIsRevealing] = useState(true)
    const [roomCode, setRoomCode] = useState('')
    const [serverIP, setServerIP] = useState('...')
    const [players, setPlayers] = useState([])
    const [error, setError] = useState('')
    const [showDigitPicker, setShowDigitPicker] = useState(false)
    const [imReady, setImReady] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const revealTimer = setTimeout(() => setIsRevealing(false), 2500)

        // Connect via Vite proxy — no port needed, works for all LAN players
        const socket = io({ transports: ['websocket'] })
        socketRef.current = socket

        socket.on('connect', () => {
            socket.emit('create-room', { playerName: userName }, (res) => {
                if (res.success) {
                    setRoomCode(res.roomCode)
                    roomCodeRef.current = res.roomCode
                    setServerIP(res.ip)
                    setPlayers(res.players)
                } else {
                    setError('Failed to create room. Is the server running?')
                }
            })
        })

        socket.on('connect_error', () => {
            setError('Cannot connect to server. Run: npm run server')
        })

        socket.on('player-joined', ({ players }) => setPlayers(players))
        socket.on('lobby-update', ({ players }) => setPlayers(players))

        socket.on('room-closed', ({ reason }) => {
            if (transitioningRef.current) return  // ignore if we're going to game
            setError(reason || 'Room closed.')
            setTimeout(onExit, 2000)
        })

        socket.on('game-started', ({ players }) => {
            transitioningRef.current = true
            // Delay so the GameScreen mounts before we hand off
            setTimeout(() => onGameStart({ players, socket, isHost: true, roomCode: roomCodeRef.current }), 300)
        })

        return () => {
            clearTimeout(revealTimer)
            // KEY FIX: only disconnect if we're NOT transitioning to the game
            if (!transitioningRef.current) {
                socket.disconnect()
            }
        }
    }, [])

    const handleDigitsChosen = (digits) => {
        setImReady(true)
        setShowDigitPicker(false)
        socketRef.current?.emit('player-ready', { digits })
    }

    const handleStartGame = () => {
        const allReady = players.every(p => p.ready)
        if (!allReady || players.length < 2) return
        socketRef.current?.emit('start-game')
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const allReady = players.length >= 2 && players.every(p => p.ready)
    const myPlayer = players.find(p => p.id === socketRef.current?.id)
    const imReadyStatus = myPlayer?.ready ?? imReady

    return (
        <div className='bg-[#4CAF50] h-screen w-screen relative overflow-hidden flex flex-col items-center justify-center gap-6 p-8'>

            {showDigitPicker && (
                <DigitPicker onConfirm={handleDigitsChosen} onCancel={() => setShowDigitPicker(false)} />
            )}

            {/* Reveal Clouds */}
            {isRevealing && (
                <div className="cloud-transition-overlay">
                    {CLOUD_WIDTHS.map((w, i) => (
                        <div key={i} className="transition-cloud animate-rise"
                            style={{
                                left: `${(i % 4) * 28 - 10}%`,
                                bottom: `-${Math.floor(i / 4) * 28 + 10}vh`,
                                animationDelay: `${(i % 4) * 0.08 + Math.floor(i / 4) * 0.18 - 1.2}s`,
                                width: `${w}px`, zIndex: 100 + i
                            }}>
                            <Cloud width="100%" />
                        </div>
                    ))}
                </div>
            )}

            {/* Background Clouds */}
            <div className="absolute top-10 left-10 animate-float opacity-30 pointer-events-none">
                <Cloud width={280} height={140} />
            </div>
            <div className="absolute bottom-16 right-8 animate-float opacity-20 pointer-events-none" style={{ animationDelay: '3s' }}>
                <Cloud width={320} height={160} />
            </div>

            {/* Error Banner */}
            {error && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/90 text-white bungee-font px-6 py-3 rounded-2xl shadow-lg z-50 text-sm">
                    ⚠️ {error}
                </div>
            )}

            <div className={`w-full max-w-2xl flex flex-col gap-5 transition-all duration-700 delay-300 ${isRevealing ? 'opacity-0 translate-y-8' : 'opacity-100 translate-y-0'}`}>

                {/* Header */}
                <div className="text-center">
                    <h1 className="bungee-font text-white text-5xl drop-shadow-lg">HOST LOBBY</h1>
                    <p className="text-white/70 bungee-font text-xs tracking-widest mt-1">SHARE YOUR IP — OTHERS CAN DISCOVER YOUR ROOM</p>
                </div>

                {/* IP + Room Code */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 flex flex-col gap-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 rounded-2xl p-4 border-2 border-green-200">
                            <p className="text-green-600 bungee-font text-xs tracking-widest mb-1">LAN IP ADDRESS</p>
                            <p className="text-green-800 bungee-font text-2xl">{serverIP}</p>
                            <p className="text-green-500 text-xs mt-1">Share this IP so players can find you</p>
                        </div>
                        <div className="flex-1 bg-amber-50 rounded-2xl p-4 border-2 border-amber-200">
                            <p className="text-amber-600 bungee-font text-xs tracking-widest mb-1">ROOM CODE</p>
                            <p className="text-amber-800 bungee-font text-3xl tracking-widest">{roomCode || '------'}</p>
                            <p className="text-amber-400 text-xs mt-1">Auto-discovered on LAN</p>
                        </div>
                    </div>
                    <button
                        onClick={() => copyToClipboard(roomCode)}
                        className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white bungee-font text-lg transition-all active:scale-95 shadow-[0_4px_0_0_#2e7d32] active:shadow-none active:translate-y-1"
                    >
                        {copied ? '✅ COPIED!' : '📋 COPY ROOM CODE'}
                    </button>
                </div>

                {/* Players List */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30">
                    <p className="text-green-700 bungee-font text-xs tracking-widest mb-4">
                        PLAYERS ({players.length}/8) {players.length < 2 && '— Waiting for others...'}
                    </p>
                    <div className="flex flex-col gap-3 max-h-48 overflow-y-auto">
                        {players.map((p, i) => {
                            const isMe = p.id === socketRef.current?.id
                            return (
                                <div key={p.id || i} className="flex items-center justify-between bg-green-50 rounded-2xl px-4 py-3 border-2 border-green-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-white bungee-font text-sm flex-shrink-0">
                                            {p.name?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-green-900 bungee-font text-lg">
                                            {p.name}
                                            {isMe && <span className="text-green-500 text-xs ml-1">(you)</span>}
                                            {i === 0 && <span className="ml-2 text-amber-500 text-xs">👑</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xl transition-all ${p.ready ? '' : 'opacity-25'}`}>
                                            {p.ready ? '✅' : '⏳'}
                                        </span>
                                        {/* Kick button — only for other players */}
                                        {!isMe && (
                                            <button
                                                onClick={() => socketRef.current?.emit('kick-player', { targetId: p.id })}
                                                title={`Kick ${p.name}`}
                                                className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-400 text-red-400 hover:text-white bungee-font text-xs transition-all active:scale-90 flex items-center justify-center"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {players.length === 0 && (
                            <p className="text-green-400 bungee-font text-center py-4">No players yet...</p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    {!imReadyStatus ? (
                        <button
                            onClick={() => setShowDigitPicker(true)}
                            className='flex-1 py-5 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all'
                        >
                            🔢 CHOOSE MY CODE
                        </button>
                    ) : (
                        <button
                            disabled={!allReady}
                            onClick={handleStartGame}
                            className={`flex-1 py-5 rounded-2xl bungee-font text-xl transition-all ${
                                allReady
                                    ? 'bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 cursor-pointer'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {allReady ? '🚀 START GAME!' : `⏳ ${players.filter(p => p.ready).length}/${players.length} READY`}
                        </button>
                    )}
                    <button
                        onClick={onExit}
                        className='px-6 py-5 rounded-2xl bg-white border-4 border-green-200 text-green-600 bungee-font text-xl hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all shadow-[0_6px_0_0_#d1d5db] active:shadow-none active:translate-y-1.5'
                    >
                        ✕ EXIT
                    </button>
                </div>
            </div>
        </div>
    )
}

export default HostLobby
