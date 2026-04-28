// Chess Killer v2.0 - Content Script
(function() {
    'use strict';

    const PANEL_ID = 'chess-killer-panel';
    let engine = null;
    let lastFEN = '';
    let currentBestMove = null;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getBestMove') {
            sendResponse({ move: currentBestMove || 'analyzing...' });
        } else if (request.action === 'makeMove') {
            const result = makeMoveOnBoard(request.move);
            sendResponse({ success: result });
        }
        return true;
    });

    // Initialize Stockfish from extension files
    function initEngine() {
        if (engine) return engine;

        try {
            const stockfishUrl = chrome.runtime.getURL('stockfish.js');
            const workerCode = `
                importScripts('${stockfishUrl}');
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            engine = new Worker(URL.createObjectURL(blob));

            engine.onmessage = function(e) {
                if (e.data.includes('bestmove')) {
                    const move = e.data.split(' ')[1];
                    showBestMove(move);
                    updateStatus('Ready');
                }
                if (e.data.includes('score cp')) {
                    const match = e.data.match(/score cp ([-\d]+)/);
                    if (match) {
                        const score = parseInt(match[1]) / 100;
                        updateEval(score.toFixed(2));
                    }
                }
            };

            engine.postMessage('uci');
            return engine;
        } catch(e) {
            console.error('Chess Killer: Engine init failed', e);
            return null;
        }
    }

    // Get FEN from chess.com board
    function getFEN() {
        let fen = '';
        let empty = 0;

        for (let rank = 8; rank >= 1; rank--) {
            empty = 0;
            for (let file = 1; file <= 8; file++) {
                const sq = `${String.fromCharCode(96 + file)}${rank}`;
                const pieceEl = document.querySelector(`[data-square="${sq}"] .piece`) ||
                              document.querySelector(`.square-${sq} .piece`) ||
                              document.querySelector(`.piece.square-${sq}`);

                if (pieceEl) {
                    if (empty > 0) { fen += empty; empty = 0; }

                    const classes = pieceEl.className;
                    if (classes.includes('wp')) fen += 'P';
                    else if (classes.includes('wr')) fen += 'R';
                    else if (classes.includes('wn')) fen += 'N';
                    else if (classes.includes('wb')) fen += 'B';
                    else if (classes.includes('wq')) fen += 'Q';
                    else if (classes.includes('wk')) fen += 'K';
                    else if (classes.includes('bp')) fen += 'p';
                    else if (classes.includes('br')) fen += 'r';
                    else if (classes.includes('bn')) fen += 'n';
                    else if (classes.includes('bb')) fen += 'b';
                    else if (classes.includes('bq')) fen += 'q';
                    else if (classes.includes('bk')) fen += 'k';
                    else fen += '?';
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (rank > 1) fen += '/';
        }

        // Get side to move
        const clocks = document.querySelectorAll('.clock');
        let sideToMove = 'w';
        clocks.forEach(clock => {
            if (clock.classList.contains('clock-white') && clock.classList.contains('selected')) {
                sideToMove = 'w';
            } else if (clock.classList.contains('clock-black') && clock.classList.contains('selected')) {
                sideToMove = 'b';
            }
        });

        fen += ` ${sideToMove} KQkq - 0 1`;
        return fen;
    }

    // Convert UCI move to algebraic display
    function uciToDisplay(uci) {
        if (!uci || uci === '(none)') return '--';
        if (uci === 'e1g1' || uci === 'e8g8') return 'O-O';
        if (uci === 'e1c1' || uci === 'e8c8') return 'O-O-O';
        return uci.substring(2, 4).toLowerCase();
    }

    function showBestMove(move) {
        currentBestMove = move;
        const el = document.getElementById('ck-best-move');
        if (el) el.textContent = uciToDisplay(move);
    }

    function updateEval(score) {
        const el = document.getElementById('ck-eval');
        if (el) el.textContent = score;
    }

    function updateStatus(status) {
        const el = document.getElementById('ck-status');
        if (el) el.textContent = status;
    }

    // Make a move on chess.com by clicking squares
    function makeMoveOnBoard(moveStr) {
        try {
            updateStatus('Making move...');

            // Parse UCI move (e2e4) or algebraic (e4, Nf3)
            let fromSq, toSq;

            if (/^[a-h][1-8][a-h][1-8]$/.test(moveStr)) {
                // UCI format
                fromSq = moveStr.substring(0, 2);
                toSq = moveStr.substring(2, 4);
            } else {
                // Try to convert algebraic to UCI (simplified)
                updateStatus('Algebraic not yet supported, use UCI');
                return false;
            }

            // Click from-square
            const fromEl = document.querySelector(`[data-square="${fromSq}"]`) ||
                          document.querySelector(`.square-${fromSq}`);
            if (!fromEl) {
                updateStatus('Square not found: ' + fromSq);
                return false;
            }
            fromEl.click();

            // Small delay then click to-square
            setTimeout(() => {
                const toEl = document.querySelector(`[data-square="${toSq}"]`) ||
                            document.querySelector(`.square-${toSq}`);
                if (toEl) {
                    toEl.click();
                    updateStatus('Move made: ' + moveStr);
                }
            }, 300);

            return true;
        } catch(e) {
            updateStatus('Error: ' + e.message);
            return false;
        }
    }

    // Analyze current position
    function analyze() {
        const fen = getFEN();
        if (!fen || fen === lastFEN) return;
        lastFEN = fen;

        updateStatus('Analyzing...');

        const eng = initEngine();
        if (eng) {
            eng.postMessage(`position fen ${fen}`);
            eng.postMessage('go depth 15');
        }
    }

    // Create floating panel
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <style>
                #${PANEL_ID} {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 200px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: #eee;
                    padding: 20px;
                    border-radius: 15px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    z-index: 999999;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    border: 2px solid #0f3460;
                }
                #${PANEL_ID} h3 {
                    margin: 0 0 15px 0;
                    text-align: center;
                    color: #e94560;
                    font-size: 18px;
                    font-weight: bold;
                }
                #${PANEL_ID} .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    font-size: 12px;
                }
                #${PANEL_ID} .label { color: #888; }
                #${PANEL_ID} .value { color: #0f3460; font-weight: bold; }
                #${PANEL_ID} .best-move {
                    text-align: center;
                    font-size: 48px;
                    color: #e94560;
                    font-weight: bold;
                    margin: 15px 0;
                    text-shadow: 0 0 10px rgba(233, 69, 96, 0.5);
                }
                #${PANEL_ID} .close-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }
                #${PANEL_ID} .close-btn:hover { color: #e94560; }
            </style>
            <button class="close-btn" id="ck-close">×</button>
            <h3>♛ CHESS KILLER</h3>
            <div class="info-row">
                <span class="label">Status:</span>
                <span class="value" id="ck-status">Starting...</span>
            </div>
            <div class="info-row">
                <span class="label">Eval:</span>
                <span class="value" id="ck-eval">--</span>
            </div>
            <div class="best-move" id="ck-best-move">--</div>
        `;

        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();

        // Start analysis loop
        setInterval(analyze, 3000);
        setTimeout(analyze, 1000);
    }

    // Initialize on chess.com
    if (window.location.hostname.includes('chess.com')) {
        setTimeout(createPanel, 2000);
    }

})();
