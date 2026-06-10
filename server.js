import http from 'http';
import fs from 'fs';
import url from 'url';
import path from 'path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT;
const DATA_FILE = path.join(__dirname, 'game.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Winning combinations for Tic-Tac-Toe
const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

function readDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (err) {
        return {};
    }
}

function writeDatabase(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function createInitialState(gameId, existingScores = null) {
    return {
        gameId: gameId,
        board: Array(9).fill(null),
        turn: 'X',
        status: 'ongoing',
        scores: existingScores || { X: 0, O: 0, draws: 0 },
        createdAt: new Date().toISOString()
    };
}

function checkGameStatus(board) {
    for (let combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return `win-${board[a]}`;
        }
    }
    if (board.every(cell => cell !== null)) {
        return 'draw';
    }
    return 'ongoing';
}

function computeAIResponse(board) {

    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            let tempBoard = [...board];
            tempBoard[i] = 'O';
            if (checkGameStatus(tempBoard) === 'win-O') return i;
        }
    }

    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            let tempBoard = [...board];
            tempBoard[i] = 'X';
            if (checkGameStatus(tempBoard) === 'win-X') return i;
        }
    }

    if (board[4] === null) return 4;

    let availableSquares = board.map((val, idx) => val === null ? idx : null).filter(v => v !== null);
    return availableSquares[Math.floor(Math.random() * availableSquares.length)];
}

function parseJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            callback(null, JSON.parse(body || '{}'));
        } catch (err) {
            callback(err, null);
        }
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname === '/state' && req.method === 'GET') {
        const gameId = parsedUrl.query.gameId;
        if (!gameId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing gameId parameter' }));
        }

        const db = readDatabase();
        if (!db[gameId]) {
            db[gameId] = createInitialState(gameId);
            writeDatabase(db);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(db[gameId]));
    }

    if (pathname === '/move' && req.method === 'POST') {
        return parseJsonBody(req, (err, data) => {
            const { gameId, index } = data;
            const db = readDatabase();

            if (!gameId || !db[gameId] || index === undefined) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid game payload' }));
            }

            let gameState = db[gameId];

            if (gameState.status !== 'ongoing' || gameState.board[index] !== null || gameState.turn !== 'X') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Illegal move attempted' }));
            }

            gameState.board[index] = 'X';
            gameState.status = checkGameStatus(gameState.board);

            if (gameState.status === 'ongoing') {
                gameState.turn = 'O';
                const aiIndex = computeAIResponse(gameState.board);
                if (aiIndex !== undefined) {
                    gameState.board[aiIndex] = 'O';
                    gameState.status = checkGameStatus(gameState.board);
                }
                gameState.turn = 'X';
            }

            if (gameState.status === 'win-X') gameState.scores.X++;
            else if (gameState.status === 'win-O') gameState.scores.O++;
            else if (gameState.status === 'draw') gameState.scores.draws++;

            db[gameId] = gameState;
            writeDatabase(db);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(gameState));
        });
    }

    if (pathname === '/reset' && req.method === 'POST') {
        return parseJsonBody(req, (err, data) => {
            const { gameId } = data;
            const db = readDatabase();

            if (!gameId || !db[gameId]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid game identification' }));
            }

            db[gameId] = createInitialState(gameId, db[gameId].scores);
            writeDatabase(db);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(db[gameId]));
        });
    }

    if (req.method === 'GET') {
        let safePath = pathname === '/' ? '/index.html' : pathname;
        let fileLocation = path.join(PUBLIC_DIR, safePath);

        const extname = path.extname(fileLocation);
        let contentType = 'text/html';
        switch (extname) {
            case '.css': contentType = 'text/css'; break;
            case '.js': contentType = 'application/javascript'; break;
        }

        fs.readFile(fileLocation, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server executing securely at http://localhost:${PORT}/`);
});