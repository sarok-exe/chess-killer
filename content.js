// Chess Killer - Load Stockfish inline without worker

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let sfProcess = null;
    
    // Piece values for basic evaluation
    const pieceValues = {
        'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
        'P': -100, 'N': -320, 'B': -330, 'R': -500, 'Q': -900, 'K': -20000
    };
    
    // Simple position evaluation (material + position)
    function evaluatePosition(fen) {
        const position = fen.split(' ')[0];
        let score = 0;
        
        position.split('/').forEach(row => {
            row.split('').forEach(char => {
                if (pieceValues[char]) {
                    score += pieceValues[char];
                }
            });
        });
        
        return score / 100;
    }
    
    // Convert square-XX to FEN coordinate
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
    
    // Use chess.js for move generation (simulated for now)
    function getBestMove(fen) {
        // Very basic: find moves that capture pieces
        const parts = fen.split(' ');
        const position = parts[0];
        
        // For now, return a simple evaluation
        const score = evaluatePosition(fen);
        
        if (Math.abs(score) > 10) {
            return score > 0 ? 'White wins' : 'Black wins';
        }
        
        // Simple opening moves suggestions
        const side = parts[1];
        if (position === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
            return side === 'w' ? 'e4' : 'e5';
        }
        
        return score > 0 ? '+' + score.toFixed(1) : score.toFixed(1);
    }
    
    function analyzePosition() {
        const fen = getBoardFEN();
        const evalEl = document.getElementById('ck-evaluation');
        const bestEl = document.getElementById('ck-best-move');
        
        if (!fen || fen.startsWith('8/8/8/8') || fen.includes('rn')) {
            evalEl.textContent = 'No board!';
            return;
        }
        
        evalEl.textContent = 'Analyzing...';
        
        try {
            // Use basic evaluation since Stockfish Web Workers are blocked in extensions
            setTimeout(() => {
                const score = evaluatePosition(fen);
                const move = getBestMove(fen);
                
                evalEl.textContent = 'Score: ' + (score > 0 ? '+' : '') + score.toFixed(2);
                bestEl.textContent = move;
            }, 500);
        } catch (e) {
            evalEl.textContent = 'Error: ' + e.message;
        }
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