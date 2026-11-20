/* shahidkamal.dev — home page behaviour. No dependencies. */
(function () {
    'use strict';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ---------- contrastive pair: same scene, different motion ---------- */
    var stage = document.getElementById('pairStage');
    if (stage) {
        var MODES = {
            speed: {
                q: 'Which clip is faster?',
                a: { x0: 30, x1: 170, h: 46, period: 3.3, n: 12, val: 'slower' },
                b: { x0: 30, x1: 170, h: 46, period: 1.1, n: 4, val: 'faster' }
            },
            magnitude: {
                q: 'Which clip moves farther?',
                a: { x0: 72, x1: 128, h: 18, period: 2.2, n: 7, val: 'smaller' },
                b: { x0: 30, x1: 170, h: 46, period: 2.2, n: 7, val: 'larger' }
            },
            direction: {
                q: 'Which clip moves left to right?',
                a: { x0: 30, x1: 170, h: 46, period: 2.2, n: 7, val: 'left to right' },
                b: { x0: 170, x1: 30, h: 46, period: 2.2, n: 7, val: 'right to left' }
            }
        };
        var BASE = 112, HOLD = 1.0;
        var mode = 'speed', playing = !reduce.matches, visible = true, t0 = null, frozen = 0, raf = 0;
        var qEl = document.getElementById('pairQ');
        var toggle = document.getElementById('pairToggle');
        var tabs = document.querySelectorAll('[data-mode]');
        var panels = [];

        function pos(c, u) {
            return [c.x0 + (c.x1 - c.x0) * u, BASE - c.h * 4 * u * (1 - u)];
        }
        function panel(key, c) {
            var s = '<div class="clip clip-' + key + '"><p class="clip-lab"><span>Clip ' + key.toUpperCase() +
                '</span><span class="val">' + c.val + '</span></p>' +
                '<svg viewBox="0 0 200 150" role="img" aria-label="Clip ' +
                key.toUpperCase() + ': a dot follows an arc, ' + c.val + '">' +
                '<path class="tick" d="M8 20V8h12M180 8h12v12M192 130v12h-12M20 142H8v-12"/>' +
                '<line class="ground" x1="18" y1="122" x2="182" y2="122"/>';
            for (var k = 0; k < c.n; k++) {
                var p = pos(c, k / (c.n - 1));
                s += '<circle class="ghost" r="4" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '"/>';
            }
            return s + '<circle class="head" r="6.5"/></svg></div>';
        }
        function build() {
            var m = MODES[mode];
            stage.innerHTML = panel('a', m.a) + panel('b', m.b);
            qEl.textContent = m.q;
            panels = [m.a, m.b].map(function (c, i) {
                var svg = stage.children[i].querySelector('svg');
                return { c: c, ghosts: svg.querySelectorAll('.ghost'), head: svg.querySelector('.head') };
            });
            tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
        }
        function draw(t) {
            panels.forEach(function (p) {
                var u = Math.min(1, t / p.c.period), xy = pos(p.c, u), n = p.ghosts.length;
                p.head.setAttribute('cx', xy[0].toFixed(1));
                p.head.setAttribute('cy', xy[1].toFixed(1));
                for (var k = 0; k < n; k++) {
                    var shown = u >= k / (n - 1) - 0.001;
                    p.ghosts[k].setAttribute('opacity', shown ? (0.3 + 0.45 * k / (n - 1)).toFixed(2) : '0');
                }
            });
        }
        function cycle() {
            var m = MODES[mode];
            return Math.max(m.a.period, m.b.period) + HOLD;
        }
        function tick(now) {
            if (t0 === null) t0 = now - frozen * 1000;
            frozen = ((now - t0) / 1000) % cycle();
            draw(frozen);
            raf = requestAnimationFrame(tick);
        }
        function sync() {
            cancelAnimationFrame(raf);
            t0 = null;
            toggle.textContent = playing ? 'Pause' : 'Play';
            toggle.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' the motion illustration');
            if (playing && visible) raf = requestAnimationFrame(tick);
            else draw(playing ? frozen : (frozen || 99));
        }
        tabs.forEach(function (b) {
            b.addEventListener('click', function () { mode = b.dataset.mode; frozen = 0; build(); sync(); });
        });
        toggle.addEventListener('click', function () {
            playing = !playing;
            if (playing && frozen >= cycle() - HOLD) frozen = 0;
            sync();
        });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(stage);
        }
        document.addEventListener('visibilitychange', function () { visible = !document.hidden; sync(); });
        build();
        sync();
    }

    /* ---------- long sections start collapsed on phones (open in the HTML, so no-JS shows everything) ---------- */
    if (window.matchMedia('(max-width: 720px)').matches) {
        document.querySelectorAll('details[data-collapse]').forEach(function (d) { d.open = false; });
    }

    /* ---------- preview videos: load and play only when on screen ---------- */
    document.querySelectorAll('video[data-preview]').forEach(function (v) {
        var btn = v.parentNode.querySelector('button');
        var wanted = !reduce.matches;
        function label() {
            if (btn) btn.textContent = v.paused ? 'Play preview' : 'Pause preview';
        }
        v.addEventListener('play', label);
        v.addEventListener('pause', label);
        if (btn) {
            btn.addEventListener('click', function () {
                wanted = v.paused;
                if (wanted) v.play().catch(function () {}); else v.pause();
            });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (es) {
                if (es[0].isIntersecting && wanted) v.play().catch(function () {});
                else v.pause();
            }, { threshold: 0.25 }).observe(v);
        }
        label();
    });
})();

/* Resume PDF on phones and tablets: open it in the same tab. iPhone Safari can do nothing when a
   PDF link opens a new tab; in the same tab its built-in viewer shows the PDF and Back returns here. */
(function () {
    if (!window.matchMedia || !window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    document.querySelectorAll('a[data-pdf]').forEach(function (a) { a.removeAttribute('target'); a.removeAttribute('rel'); });
})();
