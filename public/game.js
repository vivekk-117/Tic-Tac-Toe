let gameId = localStorage.getItem('ticTacToeGameId');
if (!gameId) {
    gameId = 'session_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('ticTacToeGameId', gameId);
}

const gridCells = document.querySelectorAll('.cell');
const statusLabel = document.querySelector('#status');
const restartBtn = document.querySelector('#reset');
const humanScoreLabel = document.querySelector('.score-card.x .num');
const drawsScoreLabel = document.querySelector('.score-card.tie .num');
const computerScoreLabel = document.querySelector('.score-card.o .num');

let inputsDisabled = false;

async function fetchCurrentGameState() {
    try {
        const response = await fetch(`/state?gameId=${gameId}`);
        const stateData = await response.json();
        updateGameInterface(stateData);
    } catch (err) {
        console.error('Failed to parse persistent state from file database:', err);
    }
}

async function processCellSelection(cellIndex) {
    if (inputsDisabled) return;
    inputsDisabled = true;

    try {
        const response = await fetch('/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: gameId, index: cellIndex })
        });

        if (response.ok) {
            const updatedState = await response.json();
            updateGameInterface(updatedState);
        } else {
            const errorData = await response.json();
            console.warn('Move rejected by rule validator:', errorData.error);
        }
    } catch (err) {
        console.error('Network failure connecting move action payload:', err);
    } finally {
        inputsDisabled = false;
    }
}

async function requestMatchReset() {
    try {
        const response = await fetch('/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: gameId })
        });
        const resetState = await response.json();
        updateGameInterface(resetState);
    } catch (err) {
        console.error('Error handling reset request sequences:', err);
    }
}

function updateGameInterface(state) {
    state.board.forEach((marker, index) => {
        const cell = gridCells[index];
        if (cell) {
            cell.classList.remove('x', 'o', 'win');
            if (marker === 'X') cell.classList.add('x');
            if (marker === 'O') cell.classList.add('o');
        }
        if (state.status === 'win-X' || state.status === 'win-O') {
            const winner = state.status === 'win-X' ? 'X' : 'O';
            const winningCombos = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
                [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
            ];

            for (let combo of winningCombos) {
                const [a, b, c] = combo;
                if (state.board[a] === winner && state.board[b] === winner && state.board[c] === winner) {
                    gridCells[a].classList.add('win');
                    gridCells[b].classList.add('win');
                    gridCells[c].classList.add('win');
                    break;
                }
            }
        }
        if (humanScoreLabel) humanScoreLabel.textContent = state.scores.X;
        if (computerScoreLabel) computerScoreLabel.textContent = state.scores.O;
        if (drawsScoreLabel) drawsScoreLabel.textContent = state.scores.draws;
    });

    if (state.status === 'ongoing') {
        statusLabel.textContent = `Your Turn (X)`;
        inputsDisabled = false;
    } else if (state.status === 'win-X') {
        statusLabel.textContent = `Victory! You beat the computer! 🎉`;
        inputsDisabled = true;
    } else if (state.status === 'win-O') {
        statusLabel.textContent = `Defeat! The Computer wins. 🤖`;
        inputsDisabled = true;
    } else if (state.status === 'draw') {
        statusLabel.textContent = `It's a draw! Tie game.`;
        inputsDisabled = true;
    }

    if (humanScoreLabel) humanScoreLabel.textContent = state.scores.X;
    if (computerScoreLabel) computerScoreLabel.textContent = state.scores.O;
    if (drawsScoreLabel) drawsScoreLabel.textContent = state.scores.draws;
}

gridCells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        if (cell.textContent === '' && !inputsDisabled) {
            processCellSelection(index);
        }
    });
});

if (restartBtn) {
    restartBtn.addEventListener('click', requestMatchReset);
}

document.addEventListener('DOMContentLoaded', fetchCurrentGameState);