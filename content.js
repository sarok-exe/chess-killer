// Chess Killer - Based on ChessCheat logic using chess.com's Stockfish

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    
    console.log('Chess Killer: Starting (ChessCheat approach)...');
    
    // Use chess.com's built-in Stockfish engine!
    function getStockfishEngine() {
        // Try to get chess.com's engine window
        if (window.JSChessEngine && window.JSChessEngine.stockfish) {
            console.log('Chess Killer: Found stockfish via JSChessEngine');
            return window.JSChessEngine.stockfish;
        }
        
        // Try global stockfish
        if (window.stockfish) {
            console.log('Chess Killer: Found global stockfish');
            return window.stockfish;
        }
        
        // Try to find worker in DOM
        const scripts = document.querySelectorAll('script[src*="stockfish"]');
        console.log('Chess Killer: Found stockfish scripts:', scripts.length);
        
        return null;
    }
    
    // Get FEN from chess.com board - chesscheat method
    function getFenString() {
        const chessboard = document.querySelector('wc-chess-board, .board, .chessboard, #chess-board');
        
        // Determine player color (flipped board = black)
        let player_colour = 'w';
        if (chessboard && chessboard.classList.contains('flipped')) {
            player_colour = 'b';
        }
        
        let fen_string = "";
        
        // Iterate through all squares (1-8, a-h)
        for (let i = 8; i >= 1; i--) {
            for (let j = 1; j <= 8; j++) {
                let position = `${j}${i}`;
                
                if (j == 1 && i != 8) {
                    fen_string += "/";
                }
                
                // Get piece at this position
                let piece = document.querySelector(`.piece.square-${position}`);
                let piece_class = piece?.className || null;
                
                if (piece_class && piece_class.includes('piece')) {
                    // Parse piece class like "piece wp square-41" -> wp -> white pawn
                    let piece_code = null;
                    const classes = piece_class.split(' ');
                    
                    for (let cls of classes) {
                        // Map piece classes
                        if (cls === 'wp') piece_code = 'P';
                        else if (cls === 'wr') piece_code = 'R';
                        else if (cls === 'wn') piece_code = 'N';
                        else if (cls === 'wb') piece_code = 'B';
                        else if (cls === 'wq') piece_code = 'Q';
                        else if (cls === 'wk') piece_code = 'K';
                        else if (cls === 'bp') piece_code = 'p';
                        else if (cls === 'br') piece_code = 'r';
                        else if (cls === 'bn') piece_code = 'n';
                        else if (cls === 'bb') piece_code = 'b';
                        else if (cls === 'bq') piece_code = 'q';
                        else if (cls === 'bk') piece_code = 'k';
                    }
                    
                    if (piece_code) {
                        fen_string += piece_code;
                    }
                } else {
                    // Empty square - compress consecutive empty squares
                    let prev_char = fen_string.slice(-1);
                    if (!isNaN(Number(prev_char))) {
                        fen_string = fen_string.slice(0, -1);
                        fen_string += Number(prev_char) + 1;
                    } else {
                        fen_string += "1";
                    }
                }
            }
        }
        
        fen_string += " " + player_colour;
        
        // Castling rights
        fen_string += " KQkq";
        
        // En passant
        fen_string += " -";
        
        // Half move clock & full move number
        fen_string += " 0 1";
        
        console.log('Chess Killer: FEN =', fen_string);
        return fen_string;
    }
    
    // Detect if it's player's turn
    function isPlayerTurn() {
        const chessboard = document.querySelector('wc-chess-board, .board, .chessboard');
        
        if (!chessboard) return true;
        
        // If board is flipped, player is black
        const playerIsBlack = chessboard.classList.contains('flipped');
        
        // Get whose turn it is from clock
        const whiteClock = document.querySelector('.clock-white');
        const blackClock = document.querySelector('.clock-black');
        
        let whiteToMove = false;
        let blackToMove = false;
        
        if (whiteClock?.classList.contains('selected') || whiteClock?.closest('.selected')) {
            whiteToMove = true;
        }
        if (blackClock?.classList.contains('selected') || blackClock?.closest('.selected')) {
            blackToMove = true;
        }
        
        if (playerIsBlack) {
            return blackToMove;
        } else {
            return whiteToMove;
        }
    }
    
    // Show best move on board - chesscheat style
    function showBestMoveOnBoard(bestMove) {
        const chessboard = document.querySelector('wc-chess-board, .board, .chessboard');
        if (!chessboard) return;
        
        // Remove old highlights
        document.querySelectorAll('.chess-killer-highlight').forEach(el => el.remove());
        
        // Parse move
        const char_map = { "a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8 };
        
        if (!bestMove || bestMove.length < 4) return;
        
        const fromPos = `${char_map[bestMove[0]]}${bestMove[1]}`;
        const toPos = `${char_map[bestMove[2]]}${bestMove[3]}`;
        
        console.log('Chess Killer: Highlighting', fromPos, '->', toPos);
        
        // Create highlight squares
        const fromHighlight = document.createElement('div');
        fromHighlight.className = `highlight chess-killer-highlight square-${fromPos}`;
        fromHighlight.style.cssText = 'position:absolute;background:#4ecdc4;opacity:0.5;border-radius:50%;width:40px;height:40px;z-index:1000;pointer-events:none;left:-10px;top:-10px;';
        
        const toHighlight = document.createElement('div');
        toHighlight.className = `highlight chess-killer-highlight square-${toPos}`;
        toHighlight.style.cssText = 'position:absolute;background:#ff6b6b;opacity:0.5;border-radius:50%;width:40px;height:40px;z-index:1000;pointer-events:none;left:-10px;top:-10px;';
        
        const container = chessboard.querySelector('[class*="boardarea"], [class*="board-container"], .board, .chessboard') || chessboard;
        
        try {
            container.appendChild(fromHighlight);
            container.appendChild(toHighlight);
        } catch (e) {
            console.log('Chess Killer: Could not add highlights', e);
        }
    }
    
    let chessEngine = null;
    let lastFen = '';
    
    function initEngine() {
        if (chessEngine) return chessEngine;
        
        try {
            // Try to use chess.com's engine
            // In newer chess.com, they load stockfish from bundles
            const engineUrl = '/bundles/app/js/vendor/jschessengine/stockfish.asm.js';
            
            // Create our own Stockfish worker
            const workerCode = `
                importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            chessEngine = new Worker(URL.createObjectURL(blob));
            
            console.log('Chess Killer: Created stockfish worker');
            return chessEngine;
        } catch (e) {
            console.error('Chess Killer: Engine init failed', e);
            return null;
        }
    }
    
    function analyzePosition() {
        const fen = getFenString();
        
        if (!fen || fen === lastFen) return;
        lastFen = fen;
        
        // Only analyze if it's player's turn
        if (!isPlayerTurn()) {
            const sideEl = document.getElementById('ck-side');
            const moveEl = document.getElementById('ck-best-move');
            const evalEl = document.getElementById('ck-evaluation');
            
            if (sideEl) sideEl.textContent = "♟ Opponent's turn - wait!";
            if (moveEl) moveEl.textContent = '--';
            if (evalEl) evalEl.textContent = 'Waiting...';
            
            // Remove highlights when not player turn
            document.querySelectorAll('.chess-killer-highlight').forEach(el => el.remove());
            return;
        }
        
        const evalEl = document.getElementById('ck-evaluation');
        const moveEl = document.getElementById('ck-best-move');
        const sideEl = document.getElementById('ck-side');
        
        if (evalEl) evalEl.textContent = 'Analyzing...';
        
        const engine = initEngine();
        if (!engine) {
            if (evalEl) evalEl.textContent = 'No engine!';
            return;
        }
        
        console.log('Chess Killer: Engine analyzing:', fen);
        
        engine.onmessage = function(e) {
            if (e.data.startsWith('bestmove')) {
                const bestMove = e.data.split(' ')[1];
                console.log('Chess Killer: Best move:', bestMove);
                
                if (bestMove && moveEl) {
                    let display = bestMove;
                    if (bestMove === 'e1g1' || bestMove === 'e8g8') display = 'O-O';
                    else if (bestMove === 'e1c1' || bestMove === 'e8c8') display = 'O-O-O';
                    else if (bestMove.length >= 4) display = bestMove.substring(2, 4);
                    
                    moveEl.textContent = display;
                    
                    // Show on board
                    showBestMoveOnBoard(bestMove);
                }
            }
            
            if (e.data.includes('score')) {
                const match = e.data.match(/score (cp|mate) ([-\d]+)/);
                if (match && evalEl) {
                    const score = parseInt(match[2]);
                    const disp = match[1] === 'mate' ? `M${Math.abs(score)}` : (score/100).toFixed(1);
                    evalEl.textContent = disp;
                }
            }
        };
        
        engine.postMessage('position fen ' + fen);
        engine.postMessage('go depth 15');
    }
    
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;
        
        console.log('Chess Killer: Creating panel');
        
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <style>
                #${PANEL_ID} {
                    position: fixed;
                    top: 50%;
                    right: 20px;
                    transform: translateY(-50%);
                    width: 220px;
                    background: linear-gradient(145deg, #0d0d0d, #1a1a1a);
                    color: #fff;
                    padding: 18px;
                    border-radius: 16px;
                    font-family: 'Courier New', monospace;
                    z-index: 999999;
                    box-shadow: 0 0 40px rgba(78,205,196,0.3), 0 4px 24px rgba(0,0,0,0.6);
                    border: 2px solid #4ecdc4;
                }
                #${PANEL_ID} h3 { 
                    margin: 0 0 10px 0; 
                    color: #4ecdc4; 
                    font-size: 20px; 
                    text-align: center; 
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    text-shadow: 0 0 10px rgba(78,205,196,0.5);
                }
                #${PANEL_ID} .side {
                    font-size: 12px;
                    text-align: center;
                    margin-bottom: 12px;
                    padding: 10px;
                    border-radius: 8px;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid #333;
                }
                #${PANEL_ID} .eval { 
                    font-size: 13px; 
                    color: #888; 
                    margin: 12px 0; 
                    text-align: center;
                    background: rgba(0,0,0,0.4); 
                    padding: 10px; 
                    border-radius: 8px;
                    border: 1px solid #222;
                }
                #${PANEL_ID} .best { 
                    font-size: 72px; 
                    color: #4ecdc4; 
                    text-align: center; 
                    margin: 20px 0; 
                    font-weight: bold;
                    font-family: 'Arial Black', sans-serif;
                    text-shadow: 0 0 30px rgba(78,205,196,0.8);
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                #${PANEL_ID} .close {
                    position: absolute; 
                    top: 10px; 
                    right: 15px;
                    background: none; 
                    border: none; 
                    color: #555;
                    cursor: pointer; 
                    font-size: 22px;
                }
                #${PANEL_ID} .close:hover { color: #ff6b6b; }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>♟ CHESS KILLER</h3>
            <div class="side" id="ck-side">♟ INITIALIZING...</div>
            <div class="eval" id="ck-evaluation">Starting engine...</div>
            <div class="best" id="ck-best-move">--</div>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        
        // Start analysis loop
        startAnalysis();
    }
    
    function startAnalysis() {
        console.log('Chess Killer: Starting analysis loop');
        
        let lastBoardState = '';
        
        // Main loop - check every second
        setInterval(() => {
            const fen = getFenString();
            
            // Check whose turn
            const playerTurn = isPlayerTurn();
            const sideEl = document.getElementById('ck-side');
            
            if (playerTurn) {
                if (sideEl) sideEl.innerHTML = '♟♟ YOUR TURN - FINDING MOVE ♟♟';
                sideEl?.style?.setProperty('color', '#4ecdc4');
                sideEl?.style?.setProperty('background', 'rgba(78,205,196,0.2)');
                
                // Analyze if board changed
                if (fen && fen !== lastBoardState) {
                    lastBoardState = fen;
                    analyzePosition();
                }
            } else {
                if (sideEl) sideEl.innerHTML = '♟ OPPONENT MOVING...';
                sideEl?.style?.setProperty('color', '#888');
                sideEl?.style?.setProperty('background', 'rgba(0,0,0,0.3)');
                
                // Clear when opponent moves
                const moveEl = document.getElementById('ck-best-move');
                if (moveEl && moveEl.textContent !== '--') {
                    // Keep showing last move
                }
            }
        }, 1200);
        
        // Initial analysis after page loads
        setTimeout(analyzePosition, 4000);
    }
    
    function init() {
        console.log('Chess Killer: Init');
        
        if (!window.location.hostname.includes('chess.com')) {
            console.log('Chess Killer: Not on chess.com');
            return;
        }
        
        // Wait for board to load
        setTimeout(createPanel, 3000);
        
        // Re-check periodically
        setInterval(() => {
            if (!document.getElementById(PANEL_ID) && document.querySelector('.board, .chessboard, wc-chess-board')) {
                createPanel();
            }
        }, 5000);
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();