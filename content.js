// Chess Killer - Fixed for Chess.com board structure

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    
    function initStockfish() {
        if (stockfish) return stockfish;
        
        try {
            stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.0/dist/stockfish.js');
        } catch (e) {
            console.error('Stockfish error:', e);
            return null;
        }
        
        stockfish.onmessage = function(e) {
            const msg = e.data;
            if (msg.includes('bestmove')) {
                const move = msg.split('bestmove ')[1]?.split(' ')[0];
                const bestEl = document.getElementById('ck-best-move');
                if (bestEl) bestEl.textContent = move || 'None';
            }
            if (msg.includes('info depth')) {
                const evalMatch = msg.match(/score (cp|mate) ([-\d]+)/);
                if (evalMatch) {
                    const score = parseInt(evalMatch[2]);
                    const evalStr = evalMatch[1] === 'mate' 
                        ? `Mate: ${score}` 
                        : (score / 100).toFixed(2);
                    document.getElementById('ck-evaluation').textContent = evalStr;
                }
            }
        };
        
        return stockfish;
    }
    
    // Convert square-XX to FEN (21 = a1, 81 = h1)
    function squareToFEN(squareNum) {
        const file = (squareNum % 10) - 1;  // 1->0, 2->1, ..., 8->7
        const rank = Math.floor(squareNum / 10);  // 1->0, 8->8
        const files = 'abcdefgh';
        return files[file] + rank;
    }
    
    function getBoardFEN() {
        const pieces = document.querySelectorAll('.piece[class*="square-"]');
        
        if (pieces.length === 0) {
            return null;
        }
        
        // Build FEN board array
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        pieces.forEach(piece => {
            const classes = piece.className;
            if (!classes) return;
            
            // Extract piece type and color
            let type = '';
            let color = '';
            
            // Parse class like "piece wq square-41" or "piece bp square-64"
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
            
            // Get square position
            const squareMatch = classes.match(/square-(\d+)/);
            if (!squareMatch || !type || !color) return;
            
            const squareNum = parseInt(squareMatch[1]);
            const fenSquare = squareToFEN(squareNum);
            
            if (fenSquare) {
                const file = fenSquare.charCodeAt(0) - 97;  // a=0, h=7
                const rank = parseInt(fenSquare[1]) - 1;  // 1=0, 8=7
                
                if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
                    board[rank][file] = color === 'w' ? type.toUpperCase() : type;
                }
            }
        });
        
        // Build FEN string
        let fen = '';
        for (let r = 7; r >= 0; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                if (board[r][f]) {
                    if (empty > 0) {
                        fen += empty;
                        empty = 0;
                    }
                    fen += board[r][f];
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (r > 0) fen += '/';
        }
        
        // Detect side to move
        // Check for turn indicator
        let sideToMove = 'w';
        const whiteClock = document.querySelector('.clock-white');
        const blackClock = document.querySelector('.clock-black');
        
        if (whiteClock?.classList.contains('selected')) {
            sideToMove = 'w';
        } else if (blackClock?.classList.contains('selected')) {
            sideToMove = 'b';
        } else {
            // Try alternate method - check game info
            const turnIndicator = document.querySelector('[class*="turn-indicator"]');
            if (turnIndicator?.classList?.contains('black')) {
                sideToMove = 'b';
            } else if (turnIndicator?.classList?.contains('white')) {
                sideToMove = 'w';
            }
        }
        
        console.log('Chess Killer: Found', pieces.length, 'pieces, side:', sideToMove);
        
        if (pieces.length < 2) return null;
        
        return fen + ' ' + sideToMove + ' KQkq - 0 1';
    }
    
    function analyzePosition() {
        const fen = getBoardFEN();
        
        console.log('Chess Killer FEN:', fen);
        
        if (!fen || fen.startsWith('8/8/8/8')) {
            const evalEl = document.getElementById('ck-evaluation');
            if (evalEl) evalEl.textContent = 'No board! pieces: ' + document.querySelectorAll('.piece').length;
            return;
        }
        
        const sf = initStockfish();
        if (!sf) {
            document.getElementById('ck-evaluation').textContent = 'Stockfish error!';
            return;
        }
        
        document.getElementById('ck-evaluation').textContent = 'Analyzing...';
        
        sf.postMessage('position fen ' + fen);
        sf.postMessage('go depth 12');
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
                    width: 180px;
                    background: linear-gradient(145deg, #1a1a2e, #0f0f1a);
                    color: #fff;
                    padding: 12px;
                    border-radius: 8px;
                    font-family: 'Consolas', monospace;
                    z-index: 999999;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                    border: 1px solid #ff6b6b;
                }
                #${PANEL_ID} h3 { margin: 0 0 8px 0; color: #ff6b6b; font-size: 13px; }
                #${PANEL_ID} .btn {
                    background: #4ecdc4;
                    color: #000;
                    border: none;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                    font-size: 12px;
                }
                #${PANEL_ID} .eval { font-size: 10px; color: #888; margin: 8px 0; }
                #${PANEL_ID} .best { font-size: 20px; color: #4ecdc4; text-align: center; margin: 8px 0; font-weight: bold; }
                #${PANEL_ID} .close {
                    position: absolute;
                    top: 4px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    font-size: 14px;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <div class="eval" id="ck-evaluation">Click Analyze</div>
            <div class="best" id="ck-best-move">--</div>
            <button class="btn" id="ck-analyze">Analyze</button>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        panel.querySelector('#ck-analyze').onclick = analyzePosition;
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        // Try creating panel when board loads
        const tryCreate = () => {
            const hasPieces = document.querySelector('.piece[class*="square-"]');
            if (hasPieces && !document.getElementById(PANEL_ID)) {
                createPanel();
                console.log('Chess Killer: Board detected');
            }
        };
        
        // Check periodically
        setInterval(tryCreate, 1000);
        tryCreate();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();