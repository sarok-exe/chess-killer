# Chess Killer v2.0 - Chrome Extension

A Chrome extension that analyzes chess positions on chess.com using Stockfish.

## Features

- Shows best move in real-time on chess.com
- Displays position evaluation
- Floating panel with move suggestions
- Popup interface for manual move input
- Supports UCI format (e2e4)

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `/home/sarok/Documents/Projects/chess-extension/` folder
5. Navigate to chess.com and start playing!

## Usage

- The extension automatically shows a floating panel on chess.com
- Best move is displayed in real-time
- Use the popup (click extension icon) to:
  - Send moves manually (UCI format: e2e4)
  - Get best move analysis

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main logic (runs on chess.com)
- `popup.html` / `popup.js` - Extension popup
- `stockfish.js` / `stockfish.wasm` - Chess engine

## TODO

- Add algebraic notation support (e4, Nf3, O-O)
- Improve move parsing from chess.com board
- Add settings panel (depth, engine options)
