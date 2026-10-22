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
  // brief circular reveal when the user reaches a new section
  function peek() {
    if (nav.classList.contains("open") || quiet) return;
    nav.classList.add("peek");
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => nav.classList.remove("peek"), 1500);
  }
  // no peeks while a click-to-scroll is passing through other sections
  function stayQuiet(ms) {
    quiet = true;
    clearTimeout(peekDelay);
    nav.classList.remove("peek");
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => { quiet = false; }, ms);
  }

  toggle.addEventListener("click", () => nav.classList.contains("open") ? closeMenu() : openMenu());
  nav.querySelector(".rnav-backdrop").addEventListener("click", closeMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  items.forEach((a, i) => {
    a.addEventListener("click", () => { stayQuiet(1100); closeMenu(); });
    a.addEventListener("mouseenter", () => { label.textContent = names[i]; });
    a.addEventListener("focus", () => { label.textContent = names[i]; });
    a.addEventListener("mouseleave", () => { label.textContent = names[current]; });
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
