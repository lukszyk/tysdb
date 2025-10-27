// Konfiguracja Firebase (Twoja, bez zmian)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD44JW-x135PT51t2Uzc_JotiEVtuO3Rig",
  authDomain: "tysiac-881c3.firebaseapp.com",
  projectId: "tysiac-881c3",
  storageBucket: "tysiac-881c3.firebasestorage.app",
  messagingSenderId: "855690860515",
  appId: "1:855690860515:web:6b4b95a5de2d4f9997b2d6",
  measurementId: "G-H5RSQYCFFN"
};

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }
    var db = firebase.firestore();
    console.log("Firebase i Firestore zainicjowane pomyślnie.");
} catch (e) {
    console.error("Błąd inicjalizacji Firebase!", e);
    var db = null;
}

// Nowe referencje i stałe
const FIREBASE_COLLECTION_WINS = 'tysiac_win_stats';
const savedGameStateRef = db.collection('saved_game_state').doc('current');
const GAME_STATE_KEY = 'tysiacGameState_legacy';

// Referencje DOM
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const statsScreen = document.getElementById('stats-screen');
const loadGameScreen = document.getElementById('load-game-screen');
const winnerModal = document.getElementById('winner-modal');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');
const playerCountSelect = document.getElementById('player-count');
const playerNamesContainer = document.getElementById('player-names-container');
const startGameBtn = document.getElementById('start-game-btn');
const showStatsBtn = document.getElementById('show-stats-btn');
const scoreboard = document.getElementById('scoreboard');
const scoreInputs = document.getElementById('score-inputs');
const addRoundBtn = document.getElementById('add-round-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const rotateFirstPlayerBtn = document.getElementById('rotate-first-player-btn');
const gameToStatsBtn = document.getElementById('game-to-stats-btn');
const roundHistoryContainer = document.getElementById('round-history-container');
const statsSummary = document.getElementById('stats-summary');
const backFromStatsBtn = document.getElementById('back-from-stats-btn');
const clearStatsBtn = document.getElementById('clear-stats-btn');
const modalBackToMenuBtn = document.getElementById('modal-back-to-menu-btn');
const roundInfoDisplay = document.getElementById('round-info-display');
const statusMessageContainer = document.getElementById('status-message-container');
const showLoadGameBtn = document.getElementById('show-load-game-btn');
const loadGameMessage = document.getElementById('load-game-message');
const loadGameBtn = document.getElementById('load-game-btn');
const deleteGameBtn = document.getElementById('delete-game-btn');
const backFromLoadBtn = document.getElementById('back-from-load-btn');
const saveGameBtn = document.getElementById('save-game-btn');

// Stan Aplikacji
let gameState = { players: [], history: [], isActive: false, firstPlayerIndex: 0, initialFirstPlayerIndex: 0, loadedFromFirebase: false };
const defaultPlayerNames = ['Kulik', 'Miś', 'Gracz 3', 'Gracz 4'];
const LEADER_CLASS = 'is-leader';

// --- Funkcje do obsługi zapisu/wczytywania w chmurze ---

async function handleShowLoadScreen() {
    console.log('handleShowLoadScreen wywołana');
    setupScreen.classList.add('hidden');
    loadGameScreen.classList.remove('hidden');
    loadGameMessage.textContent = 'Sprawdzanie...';
    loadGameBtn.classList.add('hidden');
    deleteGameBtn.classList.add('hidden');

    if (!db) {
        console.error('Brak połączenia z Firebase');
        loadGameMessage.textContent = 'Błąd: Brak połączenia z bazą danych.';
        return;
    }

    try {
        console.log('Sprawdzam zapis w Firebase...');
        const doc = await savedGameStateRef.get();
        console.log('Dokument istnieje:', doc.exists);
        
        if (doc.exists) {
            loadGameMessage.textContent = 'Znaleziono zapisaną grę. Chcesz ją kontynuować?';
            loadGameBtn.classList.remove('hidden');
            deleteGameBtn.classList.remove('hidden');
        } else {
            loadGameMessage.textContent = 'Brak zapisanej gry w chmurze.';
        }
    } catch (error) {
        console.error("Błąd sprawdzania zapisu gry:", error);
        loadGameMessage.textContent = 'Błąd połączenia z bazą danych: ' + error.message;
    }
}

async function saveCurrentGameState() {
    if (!gameState.isActive || gameState.history.length === 0) return;
    
    try {
        await savedGameStateRef.set(gameState);
        gameState.loadedFromFirebase = true;
        showTemporaryMessage('Stan gry został zapisany w chmurze!', false);
    } catch (error) {
        console.error("Błąd zapisu stanu gry:", error);
        showTemporaryMessage('Błąd podczas zapisu stanu gry!', true);
    }
}

async function loadGameStateFromFirebase() {
    try {
        const doc = await savedGameStateRef.get();
        if (doc.exists) {
            gameState = doc.data();
            gameState.isActive = true;
            gameState.loadedFromFirebase = true;
            
            renderGameScreen();
            
            loadGameScreen.classList.add('hidden');
            setupScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
        } else {
            showCustomAlert('Nie znaleziono zapisu gry.');
        }
    } catch (error) {
        console.error("Błąd wczytywania stanu gry:", error);
        showCustomAlert('Wystąpił błąd podczas wczytywania gry.');
    }
}

async function deleteSavedGameState() {
    if (!db) return;
    try {
        await savedGameStateRef.delete();
        console.log('Zapisany stan gry został usunięty.');
    } catch (error) {
        console.error('Błąd usuwania zapisanego stanu gry:', error);
    }
}

async function handleDeleteSavedGame() {
    console.log('handleDeleteSavedGame wywołana');
    showCustomConfirm('Czy na pewno chcesz usunąć zapisaną grę z chmury? Tej operacji nie można cofnąć.', async () => {
        console.log('Potwierdzono usunięcie');
        try {
            await deleteSavedGameState();
            showTemporaryMessage('Zapisana gra została usunięta z chmury.', false);
            loadGameMessage.textContent = 'Brak zapisanej gry w chmurze.';
            loadGameBtn.classList.add('hidden');
            deleteGameBtn.classList.add('hidden');
            console.log('Usunięcie zakończone pomyślnie');
        } catch (error) {
            console.error("Błąd usuwania zapisu gry:", error);
            showTemporaryMessage('Błąd podczas usuwania zapisu gry!', true);
        }
    });
}

// --- Funkcje gry ---

function addRoundScore() {
    const roundScores = {};
    let validationFailed = false, roundingOccurred = false;
    const firstInput = document.getElementById('score-input-0');
    
    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        const input = document.getElementById(`score-input-${i}`);
        let scoreValue = parseInt(input.value, 10) || 0;
        
        if (scoreValue !== 0) {
            if (player.score >= 800 && scoreValue > 0 && scoreValue < 100) {
                validationFailed = true;
                input.value = '';
                break;
            }
            if (scoreValue > 0) {
                let roundedScore = Math.round(scoreValue / 10) * 10;
                if (roundedScore !== scoreValue) roundingOccurred = true;
                scoreValue = roundedScore;
                input.value = scoreValue;
            }
        }
        roundScores[player.name] = scoreValue;
    }
    
    if (validationFailed) {
        showTemporaryMessage('Gracz z wynikiem 800+ musi ugrać minimum 100 punktów (dla punktów dodatnich).', true);
        firstInput?.focus();
        return;
    }

    gameState.players.forEach(p => p.score += roundScores[p.name]);
    gameState.history.unshift(roundScores);
    
    if (gameState.players.length === 2) {
        gameState.firstPlayerIndex = gameState.history.length % 2 !== 0 ? (gameState.initialFirstPlayerIndex + 1) % 2 : gameState.initialFirstPlayerIndex;
    } else {
        gameState.firstPlayerIndex = (gameState.firstPlayerIndex + 1) % gameState.players.length;
    }
    
    updateScoreValues();
    updateFirstPlayerMarker();
    renderRoundHistory();
    checkWinner();
    
    gameState.players.forEach((_, i) => document.getElementById(`score-input-${i}`).value = '');
    if (roundingOccurred) showTemporaryMessage('Wynik dodatni został zaokrąglony do najbliższej 10-tki.', false);
    renderRoundInfo();
    firstInput?.focus();

    if (gameState.history.length > 0) {
        saveGameBtn.disabled = false;
        saveGameBtn.classList.remove('btn-disabled');
    }
}

