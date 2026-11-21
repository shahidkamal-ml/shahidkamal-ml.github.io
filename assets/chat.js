/* SK-Mark I: a small AI assistant that answers visitors' questions about Shahid.
   It talks to a Cloudflare Worker (data-endpoint on the script tag) that runs an open-weight model.
   Model output is only ever inserted as text nodes and as links built here, never as HTML. */
(function () {
    'use strict';
    var script = document.currentScript;
    var ENDPOINT = script && script.getAttribute('data-endpoint');
    var BASE = ENDPOINT ? ENDPOINT.replace(/\/chat$/, '') : '';
    var SITEKEY = script && script.getAttribute('data-turnstile');
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
                        } else if (msg.reset) {
                            answer = '';
                            body.textContent = '';
                            body.classList.add('is-typing');
                        } else if (Array.isArray(msg.slots) && msg.slots.length) {
                            renderSlots(body.parentNode, msg.slots);
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

    /* ---------- booking in the chat ---------- */
    // Slots come from the server (via the AI's lookup or the booking bar). Booking itself is a plain
    // form post to /book: the AI never books anything.
    function renderSlots(container, slots) {
        var box = el('div', 'skm-slots');
        box.appendChild(el('p', 'skm-slots-h', 'Open times \u00b7 Eastern Time'));
        var days = [];
        var byDay = {};
        slots.forEach(function (s) {
            if (!byDay[s.day]) { byDay[s.day] = []; days.push(s.day); }
            byDay[s.day].push(s);
        });
        days.forEach(function (day) {
            var row = el('div', 'skm-day');
            row.appendChild(el('span', 'skm-day-l', day));
            var times = el('div', 'skm-times');
            byDay[day].forEach(function (s) {
                var b = el('button', 'skm-slot', s.time);
                b.type = 'button';
                b.setAttribute('aria-label', 'Book ' + s.day + ' at ' + s.time + ' Eastern Time');
                b.addEventListener('click', function () {
                    box.querySelectorAll('.skm-slot').forEach(function (x) { x.classList.remove('is-picked'); });
                    b.classList.add('is-picked');
                    bookingForm(s);
                });
                times.appendChild(b);
            });
            row.appendChild(times);
            box.appendChild(row);
        });
        var alt = el('a', 'skm-alt', 'Other days? Open the booking page \u2197');
        alt.href = BOOKING;
        if (!touch) { alt.target = '_blank'; alt.rel = 'noopener'; }
        box.appendChild(alt);
        container.appendChild(box);
        log.scrollTop = log.scrollHeight;
    }

    function field(labelText, inputEl) {
        var l = el('label', 'skm-field');
        l.appendChild(el('span', '', labelText));
        l.appendChild(inputEl);
        return l;
    }

    var turnstileLoading = null;
    function loadTurnstile() {
        if (!SITEKEY) return Promise.resolve(null);
        if (window.turnstile) return Promise.resolve(window.turnstile);
        if (!turnstileLoading) {
            turnstileLoading = new Promise(function (resolve) {
                var t = document.createElement('script');
                t.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                t.async = true;
                t.onload = function () { resolve(window.turnstile || null); };
                t.onerror = function () { resolve(null); };
                document.head.appendChild(t);
            });
        }
        return turnstileLoading;
    }

    var BOOK_ERRORS = {
        bad_name: 'Please enter your name.',
        bad_email: 'Please enter a valid email address.',
        slot_taken: 'That time was just taken. Please pick another one.',
        visitor_limit: 'You\u2019ve already booked a meeting today. To change it, use your invite or email ' + EMAIL + '.',
        daily_limit: 'Today\u2019s chat bookings are full. Please use the booking page: ' + BOOKING,
        not_human: 'Please complete the quick check, then confirm again.',
        busy: 'Too many requests right now. Please wait a minute and try again.'
    };

    function bookingForm(slot) {
        var old = log.querySelector('.skm-msg.is-form');
        if (old) old.parentNode.removeChild(old);
        var m = el('div', 'skm-msg bot is-form');
        var tag = el('span', 'skm-tag', 'SK\u00b7I');
        tag.setAttribute('aria-hidden', 'true');
        m.appendChild(tag);
        var f = el('form', 'skm-bookform');
        var title = el('p', 'skm-bf-title');
        title.appendChild(el('b', '', slot.day + ' \u00b7 ' + slot.time + ' ET'));
        title.appendChild(el('small', '', '30 min \u00b7 Google Meet \u00b7 invite by email'));
        f.appendChild(title);

        var nameIn = el('input');
        nameIn.type = 'text'; nameIn.required = true; nameIn.maxLength = 80; nameIn.autocomplete = 'name';
        var mailIn = el('input');
        mailIn.type = 'email'; mailIn.required = true; mailIn.maxLength = 254; mailIn.autocomplete = 'email';
        var topicIn = el('input');
        topicIn.type = 'text'; topicIn.maxLength = 300; topicIn.placeholder = 'Optional';
        f.appendChild(field('Your name', nameIn));
        f.appendChild(field('Your email (the invite goes here)', mailIn));
        f.appendChild(field('What would you like to discuss?', topicIn));

        var human = el('div', 'skm-human');
        var widgetId = null;
        if (SITEKEY) {
            f.appendChild(human);
            loadTurnstile().then(function (ts) {
                if (ts) widgetId = ts.render(human, { sitekey: SITEKEY, theme: 'auto', size: 'flexible' });
            });
        }

        var status = el('p', 'skm-bf-status');
        status.setAttribute('aria-live', 'polite');
        var actions = el('div', 'skm-bf-actions');
        var ok = el('button', 'skm-bf-ok', 'Confirm booking');
        ok.type = 'submit';
        var cancel = el('button', 'skm-bf-cancel', 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', function () { m.parentNode.removeChild(m); });
        actions.appendChild(ok);
        actions.appendChild(cancel);
        f.appendChild(actions);
        f.appendChild(status);

        f.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!f.reportValidity()) return;
            var token = SITEKEY && window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : '';
            ok.disabled = true;
            ok.textContent = 'Booking\u2026';
            status.textContent = '';
            fetch(BASE + '/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: slot.start, name: nameIn.value, email: mailIn.value, topic: topicIn.value, turnstile: token })
            }).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; });
            }).then(function (r) {
                if (r.ok && r.j.ok) {
                    f.textContent = '';
                    f.classList.add('is-done');
                    var done = el('p', 'skm-bf-done');
                    done.appendChild(el('b', '', '\u2713 Booked: ' + r.j.day + ' at ' + r.j.time + ' ET.'));
                    done.appendChild(document.createTextNode(' A Google Calendar invite with the Meet link is on its way to ' + mailIn.value + '. To change or cancel, use the invite or email ' + EMAIL + '.'));
                    f.appendChild(done);
                    history.push({ q: '(The visitor booked a meeting.)', a: 'Booked a 30-minute Google Meet with Shahid on ' + r.j.day + ' at ' + r.j.time + ' ET; the invite was emailed.' });
                    log.querySelectorAll('.skm-slots').forEach(function (x) { x.parentNode.removeChild(x); });
                } else {
                    var code = r.j && r.j.error;
                    richText(status, BOOK_ERRORS[code] || ('I couldn\u2019t book that just now. Please use the booking page: ' + BOOKING));
                    ok.disabled = false;
                    ok.textContent = 'Confirm booking';
                    if (SITEKEY && window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
                    if (code === 'slot_taken') showOpenTimes();
                }
                log.scrollTop = log.scrollHeight;
            }).catch(function () {
                richText(status, 'I couldn\u2019t reach the calendar. Please use the booking page: ' + BOOKING);
                ok.disabled = false;
                ok.textContent = 'Confirm booking';
            });
        });

        m.appendChild(f);
        log.appendChild(m);
        // Scroll so the form's date line sits at the top of the chat area.
        log.scrollTop += m.getBoundingClientRect().top - log.getBoundingClientRect().top - 8;
        if (!touch) nameIn.focus({ preventScroll: true });
    }

    // The booking bar shows open times right in the chat (no AI involved).
    function showOpenTimes() {
        chips.hidden = true;
        var body = addMsg('bot', '');
        body.classList.add('is-typing');
        fetch(BASE + '/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
            .then(function (r) {
                body.classList.remove('is-typing');
                if (!r.ok || !Array.isArray(r.j.slots)) throw new Error('slots');
                if (!r.j.slots.length) {
                    richText(body, 'No open times in the next week. For later dates, use the booking page: ' + BOOKING + ' or email ' + EMAIL + '.');
                    return;
                }
                richText(body, 'Here are Shahid\u2019s next open times. Pick one to book a 30-minute Google Meet.');
                renderSlots(body.parentNode, r.j.slots);
            })
            .catch(function () {
                body.classList.remove('is-typing');
                richText(body, 'I couldn\u2019t load his calendar just now. You can book here instead: ' + BOOKING);
            });
    }
    bookBar.addEventListener('click', function (e) {
        if (!BASE) return; // no server configured: the bar stays a plain link to the booking page
        e.preventDefault();
        showOpenTimes();
    });

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
