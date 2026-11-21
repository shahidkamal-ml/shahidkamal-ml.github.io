/* SK-Mark I: a small AI assistant that answers visitors' questions about Shahid.
   It talks to a Cloudflare Worker (data-endpoint on the script tag) that runs an open-weight model.
   Model output is only ever inserted as text nodes and as links built here, never as HTML. */
(function () {
    'use strict';
    var script = document.currentScript;
    var ENDPOINT = script && script.getAttribute('data-endpoint');
    var EMAIL = 'contact@shahidkamal.dev';
    var BOOKING = 'https://calendar.app.google/bwwTwATQHtTPxEeZ7';
    var touch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var history = [];
    var busy = false;

    var SUGGESTIONS = [
        'What does Shahid work on?',
        'Tell me about MotionBlind',
        'What did he do at Checkit Analytics?',
        'Is he open to full-time roles?'
    ];
    var ERRORS = {
        busy: 'I’m getting a lot of questions right now. Try again in a minute, or email ' + EMAIL + '.',
        offline: 'I’m offline for now. Email ' + EMAIL + ' and Shahid will get back to you.',
        network: 'I couldn’t reach my server. Check your connection, or email ' + EMAIL + '.',
        fallback: 'Something went wrong on my side. Please email ' + EMAIL + '.'
    };

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text) e.textContent = text;
        return e;
    }

    /* ---------- build the UI ---------- */
    var launch = el('button', 'skm-launch');
    launch.type = 'button';
    launch.setAttribute('aria-expanded', 'false');
    launch.setAttribute('aria-controls', 'skm-panel');
    launch.innerHTML = '<svg class="skm-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" stroke-dasharray="4 5 22 5"/><circle cx="20" cy="20" r="11" stroke-dasharray="1.5 3.5" opacity=".7"/><circle cx="20" cy="20" r="4" class="skm-core"/></svg>' +
        '<span class="skm-launch-t">Ask SK-Mark I</span>';
    launch.setAttribute('aria-label', 'Ask SK-Mark I, an AI assistant about Shahid');

    var panel = el('section', 'skm');
    panel.id = 'skm-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'skm-title');
    panel.hidden = true;

    var head = el('header', 'skm-head');
    var dot = el('span', 'skm-dot');
    dot.setAttribute('aria-hidden', 'true');
    var titles = el('div', 'skm-titles');
    var h = el('h2', 'skm-title', 'SK-Mark I');
    h.id = 'skm-title';
    titles.appendChild(h);
    titles.appendChild(el('p', 'skm-sub', 'AI assistant · answers from Shahid’s resume'));
    var close = el('button', 'skm-x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close the assistant');
    head.appendChild(dot);
    head.appendChild(titles);
    head.appendChild(close);

    // Always-visible booking bar: opens Shahid's Google Calendar booking page directly (no AI involved).
    var bookBar = el('a', 'skm-book');
    bookBar.href = BOOKING;
    if (!touch) { bookBar.target = '_blank'; bookBar.rel = 'noopener'; }
    bookBar.innerHTML = '<svg class="skm-book-i" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/></svg>' +
        '<span class="skm-book-t"><b>Book a meeting with Shahid</b><small>30 min \u00b7 Google Meet</small></span>' +
        '<svg class="skm-book-a" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5 12.5 10 7 15.5"/></svg>';

    var log = el('div', 'skm-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');

    var chips = el('div', 'skm-chips');
    SUGGESTIONS.forEach(function (s) {
        var b = el('button', 'skm-chip', s);
        b.type = 'button';
        b.addEventListener('click', function () { ask(s); });
        chips.appendChild(b);
    });

    var form = el('form', 'skm-form');
    var input = el('textarea', 'skm-in');
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = 'Ask about Shahid’s work…';
    input.setAttribute('aria-label', 'Your question for SK-Mark I');
    var send = el('button', 'skm-send');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    send.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M4.5 9.5 10 4l5.5 5.5"/></svg>';
    form.appendChild(input);
    form.appendChild(send);

    var note = el('p', 'skm-note');
    note.appendChild(document.createTextNode('AI can make mistakes. For anything important, email '));
    var mail = el('a', '', EMAIL);
    mail.href = 'mailto:' + EMAIL;
    note.appendChild(mail);
    note.appendChild(document.createTextNode(' or '));
    var book = el('a', '', 'book a meeting');
    book.href = BOOKING;
    if (!touch) { book.target = '_blank'; book.rel = 'noopener'; }
    note.appendChild(book);
    note.appendChild(document.createTextNode('.'));

    panel.appendChild(head);
    panel.appendChild(bookBar);
    panel.appendChild(log);
    panel.appendChild(chips);
    panel.appendChild(form);
    panel.appendChild(note);
    document.body.appendChild(launch);
    document.body.appendChild(panel);

    /* ---------- messages ---------- */
    function addMsg(who, text) {
        var m = el('div', 'skm-msg ' + who);
        if (who === 'bot') {
            var tag = el('span', 'skm-tag', 'SK·I');
            tag.setAttribute('aria-hidden', 'true');
            m.appendChild(tag);
        }
        var body = el('div', 'skm-body');
        if (text) richText(body, text);
        m.appendChild(body);
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
        return body;
    }

    // Turn URLs and email addresses into links; everything else stays plain text.
    var LINK = /(https?:\/\/[^\s<>"')\]]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    function richText(node, text) {
        node.textContent = '';
        var last = 0, m;
        LINK.lastIndex = 0;
        while ((m = LINK.exec(text))) {
            var raw = m[0], trail = '';
            while (/[.,;:!?]$/.test(raw)) { trail = raw.slice(-1) + trail; raw = raw.slice(0, -1); }
            node.appendChild(document.createTextNode(text.slice(last, m.index)));
            var a = el('a', '', raw);
            if (raw.indexOf('@') > 0 && raw.indexOf('://') < 0) {
                a.href = 'mailto:' + raw;
            } else {
                a.href = raw;
                if (!touch) { a.target = '_blank'; a.rel = 'noopener'; }
            }
            node.appendChild(a);
            if (trail) node.appendChild(document.createTextNode(trail));
            last = m.index + m[0].length;
        }
        node.appendChild(document.createTextNode(text.slice(last)));
    }

    function setBusy(on) {
        busy = on;
        send.disabled = on;
        panel.classList.toggle('is-busy', on);
    }

    function ask(question) {
        question = (question || '').trim().slice(0, 500);
        if (!question || busy) return;
        chips.hidden = true;
        addMsg('me', question);
        input.value = '';
        grow();
        var body = addMsg('bot', '');
        body.classList.add('is-typing');
        setBusy(true);
        if (!ENDPOINT) { finish(body, '', 'offline'); return; }

        var controller = 'AbortController' in window ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, 45000);
        var answer = '';

        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question, history: history.slice(-6) }),
            signal: controller ? controller.signal : undefined
        }).then(function (res) {
            var type = res.headers.get('content-type') || '';
            if (!res.ok || type.indexOf('ndjson') < 0) {
                return res.json().catch(function () { return {}; }).then(function (j) {
                    throw new Error(j.error === 'busy' ? 'busy' : j.error === 'offline' ? 'offline' : 'fallback');
                });
            }
            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';
            var failed = '';
            function pump() {
                return reader.read().then(function (step) {
                    if (step.done) return;
                    buffer += decoder.decode(step.value, { stream: true });
                    var i;
                    while ((i = buffer.indexOf('\n')) >= 0) {
                        var line = buffer.slice(0, i).trim();
                        buffer = buffer.slice(i + 1);
                        if (!line) continue;
                        var msg;
                        try { msg = JSON.parse(line); } catch (e) { continue; }
                        if (typeof msg.t === 'string') {
                            answer += msg.t;
                            body.classList.remove('is-typing');
                            body.textContent = answer;
                            log.scrollTop = log.scrollHeight;
                        } else if (msg.error) {
                            failed = 'fallback';
                        }
                    }
                    return pump();
                });
            }
            return pump().then(function () { if (failed && !answer) throw new Error(failed); });
        }).then(function () {
            finish(body, answer, answer ? '' : 'fallback');
            if (answer) history.push({ q: question, a: answer.slice(0, 1500) });
        }).catch(function (err) {
            var kind = err && (err.message === 'busy' || err.message === 'offline' || err.message === 'fallback') ? err.message : 'network';
            finish(body, answer, answer ? '' : kind);
        }).then(function () { clearTimeout(timer); });
    }

    function finish(body, answer, errorKind) {
        body.classList.remove('is-typing');
        if (errorKind) {
            body.parentNode.classList.add('is-error');
            richText(body, ERRORS[errorKind] || ERRORS.fallback);
        } else {
            richText(body, answer.trim());
        }
        log.scrollTop = log.scrollHeight;
        setBusy(false);
    }

    /* ---------- open / close ---------- */
    function open() {
        panel.hidden = false;
        launch.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('skm-open');
        if (!log.childNodes.length) {
            addMsg('bot', 'Hi, I’m SK-Mark I, the assistant on Shahid’s site. Ask me about his research, projects, experience or how to reach him.');
        }
        if (!touch) input.focus();
    }
    function shut() {
        panel.hidden = true;
        launch.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('skm-open');
        launch.focus();
    }
    launch.addEventListener('click', function () { panel.hidden ? open() : shut(); });
    close.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) shut();
    });

    function grow() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
    input.addEventListener('input', grow);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            ask(input.value);
        }
    });
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        ask(input.value);
    });
})();
