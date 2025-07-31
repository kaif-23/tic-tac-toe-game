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

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("createRoom", () => {
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

        if (room.players.length >= 2) {
            socket.emit("errorMsg", "Room is full. Try another code.");
            return;
        }

        room.players.push(socket.id);
        socket.join(roomCode);
        io.to(roomCode).emit("startGame", roomCode);
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

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        for (const code in rooms) {
            const room = rooms[code];
            const index = room.players.indexOf(socket.id);

            if (index !== -1) {
                room.players.splice(index, 1);
                console.log(`User ${socket.id} left room ${code}`);

                if (room.players.length === 1) {
                    const remainingPlayer = room.players[0];
                    io.to(remainingPlayer).emit("errorMsg", "Your opponent has disconnected. The game cannot continue.");
                }

                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} deleted as it's empty.`);
                }
            }
        }
    });
});

server.listen(3000, () => {
    console.log(" Server running at http://localhost:3000");
});