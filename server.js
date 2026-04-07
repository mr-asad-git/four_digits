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
const ROUND_TIME_MS = 60 * 1000;

const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Guess validation ──────────────────────────────────────────────
// Works for any digit count (4–8)
function checkGuess(secret, guess) {
    const len = secret.length;
    const result = Array(len).fill('red');
    const secretCopy = [...secret];
    const guessCopy = [...guess];

    for (let i = 0; i < len; i++) {
        if (guessCopy[i] === secretCopy[i]) {
            result[i] = 'green';
            secretCopy[i] = null;
            guessCopy[i] = null;
        }
    }
    for (let i = 0; i < len; i++) {
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
    players.forEach(p => { if (!p.spectator) history[p.id] = []; });
    return {
        targetQueue: players.filter(p => !p.spectator).map(p => p.id),
        currentTargetId: null,
        roundNumber: 0,
        roundGuesses: {},
        guessHistory: history,
        eliminatedIds: [],
        submittedIds: [],
        timer: null,
    };
}

// Active guessers = connected, not the target, not eliminated, not spectator
function getActiveGuessers(room) {
    const gs = room.gameState;
    return room.players.filter(p =>
        p.id !== gs.currentTargetId &&
        !gs.eliminatedIds.includes(p.id) &&
        !p.disconnected &&
        !p.spectator
    );
}

function broadcastPlayerStatus(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    io.to(roomCode).emit('player-status-changed', { players: room.players });
}

function startRound(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;
    const gs = room.gameState;

    let targetId = null;
    while (gs.targetQueue.length > 0) {
        const candidate = gs.targetQueue.shift();
        const p = room.players.find(pl => pl.id === candidate);
        if (!gs.eliminatedIds.includes(candidate) && p && !p.spectator) {
            targetId = candidate;
            break;
        }
    }

    if (!targetId) {
        const active = room.players.filter(p => !gs.eliminatedIds.includes(p.id) && !p.spectator);
        if (active.length <= 1) {
            const winner = active[0] || null;
            io.to(roomCode).emit('game-over', {
                winnerId: winner?.id || null,
                winnerName: winner?.name || 'Nobody',
            });
            console.log(`[Game] Game over in room ${roomCode}. Winner: ${winner?.name}`);
            return;
        }
        gs.targetQueue = active.map(p => p.id);
        targetId = gs.targetQueue.shift();
    }

    gs.currentTargetId = targetId;
    gs.roundGuesses = {};
    gs.submittedIds = [];
    gs.roundNumber++;

    const target = room.players.find(p => p.id === targetId);
    const expiresAt = Date.now() + ROUND_TIME_MS;

    if (gs.timer) clearTimeout(gs.timer);
    gs.timer = setTimeout(() => completeRound(roomCode), ROUND_TIME_MS);

    io.to(roomCode).emit('round-started', {
        targetId,
        targetName: target?.name || '',
        roundNumber: gs.roundNumber,
        expiresAt,
        activePlayers: room.players
            .filter(p => !gs.eliminatedIds.includes(p.id) && !p.spectator)
            .map(p => p.id),
        digitCount: room.digitCount || 4,
    });

    console.log(`[Game] Round ${gs.roundNumber} started. Target: ${target?.name} in room ${roomCode} (${room.digitCount || 4} digits)`);
}

function completeRound(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.gameState) return;
    const gs = room.gameState;

    if (gs.timer) { clearTimeout(gs.timer); gs.timer = null; }

    const target = room.players.find(p => p.id === gs.currentTargetId);
    if (!target) {
        setTimeout(() => startRound(roomCode), 5000);
        return;
    }

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

    const targetEliminated = results.some(r => r.correct);
    if (targetEliminated && !gs.eliminatedIds.includes(gs.currentTargetId)) {
        gs.eliminatedIds.push(gs.currentTargetId);
    }

    const activePlayers = room.players.filter(p => !gs.eliminatedIds.includes(p.id) && !p.spectator);
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

    setTimeout(() => startRound(roomCode), 5000);
}

