// Chess Killer - Updated for all chess.com board states

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let stockfish = null;
    
    function initStockfish() {
        if (stockfish) return stockfish;
        
        try {
            stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.0/dist/stockfish.js');
            console.log('Chess Killer: Stockfish loaded');
        } catch (e) {
            console.error('Stockfish init failed:', e);
            return null;
        }
        
        stockfish.onmessage = function(e) {
            const msg = e.data;
            if (msg.includes('bestmove')) {
                const move = msg.split('bestmove ')[1]?.split(' ')[0];
                document.getElementById('ck-best-move').textContent = move || 'None';
            }
            if (msg.includes('info depth')) {
                const evalMatch = msg.match(/score (cp|mate) ([-\d]+)/);
                if (evalMatch) {
                    const score = parseInt(evalMatch[2]);
                    const evalStr = evalMatch[1] === 'mate' 
                        ? `Mate: ${score > 0 ? '+' : ''}${Math.abs(score)}` 
                        : (score / 100).toFixed(2);
                    document.getElementById('ck-evaluation').textContent = evalStr;
                }
            }
        };
        
        return stockfish;
    }
    
    // Get board using multiple methods
    function getBoardFEN() {
        const files = 'abcdefgh';
        const ranks = '87654321';
        let fen = '';
        
        // Try all possible board selectors
        const boardSelectors = [
            '.board', 
            '.chess-board',
            '[class*="board"]',
            '#board',
            '.cg-board',
            '.game-board'
        ];
        
        let board = null;
        for (const sel of boardSelectors) {
            board = document.querySelector(sel);
            if (board) break;
        }
        
        if (!board) {
            // Fallback: look for any element with data-square
            const squares = document.querySelectorAll('[data-square]');
            if (squares.length === 0) {
                return null;
            }
        }
        
        // Build FEN
        for (let r = 0; r < 8; r++) {
            let emptyCount = 0;
            
            for (let f = 0; f < 8; f++) {
                const square = files[f] + ranks[r];
                
                // Try multiple selectors
                let piece = document.querySelector(
                    `[data-square="${square}"] .piece, ` +
                    `.square-${square} .piece, ` +
                    `[class*="square"] [data-square="${square}"] .piece`
                );
                
                if (!piece) {
                    // Try finding by piece position
                    const allPieces = document.querySelectorAll('.piece');
                    allPieces.forEach(p => {
                        const sq = p.closest('[data-square]');
                        if (sq && sq.dataset.square === square) {
                            piece = p;
                        }
                    });
                }
                
                if (piece && piece.className) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    let type = '';
                    const cls = piece.className.toString();
                    
                    if (cls.includes('pawn')) type = 'p';
                    else if (cls.includes('knight') || cls.includes('n')) type = 'n';
                    else if (cls.includes('bishop') || cls.includes('b') && !cls.includes('web')) type = 'b';
                    else if (cls.includes('rook') || cls.includes('r')) type = 'r';
                    else if (cls.includes('queen') || cls.includes('q')) type = 'q';
                    else if (cls.includes('king') || cls.includes('k')) type = 'k';
                    
                    if (type && cls.includes('white')) {
                        type = type.toUpperCase();
                    }
                    
                    if (type) fen += type;
                } else {
                    emptyCount++;
                }
            }
            
            if (emptyCount > 0) fen += emptyCount;
            if (r < 7) fen += '/';
        }
        
        if (fen === '8/8/8/8/8/8/8/8') {
            return null; // Empty board
        }
        
        // Side to move
        let side = 'w';
        const turnEl = document.querySelector('.game-turn-indicator, .turn-indicator, [class*="turn"]');
        if (turnEl && turnEl.className.includes('black')) side = 'b';
        
        return fen + ' ' + side + ' KQkq - 0 1';
    }
    
    // Find chessboard differently - look at piece positions
    function getBoardFEN_alt() {
        const pieces = document.querySelectorAll('[data-square] .piece');
        if (pieces.length === 0) {
            // Try inline styles
            const styled = document.querySelectorAll('[style*="background-image"]');
            console.log('Chess Killer: Found styled elements:', styled.length);
            return null;
        }
        
        const pieceMap = {
            'p': 'p', 'n': 'n', 'b': 'b', 'r': 'r', 'q': 'q', 'k': 'k'
        };
        
        const board = {};
        pieces.forEach(p => {
            const sq = p.closest('[data-square]');
            if (!sq) return;
            
            const square = sq.dataset.square;
            if (!square || square.length !== 2) return;
            
            const cls = p.className;
            let type = '';
            
            if (cls.includes('pawn')) type = 'p';
            else if (cls.includes('knight')) type = 'n';
            else if (cls.includes('bishop')) type = 'b';
            else if (cls.includes('rook')) type = 'r';
            else if (cls.includes('queen')) type = 'q';
            else if (cls.includes('king')) type = 'k';
            
            if (!type) return;
            
            if (cls.includes('white')) type = type.toUpperCase();
            board[square] = type;
        });
        
        if (Object.keys(board).length === 0) return null;
        
        const files = 'abcdefgh';
        let fen = '';
        
        for (let r = 8; r >= 1; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const sq = files[f] + r;
                if (board[sq]) {
                    if (empty) { fen += empty; empty = 0; }
                    fen += board[sq];
                } else {
                    empty++;
                }
            }
            if (empty) fen += empty;
            if (r > 1) fen += '/';
        }
        
        let side = 'w';
        const turnIndicator = document.querySelector('.game-turn-indicator, [class*="turn-indicator"]');
        if (turnIndicator?.className?.includes('white') === false) side = 'b';
        if (turnIndicator?.className?.includes('black')) side = 'b';
        
        return fen + ' ' + side + ' KQkq - 0 1';
    }
    
    function analyzePosition() {
        let fen = getBoardFEN();
        
        // Try alternative method
        if (!fen || fen.startsWith('8/8')) {
            fen = getBoardFEN_alt();
        }
        
        console.log('Chess Killer: FEN =', fen);
        
        if (!fen) {
            document.getElementById('ck-evaluation').textContent = 'Board not found! Refresh page';
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
                    width: 200px;
                    background: linear-gradient(145deg, #1a1a2e, #0f0f1a);
                    color: #fff;
                    padding: 14px;
                    border-radius: 10px;
                    font-family: 'Consolas', monospace;
                    z-index: 999999;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
                    border: 1px solid #ff6b6b;
                }
                #${PANEL_ID} h3 { margin: 0 0 10px 0; color: #ff6b6b; font-size: 14px; }
                #${PANEL_ID} .btn {
                    background: #4ecdc4;
                    color: #000;
                    border: none;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-weight: bold;
                }
                #${PANEL_ID} .eval { font-size: 11px; color: #888; margin: 8px 0; text-align: center; }
                #${PANEL_ID} .best { font-size: 22px; color: #4ecdc4; text-align: center; margin: 8px 0; }
                #${PANEL_ID} .close {
                    position: absolute;
                    top: 5px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
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
    
    // Monitor for board changes
    function init() {
        if (!window.location.hostname.includes('chess.com')) return;
        
        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                document.getElementById(PANEL_ID)?.remove();
            }
            // Try create panel when board appears
            const hasBoard = document.querySelector('[data-square], .board, .chess-board, .cg-board');
            if (hasBoard && !document.getElementById(PANEL_ID)) {
                createPanel();
            }
        }).observe(document.body, { childList: true, subtree: true });
        
        createPanel();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();