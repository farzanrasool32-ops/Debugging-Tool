// Environment loader for vanilla frontend
// Reads frontend/.env file at runtime when served via HTTP or falls back to sane defaults.
(function () {
  window.__ENV__ = window.__ENV__ || {};

  // Parse simple KEY=VALUE format
  function parseEnvText(text) {
    const env = {};
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        // Remove surrounding quotes if present
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  }

  // Attempt to fetch .env
  window.__ENV_PROMISE__ = fetch(".env")
    .then((res) => {
      if (!res.ok) throw new Error("Could not load .env");
      return res.text();
    })
    .then((text) => {
      const parsed = parseEnvText(text);
      Object.assign(window.__ENV__, parsed);
      if (parsed.BACKEND_API_URL || parsed.VITE_BACKEND_API_URL) {
        window.BACKEND_API_URL = parsed.BACKEND_API_URL || parsed.VITE_BACKEND_API_URL;
      }
      return window.__ENV__;
    })
    .catch(() => {
      // If fetching .env directly is blocked (e.g., file:// protocol or web server doesn't serve dotfiles),
      // fallback smoothly to environment defaults or window overrides.
      return window.__ENV__;
    });
})();
