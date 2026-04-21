import { Chessboard, COLOR, INPUT_EVENT_TYPE } from "./lib/cm-chessboard/src/Chessboard.js";
import { Markers, MARKER_TYPE } from "./lib/cm-chessboard/src/extensions/markers/Markers.js";
import { Chess } from "./lib/chess.js";

const game = new Chess();
let board = null;
let stockfish = null;
let engineEnabled = false;
let pendingPromotion = null;

const evalBar = document.getElementById('eval-bar');
const evalScoreText = document.getElementById('eval-score');
const gameStatus = document.getElementById('game-status');
const moveHistory = document.getElementById('move-history');
const engineToggle = document.getElementById('engine-toggle');
const engineInfo = document.getElementById('engine-info');
const bestMoveText = document.getElementById('best-move-text');
const resetBtn = document.getElementById('reset-btn');
const flipBtn = document.getElementById('flip-btn');
const capturedWhite = document.getElementById('captured-white');
const capturedBlack = document.getElementById('captured-black');
const promoModal = document.getElementById('promotion-modal');

function init() {
    board = new Chessboard(document.getElementById("board"), {
        position: game.fen(),
        assetsUrl: "./lib/cm-chessboard/assets/",
        style: {
            pieces: { file: "pieces/standard.svg" }
        },
        extensions: [{ class: Markers }]
    });

    board.enableMoveInput(onMoveInput);
    initEngine();
    setupEventListeners();
}

function initEngine() {
    try {
        stockfish = new Worker('./lib/stockfish.js');
        stockfish.onmessage = (e) => {
            const line = e.data;
            if (line.includes('score cp')) {
                const match = line.match(/score cp (-?\d+)/);
                if (match) updateEval(parseInt(match[1]) / 100);
            } else if (line.includes('score mate')) {
                const match = line.match(/score mate (-?\d+)/);
                if (match) updateEval('M' + Math.abs(parseInt(match[1])));
            }
            if (line.includes('bestmove')) {
                const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
                if (match) {
                    const move = match[1];
                    board.removeMarkers(MARKER_TYPE.square);
                    board.addMarker(MARKER_TYPE.square, move.substring(0, 2));
                    board.addMarker(MARKER_TYPE.square, move.substring(2, 4));
                    bestMoveText.innerText = move;
                }
            }
        };
        stockfish.postMessage('uci');
        stockfish.postMessage('isready');
    } catch (e) { console.error("Engine failed:", e); }
}

function onMoveInput(event) {
    switch (event.type) {
        case INPUT_EVENT_TYPE.moveInputStarted:
            const moves = game.moves({ square: event.square, verbose: true });
            moves.forEach(m => board.addMarker(MARKER_TYPE.dot, m.to));
            return true;

        case INPUT_EVENT_TYPE.validateMoveInput:
            const moveData = { from: event.squareFrom, to: event.squareTo };
            
            const piece = game.get(event.squareFrom);
            if (piece && piece.type === 'p' && (event.squareTo[1] === '8' || event.squareTo[1] === '1')) {
                const isLegal = game.moves({ square: event.squareFrom, verbose: true })
                                   .some(m => m.to === event.squareTo);
                if (isLegal) {
                    pendingPromotion = { from: event.squareFrom, to: event.squareTo };
                    showPromotionModal(event.squareTo);
                    return true;
                }
                return false;
            }

            const move = game.move({...moveData, promotion: 'q'});
            if (move) {
                game.undo();
                return true;
            }
            return false;

        case INPUT_EVENT_TYPE.moveInputFinished:
            board.removeMarkers(MARKER_TYPE.dot);
            if (event.legalMove && !pendingPromotion) {
                game.move({ from: event.squareFrom, to: event.squareTo, promotion: 'q' });
                board.setPosition(game.fen());
                onAfterMove();
            }
            break;

        case INPUT_EVENT_TYPE.moveInputCanceled:
            board.removeMarkers(MARKER_TYPE.dot);
            break;
    }
}

