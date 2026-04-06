import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Cloud from '../components/Cloud'
import DigitPicker from './DigitPicker'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)

const JoinLobby = ({ userName, onGameStart, onExit }) => {
    const socketRef = useRef(null)
    const transitioningRef = useRef(false)
    const roomCodeRef = useRef('')

    const [isRevealing, setIsRevealing] = useState(true)
    const [phase, setPhase] = useState('discover') // 'discover' | 'lobby'
    const [roomCode, setRoomCode] = useState('')
    const [availableRooms, setAvailableRooms] = useState([])
    const [players, setPlayers] = useState([])
    const [error, setError] = useState('')
    const [showDigitPicker, setShowDigitPicker] = useState(false)
    const [imReady, setImReady] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [loadingRooms, setLoadingRooms] = useState(true)

    // Keep ref in sync
    useEffect(() => { roomCodeRef.current = roomCode }, [roomCode])

    useEffect(() => {
        const revealTimer = setTimeout(() => setIsRevealing(false), 2500)

        // Connect via Vite proxy — auto-works for all LAN players
        // Allow polling+websocket negotiation — polling first prevents the
        // 'WebSocket closed before connection established' warning from the Vite proxy
        const socket = io({ timeout: 6000, extraHeaders: { 'ngrok-skip-browser-warning': 'true' } })
        socketRef.current = socket

        socket.on('connect', () => {
            setError('')
            fetchRooms(socket)
        })

        socket.on('connect_error', () => {
            setLoadingRooms(false)
            setError('Cannot reach game server. Make sure "npm run server" is running on the host machine.')
        })

        return () => {
            clearTimeout(revealTimer)
            if (!transitioningRef.current) socket.disconnect()
        }
    }, [])

    const fetchRooms = (socket) => {
        setLoadingRooms(true)
        socket.emit('get-rooms', (res) => {
            setLoadingRooms(false)
            setAvailableRooms(res.rooms || [])
        })
    }

    const handleRefresh = () => {
        if (socketRef.current?.connected) fetchRooms(socketRef.current)
    }

    const handleJoinRoom = (code) => {
        const finalCode = (code || roomCode).trim().toUpperCase()
        if (!finalCode) { setError('Enter a room code first.'); return }

        const socket = socketRef.current
        if (!socket?.connected) { setError('Not connected to server. Refresh the page.'); return }

        setConnecting(true)
        setError('')

        socket.emit('join-room', { roomCode: finalCode, playerName: userName }, (res) => {
            setConnecting(false)
            if (res.success) {
                // If the game is already running, jump straight to GameScreen
                if (res.spectator || res.rejoined) {
                    transitioningRef.current = true
                    setTimeout(() => onGameStart({
                        players: res.players,
                        socket,
                        isHost: res.isHost || false,
                        roomCode: finalCode,
                        spectator: res.spectator || false,
                        rejoined: res.rejoined || false,
                    }), 300)
                    return
                }

                setRoomCode(finalCode)
                roomCodeRef.current = finalCode
                setPlayers(res.players)
                setPhase('lobby')

                // Attach lobby listeners once inside the room
                socket.off('player-joined')
                socket.off('lobby-update')
                socket.off('room-closed')
                socket.off('game-started')
                socket.off('kicked')

                socket.on('player-joined', ({ players }) => setPlayers(players))
                socket.on('lobby-update', ({ players }) => setPlayers(players))

                socket.on('room-closed', ({ reason }) => {
                    if (transitioningRef.current) return
                    setError(reason || 'Room was closed.')
                    setPhase('discover')
                    setPlayers([])
                    fetchRooms(socket)
                })

                socket.on('kicked', ({ reason }) => {
                    if (transitioningRef.current) return
                    setError(reason || 'You were kicked from the room.')
                    setPhase('discover')
                    setPlayers([])
                    setImReady(false)
                    fetchRooms(socket)
                })

                socket.on('game-started', ({ players }) => {
                    transitioningRef.current = true
                    setTimeout(() => onGameStart({
                        players,
                        socket,
                        isHost: false,
                        roomCode: roomCodeRef.current,
                        spectator: false,
                        rejoined: false,
                    }), 300)
                })
            } else {
                setError(res.error || 'Failed to join room.')
            }
        })

    }

    const handleDigitsChosen = (digits) => {
        setImReady(true)
        setShowDigitPicker(false)
        socketRef.current?.emit('player-ready', { digits })
    }

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

            {/* BG Clouds */}
            <div className="absolute top-10 right-10 animate-float opacity-30 pointer-events-none">
                <Cloud width={280} height={140} />
            </div>
            <div className="absolute bottom-16 left-8 animate-float opacity-20 pointer-events-none" style={{ animationDelay: '2.5s' }}>
                <Cloud width={320} height={160} />
            </div>

            {/* Error Banner */}
            {error && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/90 text-white bungee-font px-6 py-3 rounded-2xl shadow-lg z-50 text-sm max-w-sm text-center">
                    ⚠️ {error}
                    <button onClick={() => setError('')} className="ml-3 opacity-70 hover:opacity-100">✕</button>
                </div>
            )}

            <div className={`w-full max-w-xl flex flex-col gap-5 transition-all duration-700 delay-300 ${isRevealing ? 'opacity-0 translate-y-8' : 'opacity-100 translate-y-0'}`}>

                {/* Header */}
                <div className="text-center">
                    <h1 className="bungee-font text-white text-5xl cursor-pointer drop-shadow-lg">JOIN GAME</h1>
                    <p className="text-white/70 bungee-font text-xs tracking-widest mt-1">
                        {phase === 'discover' ? 'SELECT A ROOM OR ENTER CODE' : `ROOM ${roomCode} — WAITING FOR HOST`}
                    </p>
                </div>

                {phase === 'discover' ? (
                    /* ══ DISCOVER PHASE ══ */
                    <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 flex flex-col gap-5">

                        {/* Room List */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-green-700 bungee-font text-xs tracking-widest">AVAILABLE ROOMS</p>
                                <button
                                    onClick={handleRefresh}
                                    disabled={loadingRooms}
                                    className="text-green-500 bungee-font text-xs hover:text-green-700 transition-all disabled:opacity-40"
                                >
                                    {loadingRooms ? '⏳ LOADING...' : '🔄 REFRESH'}
                                </button>
                            </div>

                            {loadingRooms ? (
                                <div className="text-center py-8 text-green-400 bungee-font text-sm">
                                    Searching for rooms...
                                </div>
                            ) : availableRooms.length === 0 ? (
                                <div className="text-center py-8 text-green-400 bungee-font text-sm">
                                    No open rooms found.<br />
                                    <span className="text-xs opacity-70">Ask the host to create one, then click Refresh.</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                    {availableRooms.map(room => (
                                        <button
                                            key={room.code}
                                            disabled={connecting || room.isFull}
                                            onClick={() => handleJoinRoom(room.code)}
                                            className={`flex items-center justify-between rounded-2xl px-4 py-3 border-2 transition-all text-left ${room.isFull
                                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                                                : 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400 active:scale-98 cursor-pointer'
                                                }`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-700 bungee-font text-xl tracking-widest">{room.code}</span>
                                                    <span className={`bungee-font text-xs px-2 py-0.5 rounded-full ${room.isFull ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                                        {room.playerCount}/{room.maxPlayers}
                                                    </span>
                                                </div>
                                                <span className="text-green-500 text-xs">👑 {room.hostName}</span>
                                            </div>
                                            <span className={`bungee-font text-sm px-3 py-2 rounded-xl ${room.isFull ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600'}`}>
                                                {connecting ? '⏳' : room.isFull ? 'FULL' : '→ JOIN'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-green-200" />
                            <span className="text-green-400 bungee-font text-xs">OR ENTER CODE</span>
                            <div className="flex-1 h-px bg-green-200" />
                        </div>

                        {/* Manual code + join */}
                        <div className="flex gap-2">
                            <input
                                className='flex-1 p-4 rounded-2xl border-2 border-amber-100 focus:border-amber-400 outline-none transition-all text-xl font-bold text-amber-800 bg-white tracking-widest uppercase'
                                type="text"
                                placeholder='Room Code'
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(roomCode)}
                                maxLength={6}
                            />
                            <button
                                disabled={connecting || !roomCode.trim()}
                                onClick={() => handleJoinRoom(roomCode)}
                                className='px-5 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-lg shadow-[0_4px_0_0_#FFA000] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50'
                            >
                                {connecting ? '⏳' : '🔗 JOIN'}
                            </button>
                        </div>

                        <button onClick={onExit}
                            className='w-full py-4 rounded-2xl cursor-pointer bg-white border-4 border-green-200 text-green-600 bungee-font text-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all'>
                            ← BACK
                        </button>
                    </div>
                ) : (
                    /* ══ LOBBY PHASE ══ */
                    <>
                        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30">
                            <p className="text-green-700 bungee-font text-xs tracking-widest mb-4">
                                PLAYERS ({players.length})
                            </p>
                            <div className="flex flex-col gap-3 max-h-52 overflow-y-auto">
                                {players.map((p, i) => (
                                    <div key={p.id || i} className="flex items-center justify-between bg-green-50 rounded-2xl px-5 py-3 border-2 border-green-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-green-400 flex items-center justify-center text-white bungee-font text-sm flex-shrink-0">
                                                {p.name?.[0]?.toUpperCase()}
                                            </div>
                                            <span className="text-green-900 bungee-font text-lg">
                                                {p.name}
                                                {p.name === userName && <span className="text-green-500 text-xs ml-1">(you)</span>}
                                                {i === 0 && <span className="ml-2 text-amber-500 text-xs">👑</span>}
                                            </span>
                                        </div>
                                        <span className={`text-xl ${p.ready ? '' : 'opacity-25'}`}>
                                            {p.ready ? '✅' : '⏳'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            {!imReadyStatus ? (
                                <button
                                    onClick={() => setShowDigitPicker(true)}
                                    className='flex-1 py-5 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all'
                                >
                                    🔢 CHOOSE MY CODE
                                </button>
                            ) : (
                                <div className='flex-1 py-5 rounded-2xl bg-green-200 text-green-700 bungee-font text-xl text-center flex items-center justify-center'>
                                    ✅ READY! WAITING FOR HOST...
                                </div>
                            )}
                            <button onClick={onExit}
                                className='px-6 py-5 rounded-2xl bg-white border-4 border-green-200 text-green-600 bungee-font text-xl hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all shadow-[0_6px_0_0_#d1d5db] active:shadow-none active:translate-y-1.5'>
                                ✕
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default JoinLobby
