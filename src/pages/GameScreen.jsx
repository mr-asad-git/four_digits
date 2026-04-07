import React, { useEffect, useRef, useState, useCallback } from 'react'
import Cloud from '../components/Cloud'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)

// ── Colour helpers ───────────────────────────────────────────────
const RESULT_COLORS = {
    green:  { bg: 'bg-green-400',  border: 'border-green-600',  text: 'text-white' },
    yellow: { bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'text-gray-900' },
    red:    { bg: 'bg-red-400',    border: 'border-red-600',    text: 'text-white' },
}

// ── History Modal ────────────────────────────────────────────────
// 'history' = receivedGuesses for this player: [{guesserName, guess, result, round}]
const HistoryModal = ({ player, history, onClose, isMe }) => {
    const [expandedGuesser, setExpandedGuesser] = useState(null);
    const [showMyCode, setShowMyCode] = useState(false);

    // Group by guesser name
    const grouped = history.reduce((acc, entry) => {
        const key = entry.guesserName || 'Unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
    }, {});
    const guessers = Object.keys(grouped);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 w-full max-w-sm flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="bungee-font text-green-800 text-lg">{player.name}'S HISTORY</h3>
                        <p className="text-gray-400 text-[10px] bungee-font tracking-wider">GUESSES OTHERS MADE ABOUT {player.name.toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm transition-all focus:outline-none flex-shrink-0">✕</button>
                </div>

                {/* SECRET CODE REVEALER — only visible to the player themselves */}
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

                <div className="flex flex-col overflow-y-auto pr-1 gap-2">
                    {guessers.length === 0 && (
                        <p className="text-gray-400 bungee-font text-center py-6 text-sm">Nobody has guessed {isMe ? 'your' : player.name + "'s"} code yet.</p>
                    )}

                    {guessers.map(guesserName => {
                        const isExpanded = expandedGuesser === guesserName;
                        const entries = grouped[guesserName];
                        return (
                            <div key={guesserName} className="flex flex-col bg-gray-50 border-2 border-gray-100 rounded-xl overflow-hidden">
                                {/* Accordion Header */}
                                <button
                                    onClick={() => setExpandedGuesser(isExpanded ? null : guesserName)}
                                    className="flex justify-between items-center p-3 w-full hover:bg-gray-100 transition-colors"
                                >
                                    <span className="text-green-800 bungee-font text-sm">BY {guesserName}</span>
                                    <span className="text-gray-400 text-xs font-bold">{isExpanded ? '▲' : '▼'} {entries.length}</span>
                                </button>

                                {/* Accordion Content */}
                                {isExpanded && (
                                    <div className="flex flex-col gap-2 p-3 pt-0 border-t-2 border-gray-100 bg-white">
                                        {entries.map((entry, i) => (
                                            <div key={`entry-${i}`} className="flex flex-col gap-1.5 mt-2 bg-gray-50 p-2 rounded-lg">
                                                <span className="text-gray-400 text-[10px] bungee-font tracking-wider">ROUND {entry.round}</span>
                                                <div className="flex gap-1.5">
                                                    {entry.guess.map((digit, j) => {
                                                        const c = RESULT_COLORS[entry.result[j]] || RESULT_COLORS.red
                                                        return (
                                                            <div key={`eguess-${i}-${j}`} className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center bungee-font text-sm shadow-sm ${c.bg} ${c.border} ${c.text}`}>
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

// ── PlayerCard ───────────────────────────────────────────────────
const PlayerCard = ({ player, isTarget, isEliminated, isMe, receivedGuesses = [], onOpenHistory }) => {
    const latestReceived = receivedGuesses.length > 0 ? receivedGuesses[receivedGuesses.length - 1] : null
    const isOffline = player.disconnected

    return (
        <div className={`
            relative flex flex-col rounded-2xl border-4 overflow-hidden transition-all duration-500
            w-48 md:w-64 flex-shrink-0 min-h-[120px] md:min-h-[130px] shadow-[0_4px_15px_rgba(0,0,0,0.1)]
            ${isOffline
                ? 'bg-gray-100/60 border-gray-200 opacity-50'
                : isEliminated
                    ? 'bg-gray-200/60 border-gray-300 opacity-60'
                    : isTarget
                        ? 'bg-white border-green-400 shadow-[0_0_20px_5px_rgba(74,222,128,0.6)] z-10 scale-[1.02] md:scale-[1.04]'
                        : 'bg-white/95 border-white shadow-xl'
            }
        `}>
            {/* Offline badge */}
            {isOffline && (
                <div className="absolute top-1 right-1 z-10 bg-red-500 text-white text-[9px] bungee-font px-1.5 py-0.5 rounded-full">OFFLINE</div>
            )}
            {/* Header */}
            <div className={`px-2 py-2 flex items-center gap-2 ${isOffline ? 'bg-gray-400/50' : isEliminated ? 'bg-gray-300/60' : isTarget ? 'bg-green-400' : 'bg-green-500'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white bungee-font text-[12px] flex-shrink-0 shadow-sm ${isOffline ? 'bg-gray-500' : isEliminated ? 'bg-gray-400' : 'bg-green-700'}`}>
                    {player.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`bungee-font text-sm truncate tracking-wide ${isEliminated || isOffline ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {player.name}
                        {isMe && <span className="opacity-80 text-[10px] ml-1">(you)</span>}
                    </p>
                </div>
                <button
                    onClick={() => onOpenHistory(player.id)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90 text-base ${isEliminated || isOffline ? 'opacity-40 cursor-default' : 'hover:bg-white/20 cursor-pointer'}`}
                    title="View History"
                >
                    📋
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col items-center justify-center px-1">
                {isOffline ? (
                    <span className="text-gray-400 bungee-font text-xs pb-1 tracking-widest">DISCONNECTED</span>
                ) : isEliminated ? (
                    <span className="text-gray-400 bungee-font text-xl pb-1">ELIMINATED</span>
                ) : isTarget ? (
                    <span className="text-green-500 bungee-font text-lg animate-pulse pb-1">TARGET</span>
                ) : latestReceived ? (
                    <div className="flex flex-col items-center pt-1">
                        <p className="text-gray-400 text-[10px] bungee-font tracking-widest mb-1.5 truncate max-w-[160px]">BY {latestReceived.guesserName}</p>
                        <div className="flex gap-1.5 pb-2">
                            {latestReceived.guess.map((digit, j) => {
                                const c = RESULT_COLORS[latestReceived.result[j]] || RESULT_COLORS.red
                                return (
                                    <div key={`pguess-${j}`} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg border-2 flex items-center justify-center bungee-font text-sm shadow-sm ${c.bg} ${c.border} ${c.text}`}>
                                        {digit}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400/70 bungee-font text-xs pb-1 tracking-widest">NO GUESSES YET</p>
                )}
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
                    className={`h-full rounded-full transition-all ${urgent ? 'bg-red-400 animate-pulse' : 'bg-white'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`bungee-font text-sm ${urgent ? 'text-red-300 animate-pulse' : 'text-white'} w-8 text-right`}>
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
    const isHost = gameData?.isHost || false
    const [digitCount, setDigitCount] = useState(gameData?.digitCount || 4)

    // ── Game state ───────────────────────────────────────────────
    const [allPlayers, setAllPlayers] = useState(gameData?.players || [])
    const [isRevealing, setIsRevealing] = useState(true)
    const [phase, setPhase] = useState('waiting') // 'waiting' | 'guessing' | 'results' | 'gameover'
    const [currentTargetId, setCurrentTargetId] = useState(null)
    const [currentTargetName, setCurrentTargetName] = useState('')
    const [roundNumber, setRoundNumber] = useState(0)
    const [expiresAt, setExpiresAt] = useState(null)
    const [activePlayers, setActivePlayers] = useState((gameData?.players || []).map(p => p.id))
    const [guessHistory, setGuessHistory] = useState({})  // { playerId: [{guess, result, targetName, round}] }
    const [roundResults, setRoundResults] = useState(null)
    const [winner, setWinner] = useState(null)
    const [submittedIds, setSubmittedIds] = useState([])
    const [totalGuessers, setTotalGuessers] = useState(0)

    // ── Modals & Input ──────────────────────────────────────────
    const [currentGuess, setCurrentGuess] = useState([])
    const [submitted, setSubmitted] = useState(false)
    const [exitConfirm, setExitConfirm] = useState(false)

    // Clear saved room & exit (voluntary leave)
    const handleLeave = () => {
        localStorage.removeItem(LAST_ROOM_KEY)
        onExit()
    }
    const [historyPlayerId, setHistoryPlayerId] = useState(null) // Which player's history to show

    // ── Cloud reveal ─────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setIsRevealing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    // ── Socket listeners ─────────────────────────────────────────
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

        // Player joined / disconnected / reconnected — update the player roster
        socket.on('player-status-changed', ({ players }) => {
            setAllPlayers(players)
        })

        // Full state sync — sent when this client reconnects mid-game
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

    // ── Guess input handlers ─────────────────────────────────────
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

    // ── Layout helpers ───────────────────────────────────────────
    const gamePlayers = allPlayers.filter(p => !p.spectator)
    const spectators = allPlayers.filter(p => p.spectator)
    const leftPlayers = gamePlayers.filter((_, i) => i % 2 === 0)
    const rightPlayers = gamePlayers.filter((_, i) => i % 2 !== 0)

    const isEliminated = (id) => !activePlayers.includes(id)
    const amTarget = currentTargetId === myId

    // Build a reverse map: receivedGuesses[targetId] = [{guesserName, guess, result, round}]
    const receivedGuesses = Object.entries(guessHistory).reduce((acc, [guesserSocketId, entries]) => {
        const guesserPlayer = allPlayers.find(p => p.id === guesserSocketId)
        const guesserName = guesserPlayer?.name || 'Unknown'
        entries.forEach(entry => {
            if (!acc[entry.targetId]) acc[entry.targetId] = []
            acc[entry.targetId].push({ guesserName, guess: entry.guess, result: entry.result, round: entry.round })
        })
        return acc
    }, {})

    const historyModalPlayer = historyPlayerId ? allPlayers.find(p => p.id === historyPlayerId) : null

    // ── Render ───────────────────────────────────────────────────
    return (
        <div className='bg-[#4CAF50] h-[100dvh] w-screen relative overflow-hidden flex flex-col'>

            {/* History Modal — shows guesses others made ABOUT this player */}
            {historyModalPlayer && (
                <HistoryModal
                    player={historyModalPlayer}
                    history={receivedGuesses[historyPlayerId] || []}
                    onClose={() => setHistoryPlayerId(null)}
                    isMe={historyPlayerId === myId}
                />
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

            {/* Exit confirm */}
            {exitConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
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
            <div className="absolute top-20 left-0 animate-float opacity-15 pointer-events-none"><Cloud width={200} height={100} /></div>
            <div className="absolute bottom-10 right-0 animate-float opacity-15 pointer-events-none" style={{ animationDelay: '3s' }}><Cloud width={250} height={120} /></div>

            {/* Room code badge — top-left */}
            {gameData?.roomCode && (
                <div className={`absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5 transition-all ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>
                    <span className="text-white/60 bungee-font text-[9px] tracking-widest">ROOM</span>
                    <span className="text-white bungee-font text-sm tracking-widest">{gameData.roomCode}</span>
                </div>
            )}

            {/* Exit button */}
            <button onClick={() => setExitConfirm(true)}
                className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-red-400/80 border-2 border-white/30 text-white bungee-font text-sm transition-all z-10 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>
                ✕
            </button>


            {/* ══ GAME OVER SCREEN ══ */}
            {phase === 'gameover' && winner && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 z-10">
                    <div className="text-center">
                        <p className="text-white/70 bungee-font text-sm tracking-widest">GAME OVER</p>
                        <h1 className="text-white bungee-font text-6xl drop-shadow-lg mt-2 px-4">
                            {winner.id === myId ? '🏆 YOU WIN!' : `🥇 ${winner.name} WINS!`}
                        </h1>
                    </div>
                    <button onClick={handleLeave}
                        className="py-5 px-10 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all">
                        BACK TO MENU
                    </button>
                </div>
            )}

            {/* ══ MAIN GAME LAYOUT ══ */}
            {phase !== 'gameover' && (
                <div className={`flex-1 flex flex-col xl:flex-row gap-4 xl:gap-8 p-3 md:p-6 md:pt-16 xl:px-10 overflow-hidden transition-all duration-700 delay-500 z-10 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>

                    {/* ── LEFT PLAYERS (Top on Mobile) ── */}
                    <div className="flex flex-row xl:flex-col gap-3 md:gap-4 w-full xl:w-[350px] flex-shrink-0 overflow-x-auto xl:overflow-y-auto no-scrollbar md:pb-0 hide-scroll items-center xl:items-end px-2 md:px-0 pt-2 md:pt-0">
                        {leftPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                receivedGuesses={receivedGuesses[p.id] || []}
                                onOpenHistory={setHistoryPlayerId}
                            />
                        ))}
                    </div>

                    {/* ── CENTER ── */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 min-w-0 py-2 md:py-0 overflow-y-auto md:overflow-visible">

                        {/* Round info + Timer */}
                        {phase === 'guessing' && (
                            <div className="w-full max-w-md px-4">
                                <div className="text-center mb-3">
                                    <p className="text-white/60 bungee-font text-xs tracking-widest">ROUND {roundNumber}</p>
                                    <p className="text-white bungee-font text-2xl md:text-3xl drop-shadow">
                                        GUESSING <span className="text-yellow-300">{currentTargetName}</span>'S CODE
                                    </p>
                                    <p className="text-white/50 bungee-font text-xs mt-1">
                                        {submittedIds.length}/{totalGuessers} submitted
                                    </p>
                                </div>
                                {expiresAt && <TimerBar expiresAt={expiresAt} />}
                            </div>
                        )}

                        {/* Waiting */}
                        {phase === 'waiting' && (
                            <div className="text-center px-4">
                                <p className="text-white bungee-font text-xl md:text-2xl drop-shadow">⏳ STARTING ROUND...</p>
                                <p className="text-white/60 bungee-font text-sm mt-1">Get ready!</p>
                            </div>
                        )}

                        {/* Round results summary */}
                        {phase === 'results' && roundResults && (
                            <div className="w-full max-w-sm bg-white/95 rounded-3xl p-5 shadow-2xl mx-4">
                                <p className="text-green-700 bungee-font text-xs tracking-widest mb-3 text-center">ROUND {roundNumber} RESULTS</p>
                                {roundResults.targetEliminated && (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-2 text-center mb-3">
                                        <p className="text-red-500 bungee-font text-sm">💥 {roundResults.targetName} OUT!</p>
                                    </div>
                                )}
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                    {roundResults.results.map((r, i) => (
                                        <div key={r.guesserSocketId || `row-${i}`} className="flex items-center gap-2 justify-between pl-1">
                                            <span className="text-green-800 bungee-font text-xs md:text-sm truncate max-w-[80px]">{r.guesserName}</span>
                                            <div className="flex gap-1">
                                                {r.guess.map((d, j) => {
                                                    const c = RESULT_COLORS[r.result[j]]
                                                    return <div key={`rcell-${i}-${j}`} className={`w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg border-2 flex items-center justify-center bungee-font text-xs md:text-sm ${c.bg} ${c.border} ${c.text}`}>{d}</div>
                                                })}
                                            </div>
                                            {r.correct ? <span className="text-green-500 text-sm">✅</span> : <span className="w-4"></span>}
                                        </div>
                                    ))}
                                    {roundResults.results.length === 0 && <p className="text-gray-400 text-xs text-center">No guesses submitted.</p>}
                                </div>
                                <p className="text-green-400 bungee-font text-[10px] md:text-xs text-center mt-3">Next round starting...</p>
                            </div>
                        )}

                        {/* ── Spectator banner ── */}
                        {isSpectator && phase === 'guessing' && (
                            <div className="bg-white/20 backdrop-blur-md rounded-3xl p-4 text-center border-2 border-white/30 mx-4">
                                <p className="text-white bungee-font text-sm">👁 SPECTATING</p>
                                <p className="text-white/60 bungee-font text-xs mt-1">You joined mid-game</p>
                            </div>
                        )}

                        {/* ── Guess Input ── */}
                        {!isSpectator && phase === 'guessing' && (
                            amTarget ? (
                                /* You're being guessed */
                                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-6 md:p-8 text-center border-4 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.4)] mx-4">
                                    <p className="text-yellow-300 bungee-font text-2xl md:text-3xl drop-shadow mb-1 md:mb-2">🎯 YOU'RE THE TARGET!</p>
                                    <p className="text-white bungee-font text-xs md:text-sm">Others are trying to guess your code...</p>
                                </div>
                            ) : submitted ? (
                                /* Submitted, waiting */
                                <div className="bg-white/95 rounded-3xl p-5 md:p-6 text-center shadow-2xl w-full max-w-sm mx-4">
                                    <p className="text-green-600 bungee-font text-lg md:text-xl mb-3">✅ GUESS SUBMITTED!</p>
                                    <div className={`flex gap-1.5 justify-center ${currentGuess.length >= 7 ? 'gap-1' : ''}`}>
                                        {currentGuess.map((d, i) => (
                                            <div key={`sub-${i}`} className={`${digitCount <= 5 ? 'w-10 h-12' : digitCount === 6 ? 'w-8 h-10' : 'w-7 h-9'} bg-green-100 rounded-xl border-2 border-green-300 flex items-center justify-center text-green-800 bungee-font text-xl`}>{d}</div>
                                        ))}
                                    </div>
                                    <p className="text-green-400 bungee-font text-[10px] md:text-xs mt-4">Waiting for others...</p>
                                </div>
                            ) : (
                                /* Input */
                                <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-4 md:p-5 shadow-2xl w-full max-w-sm flex flex-col gap-3 mx-4">
                                    {/* Digit slots — responsive: shrink for 6+ digits */}
                                    <div className={`flex gap-1.5 justify-center ${digitCount >= 7 ? 'gap-1' : 'gap-2'}`}>
                                        {Array.from({ length: digitCount }).map((_, i) => (
                                            <div key={`digit-${i}`} className={`
                                                rounded-xl border-4 flex items-center justify-center bungee-font transition-all shadow-inner
                                                ${digitCount <= 5 ? 'w-14 h-16 md:w-16 text-3xl' : digitCount === 6 ? 'w-11 h-14 md:w-12 text-2xl' : 'w-9 h-12 md:w-11 text-xl'}
                                                ${currentGuess[i] !== undefined
                                                    ? 'bg-green-50 border-green-400 text-green-800'
                                                    : 'bg-gray-50 border-gray-200 text-gray-300'
                                                }`}>
                                                {currentGuess[i] ?? '?'}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Numpad */}
                                    <div className="grid grid-cols-5 gap-1 md:gap-1.5 px-1">
                                        {[1,2,3,4,5,6,7,8,9,0].map(n => (
                                            <button key={n} onClick={() => addDigit(n)}
                                                disabled={currentGuess.length >= digitCount}
                                                className="aspect-square rounded-xl bg-green-400 hover:bg-green-500 active:bg-green-600 text-white bungee-font text-lg md:text-xl transition-all active:scale-90 shadow-[0_3px_0_0_#2e7d32] active:shadow-none active:translate-y-0.5 disabled:opacity-40">
                                                {n}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Backspace + Submit */}
                                    <div className="flex gap-2 px-1">
                                        <button onClick={removeDigit} disabled={currentGuess.length === 0}
                                            className="w-1/3 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 bungee-font text-xl md:text-2xl transition-all disabled:opacity-40">
                                            ⌫
                                        </button>
                                        <button onClick={submitGuess} disabled={currentGuess.length !== digitCount}
                                            className="flex-1 py-4 rounded-xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-sm md:text-base shadow-[0_3px_0_0_#FFA000] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
                                            ✅ SUBMIT
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* ── Spectators strip ── */}
                    {spectators.length > 0 && (
                        <div className="hidden xl:flex absolute bottom-3 left-1/2 -translate-x-1/2 items-center gap-2 bg-black/20 backdrop-blur-sm rounded-full px-4 py-1.5 z-10">
                            <span className="text-white/60 bungee-font text-[10px] tracking-widest">👁 WATCHING:</span>
                            {spectators.map(s => (
                                <span key={s.id} className="text-white/80 bungee-font text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{s.name}</span>
                            ))}
                        </div>
                    )}

                    {/* ── RIGHT PLAYERS (Bottom on Mobile) ── */}
                    <div className="flex flex-row xl:flex-col gap-3 md:gap-4 w-full xl:w-[350px] flex-shrink-0 overflow-x-auto xl:overflow-y-auto no-scrollbar xl:pt-0 hide-scroll items-center xl:items-start px-2 md:px-0 pb-2 md:pb-0">
                        {rightPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                receivedGuesses={receivedGuesses[p.id] || []}
                                onOpenHistory={setHistoryPlayerId}
                            />
                        ))}
                    </div>

                </div>
            )}
            
            {/* Scrollbar hiding handled via .hide-scroll in App.css */}
        </div>
    )
}

export default GameScreen