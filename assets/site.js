/* shahidkamal.dev — home page behaviour. No dependencies. */
(function () {
    'use strict';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ---------- hero background: a quiet optical-flow field. Static by default; on desktop it
       bends toward the pointer's motion and settles again. Decorative only. ---------- */
    var cv = document.getElementById('flow');
    if (cv && cv.getContext) {
        var ctx = cv.getContext('2d'), W = 0, H = 0, ink = '#000', hot = '#f00';
        var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        var step = fine ? 34 : 44, px = 0, py = 0, vx = 1, vy = 0, en = 0, fraf = 0, lx = null, ly = 0;
        var drawFlow = function () {
            ctx.clearRect(0, 0, W, H);
            ctx.lineWidth = 1; ctx.lineCap = 'round';
            for (var y = step / 2; y < H; y += step) {
                for (var x = step / 2; x < W; x += step) {
                    var a = Math.sin(x * 0.0045) * 1.1 + Math.cos(y * 0.007 + x * 0.002) * 1.3;
                    var ux = Math.cos(a), uy = Math.sin(a), k = 0;
                    if (en > 0.01) {
                        var dx = x - px, dy = y - py;
                        k = en * Math.exp(-(dx * dx + dy * dy) / 26000);
                        if (k > 0.02) {
                            ux = ux * (1 - k) + vx * k; uy = uy * (1 - k) + vy * k;
                            var n = Math.sqrt(ux * ux + uy * uy) || 1; ux /= n; uy /= n;
                        } else { k = 0; }
                    }
                    var len = 4 + 5 * k;
                    ctx.globalAlpha = (fine ? 0.13 : 0.08) + 0.45 * k;
                    ctx.strokeStyle = ctx.fillStyle = k > 0.2 ? hot : ink;
                    ctx.beginPath(); ctx.moveTo(x - ux * len, y - uy * len); ctx.lineTo(x + ux * len, y + uy * len); ctx.stroke();
                    ctx.beginPath(); ctx.arc(x + ux * len, y + uy * len, 1.2, 0, 6.3); ctx.fill();
                }
            }
        };
        var sizeFlow = function () {
            var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
            var cs = getComputedStyle(document.documentElement);
            ink = cs.getPropertyValue('--ink').trim() || ink; hot = cs.getPropertyValue('--a').trim() || hot;
            W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d);
            ctx.setTransform(d, 0, 0, d, 0, 0);
            drawFlow();
        };
        var settle = function () {
            en *= 0.93; drawFlow();
            if (en > 0.01) fraf = requestAnimationFrame(settle); else { en = 0; fraf = 0; drawFlow(); }
        };
        var rz = 0;
        window.addEventListener('resize', function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(sizeFlow); });
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sizeFlow);
        if (fine && !reduce.matches) {
            cv.parentNode.addEventListener('pointermove', function (e) {
                var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
                if (lx !== null) {
                    var dx = x - lx, dy = y - ly, m = Math.sqrt(dx * dx + dy * dy);
                    if (m > 1) { vx = vx * 0.7 + dx / m * 0.3; vy = vy * 0.7 + dy / m * 0.3; }
                }
                lx = x; ly = y; px = x; py = y; en = 1;
                if (!fraf) fraf = requestAnimationFrame(settle);
            }, { passive: true });
        }
        sizeFlow();
    }

    /* ---------- HUD lock-on: boxes snap onto real elements; every readout is a real measurement.
       All timing is CSS; JS only places the boxes. Skipped under reduced motion. ---------- */
    var hero = document.getElementById('top');
    var mk = function (cls, text) {
        var e = document.createElement(cls === 'hud-box' || cls === 'hud' ? 'div' : 'span');
        e.className = cls;
        if (text) { e.textContent = text; e.style.setProperty('--n', text.length); }
        return e;
    };
    var measure = function (r) {
        return 'x' + Math.round(r.left + window.scrollX) + ' y' + Math.round(r.top + window.scrollY) + ' ' + Math.round(r.width) + '\u00d7' + Math.round(r.height);
    };
    if (hero && !reduce.matches && window.scrollY < 200 && hero.animate) {
        hero.classList.add('hud-run');
        var runHud = function () {
            if (!hero.classList.contains('hud-run') || hero.querySelector('.hud')) return;
            var hr = hero.getBoundingClientRect(), small = window.innerWidth <= 720;
            var hud = mk('hud'), n = 0;
            hud.setAttribute('aria-hidden', 'true');
            hud.style.setProperty('--w', hr.width + 'px');
            hud.appendChild(mk('hud-sweep'));
            [['.det', 'person', 0.25, 0, ''], ['h1', 'name', 0.6, 5, ' r'], ['.cta', 'links', 0.95, 6, ' r b']].forEach(function (t, i) {
                var el = hero.querySelector(t[0]);
                if (!el || (small && i === 2)) return;
                var r = el.getBoundingClientRect(), p = t[3], box = mk('hud-box' + t[4]);
                box.style.cssText = 'left:' + (r.left - hr.left - p) + 'px;top:' + (r.top - hr.top - p) + 'px;width:' + (r.width + 2 * p) + 'px;height:' + (r.height + 2 * p) + 'px;--d:' + t[2] + 's';
                box.appendChild(mk('hud-lab', t[1] + ' \u00b7 track 00' + (++n) + (small && i ? '' : ' \u00b7 ' + measure(r))));
                if (i === 0) box.insertAdjacentHTML('beforeend', '<svg class="hud-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" stroke-dasharray="3 7 34 7"/><circle cx="50" cy="50" r="43" stroke-dasharray="1 5" opacity=".6"/></svg>');
                hud.appendChild(box);
            });
            if (!small) {
                var st = mk('hud-status', 'scan \u00b7 view ' + window.innerWidth + '\u00d7' + window.innerHeight + ' \u00b7 ' + n + ' targets');
                var wr = hero.querySelector('.wrap').getBoundingClientRect();
                st.style.right = (hr.right - wr.right + parseFloat(getComputedStyle(hero.querySelector('.wrap')).paddingRight)) + 'px';
                hud.appendChild(st);
            }
            var done = function () { hud.remove(); hero.classList.remove('hud-run', 'hud-go'); window.removeEventListener('resize', done); };
            hud.addEventListener('animationend', function (e) { if (e.target === hud) done(); });
            window.addEventListener('resize', done);
            hero.appendChild(hud);
            hero.classList.add('hud-go');
        };
        var startHud = function () { requestAnimationFrame(runHud); };
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(startHud);
        setTimeout(startHud, 1200);
    }

    /* cards: one lock-on as each scrolls into view; the readout is the card's own box */
    var tagged = document.querySelectorAll('.tagged');
    var fineHud = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    tagged.forEach(function (c) {
        c.style.setProperty('--n', (c.getAttribute('data-tag') || '').length);
        if (!fineHud) return;
        var rd = mk('hud-read');
        rd.setAttribute('aria-hidden', 'true');
        c.appendChild(rd);
        var fill = function () { rd.textContent = measure(c.getBoundingClientRect()); };
        c.addEventListener('pointerenter', fill);
        c.addEventListener('animationstart', function (e) { if (e.animationName === 'card-lock') fill(); });
    });
    if (!reduce.matches && 'IntersectionObserver' in window) {
        var lockIO = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
                if (!en.isIntersecting) return;
                lockIO.unobserve(en.target);
                en.target.classList.add('lock');
                en.target.addEventListener('animationend', function (e) { if (e.animationName === 'card-lock') en.target.classList.remove('lock'); });
            });
        }, { threshold: 0.25 });
        tagged.forEach(function (c) { lockIO.observe(c); });
    }

    /* section scans: as each section's heading comes into view, one sweep passes over it and boxes lock onto
       its heading and the items on screen; items further down lock on one by one as they scroll in.
       Track ids continue from the hero; every readout is the element's real box. */
    if (!reduce.matches && 'IntersectionObserver' in window && document.body.animate) {
        var trackId = 3;
        var pad = function (k) { return ('00' + k).slice(-3); };
        var labelFor = function (el) {
            if (el.matches('.xp > li')) return 'role';
            if (el.matches('.pubs > li')) return 'paper';
            if (el.matches('.panel')) return ((el.querySelector('h2, h3') || {}).textContent || 'panel').trim().toLowerCase();
            if (el.matches('.cta')) return 'links';
            if (el.matches('img')) return 'frame';
            return 'object';
        };
        var layer = function (host, targets, sweep) {
            var hr = host.getBoundingClientRect(), small = window.innerWidth <= 720;
            var hud = mk('hud');
            hud.setAttribute('aria-hidden', 'true');
            hud.style.setProperty('--w', hr.width + 'px');
            if (sweep) hud.appendChild(mk('hud-sweep'));
            targets.forEach(function (t, i) {
                var r = t[0].getBoundingClientRect(), p = t[0].matches('img') ? 3 : 6, box = mk('hud-box e');
                box.style.cssText = 'left:' + (r.left - hr.left - p) + 'px;top:' + (r.top - hr.top - p) + 'px;width:' + (r.width + 2 * p) + 'px;height:' + (r.height + 2 * p) + 'px;--d:' + (sweep ? 0.2 + i * 0.25 : 0) + 's';
                box.appendChild(mk('hud-lab', t[1] + ' · track ' + pad(++trackId) + (small ? '' : ' · ' + measure(r))));
                hud.appendChild(box);
            });
            hud.addEventListener('animationend', function (e) { if (e.target === hud) hud.remove(); });
            host.appendChild(hud);
        };
        var onScreen = function (el) { var r = el.getBoundingClientRect(); return r.bottom > 56 && r.top < window.innerHeight - 40; };
        var itemIO = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
                if (!en.isIntersecting) return;
                itemIO.unobserve(en.target);
                layer(en.target.closest('.sec'), [[en.target, labelFor(en.target)]], false);
            });
        }, { threshold: 0.4, rootMargin: '-56px 0px -10% 0px' });
        var secIO = new IntersectionObserver(function (es) {
            es.forEach(function (en) {
                if (!en.isIntersecting) return;
                secIO.unobserve(en.target);
                var sec = en.target.closest('.sec'), small = window.innerWidth <= 720, max = small ? 1 : 2;
                var idx = sec.querySelector('.idx');
                var targets = [[en.target, (idx && !small ? idx.textContent.trim() + ' · ' : '') + sec.id]];
                /* items on screen now: up to `max` join this scan, the rest stay quiet; items below lock on as they scroll in */
                sec.querySelectorAll('.xp > li, .panel, .pubs > li, .contact .cta, .card picture img').forEach(function (el) {
                    if (!onScreen(el)) itemIO.observe(el);
                    else if (targets.length <= max) targets.push([el, labelFor(el)]);
                });
                layer(sec, targets, true);
            });
        }, { threshold: 1, rootMargin: '0px 0px -12% 0px' });
        document.querySelectorAll('.sec').forEach(function (sec) {
            var head = sec.querySelector('.sec-head') || sec.querySelector('h2');
            if (head) secIO.observe(head);
        });
    }

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

/* Phones and tablets: open links in the same tab. iPhone Safari can do nothing when a link opens a
   new tab (seen with the resume PDF, GitHub and Scholar); in the same tab it works and Back returns here. */
(function () {
    if (!window.matchMedia || !window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    // Same for every new-tab link (GitHub, Scholar, LinkedIn, papers): on touch devices they open in this tab.
    document.querySelectorAll('a[data-pdf], a[target="_blank"]').forEach(function (a) { a.removeAttribute('target'); a.removeAttribute('rel'); });
})();
