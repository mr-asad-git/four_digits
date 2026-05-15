import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// ── Game State ───────────────────────────────────────────────────
// rooms = { [code]: { 
//   hostId, players: [{id, name, ready, digits, spectator, disconnected}], 
//   digitCount, password, phase, currentTargetId, roundNumber, expiresAt, activePlayers, 
//   guessHistory, timer 
// } }
const rooms = {};

// ── Helpers ──────────────────────────────────────────────────────
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function calculateResult(guess, secret) {
    const result = [];
    const secretCopy = [...secret];
    const guessCopy = [...guess];

    // First pass: Green
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === secret[i]) {
            result[i] = 'green';
            secretCopy[i] = null;
            guessCopy[i] = null;
        }
    }

    // Second pass: Yellow/Red
    for (let i = 0; i < guess.length; i++) {
        if (guessCopy[i] === null) continue;
        
        const foundIdx = secretCopy.indexOf(guessCopy[i]);
        if (foundIdx !== -1) {
            result[i] = 'yellow';
            secretCopy[foundIdx] = null;
        } else {
            result[i] = 'red';
        }
    }
    return result;
}

// ── Socket Handlers ──────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ playerName }, callback) => {
        let code = generateRoomCode();
        while (rooms[code]) code = generateRoomCode();

        rooms[code] = {
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName, ready: false, digits: null, spectator: false, disconnected: false }],
            digitCount: 4,
            password: null,
            phase: 'lobby',
            currentTargetId: null,
            roundNumber: 0,
            activePlayers: [],
            guessHistory: {},
            timer: null
        };

        socket.join(code);
        callback({
            success: true,
            roomCode: code,
            ip: getLocalIP(),
            players: rooms[code].players
        });
    });

    socket.on('get-rooms', (callback) => {
        const available = Object.entries(rooms)
            .filter(([_, r]) => r.phase === 'lobby')
            .map(([code, r]) => ({
                code,
                hostName: r.players[0]?.name || 'Unknown',
                playerCount: r.players.length,
                maxPlayers: 8,
                digitCount: r.digitCount,
                hasPassword: !!r.password,
                isFull: r.players.length >= 8
            }));
        callback({ rooms: available });
    });

    socket.on('join-room', ({ roomCode, playerName, password }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, error: 'Room not found.' });

        if (room.password && room.password !== password) {
            return callback({ success: false, error: 'Incorrect password.' });
        }

        if (room.players.length >= 8 && !room.players.find(p => p.id === socket.id)) {
            return callback({ success: false, error: 'Room is full.' });
        }

        let player = room.players.find(p => p.id === socket.id);
        if (player) {
            // Rejoin
            player.disconnected = false;
            socket.join(roomCode);
            io.to(roomCode).emit('player-status-changed', { players: room.players });
            return callback({
                success: true,
                rejoined: true,
                players: room.players,
                digitCount: room.digitCount,
                isHost: room.hostId === socket.id
            });
        }

        // New Join
        const isSpectator = room.phase !== 'lobby';
        player = { id: socket.id, name: playerName, ready: false, digits: null, spectator: isSpectator, disconnected: false };
        room.players.push(player);
        socket.join(roomCode);

        callback({
            success: true,
            spectator: isSpectator,
            players: room.players,
            digitCount: room.digitCount,
            isHost: false
        });

        io.to(roomCode).emit('player-joined', { players: room.players });
    });

    socket.on('set-room-settings', ({ digitCount, password }, callback) => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return callback({ success: false, error: 'Unauthorized.' });
        if (room.players.some(p => p.ready)) return callback({ success: false, error: 'Cannot change settings when players are ready.' });

        room.digitCount = digitCount;
        room.password = password;
        callback({ success: true });
        io.to(roomCode).emit('lobby-update', { players: room.players });
    });

    socket.on('player-ready', ({ digits }) => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = true;
            player.digits = digits;
            io.to(roomCode).emit('lobby-update', { players: room.players });
        }
    });

    socket.on('kick-player', ({ targetId }) => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        const targetSocket = io.sockets.sockets.get(targetId);
        if (targetSocket) {
            targetSocket.emit('kicked', { reason: 'You were kicked by the host.' });
            targetSocket.leave(roomCode);
        }
        room.players = room.players.filter(p => p.id !== targetId);
        io.to(roomCode).emit('lobby-update', { players: room.players });
    });

    socket.on('start-game', () => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        if (room.players.length < 2 || !room.players.every(p => p.ready)) return;

        room.phase = 'guessing';
        room.activePlayers = room.players.filter(p => !p.spectator).map(p => p.id);
        room.roundNumber = 0;
        room.guessHistory = {};
        
        io.to(roomCode).emit('game-started', { players: room.players, digitCount: room.digitCount });
        startNextRound(roomCode);
    });

    socket.on('submit-guess', ({ guess }) => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        const room = rooms[roomCode];
        if (!room || room.phase !== 'guessing') return;

        const targetPlayer = room.players.find(p => p.id === room.currentTargetId);
        if (!targetPlayer) return;

        const result = calculateResult(guess, targetPlayer.digits);
        const guesser = room.players.find(p => p.id === socket.id);
        
        if (!room.guessHistory[socket.id]) room.guessHistory[socket.id] = [];
        room.guessHistory[socket.id].push({
            targetId: room.currentTargetId,
            guess,
            result,
            round: room.roundNumber
        });

        const submittedIds = Object.keys(room.guessHistory).filter(id => 
            room.guessHistory[id].some(g => g.round === room.roundNumber)
        );

        const totalGuessers = room.activePlayers.filter(id => id !== room.currentTargetId).length;

        io.to(roomCode).emit('guess-made', { 
            guesserSocketId: socket.id, 
            submittedCount: submittedIds.length, 
            totalGuessers 
        });

        if (submittedIds.length >= totalGuessers) {
            completeRound(roomCode);
        }
    });

    socket.on('set-typing', ({ isTyping }) => {
        const roomCode = Array.from(socket.rooms).find(r => rooms[r]);
        if (!roomCode) return;
        
        socket.to(roomCode).emit('player-typing-update', { 
            typingIds: isTyping ? [socket.id] : [] 
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        Object.keys(rooms).forEach(code => {
            const room = rooms[code];
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.disconnected = true;
                if (room.phase === 'lobby') {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    if (room.players.length === 0) {
                        delete rooms[code];
                    } else if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        io.to(code).emit('lobby-update', { players: room.players });
                    }
                } else {
                    io.to(code).emit('player-status-changed', { players: room.players });
                }
            }
        });
    });
});

function startNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.roundNumber++;
    // Simple round-robin for target
    const targetIdx = (room.roundNumber - 1) % room.activePlayers.length;
    room.currentTargetId = room.activePlayers[targetIdx];
    const target = room.players.find(p => p.id === room.currentTargetId);

    room.expiresAt = Date.now() + 60000;
    room.phase = 'guessing';

    io.to(roomCode).emit('round-started', {
        targetId: room.currentTargetId,
        targetName: target.name,
        roundNumber: room.roundNumber,
        expiresAt: room.expiresAt,
        activePlayers: room.activePlayers,
        digitCount: room.digitCount
    });

    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
        completeRound(roomCode);
    }, 60000);
}

function completeRound(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.phase !== 'guessing') return;

    if (room.timer) clearTimeout(room.timer);
    room.phase = 'results';

    const roundResults = [];
    let targetGuessed = false;

    Object.entries(room.guessHistory).forEach(([guesserId, entries]) => {
        const latest = entries.find(e => e.round === room.roundNumber);
        if (latest) {
            const guesser = room.players.find(p => p.id === guesserId);
            const correct = latest.result.every(r => r === 'green');
            if (correct) targetGuessed = true;
            roundResults.push({
                guesserSocketId: guesserId,
                guesserName: guesser.name,
                guess: latest.guess,
                result: latest.result,
                correct
            });
        }
    });

    const target = room.players.find(p => p.id === room.currentTargetId);
    if (targetGuessed) {
        room.activePlayers = room.activePlayers.filter(id => id !== room.currentTargetId);
    }

    const gameOver = room.activePlayers.length <= 1;
    let winnerId = null;
    let winnerName = null;
    let winnerDigits = null;

    if (gameOver) {
        winnerId = room.activePlayers[0];
        const winnerPlayer = room.players.find(p => p.id === winnerId);
        winnerName = winnerPlayer?.name || 'None';
        winnerDigits = winnerPlayer?.digits || null;
    }

    io.to(roomCode).emit('round-complete', {
        results: roundResults,
        targetId: room.currentTargetId,
        targetName: target.name,
        targetDigits: target.digits,
        targetEliminated: targetGuessed,
        guessHistory: room.guessHistory,
        activePlayers: room.activePlayers,
        gameOver,
        winnerId,
        winnerName,
        winnerDigits
    });

    if (!gameOver) {
        setTimeout(() => {
            startNextRound(roomCode);
        }, 5000);
    } else {
        room.phase = 'gameover';
    }
}

httpServer.listen(PORT, () => {
    console.log(`Server v2 running at http://localhost:${PORT}`);
    console.log(`Local IP: ${getLocalIP()}`);
});
