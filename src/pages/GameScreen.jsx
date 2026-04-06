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
const HistoryModal = ({ player, history, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl border-b-8 border-green-700/30 w-full max-w-sm flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="bungee-font text-green-800 text-lg">{player.name}'S HISTORY</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm transition-all focus:outline-none">✕</button>
                </div>
                
                <div className="flex flex-col overflow-y-auto pr-1">
                    {history.length === 0 && <p className="text-gray-400 bungee-font text-center py-6 text-sm">No guesses yet.</p>}
                    {history.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 border-2 border-gray-100 rounded-xl p-3 mb-2">
                            <div className="flex flex-col">
                                <span className="text-gray-400 text-[10px] bungee-font tracking-wider">RD {entry.round}</span>
                                <span className="text-green-700 text-xs font-bold truncate max-w-[90px]">vs {entry.targetName}</span>
                            </div>
                            <div className="flex gap-1.5">
                                {entry.guess.map((digit, j) => {
                                    const c = RESULT_COLORS[entry.result[j]] || RESULT_COLORS.red
                                    return (
                                        <div key={j} className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center bungee-font text-sm shadow-sm ${c.bg} ${c.border} ${c.text}`}>
                                            {digit}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── PlayerCard ───────────────────────────────────────────────────
const PlayerCard = ({ player, isTarget, isEliminated, isMe, guessHistory = [], onOpenHistory }) => {
    const latestGuess = guessHistory.length > 0 ? guessHistory[guessHistory.length - 1] : null

    return (
        <div className={`
            relative flex flex-col rounded-2xl border-4 overflow-hidden transition-all duration-500
            w-40 md:w-52 flex-shrink-0 h-[100px] md:h-auto
            ${isEliminated
                ? 'bg-gray-200/60 border-gray-300 opacity-60'
                : isTarget
                    ? 'bg-white border-green-400 shadow-[0_0_20px_5px_rgba(74,222,128,0.6)] md:scale-[1.02]'
                    : 'bg-white/80 border-white/30'
            }
        `}>
            {/* Header */}
            <div className={`px-2 py-1.5 flex items-center gap-1.5 ${isEliminated ? 'bg-gray-300/60' : isTarget ? 'bg-green-400' : 'bg-green-500/80'}`}>
                {/* History Button (Top Left exactly as requested) */}
                <button 
                    onClick={() => onOpenHistory(player.id)} 
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all active:scale-90 flex-shrink-0 ${isTarget ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white/20 hover:bg-white/40 text-white'}`}
                    title="View History"
                >
                    📜
                </button>

                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white bungee-font text-[10px] flex-shrink-0 ${isEliminated ? 'bg-gray-400' : 'bg-green-700'}`}>
                    {player.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`bungee-font text-xs truncate ${isEliminated ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {player.name}
                        {isMe && <span className="opacity-70 text-[10px] ml-1">(you)</span>}
                    </p>
                </div>
            </div>

            {/* Recent Guess Only */}
            <div className="flex-1 flex flex-col items-center justify-center px-1">
                {isEliminated ? (
                    <span className="text-gray-400 bungee-font text-lg">ELIMINATED</span>
                ) : isTarget ? (
                    <span className="text-green-500 bungee-font animate-pulse">TARGET</span>
                ) : latestGuess ? (
                    <div className="flex flex-col items-center">
                        <p className="text-gray-400 text-[9px] bungee-font tracking-widest mb-1">LATEST vs {latestGuess.targetName}</p>
                        <div className="flex gap-1">
                            {latestGuess.guess.map((digit, j) => {
                                const c = RESULT_COLORS[latestGuess.result[j]] || RESULT_COLORS.red
                                return (
                                    <div key={j} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center bungee-font text-xs ${c.bg} ${c.border} ${c.text}`}>
                                        {digit}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400/60 bungee-font text-[10px]">NO GUESSES YET</p>
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

    // ── Modals & Input ──────────────────────────────────────────
    const [currentGuess, setCurrentGuess] = useState([])
    const [submitted, setSubmitted] = useState(false)
    const [exitConfirm, setExitConfirm] = useState(false)
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
    
    const historyModalPlayer = historyPlayerId ? allPlayers.find(p => p.id === historyPlayerId) : null

    // ── Render ───────────────────────────────────────────────────
    return (
        <div className='bg-[#4CAF50] h-[100dvh] w-screen relative overflow-hidden flex flex-col'>

            {/* History Modal */}
            {historyModalPlayer && (
                <HistoryModal 
                    player={historyModalPlayer} 
                    history={guessHistory[historyPlayerId] || []} 
                    onClose={() => setHistoryPlayerId(null)} 
                />
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
                <div className="flex-1 flex flex-col items-center justify-center gap-6 z-10">
                    <div className="text-center">
                        <p className="text-white/70 bungee-font text-sm tracking-widest">GAME OVER</p>
                        <h1 className="text-white bungee-font text-6xl drop-shadow-lg mt-2 px-4">
                            {winner.id === myId ? '🏆 YOU WIN!' : `🥇 ${winner.name} WINS!`}
                        </h1>
                    </div>
                    <button onClick={onExit}
                        className="py-5 px-10 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all">
                        BACK TO MENU
                    </button>
                </div>
            )}

            {/* ══ MAIN GAME LAYOUT ══ */}
            {phase !== 'gameover' && (
                <div className={`flex-1 flex flex-col md:flex-row gap-2 md:gap-4 p-2 md:p-6 overflow-hidden transition-all duration-700 delay-500 z-10 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>

                    {/* ── LEFT PLAYERS (Top on Mobile) ── */}
                    <div className="flex flex-row md:flex-col gap-2 md:gap-3 w-full md:w-52 flex-shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar md:pb-0 hide-scroll">
                        {leftPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                guessHistory={guessHistory[p.id] || []}
                                onOpenHistory={setHistoryPlayerId}
                            />
                        ))}
                    </div>

                    {/* ── CENTER ── */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-4 min-w-0 py-2 md:py-0 overflow-y-auto md:overflow-visible">

                        {/* Round info + Timer */}
                        {phase === 'guessing' && (
                            <div className="w-full max-w-sm px-4">
                                <div className="text-center mb-2">
                                    <p className="text-white/60 bungee-font text-[10px] md:text-xs tracking-widest">ROUND {roundNumber}</p>
                                    <p className="text-white bungee-font text-xl md:text-2xl drop-shadow">
                                        GUESSING <span className="text-yellow-300">{currentTargetName}</span>'S CODE
                                    </p>
                                    <p className="text-white/50 bungee-font text-xs mt-0.5">
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
                                        <div key={i} className="flex items-center gap-2 justify-between pl-1">
                                            <span className="text-green-800 bungee-font text-xs md:text-sm truncate max-w-[80px]">{r.guesserName}</span>
                                            <div className="flex gap-1">
                                                {r.guess.map((d, j) => {
                                                    const c = RESULT_COLORS[r.result[j]]
                                                    return <div key={j} className={`w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg border-2 flex items-center justify-center bungee-font text-xs md:text-sm ${c.bg} ${c.border} ${c.text}`}>{d}</div>
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

                        {/* ── Guess Input ── */}
                        {phase === 'guessing' && (
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
                                    <div className="flex gap-2 justify-center">
                                        {currentGuess.map((d, i) => (
                                            <div key={i} className="w-10 h-12 md:w-12 md:h-14 bg-green-100 rounded-2xl border-2 border-green-300 flex items-center justify-center text-green-800 bungee-font text-xl md:text-2xl">{d}</div>
                                        ))}
                                    </div>
                                    <p className="text-green-400 bungee-font text-[10px] md:text-xs mt-4">Waiting for others...</p>
                                </div>
                            ) : (
                                /* Input */
                                <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-4 md:p-5 shadow-2xl w-full max-w-xs flex flex-col gap-3 md:gap-4 mx-4">
                                    {/* Digit slots */}
                                    <div className="flex gap-1.5 md:gap-2 justify-center">
                                        {[0,1,2,3].map(i => (
                                            <div key={i} className={`w-12 h-14 md:w-14 md:h-16 rounded-2xl border-4 flex items-center justify-center bungee-font text-2xl md:text-3xl transition-all ${
                                                currentGuess[i] !== undefined
                                                    ? 'bg-green-50 border-green-400 text-green-800'
                                                    : 'bg-gray-50 border-gray-200 text-gray-300'
                                            }`}>
                                                {currentGuess[i] ?? '?'}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Numpad */}
                                    <div className="grid grid-cols-5 gap-1 md:gap-1.5 px-2">
                                        {[1,2,3,4,5,6,7,8,9,0].map(n => (
                                            <button key={n} onClick={() => addDigit(n)}
                                                disabled={currentGuess.length >= 4}
                                                className="aspect-[4/3] md:aspect-square rounded-xl bg-green-400 hover:bg-green-500 active:bg-green-600 text-white bungee-font text-lg md:text-xl transition-all active:scale-90 shadow-[0_3px_0_0_#2e7d32] active:shadow-none active:translate-y-0.5 disabled:opacity-40">
                                                {n}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Backspace + Submit */}
                                    <div className="flex gap-2 px-2 pb-1">
                                        <button onClick={removeDigit} disabled={currentGuess.length === 0}
                                            className="w-1/3 py-2.5 md:py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 bungee-font text-xs md:text-sm transition-all disabled:opacity-40">
                                            ⌫
                                        </button>
                                        <button onClick={submitGuess} disabled={currentGuess.length !== 4}
                                            className="flex-1 py-2.5 md:py-3 rounded-xl bg-[#FFC107] hover:bg-[#FFB300] text-[#5D4037] bungee-font text-xs md:text-sm shadow-[0_3px_0_0_#FFA000] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50">
                                            ✅ SUBMIT
                                        </button>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* ── RIGHT PLAYERS (Bottom on Mobile) ── */}
                    <div className="flex flex-row md:flex-col gap-2 md:gap-3 w-full md:w-52 flex-shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar md:pt-0 hide-scroll">
                        {rightPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                isTarget={p.id === currentTargetId}
                                isEliminated={isEliminated(p.id)}
                                isMe={p.id === myId}
                                guessHistory={guessHistory[p.id] || []}
                                onOpenHistory={setHistoryPlayerId}
                            />
                        ))}
                    </div>

                </div>
            )}
            
            {/* Inject small style for hiding scrollbars on mobile lists */}
            <style jsx="true">{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}

export default GameScreen