function endGame(winner) {
    if (gameState.isActive) {
        saveStats(winner);
        if (gameState.loadedFromFirebase) {
            deleteSavedGameState();
        }
    }

    document.getElementById('winner-message').textContent = `Wygrywa ${winner.name}! Gratulacje!`;
    document.getElementById('final-scores').innerHTML = '<h4>Końcowe wyniki:</h4>' + gameState.players.map(p => `<div class="flex justify-between"><span>${p.name}:</span><span class="font-semibold">${p.score} pkt</span></div>`).join('');
    winnerModal.classList.remove('hidden');
    winnerModal.classList.add('flex');
    clearGameState(false);
}

function resetGame() {
    // ZMIANA: Przy porzuceniu gry NIE usuwamy zapisu z Firebase
    // Zapis zostanie usunięty tylko gdy ktoś wygra (w funkcji endGame)
    clearGameState(true);
    
    gameScreen.classList.add('hidden');
    statsScreen.classList.add('hidden');
    winnerModal.classList.add('hidden');
    winnerModal.classList.remove('flex');
    loadGameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    generatePlayerNameInputs();
}

function clearGameState(fullClear = true) {
    gameState = { players: [], history: [], isActive: false, firstPlayerIndex: 0, initialFirstPlayerIndex: 0, loadedFromFirebase: false };
    if (fullClear) {
        localStorage.removeItem(GAME_STATE_KEY);
    }
    saveGameBtn.disabled = true;
    saveGameBtn.classList.add('btn-disabled');
}

