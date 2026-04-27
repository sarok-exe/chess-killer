// Chess Killer - Fixed: user's color detection + auto-update

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    let isUserWhite = true;
    
    async function loadStockfish() {
        if (stockfish) return stockfish;
        
        try {
            const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            const scriptText = await response.text();
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            stockfish = new Worker(URL.createObjectURL(blob));
            console.log('Chess Killer: Stockfish loaded');
            return stockfish;
        } catch (e) {
            console.error('Stockfish error:', e);
            return null;
        }
    }
    
    // Detect user's color from the board orientation
    function detectUserColor() {
        // Check if white pieces are at bottom (user is white)
        // or black pieces are at bottom (user is black)
        const whitePieces = document.querySelectorAll('.piece.wp, .piece.wr, .piece.wn, .piece.wb, .piece.wq, .piece.wk');
        const blackPieces = document.querySelectorAll('.piece.bp, .piece.br, .piece.bn, .piece.bb, .piece.bq, .piece.bk');
        
        // Check which pieces are at the bottom ranks (1-2 for white, 7-8 for black - but in DOM as square-11, square-21 etc)
        // Simpler: check if there are any white king on the left side (a1/b1 etc - rank 1)
        const whiteKingSquare = document.querySelector('.piece.wk[class*="square-"]');
        const blackKingSquare = document.querySelector('.piece.bk[class*="square-"]');
        
        if (whiteKingSquare) {
            const match = whiteKingSquare.className.match(/square-(\d+)/);
            if (match) {
                const rank = Math.floor(parseInt(match[1]) / 10);
                isUserWhite = (rank === 1 || rank === 2);
            }
        }
        
        // Alternative: check clock
        const whiteClock = document.querySelector('.clock-white');
        const selectedClock = document.querySelector('.clock-white.selected, .clock-black.selected');
        
        if (selectedClock) {
            isUserWhite = selectedClock.classList.contains('clock-white');
        }
        
        return isUserWhite;
    }
    
    function squareToFEN(squareNum) {
        const file = (squareNum % 10) - 1;
        const rank = Math.floor(squareNum / 10);
        if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
        return 'abcdefgh'[file] + rank;
    }
    
    function getBoardFEN() {
        // First check if there's a board position
        const pieces = document.querySelectorAll('.piece[class*="square-"]');
        if (pieces.length < 4) return null; // At least 2 pieces each side
        
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        pieces.forEach(piece => {
            const classes = piece.className;
            if (!classes) return;
            
            let type = '';
            let color = '';
            
            const classArr = classes.split(' ').filter(c => c);
            
            classArr.forEach(cls => {
                if (cls === 'wp' || cls === 'wr' || cls === 'wn' || cls === 'wb' || cls === 'wq' || cls === 'wk') {
                    color = 'w';
                    type = cls.substring(1);
                } else if (cls === 'bp' || cls === 'br' || cls === 'bn' || cls === 'bb' || cls === 'bq' || cls === 'bk') {
                    color = 'b';
                    type = cls.substring(1);
                }
            });
            
            const squareMatch = classes.match(/square-(\d+)/);
            if (!squareMatch || !type || !color) return;
            
            const squareNum = parseInt(squareMatch[1]);
            const fenSquare = squareToFEN(squareNum);
            
            if (fenSquare) {
                const file = fenSquare.charCodeAt(0) - 97;
                const rank = parseInt(fenSquare[1]) - 1;
                
                if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                    board[rank][file] = color === 'w' ? type.toUpperCase() : type;
                }
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
        
        // Detect whose turn
        let sideToMove = 'w';
        const turnIndicator = document.querySelector('.game-turn-indicator, .clock-white.selected, .clock-black.selected');
        if (turnIndicator) {
            if (turnIndicator.classList.contains('clock-black') || turnIndicator.classList.contains('black')) {
                sideToMove = 'b';
            }
        }
        
        return { fen: fen + ' ' + sideToMove + ' KQkq - 0 1', side: sideToMove };
    }
    
    async function analyzePosition() {
        const boardData = getBoardFEN();
        const evalEl = document.getElementById('ck-evaluation');
        const bestEl = document.getElementById('ck-best-move');
        const sideEl = document.getElementById('ck-side');
        
        if (!boardData || !boardData.fen || boardData.fen.startsWith('8/8/8/8')) {
            evalEl.textContent = 'Board not found!';
            return;
        }
        
        const { fen, side } = boardData;
        
        // Update user side display
        sideEl.textContent = `Your color: ${isUserWhite ? 'WHITE' : 'BLACK'}`;
        
        evalEl.textContent = 'Analyzing...';
        bestEl.textContent = '...';
        
        const sf = await loadStockfish();
        if (!sf) {
            evalEl.textContent = 'Engine error!';
            return;
        }
        
        // Store response for eval parsing
        let bestMove = null;
        
        sf.onmessage = function(e) {
            const msg = e.data;
            
            if (msg.includes('bestmove')) {
                const move = msg.split('bestmove ')[1]?.split(' ')[0];
                if (move) {
                    bestMove = move;
                    displayMove(move, side);
                    evalEl.textContent = 'Done!';
                }
            }
            
            if (msg.includes('info depth')) {
                const evalMatch = msg.match(/score (cp|mate) ([-\d]+)/);
                if (evalMatch) {
                    const score = parseInt(evalMatch[2]);
                    let displayScore = evalMatch[1] === 'mate' 
                        ? `MATE: ${Math.abs(score)}` 
                        : (score / 100).toFixed(1);
                    
                    // Adjust for user perspective
                    if (!isUserWhite && score !== 0) {
                        displayScore = score > 0 ? '+' + (-score/100).toFixed(1) : '' + (-score/100).toFixed(1);
                    }
                    
                    evalEl.textContent = 'Score: ' + displayScore;
                }
            }
        };
        
        sf.postMessage('position fen ' + fen);
        sf.postMessage('go depth 15');
    }
    
    function displayMove(move, currentSide) {
        const bestEl = document.getElementById('ck-best-move');
        if (!move) return;
        
        // Extract destination square
        const to = move.substring(2, 4);
        
        let displayMove = to;
        
        // For castling
        if (move === 'e1g1' || move === 'e8g8') displayMove = 'O-O';
        else if (move === 'e1c1' || move === 'e8c8') displayMove = 'O-O-O';
        
        // Check if this is a capture or check (simplified)
        // Could add + for check
        
        bestEl.textContent = displayMove;
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
                    font-family: 'JetBrains Mono', 'Consolas', monospace;
                    z-index: 999999;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
                    border: 1px solid #ff6b6b;
                }
                #${PANEL_ID} h3 { 
                    margin: 0 0 8px 0; 
                    color: #ff6b6b; 
                    font-size: 16px;
                    text-align: center;
                }
                #${PANEL_ID} .side {
                    font-size: 10px;
                    color: #666;
                    text-align: center;
                    margin-bottom: 8px;
                    background: rgba(255,107,107,0.2);
                    padding: 4px;
                    border-radius: 4px;
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
                    margin: 8px 0;
                }
                #${PANEL_ID} .btn:active {
                    transform: scale(0.98);
                }
                #${PANEL_ID} .eval { 
                    font-size: 12px; 
                    color: #aaa; 
                    margin: 10px 0;
                    text-align: center;
                    background: rgba(0,0,0,0.3);
                    padding: 8px;
                    border-radius: 6px;
                }
                #${PANEL_ID} .best { 
                    font-size: 56px; 
                    color: #4ecdc4; 
                    text-align: center; 
                    margin: 15px 0; 
                    font-weight: bold;
                    text-shadow: 0 0 30px rgba(78,205,196,0.6);
                }
                #${PANEL_ID} .close {
                    position: absolute;
                    top: 8px;
                    right: 12px;
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    font-size: 18px;
                }
                #${PANEL_ID} .hint {
                    font-size: 9px;
                    color: #555;
                    text-align: center;
                    margin-top: 8px;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <button class="btn" id="ck-analyze">Get Best Move</button>
            <div class="side" id="ck-side">Detecting color...</div>
            <div class="eval" id="ck-evaluation">Click button</div>
            <div class="best" id="ck-best-move">--</div>
            <div class="hint">For your color only!</div>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        
        panel.querySelector('#ck-analyze').onclick = () => {
            isUserWhite = detectUserColor();
            analyzePosition();
        };
        
        // Auto-detect color on load
        setTimeout(() => {
            isUserWhite = detectUserColor();
            document.getElementById('ck-side').textContent = isUserWhite ? '♔ You are WHITE' : '♚ You are BLACK';
        }, 2000);
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        // Check for board and refresh
        const checkBoard = () => {
            const hasPieces = document.querySelector('.piece[class*="square-"]');
            if (hasPieces && !document.getElementById(PANEL_ID)) {
                createPanel();
            }
            // Update status periodically
            if (document.getElementById(PANEL_ID)) {
                const sideEl = document.getElementById('ck-side');
                if (sideEl && sideEl.textContent.includes('Detecting')) {
                    isUserWhite = detectUserColor();
                    sideEl.textContent = isUserWhite ? '♔ You are WHITE' : '♚ You are BLACK';
                }
            }
        };
        
        setInterval(checkBoard, 1500);
        checkBoard();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();