function showPromotionModal(square) {
    const squareElement = document.querySelector(`[data-square="${square}"]`);
    if (squareElement) {
        const boardRect = document.getElementById('board').getBoundingClientRect();
        const sqRect = squareElement.getBoundingClientRect();
        
        promoModal.style.top = `${sqRect.top + window.scrollY}px`;
        promoModal.style.left = `${sqRect.left + window.scrollX + (sqRect.width / 2)}px`;
        promoModal.style.transform = `translate(-50%, ${square[1] === '8' ? '0' : '-100%'})`;
    } else {
        promoModal.style.top = '50%';
        promoModal.style.left = '50%';
        promoModal.style.transform = 'translate(-50%, -50%)';
    }
    
    promoModal.style.display = 'flex';
}

function handlePromotion(piece) {
    if (pendingPromotion) {
        game.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece });
        board.setPosition(game.fen());
        onAfterMove();
        pendingPromotion = null;
        promoModal.style.display = 'none';
    }
}

function onAfterMove() {
    updateStatus();
    updateHistory();
    updateCaptured();
    if (engineEnabled) analyzePosition();
}

function analyzePosition() {
    if (!stockfish) return;
    stockfish.postMessage('stop');
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15');
}

function updateEval(score) {
    let percentage;
    let text;
    if (typeof score === 'string') {
        text = score;
        percentage = 50;
    } else {
        const actualScore = game.turn() === 'w' ? score : -score;
        text = (actualScore > 0 ? '+' : '') + actualScore.toFixed(1);
        percentage = ((Math.max(-5, Math.min(5, actualScore)) + 5) / 10) * 100;
    }
    evalBar.style.height = percentage + '%';
    evalScoreText.innerText = text;
}

function updateStatus() {
    const moveColor = game.turn() === 'w' ? 'White' : 'Black';
    let status = game.isCheckmate() ? `Checkmate! ${moveColor} lost.` : (game.isDraw() ? "Draw" : `${moveColor} to move`);
    if (game.inCheck() && !game.isCheckmate()) status += " (Check)";
    gameStatus.innerText = status;
}

function updateHistory() {
    const history = game.history();
    moveHistory.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'move-row';
        row.innerHTML = `<span class="move-num">${Math.floor(i/2)+1}.</span>
                         <span>${history[i]}</span>
                         <span>${history[i+1] || ''}</span>`;
        moveHistory.appendChild(row);
    }
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

function updateCaptured() {
    const symbols = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕'};
    const initial = {p:8,n:2,b:2,r:2,q:1,P:8,N:2,B:2,R:2,Q:1};
    const current = {p:0,n:0,b:0,r:0,q:0,P:0,N:0,B:0,R:0,Q:0};
    game.board().flat().filter(s=>s).forEach(s => {
        const key = s.color==='w' ? s.type.toUpperCase() : s.type;
        if (current[key] !== undefined) current[key]++;
    });
    capturedWhite.innerHTML = ''; capturedBlack.innerHTML = '';
    ['P','N','B','R','Q'].forEach(p => {
        for(let i=0; i<initial[p]-current[p]; i++) capturedWhite.innerHTML += `<span class="captured-piece">${symbols[p]}</span>`;
    });
    ['p','n','b','r','q'].forEach(p => {
        for(let i=0; i<initial[p]-current[p]; i++) capturedBlack.innerHTML += `<span class="captured-piece">${symbols[p]}</span>`;
    });
}

function setupEventListeners() {
    engineToggle.onchange = () => {
        engineEnabled = engineToggle.checked;
        if (engineEnabled) analyzePosition();
        else { engineInfo.style.display = 'none'; board.removeMarkers(MARKER_TYPE.square); }
    };
    resetBtn.onclick = () => { game.reset(); board.setPosition(game.fen()); onAfterMove(); updateEval(0); };
    flipBtn.onclick = () => board.setOrientation(board.getOrientation()==='w'?'b':'w');
    document.querySelectorAll('.promo-option').forEach(el => {
        el.onclick = () => handlePromotion(el.dataset.piece);
    });
}

init();
