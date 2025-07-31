document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    const boxes = Array.from(document.querySelectorAll(".box"));
    const resetbtn = document.getElementById("reset-btn");
    const msgContainer = document.querySelector(".msg-container");
    const msg = document.getElementById("msg");
    const turnIndicator = document.querySelector(".turn-indicator");
    const xscoreBoard = document.getElementById("x-score");
    const oscoreBoard = document.getElementById("o-score");
    const roomDisplay = document.getElementById("room-display");

    const modeSelectionArea = document.getElementById("mode-selection-area");
    const playOfflineBtn = document.getElementById("play-offline-btn");
    const playAiBtn = document.getElementById("play-ai-btn");
    const playOnlineBtn = document.getElementById("play-online-btn");
    const backToModeSelectionBtn = document.getElementById("back-to-mode-selection-btn");
    const backToModeSelectionFromOnlineBtn = document.getElementById("back-to-mode-selection-from-online-btn");

    const createRoomBtn = document.getElementById("create-room");
    const joinRoomBtn = document.getElementById("join-room");
    const roomCodeInput = document.getElementById("room-token");
    const onlineControls = document.getElementById("online-controls");
    const gameArea = document.getElementById("game-area");

    const messageBox = document.getElementById("message-box");
    const messageBoxText = document.getElementById("message-box-text");
    const messageBoxCloseBtn = document.getElementById("message-box-close");

    let gameMode = 'none';
    let mySymbol = "";
    let myTurn = false;
    let token = "";
    let xscore = 0;
    let oscore = 0;
    let lastWinner = "";

    let localBoard = Array(9).fill("");
    let localCurrentTurn = 0;

    const AI_PLAYER = "O";
    const HUMAN_PLAYER = "X";

    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    function showMessageBox(text) {
        messageBoxText.innerText = text;
        messageBox.classList.remove("hide");
    }

    function hideMessageBox() {
        messageBox.classList.add("hide");
    }

    messageBoxCloseBtn.addEventListener("click", hideMessageBox);

    function showModeSelection() {
        modeSelectionArea.classList.remove("hide");
        onlineControls.classList.add("hide");
        gameArea.classList.add("hide");
        xscore = 0;
        oscore = 0;
        xscoreBoard.innerText = xscore;
        oscoreBoard.innerText = oscore;
        boxes.forEach(box => { box.innerText = ""; box.disabled = false; });
        msgContainer.classList.add("hide");
        roomDisplay.innerText = "Room Code: N/A";
        turnIndicator.innerText = "Player X's Turn";
        gameMode = 'none';
        mySymbol = "";
        myTurn = false;
        token = "";
        localBoard = Array(9).fill("");
        localCurrentTurn = 0;
        lastWinner = "";
    }

    function showOnlineLobby() {
        modeSelectionArea.classList.add("hide");
        onlineControls.classList.remove("hide");
        gameArea.classList.add("hide");
        gameMode = 'online';
        mySymbol = "";
        myTurn = false;
        token = "";
        roomDisplay.innerText = "Room Code: N/A";
        turnIndicator.innerText = "Player X's Turn";
    }

    function showGameArea() {
        modeSelectionArea.classList.add("hide");
        onlineControls.classList.add("hide");
        gameArea.classList.remove("hide");
    }

    function initializeGame(isFullReset = false) {
        boxes.forEach((box) => {
            box.innerText = "";
            box.disabled = false;
        });
        msgContainer.classList.add("hide");

        if (isFullReset) {
            xscore = 0;
            oscore = 0;
            xscoreBoard.innerText = xscore;
            oscoreBoard.innerText = oscore;
            lastWinner = "";
        }

        if (gameMode === 'offline' || gameMode === 'ai') {
            localBoard = Array(9).fill("");
            if (isFullReset) {
                localCurrentTurn = 0;
            } else {
                localCurrentTurn = (lastWinner === "O") ? 1 : 0;
            }
            turnIndicator.innerText = `Player ${localCurrentTurn === 0 ? "X" : "O"}'s Turn`;
            myTurn = true;
            mySymbol = null;
            roomDisplay.innerText = "Mode: Offline";
            if (gameMode === 'ai') {
                roomDisplay.innerText = "Mode: Player vs AI";
                if (localCurrentTurn === 1) {
                    setTimeout(aiMove, 500);
                }
            }
        }
    }

    function disableBoxes() {
        boxes.forEach((box) => (box.disabled = true));
    }

    function checkWin(board, player) {
        for (let [a, b, c] of winPatterns) {
            if (board[a] === player && board[b] === player && board[c] === player) {
                return true;
            }
        }
        return false;
    }

    function checkDraw(board) {
        return !board.includes("");
    }

    function endGameLocal(winnerSymbol) {
        if (winnerSymbol) {
            msg.innerText = `Player ${winnerSymbol} Wins!`;
            if (winnerSymbol === "X") xscore++; else oscore++;
            lastWinner = winnerSymbol;
        } else {
            msg.innerText = "Game Draw.";
            lastWinner = null;
        }
        msgContainer.classList.remove("hide");
        disableBoxes();
        xscoreBoard.innerText = xscore;
        oscoreBoard.innerText = oscore;
        setTimeout(() => initializeGame(false), 2000);
    }

    function getEmptySpots(board) {
        return board.map((val, idx) => val === "" ? idx : -1).filter(idx => idx !== -1);
    }

    function aiMove() {
        if (checkWin(localBoard, HUMAN_PLAYER) || checkWin(localBoard, AI_PLAYER) || checkDraw(localBoard)) {
            return;
        }

        disableBoxes();
        turnIndicator.innerText = "AI is thinking...";

        let bestScore = -Infinity;
        let bestMove;
        const availableSpots = getEmptySpots(localBoard);

        for (let i = 0; i < availableSpots.length; i++) {
            let spot = availableSpots[i];
            localBoard[spot] = AI_PLAYER;
            let score = minimax(localBoard, 0, false);
            localBoard[spot] = "";
            if (score > bestScore) {
                bestScore = score;
                bestMove = spot;
            }
        }

        if (bestMove !== undefined) {
            boxes[bestMove].innerText = AI_PLAYER;
            boxes[bestMove].disabled = true;
            localBoard[bestMove] = AI_PLAYER;

            if (checkWin(localBoard, AI_PLAYER)) {
                endGameLocal(AI_PLAYER);
            } else if (checkDraw(localBoard)) {
                endGameLocal(null);
            } else {
                localCurrentTurn = 0;
                turnIndicator.innerText = `Player ${HUMAN_PLAYER}'s Turn`;
                boxes.forEach(box => { if (box.innerText === "") box.disabled = false; });
            }
        }
    }

    function minimax(board, depth, isMaximizing) {
        if (checkWin(board, AI_PLAYER)) {
            return 1;
        } else if (checkWin(board, HUMAN_PLAYER)) {
            return -1;
        } else if (checkDraw(board)) {
            return 0;
        }

        const emptySpots = getEmptySpots(board);

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < emptySpots.length; i++) {
                let spot = emptySpots[i];
                board[spot] = AI_PLAYER;
                let score = minimax(board, depth + 1, false);
                board[spot] = "";
                bestScore = Math.max(score, bestScore);
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < emptySpots.length; i++) {
                let spot = emptySpots[i];
                board[spot] = HUMAN_PLAYER;
                let score = minimax(board, depth + 1, true);
                board[spot] = "";
                bestScore = Math.min(score, bestScore);
            }
            return bestScore;
        }
    }

    playOfflineBtn.addEventListener("click", () => {
        gameMode = 'offline';
        showGameArea();
        initializeGame(true);
        roomDisplay.innerText = "Mode: Offline (Local)";
        turnIndicator.innerText = "Player X's Turn";
    });

    playAiBtn.addEventListener("click", () => {
        gameMode = 'ai';
        showGameArea();
        initializeGame(true);
        roomDisplay.innerText = "Mode: Player vs AI";
        turnIndicator.innerText = "Player X's Turn";
    });

    playOnlineBtn.addEventListener("click", () => {
        gameMode = 'online';
        showOnlineLobby();
        roomDisplay.innerText = "Room Code: N/A";
    });

    backToModeSelectionBtn.addEventListener("click", showModeSelection);
    backToModeSelectionFromOnlineBtn.addEventListener("click", showModeSelection);

    createRoomBtn.addEventListener("click", () => {
        socket.emit("createRoom");
        turnIndicator.innerText = "Waiting for opponent...";
    });

    joinRoomBtn.addEventListener("click", () => {
        const roomCode = roomCodeInput.value.trim();
        if (roomCode) {
            socket.emit("joinRoom", roomCode);
            turnIndicator.innerText = "Attempting to join...";
        } else {
            showMessageBox("Please enter a room code to join.");
        }
    });

    boxes.forEach((box, index) => {
        box.addEventListener("click", () => {
            if (box.innerText !== "") {
                showMessageBox("This box is already taken!");
                return;
            }

            if (gameMode === 'offline') {
                const symbol = localCurrentTurn === 0 ? "X" : "O";
                box.innerText = symbol;
                box.disabled = true;
                localBoard[index] = symbol;

                if (checkWin(localBoard, symbol)) {
                    endGameLocal(symbol);
                } else if (checkDraw(localBoard)) {
                    endGameLocal(null);
                } else {
                    localCurrentTurn = 1 - localCurrentTurn;
                    turnIndicator.innerText = `Player ${localCurrentTurn === 0 ? "X" : "O"}'s Turn`;
                }

            } else if (gameMode === 'ai') {
                if (localCurrentTurn !== 0) {
                    showMessageBox("It's not your turn!");
                    return;
                }

                box.innerText = HUMAN_PLAYER;
                box.disabled = true;
                localBoard[index] = HUMAN_PLAYER;

                if (checkWin(localBoard, HUMAN_PLAYER)) {
                    endGameLocal(HUMAN_PLAYER);
                } else if (checkDraw(localBoard)) {
                    endGameLocal(null);
                } else {
                    localCurrentTurn = 1;
                    turnIndicator.innerText = "AI's Turn...";
                    setTimeout(aiMove, 700);
                }

            } else if (gameMode === 'online') {
                if (!myTurn) {
                    showMessageBox("It's not your turn!");
                    return;
                }
                socket.emit("playerMove", { token, index });
                myTurn = false;
            }
        });
    });

    resetbtn.addEventListener("click", () => {
        initializeGame(true);
    });

    socket.on("roomCreated", (code) => {
        token = code;
        mySymbol = "X";
        myTurn = true;
        roomDisplay.innerText = `Room Code: ${code}`;
        initializeGame(true);
        showGameArea();
        turnIndicator.innerText = "Waiting for opponent...";
    });

    socket.on("startGame", (code) => {
        token = code;
        if (!mySymbol) mySymbol = "O";
        myTurn = (mySymbol === "X");
        roomDisplay.innerText = `Room Code: ${code}`;
        initializeGame(true);
        showGameArea();
        turnIndicator.innerText = `Player ${myTurn ? mySymbol : (mySymbol === 'X' ? 'O' : 'X')}'s Turn`;
    });

    socket.on("updateBoard", ({ index, symbol }) => {
        boxes[index].innerText = symbol;
        boxes[index].disabled = true;
        turnIndicator.innerText = `Player ${symbol === "X" ? "O" : "X"}'s Turn`;
        myTurn = (symbol !== mySymbol);
    });

    socket.on("showResult", (result) => {
        msg.innerText = result;
        msgContainer.classList.remove("hide");
        disableBoxes();

        if (result.includes("X")) {
            xscore++;
            xscoreBoard.innerText = xscore;
            lastWinner = "X";
        } else if (result.includes("O")) {
            oscore++;
            oscoreBoard.innerText = oscore;
            lastWinner = "O";
        }

        setTimeout(() => {
            socket.emit("resetGame", token);
        }, 2000);
    });

    socket.on("draw", () => {
        msg.innerText = "Game Draw.";
        msgContainer.classList.remove("hide");
        disableBoxes();
        lastWinner = null;

        setTimeout(() => {
            socket.emit("resetGame", token);
        }, 2000);
    });

    socket.on("resetBoard", ({ board, currentTurn }) => {
        boxes.forEach((box, i) => {
            box.innerText = board[i];
            box.disabled = false;
        });
        msgContainer.classList.add("hide");

        const turnSymbol = currentTurn === 0 ? "X" : "O";
        turnIndicator.innerText = `Player ${turnSymbol}'s Turn`;
        myTurn = (mySymbol === turnSymbol);
    });

    socket.on("errorMsg", (err) => {
        showMessageBox(err);
        showOnlineLobby();
        mySymbol = "";
        myTurn = false;
        token = "";
        roomDisplay.innerText = "Room Code: N/A";
    });

    showModeSelection();
});