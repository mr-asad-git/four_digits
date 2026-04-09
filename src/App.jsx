import React, { useState } from 'react'
import IntScreen from './pages/IntScreen'
import HostLobby from './pages/HostLobby'
import JoinLobby from './pages/JoinLobby'
import GameScreen from './pages/GameScreen'
import GlobalCloudTransition from './components/GlobalCloudTransition'
import './App.css'

// Screens: 'intro' | 'host-lobby' | 'join-lobby' | 'game'
const App = () => {
    const [screen, setScreen] = useState('intro')
    const [userName, setUserName] = useState('')
    const [gameData, setGameData] = useState(null)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const triggerTransition = (callback) => {
        setIsTransitioning(true)
        // Wait for clouds to fully cover the screen before switching
        setTimeout(() => {
            callback()
        }, 1200)
        // Wait for animation to finish before removing the transition component
        setTimeout(() => {
            setIsTransitioning(false)
        }, 3000)
    }

    const handleStart = (name, action) => {
        setUserName(name)
        triggerTransition(() => {
            if (action === 'create') {
                setScreen('host-lobby')
            } else {
                setScreen('join-lobby')
            }
        })
    }

    const handleGameStart = (data) => {
        setGameData(data)
        triggerTransition(() => {
            setScreen('game')
        })
    }

    const handleExit = () => {
        triggerTransition(() => {
            setScreen('intro')
            setUserName('')
            setGameData(null)
        })
    }

    return (
        <div className="app-container">
            <GlobalCloudTransition isAnimating={isTransitioning} />
            {screen === 'intro' && (
                <IntScreen onStart={handleStart} />
            )}
            {screen === 'host-lobby' && (
                <HostLobby userName={userName} onGameStart={handleGameStart} onExit={handleExit} />
            )}
            {screen === 'join-lobby' && (
                <JoinLobby userName={userName} onGameStart={handleGameStart} onExit={handleExit} />
            )}
            {screen === 'game' && (
                <GameScreen userName={userName} gameData={gameData} onExit={handleExit} />
            )}
        </div>
    )
}

export default App