import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

const localIP = getLocalIP();
const PORT = 4000;
const MAX_PLAYERS = 8;
const ROUND_TIME_MS = 60000;

const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Guess validation ──────────────────────────────────────────────
// Returns array of 'green' | 'yellow' | 'red' for each digit position
function checkGuess(secret, guess) {
    const result = ['red', 'red', 'red', 'red'];
    const secretCopy = [...secret];
    const guessCopy = [...guess];

    // First pass: correct position → green
    for (let i = 0; i < 4; i++) {
        if (guessCopy[i] === secretCopy[i]) {
            result[i] = 'green';
            secretCopy[i] = null;
            guessCopy[i] = null;
        }
    }
    // Second pass: correct digit, wrong position → yellow
    for (let i = 0; i < 4; i++) {
        if (guessCopy[i] !== null) {
            const idx = secretCopy.indexOf(guessCopy[i]);
            if (idx !== -1) {
                result[i] = 'yellow';
                secretCopy[idx] = null;
            }
        }
    }
    return result;
}

// ── Game state helpers ────────────────────────────────────────────
function initGameState(players) {
    const history = {};
    players.forEach(p => { history[p.id] = []; });
    return {
        targetQueue: players.map(p => p.id), // who gets guessed, in order
        currentTargetId: null,
        roundNumber: 0,
        roundGuesses: {},      // { guesserSocketId: { guess, result, correct } }
        guessHistory: history, // { playerId: [{ guess, result, targetId, targetName, round }] }
        eliminatedIds: [],
        submittedIds: [],      // who submitted this round
        timer: null,
    };
}

function getActiveGuessers(room) {
    const gs = room.gameState;
    return room.players.filter(
        p => p.id !== gs.currentTargetId && !gs.eliminatedIds.includes(p.id)
    );
}

function startRound(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;
    const gs = room.gameState;

    // Pick next non-eliminated target
    let targetId = null;
    while (gs.targetQueue.length > 0) {
        const candidate = gs.targetQueue.shift();
        if (!gs.eliminatedIds.includes(candidate)) {
            targetId = candidate;
            break;
        }
    }

    // If queue empty, refill from active players for next cycle
    if (!targetId) {
        const active = room.players.filter(p => !gs.eliminatedIds.includes(p.id));
        if (active.length <= 1) {
            // Game over
            const winner = active[0] || null;
            io.to(roomCode).emit('game-over', {
                winnerId: winner?.id || null,
                winnerName: winner?.name || 'Nobody',
            });
            console.log(`[Game] Game over in room ${roomCode}. Winner: ${winner?.name}`);
            return;
        }
        gs.targetQueue = active.map(p => p.id);
        // shift first for this cycle
        const next = gs.targetQueue.shift();
        if (!gs.eliminatedIds.includes(next)) targetId = next;
        else {
            // Edge case: just pick first active
            targetId = active[0].id;
        }
    }

    gs.currentTargetId = targetId;
    gs.roundGuesses = {};
    gs.submittedIds = [];
    gs.roundNumber++;

    const target = room.players.find(p => p.id === targetId);
    const expiresAt = Date.now() + ROUND_TIME_MS;

    // Clear old timer
    if (gs.timer) clearTimeout(gs.timer);
    gs.timer = setTimeout(() => completeRound(roomCode), ROUND_TIME_MS);

    io.to(roomCode).emit('round-started', {
        targetId,
        targetName: target?.name || '',
        roundNumber: gs.roundNumber,
        expiresAt,
        activePlayers: room.players
            .filter(p => !gs.eliminatedIds.includes(p.id))
            .map(p => p.id),
    });

    console.log(`[Game] Round ${gs.roundNumber} started. Target: ${target?.name} in room ${roomCode}`);
}

function completeRound(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;
    const gs = room.gameState;

    if (gs.timer) { clearTimeout(gs.timer); gs.timer = null; }

    const target = room.players.find(p => p.id === gs.currentTargetId);
    if (!target) return;

    // Build results array
    const results = Object.entries(gs.roundGuesses).map(([guesserSocketId, data]) => {
        const guesser = room.players.find(p => p.id === guesserSocketId);
        return {
            guesserSocketId,
            guesserName: guesser?.name || '?',
            guess: data.guess,
            result: data.result,
            correct: data.correct,
        };
    });

    // Update guess history per player
    results.forEach(r => {
        if (!gs.guessHistory[r.guesserSocketId]) gs.guessHistory[r.guesserSocketId] = [];
        gs.guessHistory[r.guesserSocketId].push({
            guess: r.guess,
            result: r.result,
            targetId: gs.currentTargetId,
            targetName: target.name,
            round: gs.roundNumber,
        });
    });

    // Check if target was eliminated (anyone guessed correctly)
    const targetEliminated = results.some(r => r.correct);
    if (targetEliminated && !gs.eliminatedIds.includes(gs.currentTargetId)) {
        gs.eliminatedIds.push(gs.currentTargetId);
    }

    // Check game over: only 1 active player left
    const activePlayers = room.players.filter(p => !gs.eliminatedIds.includes(p.id));
    const gameOver = activePlayers.length <= 1;
    const winner = gameOver ? activePlayers[0] : null;

    io.to(roomCode).emit('round-complete', {
        results,
        targetId: gs.currentTargetId,
        targetName: target.name,
        targetEliminated,
        guessHistory: gs.guessHistory,
        activePlayers: activePlayers.map(p => p.id),
        gameOver,
        winnerId: winner?.id || null,
        winnerName: winner?.name || null,
    });

    console.log(`[Game] Round ${gs.roundNumber} complete in ${roomCode}. Target: ${target.name}${targetEliminated ? ' (ELIMINATED)' : ''}`);

    if (gameOver) {
        console.log(`[Game] Game over in ${roomCode}. Winner: ${winner?.name}`);
        return;
    }

    // Auto-start next round after 5 seconds (so players can see results)
    setTimeout(() => startRound(roomCode), 5000);
}

