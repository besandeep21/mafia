import { renderLanding } from "./screens/landing.js";
import { renderCreate } from "./screens/create.js";
import { renderJoin } from "./screens/join.js";
import { renderLobby } from "./screens/lobby.js";

const root = document.getElementById("app");
let currentCleanup = null;

/**
 * Parses a hash like "#/join?code=123456" into { path: "/join", params: { code: "123456" } }.
 */
function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = raw.split("?");
  const params = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { path: path || "/", params };
}

function navigate(path) {
  window.location.hash = `#${path}`;
}

const routes = {
  "/": renderLanding,
  "/create": renderCreate,
  "/join": renderJoin,
  "/lobby": renderLobby,
};

function renderRoute() {
  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }

  const { path, params } = parseHash();
  const screen = routes[path] || routes["/"];
  currentCleanup = screen(root, navigate, params) || null;
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);

// In case DOMContentLoaded already fired before this module executed.
if (document.readyState !== "loading") {
  renderRoute();
}

// Register the service worker for installability + offline app shell caching.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Registration failure shouldn't break the app — it just won't be installable/offline yet.
    });
  });
}
