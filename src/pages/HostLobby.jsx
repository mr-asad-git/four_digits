import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import Cloud from '../components/Cloud'
import DigitPicker from './DigitPicker'

const LAST_ROOM_KEY = 'fourdigits_last_room'

const HostLobby = ({ userName, onGameStart, onExit }) => {
    const socketRef = useRef(null)
    const transitioningRef = useRef(false)
    const roomCodeRef = useRef('')
    const [roomCode, setRoomCode] = useState('')
    const [serverIP, setServerIP] = useState('...')
    const [players, setPlayers] = useState([])
    const [error, setError] = useState('')
    const [showDigitPicker, setShowDigitPicker] = useState(false)
    const [imReady, setImReady] = useState(false)
    const [copied, setCopied] = useState(false)

    // ── Room settings ─────────────────────────────────────────────
    const [digitCount, setDigitCount] = useState(4)          // 4–8
    const [roomPassword, setRoomPassword] = useState('')      // empty = no password
    const [settingsApplied, setSettingsApplied] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    useEffect(() => {
        const socket = io({ extraHeaders: { 'ngrok-skip-browser-warning': 'true' } })
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
            if (transitioningRef.current) return
            setError(reason || 'Room closed.')
            setTimeout(onExit, 2000)
        })

        socket.on('game-started', ({ players, digitCount: dc }) => {
            // Save room for rejoin
            localStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ roomCode: roomCodeRef.current, playerName: userName }))
            transitioningRef.current = true
            setTimeout(() => onGameStart({
                players,
                socket,
                isHost: true,
                roomCode: roomCodeRef.current,
                digitCount: dc || 4,
            }), 300)
        })

        return () => {
            if (!transitioningRef.current) socket.disconnect()
        }
    }, [])

    const applySettings = () => {
        // Validate password: must be empty or exactly 4 digits
        if (roomPassword.length > 0 && (roomPassword.length !== 4 || !/^\d{4}$/.test(roomPassword))) {
            setError('Room password must be exactly 4 digits (or leave empty for no password).')
            return
        }
        socketRef.current?.emit('set-room-settings', {
            digitCount,
            password: roomPassword || null,
        }, (res) => {
            if (res?.success) {
                setSettingsApplied(true)
                setShowSettings(false)
                setError('')
            } else {
                setError(res?.error || 'Failed to apply settings.')
            }
        })
    }

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
        <div className='bg-[#4CAF50] h-screen w-screen relative overflow-hidden flex flex-col items-center justify-center gap-4 p-4 md:p-8'>

            {showDigitPicker && (
                <DigitPicker
                    digitCount={digitCount}
                    onConfirm={handleDigitsChosen}
                    onCancel={() => setShowDigitPicker(false)}
                />
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
                    <div className="bg-white rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 w-full max-w-sm flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <h3 className="bungee-font text-green-800 text-xl">ROOM SETTINGS</h3>
                            <p className="text-gray-400 text-[11px] bungee-font tracking-wider mt-1">MUST BE SET BEFORE ANYONE IS READY</p>
                        </div>

                        {/* Digit count */}
                        <div>
                            <p className="text-green-600 bungee-font text-xs tracking-widest mb-3">CODE LENGTH</p>
                            <div className="grid grid-cols-5 gap-2">
                                {[4, 5, 6, 7, 8].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setDigitCount(n)}
                                        className={`rounded-2xl py-3 bungee-font text-xl transition-all active:scale-95 ${
                                            digitCount === n
                                                ? 'bg-green-500 text-white shadow-[0_4px_0_0_#2e7d32] active:shadow-none active:translate-y-1'
                                                : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-600'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-gray-400 text-[10px] text-center mt-2">All players must guess {digitCount} digits</p>
                        </div>

                        {/* Password */}
                        <div>
                            <p className="text-green-600 bungee-font text-xs tracking-widest mb-2">ROOM PASSWORD <span className="text-gray-300">(OPTIONAL)</span></p>
                            <input
                                className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-green-400 outline-none text-xl font-bold text-gray-700 bg-gray-50 tracking-[0.4em] text-center"
                                type="password"
                                inputMode="numeric"
                                placeholder="4-digit PIN"
                                maxLength={4}
                                value={roomPassword}
                                onChange={e => setRoomPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            />
                            <p className="text-gray-400 text-[10px] text-center mt-1">Leave empty for no password</p>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 py-3 rounded-2xl bg-white border-4 border-gray-200 text-gray-500 bungee-font hover:bg-red-50 hover:border-red-200 hover:text-red-400 transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={applySettings}
                                className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white bungee-font shadow-[0_4px_0_0_#2e7d32] active:shadow-none active:translate-y-1 transition-all"
                            >
                                ✅ APPLY
                            </button>
                        </div>
                    </div>
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

            <div className={`w-full max-w-2xl flex flex-col gap-4 transition-all duration-700 delay-300`}>

                {/* Header */}
                <div className="text-center">
                    <h1 className="bungee-font text-white text-4xl md:text-5xl drop-shadow-lg">HOST LOBBY</h1>
                    <p className="text-white/70 bungee-font text-xs tracking-widest mt-1">SHARE YOUR ROOM CODE — OTHERS JOIN VIA CODE</p>
                </div>

                {/* Room Code + Settings row */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 md:p-6 shadow-2xl border-b-8 border-green-700/30 flex flex-col gap-4">
                    <div className="flex gap-3">
                        {/* Room code */}
                        <div className="flex-1 bg-amber-50 rounded-2xl p-4 border-2 border-amber-200">
                            <p className="text-amber-600 bungee-font text-xs tracking-widest mb-1">ROOM CODE</p>
                            <p className="text-amber-800 bungee-font text-3xl tracking-widest">{roomCode || '------'}</p>
                        </div>
                        {/* Settings pill */}
                        <div className="flex flex-col gap-2 justify-center">
                            <button
                                onClick={() => setShowSettings(true)}
                                disabled={players.some(p => p.ready)}
                                className={`flex flex-col items-center gap-0.5 px-3 py-3 rounded-2xl border-2 transition-all ${
                                    settingsApplied
                                        ? 'bg-green-50 border-green-300 text-green-700'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                                title="Room Settings"
                            >
                                <span className="text-xl">⚙️</span>
                                <span className="bungee-font text-[10px] tracking-wider">{digitCount}D{roomPassword ? ' 🔒' : ''}</span>
                            </button>
                        </div>
                    </div>

                    {/* Settings summary pill */}
                    {settingsApplied && (
                        <div className="flex gap-2 flex-wrap">
                            <span className="bg-green-100 text-green-700 bungee-font text-[10px] px-3 py-1 rounded-full tracking-widest">
                                {digitCount}-DIGIT CODE
                            </span>
                            {roomPassword && (
                                <span className="bg-amber-100 text-amber-700 bungee-font text-[10px] px-3 py-1 rounded-full tracking-widest">
                                    🔒 PASSWORD SET
                                </span>
                            )}
                        </div>
                    )}

                    {/* Copy + Share row */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => copyToClipboard(roomCode)}
                            className="flex-1 py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white bungee-font text-lg transition-all active:scale-95 shadow-[0_4px_0_0_#2e7d32] active:shadow-none active:translate-y-1"
                        >
                            {copied ? '✅ COPIED!' : '📋 COPY CODE'}
                        </button>
                        <button
                            onClick={() => {
                                const url = window.location.origin;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`, '_blank');
                            }}
                            className="w-14 bg-[#25D366] hover:bg-[#128C7E] rounded-2xl flex justify-center items-center text-white transition-all active:scale-95 shadow-[0_4px_0_0_#075E54] active:shadow-none active:translate-y-1"
                            title="Share on WhatsApp"
                        >
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Players List */}
                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 md:p-6 shadow-2xl border-b-8 border-green-700/30">
                    <p className="text-green-700 bungee-font text-xs tracking-widest mb-4">
                        PLAYERS ({players.length}/8) {players.length < 2 && '— Waiting for others...'}
                    </p>
                    <div className="flex flex-col gap-3 max-h-40 overflow-y-auto">
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
