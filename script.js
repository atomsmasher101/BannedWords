const words = {};
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function log(msg) {
    console.log('[Banned Words Overlay]', msg);
    const el = document.getElementById('status');
    if (el) el.textContent = msg;
}

function renderWords() {
    const container = document.getElementById('wordsContainer');
    if (!container) return;
    
    const wordEntries = Object.entries(words);
    if (wordEntries.length === 0) {
        container.innerHTML = '<div class="empty-state">Waiting for challenge to start...</div>';
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

function connect() {
    console.log('[Banned Words] Connecting...');
    log('Connecting...');
    
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('[Banned Words] OPEN');
        log('Connected');
    };

    ws.onmessage = (event) => {
        console.log('[Banned Words] <<<', event.data);
        try {
            const data = JSON.parse(event.data);
            
            // Handle broadcast messages from CPH.WebsocketBroadcastJson
            // These are sent directly, not through the event system
            if (data.type === 'start' && data.words) {
                handleStart(data.words);
            } else if (data.type === 'increment' && data.word) {
                handleIncrement(data.word, data.count || 1);
            } else if (data.type === 'end') {
                handleEnd(data.results);
            } else {
                // Log but ignore other messages (Hello, Subscribe responses, etc)
                if (data.request === 'Hello') {
                    console.log('[Banned Words] Connected to Streamer.bot');
                } else if (data.id === 'banned-words-sub') {
                    console.log('[Banned Words] Subscribe response:', data.status);
                }
            }
        } catch (e) {
            console.log('[Banned Words] Not JSON');
        }
    };

    ws.onerror = () => {
        console.log('[Banned Words] Error');
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

console.log('[Banned Words] INIT');
connect();
