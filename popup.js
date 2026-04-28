// Popup script for Chess Killer extension
(function() {
    const moveInput = document.getElementById('moveInput');
    const sendMoveBtn = document.getElementById('sendMove');
    const getBestBtn = document.getElementById('getBest');
    const statusEl = document.getElementById('status');

    function updateStatus(msg) {
        statusEl.textContent = msg;
    }

    // Convert algebraic notation to UCI
    function algebraicToUCI(algebraic, boardState) {
        // Handle castling
        if (algebraic === 'O-O' || algebraic === '0-0') return 'e1g1';
        if (algebraic === 'O-O-O' || algebraic === '0-0-0') return 'e1c1';

        // Simple conversion for e4 -> e2e4 (this is simplified)
        // In reality, we'd need the board state to determine the from-square
        const files = 'abcdefgh';
        const ranks = '12345678';

        // Match patterns like: e4, Nf3, Bxc6, Qh4+
        const match = algebraic.match(/^([NBRQK])?([a-h])([1-8])([+#])?$/);
        if (match) {
            const piece = match[1] || 'P';
            const toFile = match[2];
            const toRank = match[3];

            // This is where we'd need board state to find the from-square
            // For now, return a placeholder
            return `????${toFile}${toRank}`;
        }

        // If already UCI format
        if (/^[a-h][1-8][a-h][1-8]$/.test(algebraic)) {
            return algebraic;
        }

        return null;
    }

    sendMoveBtn.addEventListener('click', () => {
        const move = moveInput.value.trim();
        if (!move) {
            updateStatus('Enter a move!');
            return;
        }

        updateStatus('Sending move...');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'makeMove',
                move: move
            }, (response) => {
                if (chrome.runtime.lastError) {
                    updateStatus('Error: Not on chess.com');
                } else {
                    updateStatus('Move sent!');
                    moveInput.value = '';
                }
            });
        });
    });

    getBestBtn.addEventListener('click', () => {
        updateStatus('Analyzing...');

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'getBestMove'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    updateStatus('Error: Not on chess.com');
                } else {
                    updateStatus('Best: ' + (response?.move || 'unknown'));
                }
            });
        });
    });

    // Allow Enter key to send move
    moveInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMoveBtn.click();
        }
    });
})();
