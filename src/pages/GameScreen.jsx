import React, { useEffect, useRef, useState, useCallback } from 'react'
import Cloud from '../components/Cloud'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)

const RESULT_COLORS = {
    green: { bg: 'bg-green-400', border: 'border-green-500', text: 'text-white', label: '✓' },
    yellow: { bg: 'bg-yellow-400', border: 'border-yellow-500', text: 'text-yellow-900', label: '~' },
    red: { bg: 'bg-red-400', border: 'border-red-500', text: 'text-white', label: '✗' },
}

// ── History Modal ────────────────────────────────────────────────
const HistoryModal = ({ player, history, onClose, isMe }) => {
    const [expandedGuesser, setExpandedGuesser] = useState(null)
    const [showMyCode, setShowMyCode] = useState(false)

    const grouped = history.reduce((acc, entry) => {
        const key = entry.guesserName || 'Unknown'
        if (!acc[key]) acc[key] = []
        acc[key].push(entry)
        return acc
    }, {})
    const guessers = Object.keys(grouped)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 w-full max-w-md flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="bungee-font text-green-800 text-xl">{player.name}'S HISTORY</h3>
                        <p className="text-gray-400 text-[10px] bungee-font tracking-wider mt-0.5">GUESSES OTHERS MADE ABOUT {player.name.toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm transition-all focus:outline-none flex-shrink-0">✕</button>
                </div>

                {isMe && player.digits && (
                    <div className="mb-4 bg-amber-50 rounded-2xl p-4 border-2 border-amber-200 flex flex-col items-center gap-3">
                        <span className="text-amber-700 bungee-font text-xs tracking-widest">YOUR SECRET CODE</span>
                        <div className="flex items-center gap-3">
                            <button
                                onPointerDown={() => setShowMyCode(true)}
                                onPointerUp={() => setShowMyCode(false)}
                                onPointerLeave={() => setShowMyCode(false)}
                                className="w-12 h-12 rounded-full bg-amber-200 hover:bg-amber-300 flex items-center justify-center text-xl transition-all active:scale-95 shadow-sm border-2 border-amber-400"
                                title="Hold to reveal"
                            >
                                {showMyCode ? '🔓' : '🔒'}
                            </button>
                            <div className="flex gap-2">
                                {player.digits.map((d, i) => (
                                    <div key={`code-${i}`} className="w-10 h-10 rounded-xl border-2 border-amber-500 bg-amber-400 flex items-center justify-center bungee-font text-white shadow-md text-lg">
                                        {showMyCode ? d : '?'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col overflow-y-auto pr-1 gap-2 hide-scroll">
                    {guessers.length === 0 && (
                        <p className="text-gray-400 bungee-font text-center py-8 text-sm">Nobody has guessed {isMe ? 'your' : player.name + "'s"} code yet.</p>
                    )}
                    {guessers.map(guesserName => {
                        const isExpanded = expandedGuesser === guesserName
                        const entries = grouped[guesserName]
                        return (
                            <div key={guesserName} className="flex flex-col bg-gray-50 border-2 border-gray-100 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedGuesser(isExpanded ? null : guesserName)}
                                    className="flex justify-between items-center p-3 w-full hover:bg-gray-100 transition-colors"
                                >
                                    <span className="text-green-800 bungee-font text-sm">BY {guesserName}</span>
                                    <span className="text-gray-400 text-xs font-bold">{isExpanded ? '▲' : '▼'} {entries.length} guess{entries.length !== 1 ? 'es' : ''}</span>
                                </button>
                                {isExpanded && (
                                    <div className="flex flex-col gap-2 p-3 pt-0 border-t-2 border-gray-100 bg-white">
                                        {entries.map((entry, i) => (
                                            <div key={`entry-${i}`} className="flex flex-col gap-1.5 mt-2 bg-gray-50 p-2.5 rounded-xl">
                                                <span className="text-gray-400 text-[10px] bungee-font tracking-wider">ROUND {entry.round}</span>
                                                <div className="flex gap-1.5">
                                                    {entry.guess.map((digit, j) => {
                                                        const c = RESULT_COLORS[entry.result[j]] || RESULT_COLORS.red
                                                        return (
                                                            <div key={`eguess-${i}-${j}`} className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center bungee-font text-sm shadow-sm ${c.bg} ${c.border} ${c.text}`}>
                                                                {digit}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ── Left Panel: Player Info Card ─────────────────────────────────
const PlayerInfoCard = ({ player, isTarget, isEliminated, isMe, submittedIds, receivedGuesses = [], onOpenHistory }) => {
    const isOffline = player.disconnected
    const hasSubmitted = submittedIds.includes(player.id)
    const latestGuess = receivedGuesses.length > 0 ? receivedGuesses[receivedGuesses.length - 1] : null

    const statusColor = isOffline
        ? 'bg-gray-400/40 border-gray-400/40'
        : isEliminated
            ? 'bg-white/10 border-white/20 opacity-60'
            : isTarget
                ? 'bg-yellow-300/20 border-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.35)]'
                : 'bg-white/15 border-white/25'

    const avatarBg = isOffline ? 'bg-gray-500' : isEliminated ? 'bg-gray-400' : isTarget ? 'bg-yellow-300' : 'bg-green-600'
    const avatarText = isTarget ? 'text-green-800' : 'text-white'

    return (
        <div className={`rounded-2xl border-2 p-3 flex flex-col gap-2 transition-all duration-300 ${statusColor}`}>
            {/* Top row: avatar + name + status */}
            <div className="flex items-center gap-2.5">
                {/* Avatar */}
                <div className={`relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bungee-font text-lg ${avatarBg} ${avatarText} ${isTarget ? 'avatar-target-glow' : ''}`}>
                    {player.name?.[0]?.toUpperCase()}
                    {isMe && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white/80" />}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`bungee-font text-sm leading-tight truncate ${isEliminated || isOffline ? 'text-white/40 line-through' : 'text-white'}`}>
                            {player.name}
                        </p>
                        {isMe && <span className="text-yellow-300 text-[9px] bungee-font bg-yellow-300/20 px-1.5 py-0.5 rounded-full flex-shrink-0">YOU</span>}
                        {isTarget && <span className="text-yellow-900 text-[9px] bungee-font bg-yellow-300 px-1.5 py-0.5 rounded-full flex-shrink-0">TARGET</span>}
                        {isEliminated && <span className="text-red-300 text-[9px] bungee-font">OUT</span>}
                        {isOffline && <span className="text-red-300 text-[9px] bungee-font bg-red-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">OFFLINE</span>}
                    </div>
                    {/* Submitted indicator */}
                    {!isEliminated && !isOffline && !isTarget && (
                        <p className={`text-[9px] bungee-font mt-0.5 ${hasSubmitted ? 'text-green-300' : 'text-white/30'}`}>
                            {hasSubmitted ? '✓ SUBMITTED' : '· THINKING...'}
                        </p>
                    )}
                </div>
            </div>

            {/* Latest guess received */}
            {latestGuess && !isEliminated && !isOffline && (
                <div className="bg-black/15 rounded-xl p-2 flex flex-col gap-1">
                    <p className="text-white/40 text-[9px] bungee-font tracking-wider">LAST GUESS BY {latestGuess.guesserName}</p>
                    <div className="flex gap-1.5">
                        {latestGuess.guess.map((digit, j) => {
                            const c = RESULT_COLORS[latestGuess.result[j]] || RESULT_COLORS.red
                            return (
                                <div key={`lg-${j}`} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center bungee-font text-xs shadow-sm ${c.bg} ${c.border} ${c.text}`}>
                                    {digit}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* No guesses yet */}
            {!latestGuess && !isEliminated && !isOffline && (
                <p className="text-white/25 text-[9px] bungee-font text-center">NO GUESSES YET</p>
            )}
        </div>
    )
}

// ── Right Panel: Guess Feed Entry ────────────────────────────────
const GuessFeedEntry = ({ entry }) => {
    return (
        <div className="bg-white/12 backdrop-blur-sm rounded-2xl p-3 border border-white/20 flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center bungee-font text-white text-[11px] flex-shrink-0">
                        {entry.guesserName?.[0]?.toUpperCase()}
                    </span>
                    <span className="bungee-font text-white text-xs truncate">{entry.guesserName}</span>
                </div>
                <span className="text-white/40 bungee-font text-[9px] flex-shrink-0">R{entry.round}</span>
            </div>

            {/* Arrow + target */}
            <div className="flex items-center gap-1.5">
                <span className="text-white/30 text-xs">▸</span>
                <span className="text-white/60 bungee-font text-[10px] truncate">guessed {entry.targetName}</span>
            </div>

            {/* Digits */}
            <div className="flex gap-1.5 flex-wrap">
                {entry.guess.map((digit, j) => {
                    const c = RESULT_COLORS[entry.result[j]] || RESULT_COLORS.red
                    return (
                        <div key={`fd-${j}`} className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center bungee-font text-sm shadow-sm ${c.bg} ${c.border} ${c.text}`}>
                            {digit}
                        </div>
                    )
                })}
                {entry.correct && <span className="ml-1 text-green-300 text-lg">✓</span>}
            </div>
        </div>
    )
}

// ── Timer bar ────────────────────────────────────────────────────
const TimerBar = ({ expiresAt }) => {
    const [timeLeft, setTimeLeft] = useState(60)

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
            setTimeLeft(remaining)
            if (remaining === 0) clearInterval(interval)
        }, 200)
        return () => clearInterval(interval)
    }, [expiresAt])

    const pct = (timeLeft / 60) * 100
    const urgent = timeLeft <= 10

    return (
        <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-200 ${urgent ? 'bg-red-400 animate-pulse' : 'bg-white'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`bungee-font text-sm min-w-[36px] text-right ${urgent ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                {timeLeft}s
            </span>
        </div>
    )
}

const LAST_ROOM_KEY = 'fourdigits_last_room'

// ── Main GameScreen ──────────────────────────────────────────────
const GameScreen = ({ userName, gameData, onExit }) => {
    const socketRef = useRef(gameData?.socket)
    const myId = socketRef.current?.id

    const isSpectator = gameData?.spectator || false
    const [digitCount, setDigitCount] = useState(gameData?.digitCount || 4)

    const [allPlayers, setAllPlayers] = useState(gameData?.players || [])
    const [isRevealing, setIsRevealing] = useState(true)
    const [phase, setPhase] = useState('waiting')
    const [currentTargetId, setCurrentTargetId] = useState(null)
    const [currentTargetName, setCurrentTargetName] = useState('')
    const [roundNumber, setRoundNumber] = useState(0)
    const [expiresAt, setExpiresAt] = useState(null)
    const [activePlayers, setActivePlayers] = useState((gameData?.players || []).map(p => p.id))
    const [guessHistory, setGuessHistory] = useState({})
    const [roundResults, setRoundResults] = useState(null)
    const [winner, setWinner] = useState(null)
    const [submittedIds, setSubmittedIds] = useState([])
    const [totalGuessers, setTotalGuessers] = useState(0)

    const [currentGuess, setCurrentGuess] = useState([])
    const [submitted, setSubmitted] = useState(false)
    const [exitConfirm, setExitConfirm] = useState(false)
    const [historyPlayerId, setHistoryPlayerId] = useState(null)

    // Mobile drawer state
    const [mobilePanel, setMobilePanel] = useState(null) // 'players' | 'guesses' | null

    const handleLeave = () => {
        localStorage.removeItem(LAST_ROOM_KEY)
        onExit()
    }

    useEffect(() => {
        const t = setTimeout(() => setIsRevealing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    useEffect(() => {
        const socket = socketRef.current
        if (!socket) return

        socket.on('round-started', ({ targetId, targetName, roundNumber, expiresAt, activePlayers, digitCount: dc }) => {
            setCurrentTargetId(targetId)
            setCurrentTargetName(targetName)
            setRoundNumber(roundNumber)
            setExpiresAt(expiresAt)
            setActivePlayers(activePlayers)
            setPhase('guessing')
            setSubmitted(false)
            setCurrentGuess([])
            setSubmittedIds([])
            setRoundResults(null)
            if (dc) setDigitCount(dc)
            setTotalGuessers(activePlayers.filter(id => id !== targetId).length)
        })

        socket.on('guess-made', ({ guesserSocketId, submittedCount, totalGuessers }) => {
            setSubmittedIds(prev => [...new Set([...prev, guesserSocketId])])
            setTotalGuessers(totalGuessers)
        })

        socket.on('round-complete', ({ results, targetId, targetName, targetEliminated, guessHistory, activePlayers, gameOver, winnerId, winnerName }) => {
            setGuessHistory(guessHistory)
            setActivePlayers(activePlayers)
            setRoundResults({ results, targetId, targetName, targetEliminated })
            setPhase('results')
            if (gameOver) {
                setTimeout(() => {
                    setWinner({ id: winnerId, name: winnerName })
                    setPhase('gameover')
                }, 3000)
            }
        })

        socket.on('game-over', ({ winnerId, winnerName }) => {
            setWinner({ id: winnerId, name: winnerName })
            setPhase('gameover')
        })

        socket.on('player-status-changed', ({ players }) => {
            setAllPlayers(players)
        })

        socket.on('game-state-sync', ({ players, phase: p, currentTargetId: tid, currentTargetName: tname, roundNumber: rn, guessHistory: gh, activePlayers: ap, submittedIds: si, digitCount: dc }) => {
            setAllPlayers(players)
            setCurrentTargetId(tid)
            setCurrentTargetName(tname)
            setRoundNumber(rn)
            setGuessHistory(gh || {})
            setActivePlayers(ap || [])
            setSubmittedIds(si || [])
            if (dc) setDigitCount(dc)
            if (p === 'guessing') { setPhase('guessing'); setIsRevealing(false) }
        })

        return () => {
            socket.off('round-started')
            socket.off('guess-made')
            socket.off('round-complete')
            socket.off('game-over')
            socket.off('player-status-changed')
            socket.off('game-state-sync')
        }
    }, [])

    const addDigit = useCallback((n) => {
        if (currentGuess.length >= digitCount || submitted) return
        setCurrentGuess(prev => [...prev, n])
    }, [currentGuess, submitted, digitCount])

    const removeDigit = useCallback(() => {
        if (submitted) return
        setCurrentGuess(prev => prev.slice(0, -1))
    }, [submitted])

    const submitGuess = useCallback(() => {
        if (currentGuess.length !== digitCount || submitted) return
        socketRef.current?.emit('submit-guess', { guess: currentGuess })
        setSubmitted(true)
    }, [currentGuess, submitted, digitCount])

    // Derived data
    const gamePlayers = allPlayers.filter(p => !p.spectator)
    const spectators = allPlayers.filter(p => p.spectator)
    const isEliminated = (id) => !activePlayers.includes(id)
    const amTarget = currentTargetId === myId

    const receivedGuesses = Object.entries(guessHistory).reduce((acc, [guesserSocketId, entries]) => {
        const guesserPlayer = allPlayers.find(p => p.id === guesserSocketId)
        const guesserName = guesserPlayer?.name || 'Unknown'
        entries.forEach(entry => {
            if (!acc[entry.targetId]) acc[entry.targetId] = []
            acc[entry.targetId].push({ guesserName, guess: entry.guess, result: entry.result, round: entry.round })
        })
        return acc
    }, {})

    // Flat feed newest-first
    const guessFeed = Object.entries(guessHistory).flatMap(([guesserSocketId, entries]) => {
        const guesserPlayer = allPlayers.find(p => p.id === guesserSocketId)
        const guesserName = guesserPlayer?.name || 'Unknown'
        return entries.map((entry, idx) => {
            const targetPlayer = allPlayers.find(p => p.id === entry.targetId)
            return {
                guesserName,
                targetName: targetPlayer?.name || 'Unknown',
                guess: entry.guess,
                result: entry.result,
                round: entry.round,
                correct: entry.result?.every(r => r === 'green'),
                sortKey: entry.round * 1000 + idx,
            }
        })
    }).sort((a, b) => b.sortKey - a.sortKey)

    const historyModalPlayer = historyPlayerId ? allPlayers.find(p => p.id === historyPlayerId) : null

    // ── Panel components (DRY) ───────────────────────────────────
    const PlayersPanel = ({ onHistoryOpen }) => (
        <div className="flex flex-col gap-2 px-3 py-3">
            <p className="bungee-font text-white/40 text-[9px] tracking-widest px-0.5">
                PLAYERS · {gamePlayers.length}
            </p>
            {gamePlayers.map(p => (
                <PlayerInfoCard
                    key={p.id}
                    player={p}
                    isTarget={p.id === currentTargetId}
                    isEliminated={isEliminated(p.id)}
                    isMe={p.id === myId}
                    submittedIds={submittedIds}
                    receivedGuesses={receivedGuesses[p.id] || []}
                    onOpenHistory={onHistoryOpen}
                />
            ))}
            {spectators.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/15 flex flex-col gap-1.5">
                    <p className="bungee-font text-white/30 text-[9px] tracking-widest">👁 SPECTATORS</p>
                    {spectators.map(s => (
                        <div key={s.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-2.5 py-1.5">
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center bungee-font text-white/50 text-xs flex-shrink-0">
                                {s.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-white/40 bungee-font text-xs truncate">{s.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    const GuessLogPanel = () => {
        const feedSlice = guessFeed.slice(0, 10).reverse()
        return (
            <div className="flex flex-col gap-2 px-3 py-3">
                <p className="bungee-font text-white/40 text-[9px] tracking-widest px-0.5">
                    GUESS LOG · {guessFeed.length}{guessFeed.length > 10 ? ' (latest 10)' : ''}
                </p>
                {feedSlice.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-5">
                        <p className="text-3xl opacity-30">🎯</p>
                        <p className="text-white/30 bungee-font text-xs text-center leading-relaxed">
                            No guesses yet.<br />They'll appear here.
                        </p>
                    </div>
                ) : (
                    feedSlice.map((entry, i) => (
                        <GuessFeedEntry key={`feed-${i}`} entry={entry} />
                    ))
                )}
            </div>
        )
    }

    return (
        <div className='bg-[#4CAF50] h-[100dvh] w-screen relative overflow-hidden flex flex-col'>

            {/* Modals */}
            {historyModalPlayer && (
                <HistoryModal
                    player={historyModalPlayer}
                    history={receivedGuesses[historyPlayerId] || []}
                    onClose={() => setHistoryPlayerId(null)}
                    isMe={historyPlayerId === myId}
                />
            )}

            {/* Reveal clouds */}
            {isRevealing && (
                <div className="cloud-transition-overlay">
                    {CLOUD_WIDTHS.map((w, i) => (
                        <div key={`cloud-${i}`} className="transition-cloud animate-rise"
                            style={{
                                left: `${(i % 4) * 28 - 10}%`,
                                bottom: `-${Math.floor(i / 4) * 28 + 10}vh`,
                                animationDelay: `${(i % 4) * 0.08 + Math.floor(i / 4) * 0.18 - 1.2}s`,
                                width: `${w}px`, zIndex: 100 + i,
                            }}>
                            <Cloud width="100%" />
                        </div>
                    ))}
                </div>
            )}

            {/* Exit confirm */}
            {exitConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl border-b-8 border-green-700/30 w-72 flex flex-col items-center gap-6">
                        <p className="bungee-font text-green-800 text-xl text-center">LEAVE THE GAME?</p>
                        <div className="flex gap-4 w-full">
                            <button onClick={() => setExitConfirm(false)} className="flex-1 py-4 rounded-2xl bg-white border-4 border-green-200 text-green-600 bungee-font text-lg hover:bg-green-50 transition-all">NO</button>
                            <button onClick={handleLeave} className="flex-1 py-4 rounded-2xl bg-red-400 hover:bg-red-500 text-white bungee-font text-lg shadow-[0_4px_0_0_#b91c1c] active:shadow-none active:translate-y-1 transition-all">YES, LEAVE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BG clouds */}
            <div className="absolute top-16 left-0 animate-float opacity-10 pointer-events-none"><Cloud width={200} height={100} /></div>
            <div className="absolute bottom-10 right-0 animate-float opacity-10 pointer-events-none" style={{ animationDelay: '3s' }}><Cloud width={250} height={120} /></div>

            {/* ── Top bar ── */}
            <div className={`relative z-10 flex items-center justify-between px-3 sm:px-4 py-2.5 gap-2 transition-all duration-500 flex-shrink-0 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>

                {/* Left: room code + mobile players toggle */}
                <div className="flex items-center gap-2">
                    {gameData?.roomCode && (
                        <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                            <span className="text-white/50 bungee-font text-[9px] tracking-widest">ROOM</span>
                            <span className="text-white bungee-font text-sm tracking-widest">{gameData.roomCode}</span>
                        </div>
                    )}
                    {/* Mobile players toggle — left side */}
                    <button
                        onClick={() => setMobilePanel(p => p === 'players' ? null : 'players')}
                        className={`
                            md:hidden flex items-center gap-1.5 rounded-xl px-3 py-2 bungee-font text-xs
                            border-2 transition-all active:scale-95
                            ${mobilePanel === 'players'
                                ? 'bg-white text-green-700 border-white shadow-lg'
                                : 'bg-white/20 text-white border-white/30 hover:bg-white/30'}
                        `}
                    >
                        <span className="text-sm">👥</span>
                        <span>{gamePlayers.length}</span>
                    </button>
                </div>

                {/* Center: round info */}
                <div className="flex-1 text-center pointer-events-none">
                    {phase === 'guessing' && (
                        <>
                            <p className="text-white/50 bungee-font text-[9px] tracking-widest leading-none">ROUND {roundNumber}</p>
                            <p className="text-white bungee-font text-xs sm:text-sm leading-snug">
                                TARGET: <span className="text-yellow-300">{currentTargetName}</span>
                            </p>
                        </>
                    )}
                    {phase === 'waiting' && (
                        <p className="text-white/70 bungee-font text-xs sm:text-sm">⏳ STARTING...</p>
                    )}
                    {phase === 'results' && (
                        <p className="text-white/70 bungee-font text-xs sm:text-sm">📊 ROUND {roundNumber} RESULTS</p>
                    )}
                </div>

                {/* Right: exit + mobile guess log toggle */}
                <div className="flex items-center gap-2">
                    {/* Mobile guess log toggle — right side */}
                    <button
                        onClick={() => setMobilePanel(p => p === 'guesses' ? null : 'guesses')}
                        className={`
                            md:hidden flex items-center gap-1.5 rounded-xl px-3 py-2 bungee-font text-xs
                            border-2 transition-all active:scale-95
                            ${mobilePanel === 'guesses'
                                ? 'bg-white text-green-700 border-white shadow-lg'
                                : 'bg-white/20 text-white border-white/30 hover:bg-white/30'}
                        `}
                    >
                        <span className="text-sm">📋</span>
                        <span>{guessFeed.length}</span>
                    </button>
                    <button
                        onClick={() => setExitConfirm(true)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-red-400/80 border-2 border-white/30 text-white bungee-font text-sm transition-all flex items-center justify-center"
                    >✕</button>
                </div>
            </div>

            {/* ══ GAME OVER ══ */}
            {phase === 'gameover' && winner && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 z-10 px-4">
                    <div className="text-center">
                        <p className="text-white/70 bungee-font text-sm tracking-widest">GAME OVER</p>
                        <h1 className="text-white bungee-font text-5xl sm:text-6xl drop-shadow-lg mt-2">
                            {winner.id === myId ? '🏆 YOU WIN!' : `🥇 ${winner.name} WINS!`}
                        </h1>
                    </div>
                    <button onClick={handleLeave}
                        className="py-5 px-10 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all">
                        BACK TO MENU
                    </button>
                </div>
            )}

            {/* ══ MAIN LAYOUT ══ */}
            {phase !== 'gameover' && (
                <div className={`flex-1 relative overflow-hidden z-10 transition-all duration-700 delay-500 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>

                    {/* ══ LEFT: Players Panel — absolute, floats over center ══ */}
                    <div className="hidden md:block absolute left-3 lg:left-4 top-2 z-20 w-[220px] lg:w-[320px] max-h-[calc(100vh-80px)] overflow-y-auto hide-scroll bg-black/25 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
                        <PlayersPanel onHistoryOpen={setHistoryPlayerId} />
                    </div>

                    {/* ══ CENTER: Game Controls — full width, panels overlap it ══ */}
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 overflow-y-auto hide-scroll">

                        {/* Timer */}
                        {phase === 'guessing' && expiresAt && (
                            <div className="w-full max-w-sm">
                                <TimerBar expiresAt={expiresAt} />
                                <p className="text-white/40 bungee-font text-[9px] text-center mt-1">
                                    {submittedIds.length}/{totalGuessers} submitted
                                </p>
                            </div>
                        )}

                        {/* Waiting */}
                        {phase === 'waiting' && (
                            <div className="text-center">
                                <p className="text-white bungee-font text-xl sm:text-2xl drop-shadow">⏳ STARTING ROUND...</p>
                                <p className="text-white/60 bungee-font text-sm mt-1">Get ready!</p>
                            </div>
                        )}

                        {/* Round results */}
                        {phase === 'results' && roundResults && (
                            <div className="w-full max-w-sm bg-white/95 rounded-3xl p-4 sm:p-5 shadow-2xl">
                                <p className="text-green-700 bungee-font text-xs tracking-widest mb-3 text-center">ROUND {roundNumber} RESULTS</p>
                                {roundResults.targetEliminated && (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-2 text-center mb-3">
                                        <p className="text-red-500 bungee-font text-sm">💥 {roundResults.targetName} ELIMINATED!</p>
                                    </div>
                                )}
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 hide-scroll">
                                    {roundResults.results.map((r, i) => (
                                        <div key={r.guesserSocketId || `row-${i}`} className="flex items-center gap-2 justify-between">
                                            <span className="text-green-800 bungee-font text-xs sm:text-sm truncate max-w-[80px]">{r.guesserName}</span>
                                            <div className="flex gap-1">
                                                {r.guess.map((d, j) => {
                                                    const c = RESULT_COLORS[r.result[j]]
                                                    return <div key={`rcell-${i}-${j}`} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center bungee-font text-xs sm:text-sm ${c.bg} ${c.border} ${c.text}`}>{d}</div>
                                                })}
                                            </div>
                                            {r.correct ? <span className="text-green-500 text-sm flex-shrink-0">✅</span> : <span className="w-5 flex-shrink-0" />}
                                        </div>
                                    ))}
                                    {roundResults.results.length === 0 && <p className="text-gray-400 text-xs text-center py-2">No guesses submitted.</p>}
                                </div>
                                <p className="text-green-400 bungee-font text-[10px] text-center mt-3">Next round starting...</p>
                            </div>
                        )}

                        {/* Spectator banner */}
                        {isSpectator && phase === 'guessing' && (
                            <div className="bg-white/20 backdrop-blur-md rounded-3xl p-4 text-center border-2 border-white/30 w-full max-w-sm">
                                <p className="text-white bungee-font text-sm">👁 SPECTATING</p>
                                <p className="text-white/60 bungee-font text-xs mt-1">You joined mid-game</p>
                            </div>
                        )}

                        {/* ── Guess input ── */}
                        {!isSpectator && phase === 'guessing' && (
                            amTarget ? (
                                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-5 sm:p-8 text-center border-4 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.35)] w-full max-w-sm">
                                    <p className="text-yellow-300 bungee-font text-2xl sm:text-3xl drop-shadow mb-1">🎯 YOU'RE THE TARGET!</p>
                                    <p className="text-white bungee-font text-xs sm:text-sm">Others are guessing your code...</p>
                                </div>
                            ) : submitted ? (
                                <div className="bg-white/95 rounded-3xl p-4 sm:p-6 text-center shadow-2xl w-full max-w-sm">
                                    <p className="text-green-600 bungee-font text-lg sm:text-xl mb-3">✅ GUESS SUBMITTED!</p>
                                    <div className="flex gap-1.5 justify-center">
                                        {currentGuess.map((d, i) => (
                                            <div key={`sub-${i}`} className={`${digitCount <= 5 ? 'w-10 h-12' : digitCount === 6 ? 'w-8 h-10' : 'w-7 h-9'} bg-green-100 rounded-xl border-2 border-green-300 flex items-center justify-center text-green-800 bungee-font text-xl`}>{d}</div>
                                        ))}
                                    </div>
                                    <p className="text-green-400 bungee-font text-[10px] sm:text-xs mt-4">Waiting for others...</p>
                                </div>
                            ) : (
                                <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-3 sm:p-5 shadow-2xl w-full max-w-sm flex flex-col gap-2 sm:gap-3">
                                    {/* Digit slots */}
                                    <div className={`flex justify-center ${digitCount >= 7 ? 'gap-1' : 'gap-2'}`}>
                                        {Array.from({ length: digitCount }).map((_, i) => (
                                            <div key={`digit-${i}`} className={`
                                                rounded-xl border-4 flex items-center justify-center bungee-font transition-all shadow-inner
                                                ${digitCount <= 5 ? 'w-12 h-14 sm:w-14 sm:h-16 text-2xl sm:text-3xl' : digitCount === 6 ? 'w-10 h-12 sm:w-11 sm:h-14 text-xl sm:text-2xl' : 'w-8 h-10 sm:w-9 sm:h-12 text-lg sm:text-xl'}
                                                ${currentGuess[i] !== undefined ? 'bg-green-50 border-green-400 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-300'}
                                            `}>
                                                {currentGuess[i] ?? '?'}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Numpad */}
                                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5 px-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                            <button key={n} onClick={() => addDigit(n)}
                                                disabled={currentGuess.length >= digitCount}
                                                className="aspect-square rounded-xl bg-green-400 hover:bg-green-500 active:bg-green-600 text-white bungee-font text-lg sm:text-xl transition-all active:scale-90 shadow-[0_3px_0_0_#2e7d32] active:shadow-none active:translate-y-0.5 disabled:opacity-40">
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Backspace + Submit */}
                                    <div className="flex gap-2 px-1">
                                        <button onClick={removeDigit} disabled={currentGuess.length === 0}
                                            className="w-1/3 py-3 sm:py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 bungee-font text-xl sm:text-2xl transition-all disabled:opacity-40">⌫</button>
                                        <button onClick={submitGuess} disabled={currentGuess.length !== digitCount}
                                            className="flex-1 py-3 sm:py-4 rounded-xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-sm sm:text-base shadow-[0_3px_0_0_#FFA000] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
                                            ✅ SUBMIT
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* ══ RIGHT: Guess Log Panel — absolute, floats over center ══ */}
                    <div className="hidden md:block absolute right-3 lg:right-4 top-2 z-20 w-[220px] lg:w-[320px] max-h-[calc(100vh-80px)] overflow-y-auto hide-scroll bg-black/25 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
                        <GuessLogPanel />
                    </div>

                    {/* ══ MOBILE: Drawer overlay ══ */}
                    {mobilePanel && (
                        <div className="md:hidden absolute inset-0 z-30 flex" onClick={() => setMobilePanel(null)}>
                            {/* Players drawer — slides from left */}
                            {mobilePanel === 'players' && (
                                <>
                                    <div
                                        className="w-72 max-w-[80vw] h-full bg-[#3a9c3f]/97 backdrop-blur-md border-r border-white/20 shadow-2xl overflow-y-auto hide-scroll"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <PlayersPanel onHistoryOpen={(id) => { setHistoryPlayerId(id); setMobilePanel(null) }} />
                                    </div>
                                    <div className="flex-1" />
                                </>
                            )}
                            {/* Guess log drawer — slides from right */}
                            {mobilePanel === 'guesses' && (
                                <>
                                    <div className="flex-1" />
                                    <div
                                        className="w-80 max-w-[85vw] h-full bg-[#3a9c3f]/97 backdrop-blur-md border-l border-white/20 shadow-2xl overflow-y-auto hide-scroll"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <GuessLogPanel />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>
            )}
        </div>
    )
}

export default GameScreen