// Chess Killer - Content Script
// Runs on chess.com

console.log("Chess Killer loaded");

function getBoardFromChessCom() {
    const pieces = {};
    const pieceMap = {
        'p': 'P', 'n': 'N', 'b': 'B', 'r': 'R', 'q': 'Q', 'k': 'K',
        'P': 'p', 'N': 'n', 'B': 'b', 'R': 'r', 'Q': 'q', 'K': 'k'
    };
    
    // Find all squares
    const squares = document.querySelectorAll('[data-square]');
    squares.forEach(sq => {
        const piece = sq.querySelector('.piece');
        if (piece) {
            const color = piece.classList.contains('white') ? 'w' : 'b';
            const type = piece.className.match(/piece(.)/)?.[1] || '';
            if (type) {
                pieces[sq.dataset.square] = color + pieceMap[type];
            }
        }
    });
    
    return pieces;
}

function createAnalysisPanel() {
    if (document.getElementById('chess-killer-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'chess-killer-panel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        width: 280px;
        background: #1a1a2e;
        color: #fff;
        padding: 15px;
        border-radius: 10px;
        font-family: 'JetBrains Mono', monospace;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #ff6b6b;">♟ Chess Killer</h3>
        <div id="ck-evaluation">Analyzing...</div>
        <div id="ck-best-move" style="margin-top:10px; font-size: 18px; color: #4ecdc4; font-weight: bold;"></div>
        <button id="ck-close" style="position:absolute;top:5px;right:10px;background:none;border:none;color:#fff;cursor:pointer;">✕</button>
    `;
    
    document.body.appendChild(panel);
    document.getElementById('ck-close').onclick = () => panel.remove();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyze') {
        const board = getBoardFromChessCom();
        sendResponse({ board: board, url: window.location.href });
    }
});

// Auto-show panel on chess.com
if (window.location.hostname.includes('chess.com')) {
    // Wait for board to load
    setTimeout(createAnalysisPanel, 2000);
}