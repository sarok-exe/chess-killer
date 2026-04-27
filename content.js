// Chess Killer - Show the best move to play

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    let lastBestMove = null;
    
    // Create Stockfish from blob
    async function loadStockfish() {
        if (stockfish) return stockfish;
        
        try {
            const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            const scriptText = await response.text();
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            stockfish = new Worker(URL.createObjectURL(blob));
            
            stockfish.onmessage = function(e) {
                const msg = e.data;
                
                if (msg.includes('bestmove') && !msg.includes('pv')) {
                    const parts = msg.split('bestmove ');
                    if (parts[1]) {
                        const move = parts[1].trim().split(' ')[0];
                        if (move && move.length >= 4) {
                            lastBestMove = move;
                            displayBestMove(move);
                        }
                    }
                }
            };
            
            console.log('Chess Killer: Stockfish loaded successfully');
            return stockfish;
        } catch (e) {
            console.error('Stockfish load error:', e);
            return null;
        }
    }
    
    function displayBestMove(move) {
        const bestEl = document.getElementById('ck-best-move');
        if (!bestEl || !move) return;
        
        // Format: e2e4 -> e4
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        
        // Try to get piece type
        const pieceTypes = {
            'p': '', 'n': 'N', 'b': 'B', 'r': 'R', 'q': 'Q', 'k': 'K'
        };
        
        let notation = to;
        
        // Check for castling
        if (move === 'e1g1' || move === 'e1c1' || move === 'e8g8' || move === 'e8c8') {
            if (move.includes('g')) notation = 'O-O';
            else notation = 'O-O-O';
        } else {
            // For pawn moves, just show destination (e2e4 -> e4)
            // For pieces, show piece + destination (g1f3 -> Nf3)
            // This is simplified - proper SAN would need more logic
        }
        
        bestEl.textContent = notation;
        
        // Add arrow/indicator effect
        bestEl.style.animation = 'none';
        bestEl.offsetHeight; // Trigger reflow
        bestEl.style.animation = 'pulse 0.5s ease-in-out';
    }
    
    function squareToFEN(squareNum) {
        const file = (squareNum % 10) - 1;
        const rank = Math.floor(squareNum / 10);
        if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
        return 'abcdefgh'[file] + rank;
    }
    
    function getBoardFEN() {
        const pieces = document.querySelectorAll('.piece[class*="square-"]');
        if (pieces.length === 0) return null;
        
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
        
        let sideToMove = 'w';
        if (document.querySelector('.clock-black')?.classList.contains('selected')) {
            sideToMove = 'b';
        }
        
        return fen + ' ' + sideToMove + ' KQkq - 0 1';
    }
    
    async function analyzePosition() {
        const fen = getBoardFEN();
        const evalEl = document.getElementById('ck-evaluation');
        const bestEl = document.getElementById('ck-best-move');
        
        if (!fen || fen.startsWith('8/8/8/8')) {
            evalEl.textContent = 'Board not found!';
            bestEl.textContent = '--';
            return;
        }
        
        lastBestMove = null;
        bestEl.textContent = '...';
        evalEl.textContent = 'Thinking...';
        
        const sf = await loadStockfish();
        
        if (!sf) {
            evalEl.textContent = 'Engine error!';
            return;
        }
        
        // Send position
        sf.postMessage('position fen ' + fen);
        
        // Get best move with moderate depth for speed
        sf.postMessage('go depth 12');
        
        // Wait for result
        let waitCount = 0;
        const checkInterval = setInterval(() => {
            waitCount++;
            
            // Check evaluation
            if (sf.lastResponse?.includes('score')) {
                const evalMatch = sf.lastResponse.match(/score (cp|mate) ([-\d]+)/);
                if (evalMatch) {
                    const score = parseInt(evalMatch[2]);
                    evalEl.textContent = evalMatch[1] === 'mate' 
                        ? `MATE: ${Math.abs(score)}` 
                        : (score > 0 ? '+' : '') + (score / 100).toFixed(1);
                }
            }
            
            if (lastBestMove || waitCount > 30) {
                clearInterval(checkInterval);
                if (!lastBestMove) {
                    evalEl.textContent = 'Timeout';
                    bestEl.textContent = '--';
                }
            }
        }, 100);
        
        // Store last message for evaluation
        const originalOnMessage = sf.onmessage;
        sf.lastResponse = '';
        sf.onmessage = function(e) {
            sf.lastResponse = e.data;
            originalOnMessage(e);
        };
    }
    
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;
        
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                #${PANEL_ID} {
                    position: fixed;
                    top: 50%;
                    right: 20px;
                    transform: translateY(-50%);
                    width: 180px;
                    background: linear-gradient(145deg, #1a1a2e, #0f0f1a);
                    color: #fff;
                    padding: 14px;
                    border-radius: 10px;
                    font-family: 'JetBrains Mono', 'Consolas', monospace;
                    z-index: 999999;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                    border: 1px solid #ff6b6b;
                }
                #${PANEL_ID} h3 { 
                    margin: 0 0 10px 0; 
                    color: #ff6b6b; 
                    font-size: 14px;
                }
                #${PANEL_ID} .btn {
                    background: linear-gradient(135deg, #4ecdc4, #44a08d);
                    color: #1a1a2e;
                    border: none;
                    padding: 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                    font-size: 14px;
                }
                #${PANEL_ID} .eval { 
                    font-size: 12px; 
                    color: #aaa; 
                    margin: 10px 0;
                    text-align: center;
                }
                #${PANEL_ID} .best { 
                    font-size: 48px; 
                    color: #4ecdc4; 
                    text-align: center; 
                    margin: 15px 0; 
                    font-weight: bold;
                    text-shadow: 0 0 20px rgba(78,205,196,0.5);
                }
                #${PANEL_ID} .close {
                    position: absolute;
                    top: 6px;
                    right: 10px;
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    font-size: 16px;
                }
                #${PANEL_ID} .hint {
                    font-size: 8px;
                    color: #666;
                    text-align: center;
                    margin-top: 8px;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <button class="btn" id="ck-analyze">Show Best Move</button>
            <div class="eval" id="ck-evaluation">Click button</div>
            <div class="best" id="ck-best-move">--</div>
            <div class="hint">The move you need to play</div>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        panel.querySelector('#ck-analyze').onclick = analyzePosition;
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        setInterval(() => {
            const hasPieces = document.querySelector('.piece[class*="square-"]');
            if (hasPieces && !document.getElementById(PANEL_ID)) {
                createPanel();
            }
        }, 1000);
        
        createPanel();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();