// Chess Killer - Show best move with Stockfish Blob Worker

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    let currentFen = null;
    let pendingAnalysis = false;
    
    // Load Stockfish from CDN as text and create blob worker
    async function loadStockfishBlob() {
        if (stockfish) return stockfish;
        
        try {
            // Fetch the stockfish script
            const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            const scriptText = await response.text();
            
            // Create a blob URL for the worker
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            
            stockfish = new Worker(blobUrl);
            
            stockfish.onmessage = function(e) {
                const msg = e.data;
                
                if (msg.includes('bestmove')) {
                    const move = msg.split('bestmove ')[1]?.split(' ')[0];
                    const bestEl = document.getElementById('ck-best-move');
                    if (bestEl && move) {
                        // Format move to show nicer (e2e4 -> e4)
                        bestEl.textContent = formatMove(move);
                    }
                    pendingAnalysis = false;
                }
                
                if (msg.includes('info depth')) {
                    const evalMatch = msg.match(/score (cp|mate) ([-\d]+)/);
                    if (evalMatch) {
                        const score = parseInt(evalMatch[2]);
                        const evalStr = evalMatch[1] === 'mate' 
                            ? `MATE: ${score > 0 ? '+' : ''}${Math.abs(score)}` 
                            : (score / 100).toFixed(1);
                        document.getElementById('ck-evaluation').textContent = evalStr;
                    }
                }
            };
            
            stockfish.onerror = function(e) {
                console.error('Stockfish error:', e);
                pendingAnalysis = false;
            };
            
            return stockfish;
        } catch (e) {
            console.error('Failed to load Stockfish:', e);
            return null;
        }
    }
    
    function formatMove(move) {
        // Convert UCI to SAN-ish (e2e4 -> e4)
        if (!move || move.length < 4) return move;
        return move.substring(2, 4);
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
        
        currentFen = fen;
        evalEl.textContent = 'Loading engine...';
        bestEl.textContent = '...';
        
        const sf = await loadStockfishBlob();
        
        if (!sf) {
            evalEl.textContent = 'Engine failed!';
            bestEl.textContent = '--';
            return;
        }
        
        // Clear previous results
        bestEl.textContent = '...';
        
        // Send position to Stockfish
        sf.postMessage('position fen ' + fen);
        sf.postMessage('go depth 15');
        
        pendingAnalysis = true;
        
        // Auto-clear after 5 seconds
        setTimeout(() => {
            if (pendingAnalysis) {
                evalEl.textContent = 'Timeout';
                pendingAnalysis = false;
            }
        }, 5000);
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
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                #${PANEL_ID} .btn {
                    background: linear-gradient(135deg, #4ecdc4, #44a08d);
                    color: #1a1a2e;
                    border: none;
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                    font-size: 13px;
                    transition: transform 0.1s;
                }
                #${PANEL_ID} .btn:active {
                    transform: scale(0.98);
                }
                #${PANEL_ID} .eval { 
                    font-size: 11px; 
                    color: #888; 
                    margin: 10px 0;
                    text-align: center;
                    background: rgba(0,0,0,0.3);
                    padding: 6px;
                    border-radius: 4px;
                }
                #${PANEL_ID} .best { 
                    font-size: 32px; 
                    color: #4ecdc4; 
                    text-align: center; 
                    margin: 10px 0; 
                    font-weight: bold;
                    background: rgba(78,205,196,0.15);
                    padding: 15px;
                    border-radius: 8px;
                    letter-spacing: 3px;
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
                #${PANEL_ID} .label {
                    font-size: 9px;
                    color: #666;
                    text-align: center;
                }
                #${PANEL_ID} .warning {
                    font-size: 8px;
                    color: #ff6b6b;
                    text-align: center;
                    margin-top: 8px;
                    opacity: 0.6;
                }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ Chess Killer</h3>
            <div class="label">EVALUATION</div>
            <div class="eval" id="ck-evaluation">Click Analyze</div>
            <div class="label">BEST MOVE</div>
            <div class="best" id="ck-best-move">--</div>
            <button class="btn" id="ck-analyze">Find Best Move</button>
            <div class="warning">Analysis only!</div>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        panel.querySelector('#ck-analyze').onclick = analyzePosition;
    }
    
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        // Check for board periodically
        setInterval(() => {
            const hasPieces = document.querySelector('.piece[class*="square-"]');
            if (hasPieces && !document.getElementById(PANEL_ID)) {
                createPanel();
                console.log('Chess Killer: Panel created');
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