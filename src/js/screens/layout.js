/**
 * Shared screen shell.
 *
 * Per CLAUDE_PROJECT_INSTRUCTIONS.md §8 and the master instructions'
 * "Role Privacy" section: every player must see the same overall
 * component structure (header, content, action area) regardless of
 * what role-specific content fills it. That requirement starts here,
 * in Phase 1, so later phases don't have to retrofit it.
 */

const BACK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

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
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}
