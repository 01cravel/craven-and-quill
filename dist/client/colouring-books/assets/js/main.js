/**
 * Craven & Quill Books — site scripts.
 *
 * BOOKS below is the one place to activate a live Amazon link. Every "Buy on
 * Amazon" button and badge on every page carries a data-book attribute and
 * upgrades itself automatically once you paste in a real product URL here.
 * Leave a title's amazonUrl as null and the site keeps showing its honest
 * pre-launch state and funnels to the email signup instead.
 */
const BOOKS = {
  ghosts: { amazonUrl: null },
  animals: { amazonUrl: null },
  mandalas: { amazonUrl: null },
};

// This is the whole current test: no live purchase path yet, just "leave your
// email, we'll tell you when we're live." Move this date as the real launch
// date moves — everything with .js-launch-countdown re-reads it on load.
const LAUNCH_DATE = "2026-09-29";

// Where the email signup forms submit. "/api/subscribe" is the site's own
// server (dist/server/index.js), which stores the email plus what they asked
// for in the site database. Set to null for a local-only demo message.
const NEWSLETTER_ENDPOINT = "/api/subscribe";

document.addEventListener("DOMContentLoaded", () => {
  upgradeBuyButtons();
  initLaunchCountdown();
  initNav();
  initGallery();
  initNewsletterForms();
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});

function initLaunchCountdown() {
  const msPerDay = 86400000;
  const daysLeft = Math.ceil((new Date(LAUNCH_DATE) - new Date()) / msPerDay);

  let text;
  if (daysLeft > 10) text = "Launching in 2 weeks";
  else if (daysLeft > 1) text = `Launching in ${daysLeft} days`;
  else if (daysLeft === 1) text = "Launching tomorrow";
  else text = "Launching any day now";

  document.querySelectorAll(".js-launch-countdown").forEach((el) => {
    el.textContent = text;
  });
}

function upgradeBuyButtons() {
  Object.entries(BOOKS).forEach(([slug, data]) => {
    if (!data.amazonUrl) return;
    document.querySelectorAll(`[data-book="${slug}"].js-buy-btn`).forEach((btn) => {
      btn.href = data.amazonUrl;
      btn.target = "_blank";
      btn.rel = "noopener";
      btn.removeAttribute("aria-disabled");
      const label = btn.querySelector(".btn-label");
      if (label) label.textContent = "Buy on Amazon";
    });
    document.querySelectorAll(`[data-book="${slug}"].js-buy-badge`).forEach((badge) => {
      badge.textContent = "Available on Amazon";
      badge.classList.remove("badge-soon");
      badge.classList.add("badge-live");
    });
  });
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;

  const closeNav = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 900) closeNav();
  });
}

function initGallery() {
  const lightbox = document.querySelector(".lightbox");
  if (!lightbox) return;

  const img = lightbox.querySelector("img");
  const caption = lightbox.querySelector(".lightbox-caption");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const prevBtn = lightbox.querySelector(".lightbox-prev");
  const nextBtn = lightbox.querySelector(".lightbox-next");

  let items = [];
  let index = 0;
  let lastFocused = null;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const source = items[index].querySelector("img");
    img.src = source.dataset.full;
    img.alt = source.alt || "";
    caption.textContent = source.dataset.caption || "";
  };

  const open = (group, startIndex) => {
    items = group;
    lastFocused = document.activeElement;
    lightbox.classList.add("is-open");
    show(startIndex);
    closeBtn.focus();
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  };

  document.querySelectorAll(".gallery-grid").forEach((grid) => {
    const buttons = Array.from(grid.querySelectorAll(".gallery-item"));
    buttons.forEach((btn, i) => {
      btn.addEventListener("click", () => open(buttons, i));
    });
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => show(index - 1));
  nextBtn.addEventListener("click", () => show(index + 1));
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
}

function initNewsletterForms() {
  document.querySelectorAll("form[data-form='newsletter']").forEach((form) => {
    const wrap = form.parentElement;
    const success = wrap.querySelector(".form-success");
    const error = wrap.querySelector(".form-error");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (error) error.classList.remove("is-visible");

      if (!NEWSLETTER_ENDPOINT) {
        // Demo mode: no email service connected yet, so nothing is actually
        // saved anywhere. See website/README.md and NEWSLETTER_ENDPOINT above.
        revealSuccess(form, success);
        return;
      }

      const interest = document.querySelector('meta[name="cq-interest"]')?.content || "general";
      fetch(NEWSLETTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: form.elements.email.value,
          interest,
          page: location.pathname,
          website: form.elements.website ? form.elements.website.value : "",
        }),
      })
        .then(async (res) => {
          if (res.ok) return revealSuccess(form, success);
          const data = await res.json().catch(() => ({}));
          showError(error, data.error);
        })
        .catch(() => showError(error));
    });
  });
}

function showError(error, message) {
  if (!error) return;
  const span = error.querySelector("span");
  if (span) span.textContent = message || "Something went wrong — please try again in a moment.";
  error.classList.add("is-visible");
}

function revealSuccess(form, success) {
  form.reset();
  form.hidden = true;
  if (success) success.classList.add("is-visible");
}
