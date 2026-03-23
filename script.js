const words = {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let ws = null;

function log(msg) {
    console.log('[Banned Words]', msg);
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function renderWords() {
    const container = document.getElementById('wordsContainer');
    if (!container) return;
    
    const wordEntries = Object.entries(words);
    if (wordEntries.length === 0) {
        container.innerHTML = '<div class="empty-state">Waiting for challenge...</div>';
        return;
    }
    container.innerHTML = wordEntries.map(([word, count]) => `
        <div class="word-card" id="card-${word}">
            <div class="word-text">${word}</div>
            <div class="count" id="count-${word}">${count}</div>
        </div>
    `).join('');
}

function animateWord(word) {
    const card = document.getElementById(`card-${word}`);
    const count = document.getElementById(`count-${word}`);
    if (card) {
        card.classList.add('animating', 'highlight');
        setTimeout(() => card.classList.remove('animating', 'highlight'), 300);
    }
    if (count) {
        count.classList.add('flash');
        setTimeout(() => count.classList.remove('flash'), 400);
    }
}

function handleIncrement(word, count) {
    words[word.toLowerCase()] = count;
    renderWords();
    animateWord(word);
    log(`Detected: ${word} = ${count}`);
}

function handleEnd(results) {
    log('Challenge ended');
    setTimeout(() => {
        for (let key in words) delete words[key];
        renderWords();
    }, 5000);
}

function handleStart(wordsList) {
    for (let key in words) delete words[key];
    wordsList.forEach(w => words[w.toLowerCase()] = 0);
    renderWords();
    log(`Started: ${wordsList.join(', ')}`);
}

function handleMessage(data) {
    console.log('[Banned Words] Handling:', data);
    
    if (data.type === 'start' && data.words) {
        handleStart(data.words);
    } else if (data.type === 'increment' && data.word) {
        handleIncrement(data.word, data.count || 1);
    } else if (data.type === 'end') {
        handleEnd(data.results);
    } else {
        console.log('[Banned Words] Unknown type:', data.type);
    }
}

function connect() {
    console.log('[Banned Words] Connecting...');
    log('Connecting...');
    
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('[Banned Words] Connected');
        log('Connected');
    };

    ws.onmessage = (event) => {
        console.log('[Banned Words] Raw:', event.data);
        
        // Try to parse as JSON
        try {
            const data = JSON.parse(event.data);
            
            // Handle broadcast (direct JSON from WebsocketBroadcastJson)
            if (data.type) {
                handleMessage(data);
            }
        } catch (e) {
            // If it fails, maybe it's multiple JSON objects?
            // Try splitting by newlines
            const lines = event.data.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        if (data.type) handleMessage(data);
                    } catch (e2) {}
                }
            }
        }
    };

    ws.onerror = () => {
        log('Error');
    };

    ws.onclose = (e) => {
        console.log('[Banned Words] Closed:', e.code);
        reconnectAttempts++;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            log(`Reconnecting (${reconnectAttempts})...`);
            setTimeout(connect, 3000);
        }
    };
}

// Check URL params on load
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('type') === 'start' && urlParams.get('words')) {
    const wordsParam = urlParams.get('words').split(',');
    handleStart(wordsParam);
}

console.log('[Banned Words] INIT');
connect();
