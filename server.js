const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/online.html");
});

const rooms = {};

// Helper function to get player's current room
function getPlayerRoom(socketId) {
    for (const code in rooms) {
        if (rooms[code].players.includes(socketId)) {
            return code;
        }
    }
    return null;
}

// Helper function to remove player from their current room
function removePlayerFromRoom(socketId) {
    const roomCode = getPlayerRoom(socketId);
    if (!roomCode) return null;

    const room = rooms[roomCode];
    const index = room.players.indexOf(socketId);

    if (index !== -1) {
        room.players.splice(index, 1);
        console.log(`User ${socketId} removed from room ${roomCode}`);

        // If room is empty, delete it
        if (room.players.length === 0) {
            delete rooms[roomCode];
            console.log(`Room ${roomCode} deleted as it's empty.`);
            return { roomCode, hadPlayers: false };
        }

        // If one player remains, notify them
        if (room.players.length === 1) {
            const remainingPlayer = room.players[0];
            io.to(remainingPlayer).emit("errorMsg", "Your opponent has left the room. You can wait for someone to rejoin or create a new room.");
            io.to(remainingPlayer).emit("systemMessage", "Your opponent left the room.");

            // Reset the game state for the remaining player
            room.board = Array(9).fill("");
            room.currentTurn = 0;
            room.lastWinner = null;
            room.gameOver = false;

            return { roomCode, hadPlayers: true, remainingPlayer };
        }
    }

    return null;
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("createRoom", () => {
        // Remove player from any existing room first
        removePlayerFromRoom(socket.id);

        const roomCode = uuidv4().slice(0, 6).toUpperCase();

        rooms[roomCode] = {
            players: [socket.id],
            board: Array(9).fill(""),
            currentTurn: 0,
            lastWinner: null,
            gameOver: false
        };

        socket.join(roomCode);
        socket.emit("roomCreated", roomCode);
        console.log(`Room ${roomCode} created by ${socket.id}`);
    });

    socket.on("joinRoom", (roomCodeInput) => {
        const roomCode = roomCodeInput.trim().toUpperCase();
        const room = rooms[roomCode];

        if (!room) {
            socket.emit("errorMsg", "Room not found. Please check the code.");
            return;
        }

        // Check if player is already in this room
        if (room.players.includes(socket.id)) {
            socket.emit("errorMsg", "You are already in this room.");
            return;
        }

        if (room.players.length >= 2) {
            socket.emit("errorMsg", "Room is full. Try another code.");
            return;
        }

        // Remove player from any other room first
        removePlayerFromRoom(socket.id);

        room.players.push(socket.id);
        socket.join(roomCode);

        // Reset game state when second player joins
        room.board = Array(9).fill("");
        room.currentTurn = 0;
        room.lastWinner = null;
        room.gameOver = false;

        io.to(roomCode).emit("startGame", roomCode);

        // Send system message to both players
        io.to(roomCode).emit("systemMessage", "Both players connected. Game is starting!");

        console.log(`User ${socket.id} joined room ${roomCode}`);
    });

    socket.on("playerMove", ({ token, index }) => {
        const room = rooms[token];

        if (!room || room.players.length < 2 || room.gameOver) return;

        if (room.board[index] !== "") return;

        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex === -1 || playerIndex !== room.currentTurn) return;

        const symbol = playerIndex === 0 ? "X" : "O";
        room.board[index] = symbol;

        io.to(token).emit("updateBoard", { index, symbol });

        const b = room.board;
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let [a, b1, c] of winPatterns) {
            if (b[a] && b[a] === b[b1] && b[a] === b[c]) {
                io.to(token).emit("showResult", `Player ${symbol} Wins!`);
                room.lastWinner = symbol;
                room.gameOver = true;
                return;
            }
        }

        if (!b.includes("")) {
            io.to(token).emit("draw");
            room.lastWinner = null;
            room.gameOver = true;
            return;
        }

        room.currentTurn = 1 - room.currentTurn;
    });

    socket.on("resetGame", (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        room.board = Array(9).fill("");
        room.gameOver = false;
        room.currentTurn = room.lastWinner === "O" ? 1 : 0;

        io.to(roomId).emit("resetBoard", {
            board: room.board,
            currentTurn: room.currentTurn
        });
    });

    // Chat functionality
    socket.on("chatMessage", ({ token, message }) => {
        const room = rooms[token];
        if (!room || !message || message.trim() === "") return;

        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex === -1) return;

        const sender = playerIndex === 0 ? "X" : "O";

        // Send message to both players
        room.players.forEach((playerId, idx) => {
            io.to(playerId).emit("chatMessage", {
                sender: sender,
                message: message.trim(),
                isMe: playerId === socket.id
            });
        });

        console.log(`Chat in room ${token} - Player ${sender}: ${message.trim()}`);
    });

    // Handle explicit leave room request
    socket.on("leaveRoom", () => {
        removePlayerFromRoom(socket.id);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        removePlayerFromRoom(socket.id);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(` Server running at http://localhost:${port}/ `);
});