// ── REST ─────────────────────────────────────────────────────────
app.get('/server-info', (req, res) => {
    res.json({ ip: localIP, port: PORT });
});

// ── Socket.IO ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[+] Connected: ${socket.id}`);

    socket.on('get-rooms', (callback) => {
        const openRooms = Object.entries(rooms)
            .filter(([, room]) => !room.started)
            .map(([code, room]) => ({
                code,
                playerCount: room.players.length,
                maxPlayers: MAX_PLAYERS,
                hostName: room.players[0]?.name || 'Unknown',
                isFull: room.players.length >= MAX_PLAYERS,
            }));
        callback({ rooms: openRooms });
    });

    socket.on('create-room', ({ playerName }, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName, ready: false, digits: null }],
            started: false,
        };
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.isHost = true;
        console.log(`[Room] ${playerName} created room ${roomCode}`);
        callback({ success: true, roomCode, ip: localIP, port: PORT, players: rooms[roomCode].players });
    });

    socket.on('join-room', ({ roomCode, playerName }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, error: 'Room not found.' });
        if (room.started) return callback({ success: false, error: 'Game has already started.' });
        if (room.players.length >= MAX_PLAYERS) return callback({ success: false, error: `Room is full (max ${MAX_PLAYERS}).` });
        room.players.push({ id: socket.id, name: playerName, ready: false, digits: null });
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.isHost = false;
        io.to(roomCode).emit('player-joined', { players: room.players });
        console.log(`[Room] ${playerName} joined room ${roomCode}`);
        callback({ success: true, roomCode, players: room.players, isHost: false });
    });

    socket.on('player-ready', ({ digits }) => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) { player.ready = true; player.digits = digits; }
        io.to(roomCode).emit('lobby-update', { players: room.players });
        console.log(`[Room] ${socket.data.playerName} READY in ${roomCode}`);
    });

    socket.on('kick-player', ({ targetId }) => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room || room.host !== socket.id) return;
        const target = room.players.find(p => p.id === targetId);
        if (!target) return;
        room.players = room.players.filter(p => p.id !== targetId);
        io.to(targetId).emit('kicked', { reason: 'You were kicked by the host.' });
        io.to(roomCode).emit('lobby-update', { players: room.players });
        console.log(`[Room] ${target.name} kicked from ${roomCode}`);
    });

    socket.on('start-game', () => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room || room.host !== socket.id) return;
        room.started = true;
        room.gameState = initGameState(room.players);

        io.to(roomCode).emit('game-started', { players: room.players });
        console.log(`[Game] Starting in room ${roomCode} with ${room.players.length} players`);

        // First round starts after transition animation
        setTimeout(() => startRound(roomCode), 3500);
    });

    // ── GAME: player submits a guess ─────────────────────────────
    socket.on('submit-guess', ({ guess }) => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room?.gameState) return;
        const gs = room.gameState;

        // Must be an active guesser (not the target, not eliminated)
        if (socket.id === gs.currentTargetId) return;
        if (gs.eliminatedIds.includes(socket.id)) return;
        if (gs.submittedIds.includes(socket.id)) return; // already submitted

        const target = room.players.find(p => p.id === gs.currentTargetId);
        if (!target?.digits) return;

        const result = checkGuess(target.digits, guess);
        const correct = result.every(r => r === 'green');

        gs.roundGuesses[socket.id] = { guess, result, correct };
        gs.submittedIds.push(socket.id);

        // Broadcast who submitted (without revealing the guess yet)
        const submitter = room.players.find(p => p.id === socket.id);
        io.to(roomCode).emit('guess-made', {
            guesserSocketId: socket.id,
            guesserName: submitter?.name || '?',
            submittedCount: gs.submittedIds.length,
            totalGuessers: getActiveGuessers(room).length,
        });

        console.log(`[Game] ${socket.data.playerName} guessed in room ${roomCode}`);

        // If all active guessers submitted, complete round early
        if (gs.submittedIds.length >= getActiveGuessers(room).length) {
            completeRound(roomCode);
        }
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
        const { roomCode, isHost } = socket.data;
        if (!roomCode || !rooms[roomCode]) return;
        const room = rooms[roomCode];

        if (room.started) {
            room.players = room.players.filter(p => p.id !== socket.id);
            // If they were supposed to guess this round, check if round should complete
            if (room.gameState) {
                const gs = room.gameState;
                if (!gs.eliminatedIds.includes(socket.id) && socket.id !== gs.currentTargetId) {
                    const guessers = getActiveGuessers(room);
                    if (guessers.length > 0 && gs.submittedIds.length >= guessers.length) {
                        completeRound(roomCode);
                    }
                }
            }
            return;
        }

        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.players.length === 0 || isHost) {
            io.to(roomCode).emit('room-closed', { reason: 'Host left the lobby.' });
            delete rooms[roomCode];
        } else {
            io.to(roomCode).emit('lobby-update', { players: room.players });
        }
        console.log(`[-] Disconnected: ${socket.id}`);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n🎮  Four Digits — Game Server');
    console.log(`    Local:   http://localhost:${PORT}`);
    console.log(`    Network: http://${localIP}:${PORT}`);
    console.log(`\n    Players open: http://${localIP}:5173\n`);
});
