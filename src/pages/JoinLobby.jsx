import React, { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Cloud from '../components/Cloud'
import DigitPicker from './DigitPicker'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)
const LAST_ROOM_KEY = 'fourdigits_last_room'

const JoinLobby = ({ userName, onGameStart, onExit }) => {
    const socketRef = useRef(null)
    const transitioningRef = useRef(false)
    const roomCodeRef = useRef('')
    // Keep latest join handler in a ref so the socket 'connect' closure can call it
    const joinHandlerRef = useRef(null)

    const [isRevealing, setIsRevealing] = useState(true)
    const [phase, setPhase] = useState('discover') // 'discover' | 'lobby'
    const [roomCode, setRoomCode] = useState('')
    const [lastRoom, setLastRoom] = useState(null)

    // Load last room on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(LAST_ROOM_KEY)
            if (stored) setLastRoom(JSON.parse(stored))
        } catch (_) {
            localStorage.removeItem(LAST_ROOM_KEY)
        }
    }, [])
    const [availableRooms, setAvailableRooms] = useState([])
    const [players, setPlayers] = useState([])
    const [error, setError] = useState('')
    const [showDigitPicker, setShowDigitPicker] = useState(false)
    const [imReady, setImReady] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [loadingRooms, setLoadingRooms] = useState(true)
    const [digitCount, setDigitCount] = useState(4)
    const [pendingJoinCode, setPendingJoinCode] = useState(null)
    const [passwordInput, setPasswordInput] = useState('')

    // Keep ref in sync
    useEffect(() => { roomCodeRef.current = roomCode }, [roomCode])

    const fetchRooms = useCallback((socket) => {
        setLoadingRooms(true)
        socket.emit('get-rooms', (res) => {
            setLoadingRooms(false)
            setAvailableRooms(res.rooms || [])
        })
    }, [])

    // Core join logic — defined as useCallback so the ref stays fresh
    const joinRoom = useCallback((socket, code, passwordOverride, rooms) => {
        const finalCode = (code || roomCodeRef.current).trim().toUpperCase()
        if (!finalCode) { setError('Enter a room code first.'); return }
        if (!socket?.connected) { setError('Not connected to server. Refresh the page.'); return }

        // Check if this room requires a password and we don't have one yet
        const roomMeta = (rooms || []).find(r => r.code === finalCode)
        if (roomMeta?.hasPassword && passwordOverride === undefined) {
            setPendingJoinCode(finalCode)
            setPasswordInput('')
            return
        }

        setConnecting(true)
        setError('')

        socket.emit('join-room', { roomCode: finalCode, playerName: userName, password: passwordOverride || null }, (res) => {
            setConnecting(false)
            setPendingJoinCode(null)
            setPasswordInput('')
            if (res.success) {
                // Game already running → go straight to GameScreen
                if (res.spectator || res.rejoined) {
                    localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ roomCode: finalCode, playerName: userName }))
                    transitioningRef.current = true
                    setTimeout(() => onGameStart({
                        players: res.players,
                        socket,
                        isHost: res.isHost || false,
                        roomCode: finalCode,
                        spectator: res.spectator || false,
                        rejoined: res.rejoined || false,
                        digitCount: res.digitCount || 4,
                    }), 300)
                    return
                }

                setDigitCount(res.digitCount || 4)
                setRoomCode(finalCode)
                roomCodeRef.current = finalCode
                setPlayers(res.players)
                setPhase('lobby')

                socket.off('player-joined')
                socket.off('lobby-update')
                socket.off('room-closed')
                socket.off('game-started')
                socket.off('kicked')

                socket.on('player-joined', ({ players }) => setPlayers(players))
                socket.on('lobby-update', ({ players }) => setPlayers(players))

                socket.on('room-closed', ({ reason }) => {
                    if (transitioningRef.current) return
                    localStorage.removeItem(LAST_ROOM_KEY)
                    setError(reason || 'Room was closed.')
                    setPhase('discover')
                    setPlayers([])
                    fetchRooms(socket)
                })

                socket.on('kicked', ({ reason }) => {
                    if (transitioningRef.current) return
                    localStorage.removeItem(LAST_ROOM_KEY)
                    setError(reason || 'You were kicked from the room.')
                    setPhase('discover')
                    setPlayers([])
                    setImReady(false)
                    fetchRooms(socket)
                })

                socket.on('game-started', ({ players, digitCount: dc }) => {
                    localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ roomCode: finalCode, playerName: userName }))
                    transitioningRef.current = true
                    setTimeout(() => onGameStart({
                        players,
                        socket,
                        isHost: false,
                        roomCode: roomCodeRef.current,
                        spectator: false,
                        rejoined: false,
                        digitCount: dc || 4,
                    }), 300)
                })
            } else {
                setError(res.error || 'Failed to join room.')
            }
        })
    }, [userName, onGameStart, fetchRooms])

    // Keep the ref fresh after every re-render
    useEffect(() => { joinHandlerRef.current = joinRoom }, [joinRoom])

    // Socket setup — runs once on mount
    useEffect(() => {
        const revealTimer = setTimeout(() => setIsRevealing(false), 2500)
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
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleRefresh = () => {
        if (socketRef.current?.connected) fetchRooms(socketRef.current)
    }

    const handleJoinRoom = (code, passwordOverride) => {
        joinRoom(socketRef.current, code, passwordOverride, availableRooms)
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
                <DigitPicker digitCount={digitCount} onConfirm={handleDigitsChosen} onCancel={() => setShowDigitPicker(false)} />
            )}

            {/* Password Prompt Modal */}
            {pendingJoinCode && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPendingJoinCode(null)}>
                    <div className="bg-white rounded-3xl p-6 shadow-2xl border-b-8 border-amber-400/40 w-full max-w-xs flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <span className="text-4xl">🔒</span>
                            <h3 className="bungee-font text-amber-700 text-xl mt-2">ROOM PASSWORD</h3>
                            <p className="text-gray-400 text-[11px] bungee-font tracking-wider mt-1">ENTER THE 4-DIGIT PIN</p>
                        </div>
                        <input
                            autoFocus
                            className="w-full p-4 rounded-2xl border-2 border-amber-200 focus:border-amber-400 outline-none text-2xl font-bold text-center tracking-[0.5em] text-amber-800 bg-amber-50"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="••••"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            onKeyDown={e => e.key === 'Enter' && passwordInput.length === 4 && handleJoinRoom(pendingJoinCode, passwordInput)}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setPendingJoinCode(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 bungee-font hover:bg-gray-200 transition-all">
                                CANCEL
                            </button>
                            <button
                                disabled={passwordInput.length !== 4 || connecting}
                                onClick={() => handleJoinRoom(pendingJoinCode, passwordInput)}
                                className="flex-1 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white bungee-font shadow-[0_4px_0_0_#d97706] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                            >
                                {connecting ? '⏳' : '→ JOIN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reveal Clouds */}
            {isRevealing && (
                <div className="cloud-transition-overlay">
                    {CLOUD_WIDTHS.map((w, i) => (
                        <div key={`cloud-${i}`} className="transition-cloud animate-rise"
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

                        {/* Rejoin banner */}
                        {lastRoom && (
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-amber-600 bungee-font text-[10px] tracking-widest">LAST ROOM</p>
                                    <p className="text-amber-800 bungee-font text-lg tracking-widest truncate">{lastRoom.roomCode}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleJoinRoom(lastRoom.roomCode)}
                                        disabled={connecting}
                                        className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-white bungee-font text-xs shadow-[0_3px_0_0_#d97706] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50"
                                    >
                                        🔁 REJOIN
                                    </button>
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem(LAST_ROOM_KEY)
                                            setLastRoom(null)
                                        }}
                                        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 text-sm flex items-center justify-center transition-all"
                                        title="Dismiss"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}

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
                                                : 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-400 cursor-pointer'
                                                }`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-700 bungee-font text-xl tracking-widest">{room.code}</span>
                                                    <span className={`bungee-font text-xs px-2 py-0.5 rounded-full ${room.isFull ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                                        {room.playerCount}/{room.maxPlayers}
                                                    </span>
                                                    {room.digitCount && room.digitCount !== 4 && (
                                                        <span className="bungee-font text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{room.digitCount}D</span>
                                                    )}
                                                    {room.hasPassword && <span className="text-xs">🔒</span>}
                                                </div>
                                                <span className="text-green-500 text-xs">👑 {room.hostName}</span>
                                            </div>
                                            <span className={`bungee-font text-sm px-3 py-2 rounded-xl ${room.isFull ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600'}`}>
                                                {connecting ? '⏳' : room.isFull ? 'FULL' : room.hasPassword ? '🔒 JOIN' : '→ JOIN'}
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
                                autoComplete="off"
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
