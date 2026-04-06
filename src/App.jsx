import React, { useState } from 'react'
import IntScreen from './pages/IntScreen'
import HostLobby from './pages/HostLobby'
import JoinLobby from './pages/JoinLobby'
import GameScreen from './pages/GameScreen'
import './App.css'

// Screens: 'intro' | 'host-lobby' | 'join-lobby' | 'game'
const App = () => {
    const [screen, setScreen] = useState('intro')
    const [userName, setUserName] = useState('')
    const [gameData, setGameData] = useState(null) // { players, roomCode, socket }

    const handleStart = (name, action) => {
        setUserName(name)
        if (action === 'create') {
            setScreen('host-lobby')
        } else {
            setScreen('join-lobby')
        }
    }

    const handleGameStart = (data) => {
        setGameData(data)
        setScreen('game')
    }

    const handleExit = () => {
        setScreen('intro')
        setUserName('')
        setGameData(null)
    }

    return (
        <div className="app-container">
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