// Chess Killer - Automatic analysis after each move

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    let lastFen = null;
    let currentSideToMove = 'w';
    
    async function loadStockfish() {
        if (stockfish) return stockfish;
        
        try {
            const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            const scriptText = await response.text();
            stockfish = new Worker(URL.createObjectURL(new Blob([scriptText], { type: 'application/javascript' })));
            return stockfish;
        } catch (e) {
            console.error('Stockfish error:', e);
            return null;
        }
    }
    
    function getChessBoard() {
        const selectors = ['.board:not(chess-board)', '.chessboard', 'chess-board', '#chessboard'];
        for (const sel of selectors) {
            const board = document.querySelector(sel);
            if (board?.chessBoard) return board.chessBoard;
        }
        return null;
    }
    
    function getSideFromDOM() {
        const whiteClock = document.querySelector('.clock-white');
        const blackClock = document.querySelector('.clock-black');
        
        if (whiteClock?.classList.contains('selected')) return 'w';
        if (blackClock?.classList.contains('selected')) return 'b';
        
        const indicator = document.querySelector('.game-turn-indicator');
        if (indicator?.classList.contains('white')) return 'w';
        if (indicator?.classList.contains('black')) return 'b';
        
        return null;
    }
    
    function getPlayerColor() {
        const chessBoard = getChessBoard();
        if (chessBoard?._player) return chessBoard._player;
        return 'w';
    }
    
    function getBoardFEN() {
        const chessBoard = getChessBoard();
        
        if (chessBoard) {
            try {
                if (chessBoard.getFen) {
                    return chessBoard.getFen();
                }
                if (chessBoard.gameSetup?.pieces) {
                    const pieces = chessBoard.gameSetup.pieces;
                    const board = Array(8).fill(null).map(() => Array(8).fill(null));
                    
                    pieces.forEach(p => {
                        const file = p.area.charCodeAt(0) - 97;
                        const rank = parseInt(p.area[1]) - 1;
                        if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                            let piece = p.type;
                            if (p.side === 'w') piece = piece.toUpperCase();
                            board[rank][file] = piece;
                        }
                    });
                    
                    let fen = '';
                    for (let r = 7; r >= 0; r--) {
                        let empty = 0;
                        for (let f = 0; f < 8; f++) {
                            if (board[r][f]) {
                                if (empty > 0) { fen += empty; empty = 0; }
                                fen += board[r][f];
                            } else empty++;
                        }
                        if (empty > 0) fen += empty;
                        if (r > 0) fen += '/';
                    }
                    
                    const side = getSideFromDOM() || 'w';
                    return fen + ' ' + side + ' KQkq - 0 1';
                }
            } catch (e) {}
        }
        
        // Fallback: parse from DOM
        const pieces = document.querySelectorAll('.piece[class*="square-"]');
        if (pieces.length > 0) {
            const classMap = {
                'wp': 'P', 'wr': 'R', 'wn': 'N', 'wb': 'B', 'wq': 'Q', 'wk': 'K',
                'bp': 'p', 'br': 'r', 'bn': 'n', 'bb': 'b', 'bq': 'q', 'bk': 'k'
            };
            
            const board = Array(8).fill(null).map(() => Array(8).fill(null));
            
            pieces.forEach(piece => {
                const classes = piece.className || '';
                const classArr = classes.split(' ');
                let pieceCode = '';
                
                classArr.forEach(cls => {
                    if (classMap[cls]) pieceCode = classMap[cls];
                });
                
                if (!pieceCode) return;
                
                const match = classes.match(/square-(\d+)/);
                if (!match) return;
                
                const squareNum = parseInt(match[1]);
                const file = (squareNum % 10) - 1;
                const rank = Math.floor(squareNum / 10) - 1;
                
                if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                    board[rank][file] = pieceCode;
                }
            });
            
            let fen = '';
            for (let r = 7; r >= 0; r--) {
                let empty = 0;
                for (let f = 0; f < 8; f++) {
                    if (board[r][f]) {
                        if (empty > 0) { fen += empty; empty = 0; }
                        fen += board[r][f];
                    } else empty++;
                }
                if (empty > 0) fen += empty;
                if (r > 0) fen += '/';
            }
            
            const side = getSideFromDOM() || 'w';
            return fen + ' ' + side + ' KQkq - 0 1';
        }
        
        return null;
    }
    
    async function analyzeAndShow() {
        const evalEl = document.getElementById('ck-evaluation');
        const bestEl = document.getElementById('ck-best-move');
        const sideEl = document.getElementById('ck-side');
        
        const fen = getBoardFEN();
        const side = getSideFromDOM();
        const playerColor = getPlayerColor();
        
        if (!fen || fen.startsWith('8/8/8/8')) {
            sideEl.textContent = 'Waiting for game...';
            bestEl.textContent = '--';
            return;
        }
        
        // Only analyze if it's player's turn
        if (side !== playerColor) {
            const otherPlayer = playerColor === 'w' ? 'WHITE' : 'BLACK';
            sideEl.textContent = `♔ Opponent's move (${otherPlayer})`;
            evalEl.textContent = "Waiting...";
            bestEl.textContent = '--';
            return;
        }
        
        // Check if position changed
        if (fen === lastFen) return;
        lastFen = fen;
        
        const playerName = playerColor === 'w' ? 'WHITE' : 'BLACK';
        sideEl.textContent = `♔ Your move (${playerName})`;
        evalEl.textContent = 'Analyzing...';
        bestEl.textContent = '...';
        
        const sf = await loadStockfish();
        if (!sf) {
            evalEl.textContent = 'Engine error!';
            return;
        }
        
        // Clear previous handler
        sf.onmessage = null;
        
        let gotBestMove = false;
        
        sf.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const move = e.data.split('bestmove ')[1]?.split(' ')[0];
                if (move && !gotBestMove) {
                    gotBestMove = true;
                    
                    // Format move
                    let display = '';
                    if (move === 'e1g1' || move === 'e8g8') display = 'O-O';
                    else if (move === 'e1c1' || move === 'e8c8') display = 'O-O-O';
                    else if (move.length >= 4) display = move.substring(2, 4);
                    else display = move;
                    
                    bestEl.textContent = display;
                    evalEl.textContent = 'Best move found!';
                }
            }
            
            if (e.data.includes('info depth')) {
                const match = e.data.match(/score (cp|mate) ([-\d]+)/);
                if (match) {
                    const score = parseInt(match[2]);
                    let display = match[1] === 'mate' ? `MATE: ${Math.abs(score)}` : (score / 100).toFixed(1);
                    evalEl.textContent = display;
                }
            }
        };
        
        sf.postMessage('position fen ' + fen);
        sf.postMessage('go depth 15');
    }
    
    // Watch for board changes and analyze
    function startAutoAnalysis() {
        let lastBoardState = '';
        
        const checkAndAnalyze = () => {
            const fen = getBoardFEN();
            const side = getSideFromDOM();
            
            if (fen && (fen !== lastBoardState || side !== currentSideToMove)) {
                lastBoardState = fen || '';
                currentSideToMove = side || 'w';
                analyzeAndShow();
            }
        };
        
        // Check every 1 second
        setInterval(checkAndAnalyze, 1000);
        
        // Also check after clicks on the page (moves)
        document.addEventListener('click', () => {
            setTimeout(checkAndAnalyze, 500);
        });
        
        // Check when game events fire
        document.addEventListener('ccHelper-draw', checkAndAnalyze);
    }
    
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;
        
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <style>
                #${PANEL_ID} {
                    position: fixed;
                    top: 50%;
                    right: 20px;
                    transform: translateY(-50%);
                    width: 200px;
                    background: linear-gradient(145deg, #1a1a2e, #0f0f1a);
                    color: #fff;
                    padding: 16px;
                    border-radius: 12px;
                    font-family: 'JetBrains Mono', monospace;
                    z-index: 999999;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
                    border: 1px solid #ff6b6b;
                }
                #${PANEL_ID} h3 { margin: 0 0 8px 0; color: #ff6b6b; font-size: 16px; text-align: center; }
                #${PANEL_ID} .side {
                    font-size: 11px;
                    text-align: center;
                    margin-bottom: 10px;
                    padding: 8px;
                    border-radius: 6px;
                    background: rgba(78,205,196,0.15);
                    color: #4ecdc4;
                }
                #${PANEL_ID} .eval { 
                    font-size: 12px; color: #888; margin: 10px 0; text-align: center;
                    background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;
                }
                #${PANEL_ID} .best { 
                    font-size: 56px; color: #4ecdc4; text-align: center; 
                    margin: 15px 0; font-weight: bold;
                    text-shadow: 0 0 30px rgba(78,205,196,0.7);
                }
                #${PANEL_ID} .close {
                    position: absolute; top: 8px; right: 12px;
                    background: none; border: none; color: #555;
                    cursor: pointer; font-size: 18px;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <div class="side" id="ck-side">Detecting...</div>
            <div class="eval" id="ck-evaluation">Auto-analyzing</div>
            <div class="best" id="ck-best-move">--</div>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        
        startAutoAnalysis();
        setTimeout(analyzeAndShow, 1000);
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        setInterval(() => {
            const hasStuff = getChessBoard() || document.querySelector('.piece[class*="square-"], .board, .chessboard');
            if (hasStuff && !document.getElementById(PANEL_ID)) {
                createPanel();
            }
        }, 1500);
        
        createPanel();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();