// --- Pomocnicze funkcje ---

let messageTimeout;
function showTemporaryMessage(message, isError = false) {
    statusMessageContainer.innerHTML = `<div class="p-2 rounded-lg ${isError ? 'bg-red-800 text-white' : 'bg-yellow-600 text-slate-900'} font-semibold">${message}</div>`;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        statusMessageContainer.innerHTML = '';
    }, 5000);
}

function renderRoundInfo() {
    if (!gameState.isActive) return;
    const currentRound = gameState.history.length + 1;
    const firstPlayerName = gameState.players[gameState.firstPlayerIndex].name;
    roundInfoDisplay.innerHTML = `<span class="text-slate-300">Runda: </span><span class="text-teal-400 font-bold">${currentRound}</span><span class="text-slate-300 ml-4 hidden sm:inline-block">|</span><span class="text-slate-300 ml-4">Na musiku: </span><span class="text-amber-400 font-bold">${firstPlayerName} </span>`;
    const isRound1 = gameState.history.length === 0;
    rotateFirstPlayerBtn.classList.toggle('btn-disabled', !isRound1);
    rotateFirstPlayerBtn.disabled = !isRound1;
    rotateFirstPlayerBtn.title = isRound1 ? "Dostępne tylko w Rundzie 1." : "Blokada: Dostępne tylko w Rundzie 1.";
}

function recalculateScores() {
    gameState.players.forEach(p => p.score = 0);
    gameState.history.forEach(round => {
        gameState.players.forEach(player => {
            player.score += round[player.name] || 0;
        });
    });
    if (gameState.players.length === 2) {
        gameState.firstPlayerIndex = gameState.history.length % 2 === 0 ? gameState.initialFirstPlayerIndex : (gameState.initialFirstPlayerIndex + 1) % 2;
    } else {
        gameState.firstPlayerIndex = (gameState.initialFirstPlayerIndex + gameState.history.length) % gameState.players.length;
    }
    updateScoreValues();
    updateFirstPlayerMarker();
    renderRoundHistory();
    renderRoundInfo();
}

