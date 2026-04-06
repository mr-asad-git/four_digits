import React, { useEffect, useRef, useState, useCallback } from 'react'
import Cloud from '../components/Cloud'

const CLOUD_WIDTHS = Array.from({ length: 16 }, (_, i) => 380 + (i * 41) % 320)

// ── Colour helpers ───────────────────────────────────────────────
const RESULT_COLORS = {
    green:  { bg: 'bg-green-400',  border: 'border-green-600',  text: 'text-white' },
    yellow: { bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'text-gray-900' },
    red:    { bg: 'bg-red-400',    border: 'border-red-600',    text: 'text-white' },
}

// ── PlayerCard ───────────────────────────────────────────────────
const PlayerCard = ({ player, isTarget, isEliminated, isMe, guessHistory = [] }) => {
    return (
        <div className={`
            flex flex-col rounded-2xl border-4 overflow-hidden transition-all duration-500 flex-1
            ${isEliminated
                ? 'bg-gray-200/60 border-gray-300 opacity-60'
                : isTarget
                    ? 'bg-white border-green-400 shadow-[0_0_30px_8px_rgba(74,222,128,0.6)] scale-[1.02]'
                    : 'bg-white/80 border-white/30'
            }
        `}>
            {/* Header */}
            <div className={`px-3 py-2 flex items-center gap-2 ${isEliminated ? 'bg-gray-300/60' : isTarget ? 'bg-green-400' : 'bg-green-500/80'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white bungee-font text-xs flex-shrink-0 ${isEliminated ? 'bg-gray-400' : 'bg-green-700'}`}>
                    {player.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`bungee-font text-sm truncate ${isEliminated ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {player.name}
                        {isMe && <span className="ml-1 text-white/70 text-xs">(you)</span>}
                    </p>
                </div>
                {isTarget && (
                    <span className="bg-white text-green-600 bungee-font text-xs px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">
                        TARGET
                    </span>
                )}
                {isEliminated && (
                    <span className="bg-gray-400 text-white bungee-font text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                        ✕ OUT
                    </span>
                )}
            </div>

            {/* Guess History */}
            <div className="flex-1 px-2 py-2 flex flex-col gap-1 overflow-y-auto max-h-40 min-h-16">
                {guessHistory.length === 0 && (
                    <p className="text-gray-400 bungee-font text-xs text-center mt-2">No guesses yet</p>
                )}
                {guessHistory.map((entry, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                        <p className="text-gray-400 text-xs truncate">vs {entry.targetName}</p>
                        <div className="flex gap-1">
                            {entry.guess.map((digit, j) => {
                                const c = RESULT_COLORS[entry.result[j]] || RESULT_COLORS.red
                                return (
                                    <div key={j} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center bungee-font text-sm ${c.bg} ${c.border} ${c.text}`}>
                                        {digit}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
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

// ── Main GameScreen ──────────────────────────────────────────────
const GameScreen = ({ userName, gameData, onExit }) => {
    const socketRef = useRef(gameData?.socket)
    const myId = socketRef.current?.id

    const allPlayers = gameData?.players || []
    const isHost = gameData?.isHost || false

    // ── Game state ───────────────────────────────────────────────
    const [isRevealing, setIsRevealing] = useState(true)
    const [phase, setPhase] = useState('waiting') // 'waiting' | 'guessing' | 'results' | 'gameover'
    const [currentTargetId, setCurrentTargetId] = useState(null)
    const [currentTargetName, setCurrentTargetName] = useState('')
    const [roundNumber, setRoundNumber] = useState(0)
    const [expiresAt, setExpiresAt] = useState(null)
    const [activePlayers, setActivePlayers] = useState(allPlayers.map(p => p.id))
    const [guessHistory, setGuessHistory] = useState({})  // { playerId: [{guess, result, targetName, round}] }
    const [roundResults, setRoundResults] = useState(null)
    const [winner, setWinner] = useState(null)
    const [submittedIds, setSubmittedIds] = useState([])
    const [totalGuessers, setTotalGuessers] = useState(0)

    // ── Guess input state ────────────────────────────────────────
    const [currentGuess, setCurrentGuess] = useState([])
    const [submitted, setSubmitted] = useState(false)
    const [exitConfirm, setExitConfirm] = useState(false)

    // ── Cloud reveal ─────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setIsRevealing(false), 3000)
        return () => clearTimeout(t)
    }, [])

    // ── Socket listeners ─────────────────────────────────────────
    useEffect(() => {
        const socket = socketRef.current
        if (!socket) return

        socket.on('round-started', ({ targetId, targetName, roundNumber, expiresAt, activePlayers }) => {
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

        return () => {
            socket.off('round-started')
            socket.off('guess-made')
            socket.off('round-complete')
            socket.off('game-over')
        }
    }, [])

    // ── Guess input handlers ─────────────────────────────────────
    const addDigit = useCallback((n) => {
        if (currentGuess.length >= 4 || submitted) return
        setCurrentGuess(prev => [...prev, n])
    }, [currentGuess, submitted])

    const removeDigit = useCallback(() => {
        if (submitted) return
        setCurrentGuess(prev => prev.slice(0, -1))
    }, [submitted])

    const submitGuess = useCallback(() => {
        if (currentGuess.length !== 4 || submitted) return
        socketRef.current?.emit('submit-guess', { guess: currentGuess })
        setSubmitted(true)
    }, [currentGuess, submitted])

    // ── Layout helpers ───────────────────────────────────────────
    // Split players: left half and right half
    const leftPlayers = allPlayers.filter((_, i) => i % 2 === 0)
    const rightPlayers = allPlayers.filter((_, i) => i % 2 !== 0)

    const isEliminated = (id) => !activePlayers.includes(id)
    const amTarget = currentTargetId === myId

    // ── Render ───────────────────────────────────────────────────
    return (
        <div className='bg-[#4CAF50] h-screen w-screen relative overflow-hidden flex flex-col'>

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

            {/* Exit confirm */}
            {exitConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl border-b-8 border-green-700/30 w-72 flex flex-col items-center gap-6">
                        <p className="bungee-font text-green-800 text-xl text-center">LEAVE THE GAME?</p>
                        <div className="flex gap-4 w-full">
                            <button onClick={() => setExitConfirm(false)} className="flex-1 py-4 rounded-2xl bg-white border-4 border-green-200 text-green-600 bungee-font text-lg hover:bg-green-50 transition-all">NO</button>
                            <button onClick={onExit} className="flex-1 py-4 rounded-2xl bg-red-400 hover:bg-red-500 text-white bungee-font text-lg shadow-[0_4px_0_0_#b91c1c] active:shadow-none active:translate-y-1 transition-all">YES</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BG clouds */}
            <div className="absolute top-20 left-0 animate-float opacity-15 pointer-events-none"><Cloud width={200} height={100} /></div>
            <div className="absolute bottom-10 right-0 animate-float opacity-15 pointer-events-none" style={{ animationDelay: '3s' }}><Cloud width={250} height={120} /></div>

            {/* Exit button */}
            <button onClick={() => setExitConfirm(true)}
                className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-red-400/80 border-2 border-white/30 text-white bungee-font text-sm transition-all z-10 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>
                ✕
            </button>

            {/* ══ GAME OVER SCREEN ══ */}
            {phase === 'gameover' && winner && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="text-center">
                        <p className="text-white/70 bungee-font text-sm tracking-widest">GAME OVER</p>
                        <h1 className="text-white bungee-font text-6xl drop-shadow-lg mt-2">
                            {winner.id === myId ? '🏆 YOU WIN!' : `🥇 ${winner.name} WINS!`}
                        </h1>
                    </div>
                    <button onClick={onExit}
                        className="py-5 px-10 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-2xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all">
                        BACK TO MENU
                    </button>
                </div>
            )}

            {/* ══ MAIN GAME LAYOUT ══ */}
            {phase !== 'gameover' && (
                <div className={`flex-1 flex gap-3 p-4 overflow-hidden transition-all duration-700 delay-500 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>

                    {/* ── LEFT PLAYERS ── */}
                    <div className="flex flex-col gap-3 w-52 flex-shrink-0">
                        {leftPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                guessHistory={guessHistory[p.id] || []}
                            />
                        ))}
                    </div>

                    {/* ── CENTER ── */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 min-w-0">

                        {/* Round info + Timer */}
                        {phase === 'guessing' && (
                            <div className="w-full max-w-sm">
                                <div className="text-center mb-3">
                                    <p className="text-white/60 bungee-font text-xs tracking-widest">ROUND {roundNumber}</p>
                                    <p className="text-white bungee-font text-2xl drop-shadow">
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
                            <div className="text-center">
                                <p className="text-white bungee-font text-2xl">⏳ STARTING ROUND...</p>
                                <p className="text-white/60 bungee-font text-sm mt-2">Get ready!</p>
                            </div>
                        )}

                        {/* Round results summary */}
                        {phase === 'results' && roundResults && (
                            <div className="w-full max-w-sm bg-white/90 rounded-3xl p-5 shadow-2xl">
                                <p className="text-green-700 bungee-font text-xs tracking-widest mb-3 text-center">ROUND {roundNumber} RESULTS</p>
                                {roundResults.targetEliminated && (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-2 text-center mb-3">
                                        <p className="text-red-600 bungee-font text-sm">💥 {roundResults.targetName} was ELIMINATED!</p>
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    {roundResults.results.map((r, i) => (
                                        <div key={i} className="flex items-center gap-2 justify-between">
                                            <span className="text-green-800 bungee-font text-sm truncate">{r.guesserName}</span>
                                            <div className="flex gap-1">
                                                {r.guess.map((d, j) => {
                                                    const c = RESULT_COLORS[r.result[j]]
                                                    return <div key={j} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center bungee-font text-sm ${c.bg} ${c.border} ${c.text}`}>{d}</div>
                                                })}
                                            </div>
                                            {r.correct && <span className="text-green-500 text-lg">✅</span>}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-green-400 bungee-font text-xs text-center mt-3">Next round starting...</p>
                            </div>
                        )}

                        {/* ── Guess Input ── */}
                        {phase === 'guessing' && (
                            amTarget ? (
                                /* You're being guessed */
                                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 text-center border-4 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.4)]">
                                    <p className="text-yellow-300 bungee-font text-3xl drop-shadow mb-2">🎯 YOU'RE THE TARGET!</p>
                                    <p className="text-white bungee-font text-sm">Others are trying to guess your code...</p>
                                    <p className="text-white/50 bungee-font text-xs mt-3">{submittedIds.length}/{totalGuessers} have guessed</p>
                                </div>
                            ) : submitted ? (
                                /* Submitted, waiting */
                                <div className="bg-white/90 rounded-3xl p-6 text-center shadow-2xl w-full max-w-sm">
                                    <p className="text-green-600 bungee-font text-xl mb-2">✅ GUESS SUBMITTED!</p>
                                    <div className="flex gap-2 justify-center">
                                        {currentGuess.map((d, i) => (
                                            <div key={i} className="w-12 h-14 bg-green-100 rounded-2xl border-2 border-green-300 flex items-center justify-center text-green-800 bungee-font text-2xl">{d}</div>
                                        ))}
                                    </div>
                                    <p className="text-green-400 bungee-font text-xs mt-3">Waiting for others... ({submittedIds.length}/{totalGuessers})</p>
                                </div>
                            ) : (
                                /* Input */
                                <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-2xl w-full max-w-xs flex flex-col gap-4">
                                    {/* Digit slots */}
                                    <div className="flex gap-2 justify-center">
                                        {[0,1,2,3].map(i => (
                                            <div key={i} className={`w-14 h-16 rounded-2xl border-4 flex items-center justify-center bungee-font text-3xl transition-all ${
                                                currentGuess[i] !== undefined
                                                    ? 'bg-green-50 border-green-400 text-green-800'
                                                    : 'bg-gray-50 border-gray-200 text-gray-300'
                                            }`}>
                                                {currentGuess[i] ?? '?'}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Numpad */}
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {[1,2,3,4,5,6,7,8,9,0].map(n => (
                                            <button key={n} onClick={() => addDigit(n)}
                                                disabled={currentGuess.length >= 4}
                                                className="aspect-square rounded-xl bg-green-400 hover:bg-green-500 active:bg-green-600 text-white bungee-font text-xl transition-all active:scale-90 shadow-[0_3px_0_0_#2e7d32] active:shadow-none active:translate-y-0.5 disabled:opacity-40">
                                                {n}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Backspace + Submit */}
                                    <div className="flex gap-2">
                                        <button onClick={removeDigit} disabled={currentGuess.length === 0}
                                            className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 bungee-font text-sm transition-all disabled:opacity-40">
                                            ⌫
                                        </button>
                                        <button onClick={submitGuess} disabled={currentGuess.length !== 4}
                                            className="flex-1 py-3 rounded-xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-sm shadow-[0_3px_0_0_#FFA000] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
                                            ✅ SUBMIT
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* ── RIGHT PLAYERS ── */}
                    <div className="flex flex-col gap-3 w-52 flex-shrink-0">
                        {rightPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                guessHistory={guessHistory[p.id] || []}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default GameScreen