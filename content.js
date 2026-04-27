// Chess Killer - Based on Chess-Helper approach

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    
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
    
    // Get chessboard from chess.com's internal API
    function getChessBoard() {
        // Try various selectors that chess.com uses
        const selectors = [
            '.board:not(chess-board)',
            '.chessboard',
            'chess-board',
            '#chessboard',
            '.main-board .board'
        ];
        
        for (const sel of selectors) {
            const board = document.querySelector(sel);
            if (board) {
                // Try to get internal API
                if (board.chessBoard) return board.chessBoard;
                if (board.game) return board.game;
            }
        }
        return null;
    }
    
    // Get FEN from chess.com's internal state
    function getBoardFEN() {
        const chessBoard = getChessBoard();
        
        if (!chessBoard) {
            console.log('Chess Killer: No board found');
            return null;
        }
        
        try {
            // Try to get FEN from the board
            if (chessBoard.getFen) {
                return chessBoard.getFen();
            }
            if (chessBoard.gameSetup) {
                // Build FEN from gameSetup
                const pieces = chessBoard.gameSetup.pieces;
                if (!pieces || !pieces.length) return null;
                
                const board = Array(8).fill(null).map(() => Array(8).fill(null));
                
                pieces.forEach(p => {
                    const file = p.area.charCodeAt(0) - 97;
                    const rank = parseInt(p.area[1]) - 1;
                    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                        board[rank][file] = p.type;
                    }
                });
                
                // Build FEN
                let fen = '';
                for (let r = 7; r >= 0; r--) {
                    let empty = 0;
                    for (let f = 0; f < 8; f++) {
                        if (board[r][f]) {
                            if (empty > 0) { fen += empty; empty = 0; }
                            let piece = board[r][f];
                            if (p.side === 'w') piece = piece.toUpperCase();
                            fen += piece;
                        } else {
                            empty++;
                        }
                    }
                    if (empty > 0) fen += empty;
                    if (r > 0) fen += '/';
                }
                
                // Get side to move
                const side = chessBoard.gameSetup.flags?.sm || 'w';
                
                return fen + ' ' + side + ' KQkq - 0 1';
            }
        } catch (e) {
            console.error('Chess Killer FEN error:', e);
        }
        
        return null;
    }
    
    // Detect whose turn (player color)
    function getPlayerColor() {
        const chessBoard = getChessBoard();
        if (!chessBoard) return 'w';
        
        // Try to get player's color
        try {
            if (chessBoard._player) {
                return chessBoard._player;
            }
            if (chessBoard.gameSetup) {
                return chessBoard.gameSetup.pmd?.[0] || 'w';
            }
        } catch (e) {}
        
        return 'w';
    }
    
    // Check whose turn it is
    function getSideToMove() {
        const chessBoard = getChessBoard();
        if (!chessBoard) return 'w';
        
        try {
            // From Chess-Helper code
            const sideToMove = chessBoard.gameSetup?.flags?.sm;
            return sideToMove || 'w';
        } catch (e) {
            return 'w';
        }
    }
    
    // Also try DOM-based detection
    function getSideFromDOM() {
        // Check clocks
        const whiteClock = document.querySelector('.clock-white');
        const blackClock = document.querySelector('.clock-black');
        
        if (whiteClock?.classList.contains('selected')) return 'w';
        if (blackClock?.classList.contains('selected')) return 'b';
        
        // Check turn indicator
        const indicator = document.querySelector('.game-turn-indicator');
        if (indicator?.classList.contains('white')) return 'w';
        if (indicator?.classList.contains('black')) return 'b';
        
        return null;
    }
    
    async function analyzePosition() {
        const evalEl = document.getElementById('ck-evaluation');
        const bestEl = document.getElementById('ck-best-move');
        
        // Try multiple methods to get FEN
        let fen = getBoardFEN();
        
        // Fallback: parse pieces from DOM
        if (!fen) {
            const pieces = document.querySelectorAll('.piece[class*="square-"]');
            if (pieces.length > 0) {
                fen = parsePiecesToFEN(pieces);
            }
        }
        
        if (!fen || fen.startsWith('8/8/8/8')) {
            evalEl.textContent = 'No board found!';
            bestEl.textContent = '--';
            console.log('Chess Killer: Could not get board state');
            return;
        }
        
        // Get side to move
        let side = getSideToMove();
        if (!side || side === null) {
            side = getSideFromDOM();
        }
        if (!side) side = 'w';
        
        console.log('Chess Killer: Side to move:', side);
        
        // Detect player color
        const playerColor = getPlayerColor();
        console.log('Chess Killer: Player color:', playerColor);
        
        evalEl.textContent = 'Analyzing...';
        bestEl.textContent = '...';
        
        const sf = await loadStockfish();
        if (!sf) {
            evalEl.textContent = 'Engine error!';
            return;
        }
        
        // Listen for best move
        let bestMove = null;
        
        sf.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const move = e.data.split('bestmove ')[1]?.split(' ')[0];
                if (move) {
                    bestMove = move;
                    showBestMove(move, side);
                }
            }
            
            if (e.data.includes('info depth')) {
                const match = e.data.match(/score (cp|mate) ([-\d]+)/);
                if (match) {
                    const score = parseInt(match[2]);
                    let display = match[1] === 'mate' 
                        ? `MATE: ${Math.abs(score)}` 
                        : (score / 100).toFixed(1);
                    
                    // Only show if it's player's turn to move
                    if (side === playerColor) {
                        evalEl.textContent = display;
                    } else {
                        evalEl.textContent = "Opponent's turn - waiting...";
                    }
                }
            }
        };
        
        sf.postMessage('position fen ' + fen);
        sf.postMessage('go depth 15');
    }
    
    function showBestMove(move, sideToMove) {
        const playerColor = getPlayerColor();
        const sideEl = document.getElementById('ck-side');
        
        // Only show move if it's player's turn
        if (sideToMove !== playerColor) {
            sideEl.textContent = "Wait for your turn!";
            document.getElementById('ck-evaluation').textContent = "Opponent playing...";
            document.getElementById('ck-best-move').textContent = '--';
            return;
        }
        
        sideEl.textContent = playerColor === 'w' ? '♔ Your turn (WHITE)' : '♚ Your turn (BLACK)';
        
        // Format move: e2e4 -> e4
        let displayMove = '';
        if (move.length >= 4) {
            const to = move.substring(2, 4);
            
            // Check for castling
            if (move === 'e1g1' || move === 'e8g8') displayMove = 'O-O';
            else if (move === 'e1c1' || move === 'e8c8') displayMove = 'O-O-O';
            else displayMove = to;
        }
        
        document.getElementById('ck-best-move').textContent = displayMove;
    }
    
    function parsePiecesToFEN(pieces) {
        const classMap = {
            'wp': 'P', 'wr': 'R', 'wn': 'N', 'wb': 'B', 'wq': 'Q', 'wk': 'K',
            'bp': 'p', 'br': 'r', 'bn': 'n', 'bb': 'b', 'bq': 'q', 'bk': 'k'
        };
        
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        pieces.forEach(piece => {
            const classes = piece.className || '';
            const classArr = classes.split(' ').filter(c => c);
            
            let pieceCode = '';
            classArr.forEach(cls => {
                if (classMap[cls]) pieceCode = classMap[cls];
            });
            
            if (!pieceCode) return;
            
            const squareMatch = classes.match(/square-(\d+)/);
            if (!squareMatch) return;
            
            const squareNum = parseInt(squareMatch[1]);
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
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (r > 0) fen += '/';
        }
        
        const side = getSideFromDOM() || 'w';
        
        return fen + ' ' + side + ' KQkq - 0 1';
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
                    color: #666;
                    text-align: center;
                    margin-bottom: 10px;
                    background: rgba(255,107,107,0.15);
                    padding: 6px;
                    border-radius: 6px;
                }
                #${PANEL_ID} .btn {
                    background: linear-gradient(135deg, #4ecdc4, #44a08d);
                    color: #1a1a2e;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                    font-size: 15px;
                }
                #${PANEL_ID} .eval { 
                    font-size: 12px; color: #888; margin: 10px 0; text-align: center;
                    background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;
                }
                #${PANEL_ID} .best { 
                    font-size: 52px; color: #4ecdc4; text-align: center; 
                    margin: 15px 0; font-weight: bold;
                    text-shadow: 0 0 25px rgba(78,205,196,0.7);
                }
                #${PANEL_ID} .close {
                    position: absolute; top: 8px; right: 12px;
                    background: none; border: none; color: #555;
                    cursor: pointer; font-size: 18px;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <button class="btn" id="ck-analyze">Get Best Move</button>
            <div class="side" id="ck-side">Your turn: --</div>
            <div class="eval" id="ck-evaluation">Click to analyze</div>
            <div class="best" id="ck-best-move">--</div>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        panel.querySelector('#ck-analyze').onclick = analyzePosition;
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        setInterval(() => {
            const board = getChessBoard() || document.querySelector('.piece[class*="square-"]');
            if (board && !document.getElementById(PANEL_ID)) {
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