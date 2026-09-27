/**
 * Shared screen shell.
 *
 * Per CLAUDE_PROJECT_INSTRUCTIONS.md §8 and the master instructions'
 * "Role Privacy" section: every player must see the same overall
 * component structure (header, content, action area) regardless of
 * what role-specific content fills it. That requirement starts here,
 * in Phase 1, so later phases don't have to retrofit it.
 */

import { subscribeConnectionStatus } from "../state/roomStore.js";

const BACK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Phase 10: shared icons for renderStatePlaceholder()'s two tones —
// a neutral "i" for empty/gone states, a warning triangle for real errors.
const INFO_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
  <path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="8" r="1.1" fill="currentColor"/>
</svg>`;

const WARNING_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 3.5 21 20H3L12 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="17" r="1.1" fill="currentColor"/>
</svg>`;

export const STATE_ICONS = { info: INFO_ICON, warning: WARNING_ICON };

/**
 * Renders the header + empty content section into `root`, returning the
 * content element for the screen module to populate.
 * @param {HTMLElement} root
 * @param {{ title: string, showBack?: boolean, onBack?: () => void, rightHtml?: string }} opts
 */
export function renderShell(root, opts) {
  const { title, showBack = false, onBack, rightHtml = "" } = opts;

  root.innerHTML = `
    <header class="app-header">
      <div class="app-header__side">
        ${showBack ? `<button class="btn-icon" type="button" data-role="back" aria-label="Go back">${BACK_ICON}</button>` : ""}
      </div>
      <h1 class="app-header__title">${title}</h1>
      <div class="app-header__side" data-role="right-slot">${rightHtml}</div>
    </header>
    <main class="screen" data-role="content"></main>
  `;

  if (showBack && onBack) {
    root.querySelector('[data-role="back"]').addEventListener("click", onBack);
  }

  return root.querySelector('[data-role="content"]');
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/**
 * Renders a centered icon + title + optional message/action, filling the
 * given content area. This is the one shared layout for every "nothing
 * substantive to show yet" moment a screen hits — first load, the room
 * being gone, or a real setup problem — so a player only ever has to
 * learn this pattern once. See components.css's `.state-block`.
 * @param {HTMLElement} container
 * @param {{ icon?: "info"|"warning", title: string, message?: string, actionLabel?: string, onAction?: () => void }} opts
 */
export function renderStatePlaceholder(container, opts) {
  const { icon, title, message = "", actionLabel, onAction } = opts;
  const tone = icon === "warning" ? "error" : "neutral";

  container.innerHTML = `
    <div class="state-block" role="${tone === "error" ? "alert" : "status"}">
      ${icon ? `<div class="state-icon ${tone === "error" ? "state-icon--error" : ""}">${STATE_ICONS[icon] || ""}</div>` : ""}
      <p class="state-block__title">${escapeHtml(title)}</p>
      ${message ? `<p class="state-block__message">${escapeHtml(message)}</p>` : ""}
      ${
        actionLabel
          ? `<button class="btn btn-primary" type="button" data-role="state-action" style="width:auto; padding-left:24px; padding-right:24px; margin-top:var(--space-xs);">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>
  `;

  if (actionLabel && onAction) {
    container.querySelector('[data-role="state-action"]').addEventListener("click", onAction);
  }
}

/** Convenience wrapper for the plain "still fetching" placeholder (spinner, no icon/action). */
export function renderLoadingState(container, message = "Loading…") {
  container.innerHTML = `
    <div class="state-block" role="status">
      <span class="spinner spinner-lg" aria-hidden="true"></span>
      <p class="state-block__message">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Puts a button into a disabled, spinner+label busy state, remembering
 * its original markup so clearButtonBusy() can restore it exactly on a
 * failure path. Safe to call more than once in a row (e.g. re-labeling
 * mid-flow) — only the FIRST call's markup is remembered as "original."
 */
export function setButtonBusy(button, label) {
  if (button.dataset.busyOriginal === undefined) {
    button.dataset.busyOriginal = button.innerHTML;
  }
  button.disabled = true;
  button.innerHTML = `<span class="spinner spinner-sm" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
}

/** Restores a button previously put into a busy state by setButtonBusy(). */
export function clearButtonBusy(button) {
  button.disabled = false;
  if (button.dataset.busyOriginal !== undefined) {
    button.innerHTML = button.dataset.busyOriginal;
    delete button.dataset.busyOriginal;
  }
}

let announceEl = null;

/**
 * Announces `message` to screen readers via a persistent aria-live region
 * kept outside the #app tree (renderShell() replaces that whole tree on
 * every state update rather than patching it, which gives a screen reader
 * nothing stable to diff against — a freshly-inserted live region often
 * isn't announced by the time its content is set in the same tick). Used
 * for phase changes and the one-time "10 seconds left" timer cue. No-ops
 * if `message` repeats the last announcement.
 */
export function announce(message) {
  if (!announceEl) {
    announceEl = document.createElement("div");
    announceEl.className = "visually-hidden";
    announceEl.setAttribute("role", "status");
    announceEl.setAttribute("aria-live", "polite");
    document.body.appendChild(announceEl);
  }
  if (announceEl.textContent === message) return;
  announceEl.textContent = message;
}

let toastTimer = null;

/**
 * Shows a short-lived toast for mock action feedback (e.g. "Link copied").
 * @param {string} message
 */
export function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

/**
 * Formats milliseconds remaining as "M:SS", floored at 0. The countdown
 * shown is purely visual — per GAME_RULES.md's timer philosophy, the
 * server's deadline is what actually resolves a phase, never the
 * client's own clock.
 */
export function formatRemaining(deadlineMs) {
  const remainingMs = Math.max(0, (deadlineMs || 0) - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Starts a 1s-interval ticker that updates a timer element's text.
 *
 * Phase 10: also toggles `.timer-badge--critical` (a pulsing red, see
 * components.css) once 10s or less remain, and announces that moment
 * once via announce() — a screen reader user has no way to see the
 * color pulse, so without this they'd get zero signal that time is
 * almost up.
 * @param {HTMLElement} el
 * @param {number} deadlineMs
 * @returns {() => void} stop the ticker
 */
export function startCountdown(el, deadlineMs) {
  if (!el || !deadlineMs) return () => {};

  let announcedCritical = false;

  function tick() {
    const remainingMs = Math.max(0, deadlineMs - Date.now());
    el.textContent = formatRemaining(deadlineMs);

    const isCritical = remainingMs > 0 && remainingMs <= 10000;
    el.classList.toggle("timer-badge--critical", isCritical);
    if (isCritical && !announcedCritical) {
      announcedCritical = true;
      announce("10 seconds left");
    }
  }

  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/**
 * Shows a persistent banner while the browser reports no network
 * connection. This is a connectivity *hint* for the player, not
 * authoritative — the app's own polling/backoff in roomStore.js already
 * handles actual request failures regardless of what this shows.
 * @returns {() => void} stop listening (rarely needed — this runs for the app's lifetime)
 */
export function initOfflineIndicator() {
  let banner = null;

  function show() {
    if (banner) return;
    banner = document.createElement("div");
    banner.className = "offline-banner";
    banner.textContent = "You're offline — will reconnect automatically.";
    document.body.appendChild(banner);
  }

  function hide() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  window.addEventListener("online", hide);
  window.addEventListener("offline", show);
  if (typeof navigator !== "undefined" && navigator.onLine === false) show();

  return () => {
    window.removeEventListener("online", hide);
    window.removeEventListener("offline", show);
    hide();
  };
}

/**
 * Shows a small top banner while this device's room polling has failed
 * several times in a row but the browser still believes it's online —
 * e.g. Apps Script momentarily busy, or a flaky connection that never
 * actually trips navigator.onLine. Distinct from initOfflineIndicator()
 * above, and deliberately never shown at the same time: this checks
 * navigator.onLine itself before appearing, and hides immediately on the
 * browser's own "offline" event, so a real disconnect always shows the
 * (more specific) offline banner instead of both stacked at once.
 * @returns {() => void} stop listening
 */
export function initReconnectIndicator() {
  let banner = null;

  function show() {
    if (banner || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    banner = document.createElement("div");
    banner.className = "reconnect-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `<span class="spinner spinner-sm" aria-hidden="true"></span><span>Reconnecting…</span>`;
    document.body.appendChild(banner);
  }

  function hide() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  const unsubscribe = subscribeConnectionStatus((status) => {
    if (status === "reconnecting") show();
    else hide();
  });
  window.addEventListener("offline", hide);

  return () => {
    unsubscribe();
    window.removeEventListener("offline", hide);
    hide();
  };
}

/**
 * Watches a service worker registration and shows a small, dismissible,
 * non-forcing toast once a newer version has taken over in the
 * background. Deliberately does NOT auto-reload the page: this is a
 * physical group game in progress, and yanking someone's screen out
 * from under them mid-vote to apply an update would be far worse than
 * letting them refresh whenever suits them (e.g. once the game ends).
 * See DECISIONS.md's Phase 8 notes.
 */
export function initUpdatePrompt() {
  if (!("serviceWorker" in navigator)) return;

  let notifiedOnce = false;
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // The very first controllerchange (a fresh install with no prior
    // controller) isn't an "update" — only notify on a SUBSEQUENT change,
    // which means a newer version replaced one that was already running.
    if (!hadController) {
      hadController = true;
      return;
    }
    if (notifiedOnce) return;
    notifiedOnce = true;

    const toast = document.createElement("div");
    toast.className = "update-toast";
    toast.innerHTML = `
      <span>A new version has loaded.</span>
      <button type="button" data-role="reload">Refresh</button>
      <button type="button" data-role="dismiss" aria-label="Dismiss">&times;</button>
    `;
    toast.querySelector('[data-role="reload"]').addEventListener("click", () => window.location.reload());
    toast.querySelector('[data-role="dismiss"]').addEventListener("click", () => toast.remove());
    document.body.appendChild(toast);
  });
}
