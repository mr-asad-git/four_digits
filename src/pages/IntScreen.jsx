import React, { useState } from 'react'
import Cloud from '../components/Cloud'

const IntScreen = ({ onStart }) => {
    const [name, setName] = useState('')
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [pendingAction, setPendingAction] = useState(null)

    const handleAction = (action) => {
        if (!name.trim()) return
        setPendingAction(action)
        setIsTransitioning(true)
        setTimeout(() => {
            onStart(name.trim(), action)
        }, 1300)
    }

    return (
        <div className='bg-[#4CAF50] h-screen w-screen relative overflow-hidden flex justify-center items-center'>

            {/* Floating BG Clouds */}
            <div className="absolute top-8 left-8 animate-float opacity-60">
                <Cloud width={320} height={160} />
            </div>
            <div className="absolute top-36 right-12 animate-float opacity-40" style={{ animationDelay: '2s' }}>
                <Cloud width={260} height={130} />
            </div>
            <div className="absolute bottom-16 left-[18%] animate-float opacity-50" style={{ animationDelay: '4s' }}>
                <Cloud width={380} height={190} />
            </div>
            <div className="absolute bottom-40 right-[10%] animate-float opacity-30" style={{ animationDelay: '1s' }}>
                <Cloud width={220} height={110} />
            </div>

            {/* Card */}
            <div className={`relative flex flex-col items-center transition-all duration-700 ${isTransitioning ? 'opacity-0 scale-90 -translate-y-8' : 'opacity-100 scale-100 translate-y-0'}`}>
                <h1 className='bungee-font text-white drop-shadow-2xl mb-2' style={{ fontSize: 'clamp(60px, 10vw, 100px)', lineHeight: 1 }}>
                    4 DIGITS
                </h1>
                <p className='text-white/70 bungee-font text-sm tracking-widest mb-8'>MULTIPLAYER FUN GAME</p>

                <div className="w-[400px] bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border-b-8 border-green-700/30 flex flex-col gap-5">
                    {/* Name input */}
                    <div>
                        <label className="text-green-700 bungee-font text-xs tracking-widest block mb-2">YOUR NAME</label>
                        <input
                            className='w-full p-4 rounded-2xl border-2 border-green-100 focus:border-green-400 outline-none transition-all text-lg font-bold text-green-900 bg-white'
                            type="text"
                            placeholder='Type your name...'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAction('create')}
                            maxLength={16}
                        />
                    </div>

                    {/* Create Game */}
                    <button
                        onClick={() => handleAction('create')}
                        disabled={isTransitioning}
                        className='w-full py-5 rounded-2xl bg-[#FFC107] hover:bg-[#FFB300] active:bg-[#FFA000] text-[#5D4037] bungee-font text-2xl shadow-[0_6px_0_0_#FFA000] active:shadow-none active:translate-y-1.5 transition-all disabled:opacity-50'
                    >
                        🎮 CREATE GAME
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-green-200" />
                        <span className="text-green-400 bungee-font text-xs">OR</span>
                        <div className="flex-1 h-px bg-green-200" />
                    </div>

                    {/* Join Game */}
                    <button
                        onClick={() => handleAction('join')}
                        disabled={isTransitioning}
                        className='w-full py-5 rounded-2xl bg-white hover:bg-green-50 active:bg-green-100 text-green-700 bungee-font text-2xl border-4 border-green-200 shadow-[0_6px_0_0_#a7d7a7] active:shadow-none active:translate-y-1.5 transition-all disabled:opacity-50'
                    >
                        🔗 FIND ROOM
                    </button>
                </div>
            </div>

            {/* Transition Overlay */}
            {isTransitioning && (
                <div className="cloud-transition-overlay">
                    {[...Array(16)].map((_, i) => (
                        <div
                            key={i}
                            className="transition-cloud animate-rise"
                            style={{
                                left: `${(i % 4) * 28 - 10}%`,
                                bottom: `-${Math.floor(i / 4) * 28 + 20}vh`,
                                animationDelay: `${(i % 4) * 0.08 + Math.floor(i / 4) * 0.18}s`,
                                width: `${380 + (i * 37) % 300}px`,
                                zIndex: 100 + i,
                            }}
                        >
                            <Cloud width="100%" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default IntScreen