/* ===== Theme toggle (dark default, remembers choice) ===== */
(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch (e) {}
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();

/* ===== Radial navigation ===== */
(() => {
  const nav = document.getElementById("rnav");
  const toggle = document.getElementById("rnav-toggle");
  const items = [...nav.querySelectorAll(".rnav-item")];
  const label = nav.querySelector(".rnav-label");
  const pill = nav.querySelector(".rnav-pill");
  const hub = nav.querySelector(".rnav-hub");
  const sections = items.map(a => document.querySelector(a.getAttribute("href")));
  const names = items.map(a => a.dataset.label);

  let current = 0, ready = false, quiet = false;
  let peekDelay, peekTimer, quietTimer;

  // spread items evenly around the circle, starting from the top
  items.forEach((a, i) => {
    a.style.setProperty("--a", `${-90 + (i * 360) / items.length}deg`);
    a.style.setProperty("--i", i);
  });

  function setCurrent(i) {
    current = i;
    items.forEach((a, j) => {
      a.classList.toggle("active", j === i);
      if (j === i) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    pill.textContent = names[i];
    label.textContent = names[i];
    hub.innerHTML = items[i].querySelector("svg").outerHTML;
  }

  function openMenu() {
    clearTimeout(peekTimer);
    nav.classList.remove("peek");
    nav.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }
  function closeMenu() {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    label.textContent = names[current];
  }
  // circular reveal when the user reaches a new section. While it is on screen the
  // section buttons are clickable, exactly like the opened menu.
  const PEEK_MS = 1600;
  function startPeekTimer(ms) {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => nav.classList.remove("peek"), ms);
  }
  function peek() {
    if (nav.classList.contains("open") || quiet) return;
    nav.classList.add("peek");
    startPeekTimer(PEEK_MS);
  }
  // keep the circle on screen while the user is reaching for a button, hide it shortly after they let go
  function holdPeek() { if (nav.classList.contains("peek")) clearTimeout(peekTimer); }
  function releasePeek() { if (nav.classList.contains("peek")) startPeekTimer(900); }
  // no peeks while a click-to-scroll is passing through other sections
  function stayQuiet(ms) {
    quiet = true;
    clearTimeout(peekDelay);
    clearTimeout(peekTimer);
    nav.classList.remove("peek");
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => { quiet = false; }, ms);
  }

  toggle.addEventListener("click", () => nav.classList.contains("open") ? closeMenu() : openMenu());
  nav.querySelector(".rnav-backdrop").addEventListener("click", closeMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  items.forEach((a, i) => {
    a.addEventListener("click", () => { stayQuiet(1100); closeMenu(); });
    a.addEventListener("mouseenter", () => { label.textContent = names[i]; holdPeek(); });
    a.addEventListener("focus", () => { label.textContent = names[i]; holdPeek(); });
    a.addEventListener("mouseleave", () => { label.textContent = names[current]; releasePeek(); });
    a.addEventListener("blur", releasePeek);
    a.addEventListener("touchstart", holdPeek, { passive: true });
    a.addEventListener("touchend", releasePeek, { passive: true });
    a.addEventListener("touchcancel", releasePeek, { passive: true });
  });

  // scroll-spy: the section crossing the middle of the screen is "current"
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const i = sections.indexOf(e.target);
      if (i === current) return;
      setCurrent(i);
      if (ready) { clearTimeout(peekDelay); peekDelay = setTimeout(peek, 250); }
    });
  }, { rootMargin: "-45% 0px -54% 0px" });
  sections.forEach(s => io.observe(s));

  setCurrent(0);
  setTimeout(() => { ready = true; }, 800);
})();

