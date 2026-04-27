# Chess Killer

Chrome extension for chess analysis on Chess.com using Stockfish.

## Install

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chess-killer` folder

## Features

- Analyzes positions using Stockfish engine
- Shows best move evaluation
- Clean dark UI panel
- Runs on Chess.com

## ⚠️ Important

For **analysis only** - don't use during live or rated games!

## Files

- `manifest.json` - Extension config
- `content.js` - Chess.com integration + Stockfish
- `popup.html/js` - Extension popup

## Usage

1. Visit any game on chess.com
2. Click "Analyze Position" on the panel
3. Stockfish will show the best move