// ── REST ──────────────────────────────────────────────────────────
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
                playerCount: room.players.filter(p => !p.disconnected).length,
                maxPlayers: MAX_PLAYERS,
                hostName: room.players[0]?.name || 'Unknown',
                isFull: room.players.filter(p => !p.disconnected).length >= MAX_PLAYERS,
                digitCount: room.digitCount || 4,
                hasPassword: !!room.password,
            }));
        callback({ rooms: openRooms });
    });

    socket.on('create-room', ({ playerName }, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName, ready: false, digits: null, disconnected: false, spectator: false }],
            started: false,
            digitCount: 4,
            password: null,
        };
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.isHost = true;
        console.log(`[Room] ${playerName} created room ${roomCode}`);
        callback({ success: true, roomCode, ip: localIP, port: PORT, players: rooms[roomCode].players });
    });

    // ── Host sets room settings (digit count + password) ─────────
    socket.on('set-room-settings', ({ digitCount, password }, callback) => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room) return callback?.({ success: false, error: 'Room not found.' });
        if (room.host !== socket.id) return callback?.({ success: false, error: 'Only the host can change settings.' });
        if (room.started) return callback?.({ success: false, error: 'Game already started.' });
        if (room.players.some(p => p.ready)) return callback?.({ success: false, error: 'Cannot change after players are ready.' });

        const dc = parseInt(digitCount);
        if (isNaN(dc) || dc < 4 || dc > 8) return callback?.({ success: false, error: 'Digit count must be 4–8.' });
        if (password !== null && password !== undefined && !/^\d{4}$/.test(password)) {
            return callback?.({ success: false, error: 'Password must be exactly 4 digits.' });
        }

        room.digitCount = dc;
        room.password = password || null;

        io.to(roomCode).emit('room-settings-updated', { digitCount: dc, hasPassword: !!room.password });
        console.log(`[Room] ${roomCode} settings: ${dc} digits, password: ${room.password ? 'YES' : 'NO'}`);
        callback?.({ success: true });
    });

    socket.on('join-room', ({ roomCode, playerName, password }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, error: 'Room not found.' });

        // ── Password check ────────────────────────────────────────
        if (room.password && password !== room.password) {
            return callback({ success: false, error: room.password ? 'Incorrect password.' : 'No password needed.' });
        }

        // ── If game is running, join as spectator or rejoin ───────
        if (room.started) {
            const existingSlot = room.players.find(p => p.name === playerName && p.disconnected);
            if (existingSlot) {
                const oldId = existingSlot.id;
                existingSlot.id = socket.id;
                existingSlot.disconnected = false;
                socket.join(roomCode);
                socket.data.roomCode = roomCode;
                socket.data.playerName = playerName;
                socket.data.isHost = (room.host === oldId);
                if (socket.data.isHost) room.host = socket.id;

                if (room.gameState?.guessHistory[oldId]) {
                    room.gameState.guessHistory[socket.id] = room.gameState.guessHistory[oldId];
                    delete room.gameState.guessHistory[oldId];
                }
                if (room.gameState) {
                    const si = room.gameState.submittedIds.indexOf(oldId);
                    if (si !== -1) room.gameState.submittedIds[si] = socket.id;
                    const ri = room.gameState.eliminatedIds.indexOf(oldId);
                    if (ri !== -1) room.gameState.eliminatedIds[ri] = socket.id;
                    if (room.gameState.currentTargetId === oldId) room.gameState.currentTargetId = socket.id;
                    const tq = room.gameState.targetQueue.indexOf(oldId);
                    if (tq !== -1) room.gameState.targetQueue[tq] = socket.id;
                    const rg = room.gameState.roundGuesses[oldId];
                    if (rg) { room.gameState.roundGuesses[socket.id] = rg; delete room.gameState.roundGuesses[oldId]; }
                }

                broadcastPlayerStatus(roomCode);

                const gs = room.gameState;
                socket.emit('game-state-sync', {
                    players: room.players,
                    phase: gs ? 'guessing' : 'waiting',
                    currentTargetId: gs?.currentTargetId || null,
                    currentTargetName: room.players.find(p => p.id === gs?.currentTargetId)?.name || '',
                    roundNumber: gs?.roundNumber || 0,
                    guessHistory: gs?.guessHistory || {},
                    activePlayers: room.players.filter(p => !gs?.eliminatedIds.includes(p.id) && !p.spectator).map(p => p.id),
                    eliminatedIds: gs?.eliminatedIds || [],
                    submittedIds: gs?.submittedIds || [],
                    digitCount: room.digitCount || 4,
                });

                console.log(`[Room] ${playerName} RE-JOINED room ${roomCode}`);
                return callback({ success: true, roomCode, players: room.players, isHost: socket.data.isHost, rejoined: true, digitCount: room.digitCount || 4 });
            }

            // New spectator
            room.players.push({ id: socket.id, name: playerName, ready: true, digits: null, disconnected: false, spectator: true });
            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.playerName = playerName;
            socket.data.isHost = false;
            broadcastPlayerStatus(roomCode);

            const gs = room.gameState;
            socket.emit('game-state-sync', {
                players: room.players,
                phase: gs ? 'guessing' : 'waiting',
                currentTargetId: gs?.currentTargetId || null,
                currentTargetName: room.players.find(p => p.id === gs?.currentTargetId)?.name || '',
                roundNumber: gs?.roundNumber || 0,
                guessHistory: gs?.guessHistory || {},
                activePlayers: room.players.filter(p => !gs?.eliminatedIds.includes(p.id) && !p.spectator).map(p => p.id),
                eliminatedIds: gs?.eliminatedIds || [],
                submittedIds: gs?.submittedIds || [],
                digitCount: room.digitCount || 4,
            });

            console.log(`[Room] ${playerName} joined room ${roomCode} as SPECTATOR`);
            return callback({ success: true, roomCode, players: room.players, isHost: false, spectator: true, digitCount: room.digitCount || 4 });
        }

        if (room.players.filter(p => !p.disconnected).length >= MAX_PLAYERS) {
            return callback({ success: false, error: `Room is full (max ${MAX_PLAYERS}).` });
        }

        room.players.push({ id: socket.id, name: playerName, ready: false, digits: null, disconnected: false, spectator: false });
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.playerName = playerName;
        socket.data.isHost = false;
        io.to(roomCode).emit('player-joined', { players: room.players });
        console.log(`[Room] ${playerName} joined room ${roomCode}`);
        callback({ success: true, roomCode, players: room.players, isHost: false, digitCount: room.digitCount || 4 });
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

        io.to(roomCode).emit('game-started', { players: room.players, digitCount: room.digitCount || 4 });
        console.log(`[Game] Starting in room ${roomCode} with ${room.players.length} players, ${room.digitCount || 4} digits`);

        setTimeout(() => startRound(roomCode), 3500);
    });

    // ── GAME: player submits a guess ─────────────────────────────
    socket.on('submit-guess', ({ guess }) => {
        const { roomCode } = socket.data;
        const room = rooms[roomCode];
        if (!room?.gameState) return;
        const gs = room.gameState;
        const dc = room.digitCount || 4;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.spectator) return;
        if (socket.id === gs.currentTargetId) return;
        if (gs.eliminatedIds.includes(socket.id)) return;
        if (gs.submittedIds.includes(socket.id)) return;
        if (!Array.isArray(guess) || guess.length !== dc) return; // validate length

        const target = room.players.find(p => p.id === gs.currentTargetId);
        if (!target?.digits || target.digits.length !== dc) return;

        const result = checkGuess(target.digits, guess);
        const correct = result.every(r => r === 'green');

        gs.roundGuesses[socket.id] = { guess, result, correct };
        gs.submittedIds.push(socket.id);

        const submitter = room.players.find(p => p.id === socket.id);
        io.to(roomCode).emit('guess-made', {
            guesserSocketId: socket.id,
            guesserName: submitter?.name || '?',
            submittedCount: gs.submittedIds.length,
            totalGuessers: getActiveGuessers(room).length,
        });

        console.log(`[Game] ${socket.data.playerName} guessed in room ${roomCode}`);

        if (gs.submittedIds.length >= getActiveGuessers(room).length) {
            completeRound(roomCode);
        }
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
        const { roomCode, isHost } = socket.data;
        if (!roomCode || !rooms[roomCode]) {
            console.log(`[-] Disconnected (no room): ${socket.id}`);
            return;
        }
        const room = rooms[roomCode];
        console.log(`[-] Disconnected: ${socket.data.playerName} (${socket.id}) from room ${roomCode}`);

        if (room.started) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) player.disconnected = true;

            const connectedCount = room.players.filter(p => !p.disconnected).length;
            if (connectedCount === 0) {
                console.log(`[-] Room ${roomCode} closed — all players disconnected.`);
                delete rooms[roomCode];
                return;
            }

            broadcastPlayerStatus(roomCode);

            const gs = room.gameState;
            if (gs) {
                if (socket.id === gs.currentTargetId) {
                    console.log(`[Game] Target ${socket.data.playerName} disconnected — completing round early.`);
                    if (gs.timer) { clearTimeout(gs.timer); gs.timer = null; }
                    completeRound(roomCode);
                    return;
                }
                if (!gs.eliminatedIds.includes(socket.id) && !player?.spectator) {
                    const guessers = getActiveGuessers(room);
                    if (guessers.length === 0 || gs.submittedIds.length >= guessers.length) {
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
        console.log(`[-] ${socket.data.playerName} removed from lobby ${roomCode}`);
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n\x1b[32m🎮  Four Digits — Game Server\x1b[0m');
    console.log(`\n\x1b[36m👉 ALMOST READY!\x1b[0m Node server is running in the background.`);
    console.log(`\n\x1b[33m⚠️  DO NOT CLICK THIS SERVER URL.\x1b[0m It has no UI.`);
    console.log(`\x1b[33m⚠️  INSTEAD, CLICK YOUR VITE SERVER URL (usually http://localhost:5173)\x1b[0m`);
    console.log(`\n    Players on your network can join using: http://${localIP}:5173\n`);
});