/* ===== Scroll progress bar ===== */
(() => {
  const bar = document.createElement("div");
  bar.className = "progress";
  document.body.prepend(bar);
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

/* ===== Reveal on scroll (content stays visible if JS or IntersectionObserver is missing) ===== */
(() => {
  if (!("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(".section-title, .plate, .pitch, .hero-sub, .hero .btn-row");
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  targets.forEach(el => {
    // small stagger for siblings that appear together (e.g. skill cards, stat plates)
    const idx = [...el.parentElement.children].indexOf(el);
    el.style.setProperty("--d", `${Math.min(idx, 5) * 70}ms`);
    el.classList.add("reveal");
    io.observe(el);
  });
})();

/* ===== Project galleries: 3D coverflow + fullscreen lightbox =====
   In index.html, per project (any number of images, 1 or more):

   <div class="gallery" data-title="Name"
        data-folder="assets/projects/name"
        data-captions="Caption 1; Caption 2; Caption 3"></div>

   - Put the images in that folder named 1.png, 2.png, 3.png ... (jpg, jpeg, webp also work).
     The page keeps looking for the next number and stops at the first missing one,
     so adding or removing images never needs a code change.
   - data-captions is optional and matched by position.
   - Old style still works: data-images="a.png|Caption; b.png|Caption". */
(() => {
  const roots = [...document.querySelectorAll(".gallery")];
  if (!roots.length) return;

  const EXTS = ["png", "jpg", "jpeg", "webp"];
  const MAX_IMAGES = 12;
  const DEFAULT_RATIO = 2.1;           // used until real image sizes are known

  const ICON = {
    prev: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  const splitList = s => (s || "").split(";").map(x => x.trim()).filter(Boolean);

  // explicit list: "src|caption; src|caption"
  const parseExplicit = el => splitList(el.dataset.images).map(s => {
    const [src, ...rest] = s.split("|");
    return { src: src.trim(), cap: rest.join("|").trim(), ratio: 0 };
  });

  // load one image to see whether it exists and how big it is
  const probe = src => new Promise(res => {
    const im = new Image();
    im.onload = () => res({ src, ratio: im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0 });
    im.onerror = () => res(null);
    im.src = src;
  });

  // folder/1.png, folder/2.png ... until the first number that does not exist
  async function discover(folder, captions) {
    const base = folder.replace(/\/+$/, "");
    const found = [];
    for (let i = 1; i <= MAX_IMAGES; i++) {
      let hit = null;
      for (const ext of EXTS) {
        hit = await probe(`${base}/${i}.${ext}`);
        if (hit) break;
      }
      if (!hit) break;
      found.push({ src: hit.src, cap: captions[i - 1] || "", ratio: hit.ratio });
    }
    return found;
  }

  /* ---------- shared fullscreen lightbox ---------- */
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Image viewer");
  lb.innerHTML =
    `<button class="lb-btn lb-close" type="button" aria-label="Close image viewer">${ICON.close}</button>` +
    `<button class="lb-btn lb-prev" type="button" aria-label="Previous image">${ICON.prev}</button>` +
    `<figure class="lb-figure"><img class="lb-img" alt="" draggable="false"><figcaption class="lb-cap"></figcaption></figure>` +
    `<button class="lb-btn lb-next" type="button" aria-label="Next image">${ICON.next}</button>`;
  document.body.appendChild(lb);

  const lbImg = lb.querySelector(".lb-img");
  const lbCap = lb.querySelector(".lb-cap");
  const lbPrev = lb.querySelector(".lb-prev");
  const lbNext = lb.querySelector(".lb-next");
  const lbClose = lb.querySelector(".lb-close");
  const lbFigure = lb.querySelector(".lb-figure");

  let cur = null, curIndex = 0, lastFocus = null, hideTimer;

  const label = (i, n, cap) => (n > 1 ? `${i + 1} / ${n}` : "") + (cap ? `${n > 1 ? "  ·  " : ""}${cap}` : "");

  function lbShow() {
    const items = cur.items();
    const it = items[curIndex];
    if (!it) return;
    lbImg.src = it.src;
    lbImg.alt = it.cap || `${cur.title} screenshot ${curIndex + 1}`;
    lbCap.textContent = label(curIndex, items.length, it.cap);
    const multi = items.length > 1;
    lbPrev.hidden = lbNext.hidden = !multi;
    lbPrev.disabled = curIndex === 0;
    lbNext.disabled = curIndex === items.length - 1;
    // warm the cache for neighbours so stepping feels instant
    [curIndex - 1, curIndex + 1].forEach(j => { if (items[j]) new Image().src = items[j].src; });
  }
  function lbStep(dir) {
    const n = cur.items().length;
    const next = curIndex + dir;
    if (next < 0 || next >= n) return;
    curIndex = next;
    lbShow();
  }
  function lbOpen(api, index) {
    clearTimeout(hideTimer);
    cur = api; curIndex = index;
    lastFocus = document.activeElement;
    lbShow();
    lb.hidden = false;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => { lb.classList.add("show"); lbClose.focus(); });
  }
  function lbHide() {
    if (lb.hidden) return;
    lb.classList.remove("show");
    document.documentElement.style.overflow = "";
    const api = cur, idx = curIndex, back = lastFocus;
    hideTimer = setTimeout(() => { lb.hidden = true; lbImg.removeAttribute("src"); }, 250);
    if (api) api.setActive(idx);          // gallery jumps to the image you were viewing
    cur = null;
    if (api) api.focusActive(); else if (back && back.focus) back.focus();
  }

  lbClose.addEventListener("click", lbHide);
  lbPrev.addEventListener("click", () => lbStep(-1));
  lbNext.addEventListener("click", () => lbStep(1));
  // click on the dark backdrop (not on the image or buttons) closes
  lb.addEventListener("click", e => { if (e.target === lb) lbHide(); });

  document.addEventListener("keydown", e => {
    if (lb.hidden || !cur) return;
    if (e.key === "Escape") { e.preventDefault(); lbHide(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); lbStep(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); lbStep(1); }
    else if (e.key === "Tab") {
      // keep keyboard focus inside the viewer
      const f = [...lb.querySelectorAll("button")].filter(b => !b.hidden && !b.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // sideways trackpad scroll inside the viewer moves to the next / previous image
  let lbWheelAt = 0;
  lb.addEventListener("wheel", e => {
    if (!cur || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lbWheelAt < 380) return;
    lbWheelAt = now;
    lbStep(e.deltaX > 0 ? 1 : -1);
  }, { passive: false });

  // swipe left/right inside the viewer
  let lsx = 0, lDown = false;
  lbFigure.addEventListener("pointerdown", e => { lDown = true; lsx = e.clientX; });
  lbFigure.addEventListener("pointerup", e => {
    if (!lDown) return;
    lDown = false;
    const dx = e.clientX - lsx;
    if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
  });
  lbFigure.addEventListener("pointercancel", () => { lDown = false; });

  /* ---------- one coverflow per .gallery ---------- */
  function build(root) {
    const title = root.dataset.title || "Project";
    let items = [];
    let active = 0, pos = 0, stepPx = 300, lastW = 0, swiped = false;
    let stage, track, slides = [], dots = [], capEl;

    const api = {
      title,
      items: () => items,
      setActive: i => go(i),
      focusActive: () => { if (slides[active]) slides[active].focus({ preventScroll: true }); }
    };

    function go(i) {
      pos = Math.max(0, Math.min(items.length - 1, i));
      if (stage) stage.classList.remove("dragging");
      layout();
    }
    // follow a finger / wheel continuously; hard = no overshoot past the first/last image
    function setPos(p, hard) {
      const o = hard ? 0 : .3;
      pos = Math.max(-o, Math.min(items.length - 1 + o, p));
      layout();
    }

    // slides use the typical (median) ratio of this project's images, so nothing is cropped
    function groupRatio() {
      const r = items.map(x => x.ratio).filter(x => x > 0).sort((a, b) => a - b);
      if (!r.length) return DEFAULT_RATIO;
      const mid = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2;
      return Math.max(1.2, Math.min(2.6, mid));
    }

    function layout() {
      const n = items.length;
      const W = root.clientWidth;
      if (!n || !stage || !W) return;
      lastW = W;
      active = Math.max(0, Math.min(n - 1, Math.round(pos)));
      const small = W < 560;
      const ratio = groupRatio();

      let sw;
      if (n === 1) sw = Math.min(W * (small ? .94 : .86), 880, 520 * ratio);
      else sw = small ? W * .78 : Math.min(W * .62, 720, 460 * ratio);
      const sh = sw / ratio;
      stepPx = sw * .6;                   // pixels of drag that equal one image

      stage.style.height = `${Math.round(sh + (small ? 36 : 56))}px`;
      track.style.setProperty("--sw", `${sw}px`);
      track.style.setProperty("--sh", `${sh}px`);

      const k = small ? .64 : .74;        // distance of the first neighbour (x slide width)
      const extra = sw * .28;              // extra gap for slides further out
      const angle = small ? 46 : 50;

      slides.forEach((s, i) => {
        const d = i - pos, a = Math.abs(d), sgn = Math.sign(d), t = Math.min(a, 1);
        const x = sgn * (t * sw * k + Math.max(a - 1, 0) * extra);
        const z = -(t * 70 + Math.max(a - 1, 0) * 70);
        // side slides turn their faces toward the centre
        s.style.transform = `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${-sgn * angle * t}deg)`;
        s.style.zIndex = Math.round(100 - a * 10);
        s.style.setProperty("--t", t);
        s.classList.toggle("is-active", i === active);
        s.classList.toggle("is-far", a > 2.5);
        s.tabIndex = i === active ? 0 : -1;
      });
      dots.forEach((b, i) => {
        b.classList.toggle("on", i === active);
        if (i === active) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      });
      capEl.textContent = label(active, n, items[active].cap);
    }

    function render() {
      root.textContent = "";
      if (!items.length) {
        root.innerHTML = '<div class="gallery-empty">Screenshots coming soon</div>';
        return;
      }
      const n = items.length;
      active = Math.min(active, n - 1);

      stage = document.createElement("div");
      stage.className = "cf" + (n === 1 ? " single" : "");
      stage.tabIndex = 0;
      stage.setAttribute("role", "group");
      stage.setAttribute("aria-roledescription", "carousel");
      stage.setAttribute("aria-label", `${title} screenshots`);

      track = document.createElement("div");
      track.className = "cf-track";
      slides = items.map((it, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cf-slide";
        b.setAttribute("aria-label", `${title} screenshot ${i + 1} of ${n}${it.cap ? ": " + it.cap : ""}. Press to enlarge.`);
        const img = document.createElement("img");
        img.src = it.src;
        img.alt = "";
        img.draggable = false;
        img.decoding = "async";
        img.addEventListener("load", () => {         // learn the real size, then fit the frame to it
          const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0;
          if (r && Math.abs(r - it.ratio) > .001) { it.ratio = r; layout(); }
        }, { once: true });
        img.addEventListener("error", () => {        // missing file: drop it and re-lay out
          items = items.filter(x => x !== it);
          render();
        }, { once: true });
        b.appendChild(img);
        b.addEventListener("click", () => {
          const idx = items.indexOf(it);
          if (idx === active) lbOpen(api, idx); else go(idx);
        });
        track.appendChild(b);
        return b;
      });
      stage.appendChild(track);

      root.appendChild(stage);

      const meta = document.createElement("div");
      meta.className = "cf-meta";
      capEl = document.createElement("p");
      capEl.className = "cf-cap";
      capEl.setAttribute("aria-live", "polite");
      meta.appendChild(capEl);
      dots = [];
      if (n > 1 && n <= 10) {
        const wrap = document.createElement("div");
        wrap.className = "cf-dots";
        dots = items.map((_, i) => {
          const d = document.createElement("button");
          d.type = "button"; d.className = "cf-dot";
          d.setAttribute("aria-label", `Go to screenshot ${i + 1}`);
          d.addEventListener("click", () => go(i));
          wrap.appendChild(d);
          return d;
        });
        meta.appendChild(wrap);
      }
      root.appendChild(meta);

      /* drag (mouse / touch) and sideways wheel (trackpad) slide the images like horizontal scrolling;
         vertical scrolling of the page stays native (touch-action: pan-y) */
      let sx = 0, sy = 0, startPos = 0, lastX = 0, lastT = 0, vx = 0, pid = null, down = false, dragging = false;
      stage.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        down = true; dragging = false; swiped = false;
        sx = e.clientX; sy = e.clientY; startPos = pos; lastX = sx; lastT = e.timeStamp; vx = 0; pid = e.pointerId;
      });
      stage.addEventListener("pointermove", e => {
        if (!down || e.pointerId !== pid) return;
        const dx = e.clientX - sx;
        if (!dragging) {
          if (Math.abs(dx) < 6 || items.length < 2) return;
          if (Math.abs(e.clientY - sy) > Math.abs(dx)) { down = false; return; }   // mostly vertical: let the page scroll
          dragging = true;
          stage.classList.add("dragging");
          try { stage.setPointerCapture(pid); } catch (err) {}
        }
        const dt = e.timeStamp - lastT;
        if (dt > 0) vx = .8 * vx + .2 * ((e.clientX - lastX) / dt);
        lastX = e.clientX; lastT = e.timeStamp;
        setPos(startPos - dx / stepPx);
      });
      const end = e => {
        if (!down || e.pointerId !== pid) return;
        down = false;
        if (!dragging) return;
        dragging = false; swiped = true;          // a drag must not count as a click
        try { stage.releasePointerCapture(pid); } catch (err) {}
        const base = Math.round(pos);
        const target = Math.round(pos - vx * 100 / stepPx);   // a quick flick carries a little further
        go(Math.max(base - 1, Math.min(base + 1, target)));
      };
      stage.addEventListener("pointerup", end);
      stage.addEventListener("pointercancel", end);

      let wheelTimer;
      stage.addEventListener("wheel", e => {
        const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
        if (!horizontal || items.length < 2) return;      // plain vertical wheel keeps scrolling the page
        e.preventDefault();
        const raw = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const delta = raw * (e.deltaMode === 1 ? 16 : 1);
        stage.classList.add("dragging");
        setPos(pos + delta / (stepPx * 1.1), true);
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => go(Math.round(pos)), 140);   // settle on the nearest image when the swipe ends
      }, { passive: false });
      stage.addEventListener("click", e => {
        if (swiped) { swiped = false; e.stopPropagation(); e.preventDefault(); }
      }, true);

      stage.addEventListener("keydown", e => {
        if (e.target !== stage) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
        else if (e.key === "Home") { e.preventDefault(); go(0); }
        else if (e.key === "End") { e.preventDefault(); go(items.length - 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lbOpen(api, active); }
      });

      layout();
    }

    async function start() {
      if (root.dataset.images) items = parseExplicit(root);
      else if (root.dataset.folder) items = await discover(root.dataset.folder, splitList(root.dataset.captions));
      render();
      if ("ResizeObserver" in window) {
        new ResizeObserver(() => { if (root.clientWidth !== lastW) layout(); }).observe(root);
      } else {
        addEventListener("resize", layout);
      }
    }

    // placeholder while images are being looked up; start when the card is close to the screen
    root.innerHTML = '<div class="gallery-empty">Loading screenshots…</div>';
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
      }, { rootMargin: "400px 0px" });
      io.observe(root);
    } else {
      start();
    }
  }

  roots.forEach(build);
})();

/* ===== Metallic sheen that follows the cursor on plates (mouse devices only) ===== */
(() => {
  if (!matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll(".plate").forEach(p => {
    p.addEventListener("pointermove", e => {
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", `${e.clientX - r.left}px`);
      p.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
})();