function renderRoundHistory() {
    if (gameState.history.length === 0) {
        roundHistoryContainer.innerHTML = '<p class="text-slate-500 text-xs text-center p-2">Brak dodanych rund.</p>';
        return;
    }
    let headerHtml = '<tr><th class="w-1/6">Runda</th>';
    gameState.players.forEach(p => headerHtml += `<th class="whitespace-nowrap" title="${p.name}">${p.name.length > 5 ? p.name.substring(0, 5) + '.' : p.name}</th>`);
    headerHtml += '<th class="w-1/12">Akcje</th></tr>';
    let bodyHtml = '';
    gameState.history.forEach((round, index) => {
        const roundNumber = gameState.history.length - index;
        let rowHtml = `<tr><td>${roundNumber}</td>`;
        gameState.players.forEach(p => rowHtml += `<td class="${(round[p.name] || 0) < 0 ? 'score-negative' : 'history-score'}">${round[p.name] || 0}</td>`);
        rowHtml += `<td><button onclick="confirmDeleteRound(${index})" class="text-red-500 hover:text-red-400 p-0.5 rounded"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button></td></tr>`;
        bodyHtml += rowHtml;
    });
    roundHistoryContainer.innerHTML = `<table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
}

window.confirmDeleteRound = function(i) {
    showCustomConfirm('Czy na pewno chcesz usunąć tę rundę?', () => deleteRound(i));
}

function deleteRound(i) {
    gameState.history.splice(i, 1);
    recalculateScores();
    checkWinner();
}

function handleInputKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentIndex = parseInt(e.target.dataset.playerIndex, 10);
        const nextIndex = currentIndex + 1;
        if (nextIndex < gameState.players.length) document.getElementById(`score-input-${nextIndex}`)?.focus();
        else addRoundScore();
    }
}

function renderGameScreen() {
    scoreboard.innerHTML = '';
    scoreInputs.innerHTML = '';
    gameState.players.forEach((player, i) => {
        scoreboard.innerHTML += `<div class="card text-center"><div id="player-name-${i}" class="text-sm font-semibold flex items-center justify-center gap-1">${player.name}</div><div id="player-score-${i}" class="text-3xl font-bold mt-1 ${player.score >= 800 ? 'score-danger' : 'text-teal-400'}">${player.score}</div></div>`;
        scoreInputs.innerHTML += `<div><label for="score-input-${i}" class="block mb-1 text-xs font-medium text-slate-400">${player.name}</label><input type="number" id="score-input-${i}" class="input-field text-center text-sm" placeholder="0" data-player-index="${i}"></div>`;
        document.getElementById(`score-input-${i}`).addEventListener('keydown', handleInputKeydown);
    });
    updateScoreValues();
    updateFirstPlayerMarker();
    renderRoundHistory();
    renderRoundInfo();
    document.getElementById('score-input-0')?.focus();
}

function updateScoreValues() {
    const maxScore = Math.max(...gameState.players.map(p => p.score));
    gameState.players.forEach((p, i) => {
        const scoreEl = document.getElementById(`player-score-${i}`);
        const cardEl = scoreboard.children[i];
        if (scoreEl) {
            scoreEl.textContent = p.score;
            scoreEl.classList.toggle('score-danger', p.score >= 800);
            scoreEl.classList.toggle('text-teal-400', p.score < 800);
        }
        if (cardEl) cardEl.classList.toggle(LEADER_CLASS, p.score === maxScore && maxScore > 0);
    });
}

function generatePlayerNameInputs() {
    const count = parseInt(playerCountSelect.value, 10);
    playerNamesContainer.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        playerNamesContainer.innerHTML += `<div><label for="player${i}" class="block mb-1 text-sm font-medium text-slate-400">Imię gracza ${i}:</label><input type="text" id="player${i}" class="input-field" placeholder="Gracz ${i}" value="${defaultPlayerNames[i - 1] || `Gracz ${i}`}"></div>`;
    }
}

function startGame() {
    const players = [];
    let hasValidNames = true;
    for (let i = 1; i <= parseInt(playerCountSelect.value, 10); i++) {
        const input = document.getElementById(`player${i}`);
        const name = input.value.trim();
        if (name === '') {
            input.style.borderColor = 'red';
            hasValidNames = false;
        } else {
            input.style.borderColor = '';
            players.push({ name: name, score: 0 });
        }
    }
    if (!hasValidNames) {
        showCustomAlert('Wszystkie pola z imionami muszą być wypełnione.');
        return;
    }
    gameState = { players, history: [], isActive: true, firstPlayerIndex: 0, initialFirstPlayerIndex: 0, loadedFromFirebase: false };
    renderGameScreen();
    setupScreen.classList.add('hidden');
    statsScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}

function checkWinner() {
    const winners = gameState.players.filter(p => p.score >= 1000);
    if (winners.length > 0) {
        const winner = winners.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr);
        endGame(winner);
    }
}

function updateFirstPlayerMarker() {
    gameState.players.forEach((p, i) => {
        const nameEl = document.getElementById(`player-name-${i}`);
        if (nameEl) {
            let markers = '';
            if (i === gameState.firstPlayerIndex) markers += '<span class="text-amber-400 text-xs ml-1" title="Na musiku">musik</span>';
            if (i === gameState.initialFirstPlayerIndex) markers += '<span class="text-red-400 text-xs ml-1 font-bold" title="Rozpoczynający RUNDĘ 1">START</span>';
            nameEl.innerHTML = `${p.name} ${markers}`;
        }
    });
}

function rotateFirstPlayer() {
    if (gameState.history.length > 0) {
        showTemporaryMessage('Zmiana możliwa tylko w Rundzie 1.', true);
        return;
    }
    if (!gameState.isActive || gameState.players.length < 2) return;
    gameState.firstPlayerIndex = (gameState.firstPlayerIndex + 1) % gameState.players.length;
    gameState.initialFirstPlayerIndex = gameState.firstPlayerIndex;
    updateFirstPlayerMarker();
    renderRoundInfo();
}

function handleBackFromStats() {
    statsScreen.classList.add('hidden');
    if(gameState.isActive) gameScreen.classList.remove('hidden');
    else setupScreen.classList.remove('hidden');
}

function handleBackToMenu() {
    if (gameState.isActive) {
        const message = gameState.loadedFromFirebase 
            ? 'Porzucić obecną grę? Będziesz mógł wrócić do niej później (zapis pozostanie w chmurze).' 
            : 'Porzucić obecną grę? Postęp lokalny nie zostanie zapisany.';
        showCustomConfirm(message, resetGame);
    } else {
        resetGame();
    }
}

// --- Modalne ---

let currentYesHandler, currentNoHandler;

function showCustomAlert(msg) {
    showCustomConfirm(msg, () => {}, false);
}

function showCustomConfirm(msg, onConfirm, showNo = true) {
    confirmMessage.textContent = msg;
    confirmModal.classList.add('flex');
    confirmModal.classList.remove('hidden');
    confirmNoBtn.classList.toggle('hidden', !showNo);
    if (!showNo) {
        confirmYesBtn.textContent = 'OK';
        confirmYesBtn.classList.remove('bg-red-600', 'w-1/2');
        confirmYesBtn.classList.add('btn-primary', 'w-full');
    } else {
        confirmYesBtn.textContent = 'Tak';
        confirmYesBtn.classList.add('bg-red-600', 'w-1/2');
        confirmYesBtn.classList.remove('btn-primary', 'w-full');
    }
    if (currentYesHandler) confirmYesBtn.removeEventListener('click', currentYesHandler);
    if (currentNoHandler) confirmNoBtn.removeEventListener('click', currentNoHandler);
    const cleanUp = () => {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        confirmYesBtn.removeEventListener('click', currentYesHandler);
        confirmNoBtn.removeEventListener('click', currentNoHandler);
        confirmYesBtn.textContent = 'Tak';
    };
    const handleYes = () => {
        cleanUp();
        if (showNo) onConfirm();
    };
    const handleNo = cleanUp;
    currentYesHandler = handleYes;
    currentNoHandler = handleNo;
    confirmYesBtn.addEventListener('click', currentYesHandler);
    confirmNoBtn.addEventListener('click', currentNoHandler);
}

// --- Statystyki ---

async function saveStats(winner) {
    if (!db) return;
    try {
        const winnerRef = db.collection(FIREBASE_COLLECTION_WINS).doc(winner.name);
        await winnerRef.set({ name: winner.name, wins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        showTemporaryMessage(`Zwycięstwo ${winner.name} zapisane w rankingu!`, false);
    } catch (e) {
        console.error("Błąd zapisu statystyk do Firebase:", e);
        showTemporaryMessage("Błąd zapisu statystyk do Firebase!", true);
    }
}

async function getStatsFromFirebase() {
    if (!db) {
        return { playerWins: {} };
    }
    const stats = { playerWins: {} };
    try {
        const winsSnapshot = await db.collection(FIREBASE_COLLECTION_WINS).get();
        winsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.wins) {
                stats.playerWins[doc.id] = parseInt(data.wins, 10) || 0;
            }
        });
    } catch (e) {
        console.error("Błąd pobierania statystyk z Firebase:", e);
        showTemporaryMessage("Błąd pobierania statystyk z Firebase!", true);
    }
    return stats;
}

async function handleClearStats() {
    showCustomConfirm('Czy na pewno chcesz usunąć WSZYSTKIE statystyki zwycięstw z Firebase? Tej operacji nie można cofnąć.', async () => {
        if (!db) {
            showTemporaryMessage("Brak połączenia z bazą danych.", true);
            return;
        }
        try {
            showTemporaryMessage("Rozpoczynam usuwanie rankingu...", false);
            const winsSnapshot = await db.collection(FIREBASE_COLLECTION_WINS).get();
            const deletePromises = winsSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            showTemporaryMessage("Wszystkie statystyki zwycięstw zostały usunięte.", false);
            showStats();
        } catch (error) {
            console.error("Błąd podczas usuwania statystyk: ", error);
            showTemporaryMessage("Wystąpił błąd podczas usuwania statystyk.", true);
        }
    });
}

async function showStats() {
    const stats = await getStatsFromFirebase();
    const totalGames = Object.values(stats.playerWins).reduce((sum, current) => sum + current, 0);
    let summaryHtml = `<p class="text-base">Zagrano łącznie: <span class="font-bold text-teal-400">${totalGames}</span> gier</p>`;
    const sortedWins = Object.entries(stats.playerWins).sort(([, a], [, b]) => b - a);
    if (sortedWins.length > 0) {
        summaryHtml += `<h4 class="mt-3 mb-2 font-semibold text-sm">Ranking zwycięstw:</h4>`;
        summaryHtml += `<div class="space-y-1 text-sm">`;
        sortedWins.forEach(([name, wins]) => {
            const winPercentage = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(0) : 0;
            summaryHtml += `<div class="flex justify-center gap-2"><span>${name}:</span> <span class="font-semibold">${wins} wygrane (${winPercentage}%)</span></div>`;
        });
        summaryHtml += `</div>`;
    } else {
        summaryHtml += `<p class="mt-3 text-sm text-slate-400">Brak zapisanych gier w rankingu.</p>`;
    }
    statsSummary.innerHTML = summaryHtml;
    setupScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    statsScreen.classList.remove('hidden');
}

// --- Event Listeners ---

showLoadGameBtn.addEventListener('click', handleShowLoadScreen);
backFromLoadBtn.addEventListener('click', () => {
    loadGameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
});
loadGameBtn.addEventListener('click', loadGameStateFromFirebase);
deleteGameBtn.addEventListener('click', handleDeleteSavedGame);
saveGameBtn.addEventListener('click', saveCurrentGameState);
showStatsBtn.addEventListener('click', showStats);
gameToStatsBtn.addEventListener('click', showStats);
backFromStatsBtn.addEventListener('click', handleBackFromStats);
playerCountSelect.addEventListener('change', generatePlayerNameInputs);
startGameBtn.addEventListener('click', startGame);
addRoundBtn.addEventListener('click', addRoundScore);
rotateFirstPlayerBtn.addEventListener('click', rotateFirstPlayer);
backToMenuBtn.addEventListener('click', handleBackToMenu);
modalBackToMenuBtn.addEventListener('click', resetGame);
clearStatsBtn.addEventListener('click', handleClearStats);

// Inicjalizacja
generatePlayerNameInputs();