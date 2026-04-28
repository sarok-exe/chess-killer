// Chess Killer - Simplified

(function() {
    'use strict';
    
    const PANEL_ID = 'chess-killer-panel';
    let engine = null;
    
    function initEngine() {
        if (engine) return engine;
        try {
            const blob = new Blob([`
                importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');
            `], { type: 'application/javascript' });
            engine = new Worker(URL.createObjectURL(blob));
            return engine;
        } catch(e) { return null; }
    }
    
    function getFEN() {
        let fen = '';
        
        for (let rank = 8; rank >= 1; rank--) {
            let empty = 0;
            for (let file = 1; file <= 8; file++) {
                const sq = `${file}${rank}`;
                const p = document.querySelector(`.piece.square-${sq}`);
                
                if (p) {
                    if (empty > 0) { fen += empty; empty = 0; }
                    if (p.classList.contains('wp')) fen += 'P';
                    else if (p.classList.contains('wr')) fen += 'R';
                    else if (p.classList.contains('wn')) fen += 'N';
                    else if (p.classList.contains('wb')) fen += 'B';
                    else if (p.classList.contains('wq')) fen += 'Q';
                    else if (p.classList.contains('wk')) fen += 'K';
                    else if (p.classList.contains('bp')) fen += 'p';
                    else if (p.classList.contains('br')) fen += 'r';
                    else if (p.classList.contains('bn')) fen += 'n';
                    else if (p.classList.contains('bb')) fen += 'b';
                    else if (p.classList.contains('bq')) fen += 'q';
                    else if (p.classList.contains('bk')) fen += 'k';
                } else {
                    empty++;
                }
            }
            if (empty > 0) fen += empty;
            if (rank > 1) fen += '/';
        }
        
        const whiteSelected = document.querySelector('.clock-white.selected');
        fen += ' ' + (whiteSelected ? 'w' : 'b') + ' KQkq - 0 1';
        
        return fen;
    }
    
    function getPlayerColor() {
        const flipped = document.querySelector('.board.flipped');
        return flipped ? 'b' : 'w';
    }
    
    function isMyTurn() {
        const sideToMove = document.querySelector('.clock-white.selected') ? 'w' : 'b';
        return sideToMove === getPlayerColor();
    }
    
    function showBestMove(move) {
        const el = document.getElementById('ck-move');
        if (!el) return;
        
        let display = '--';
        if (move) {
            if (move === 'e1g1' || move === 'e8g8') display = 'O-O';
            else if (move === 'e1c1' || move === 'e8c8') display = 'O-O-O';
            else display = move.substring(2, 4);
        }
        el.textContent = display;
    }
    
    let lastFEN = '';
    
    function analyze() {
        const fen = getFEN();
        if (!fen || fen === lastFEN) return;
        
        const myTurn = isMyTurn();
        const sideEl = document.getElementById('ck-side');
        const evalEl = document.getElementById('ck-evaluation');
        
        if (myTurn) {
            if (sideEl) sideEl.textContent = 'YOUR TURN';
            if (evalEl) evalEl.textContent = 'Analyzing...';
            
            const eng = initEngine();
            if (eng) {
                eng.onmessage = function(e) {
                    if (e.data.startsWith('bestmove')) {
                        showBestMove(e.data.split(' ')[1]);
                        if (evalEl) evalEl.textContent = 'Done!';
                    }
                    if (e.data.includes('score cp')) {
                        const sc = e.data.match(/score cp ([-\d]+)/);
                        if (sc && evalEl) evalEl.textContent = (parseInt(sc[1])/100).toFixed(1);
                    }
                };
                eng.postMessage('position fen ' + fen);
                eng.postMessage('go depth 15');
            }
        } else {
            if (sideEl) sideEl.textContent = 'OPPONENT';
            if (evalEl) evalEl.textContent = 'Wait';
            showBestMove(null);
        }
        
        lastFEN = fen;
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
                    background: #111;
                    color: #fff;
                    padding: 20px;
                    border-radius: 12px;
                    font-family: monospace;
                    z-index: 999999;
                    border: 2px solid #0ff;
                }
                #${PANEL_ID} h3 { margin: 0 0 15px 0; text-align: center; color: #0ff; font-size: 16px; }
                #${PANEL_ID} .side { text-align: center; padding: 8px; background: #222; border-radius: 6px; margin-bottom: 10px; font-size: 14px; }
                #${PANEL_ID} .eval { text-align: center; font-size: 12px; color: #888; margin-bottom: 15px; }
                #${PANEL_ID} .move { text-align: center; font-size: 56px; color: #0ff; font-weight: bold; margin: 15px 0; }
                #${PANEL_ID} .close { position: absolute; top: 8px; right: 12px; background: none; border: none; color: #666; font-size: 18px; cursor: pointer; }
            </style>
            <button class="close" id="ck-close">×</button>
            <h3>CHESS KILLER</h3>
            <div class="side" id="ck-side">Starting...</div>
            <div class="eval" id="ck-evaluation">...</div>
            <div class="move" id="ck-move">--</div>
        `;
        
        document.body.appendChild(panel);
        panel.querySelector('#ck-close').onclick = () => panel.remove();
        
        setInterval(analyze, 2000);
        setTimeout(analyze, 3000);
    }
    
    if (document.location.hostname.includes('chess.com')) {
        setTimeout(createPanel, 3000);
    }
})();