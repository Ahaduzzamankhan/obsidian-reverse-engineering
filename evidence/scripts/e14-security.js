(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ipc = require("electron").ipcRenderer;
  const step = (k, fn) => {
    try {
      out[k] = fn();
    } catch (e) {
      out[k] = "ERR " + (e && e.message ? e.message : e);
    }
  };

  step("nodeExposure", () => ({
    require: typeof require,
    process: typeof process,
    processVersion: process.version,
    versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
    windowRequire: typeof window.require,
    module: typeof module,
    globalProcessEnvKeys: Object.keys(process.env).length,
  }));

  step("csp", () => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return { meta: m && m.content, hasDefaultSrc: !!(m && m.content.includes('default-src')), hasScriptSrc: !!(m && m.content.includes('script-src')) };
  });

  step("inlineScriptAllowed", () => {
    const s = document.createElement("script");
    s.textContent = "window.__inlineRan = true;";
    document.head.appendChild(s);
    return window.__inlineRan === true;
  });

  step("webviewTag", () => {
    const el = document.createElement("webview");
    return { extended: el.constructor.name, hasLoadURL: typeof el.loadURL === "function" };
  });

  step("sanitizer", () => {
    const api = require("obsidian");
    const dirty = '<img src=x onerror="window.__xss=1"><script>window.__xss2=1<\/script><a href="javascript:alert(1)">x</a><b onclick="window.__xss3=1">ok</b>';
    const frag = api.sanitizeHTMLToDom(dirty);
    const div = document.createElement("div");
    div.appendChild(frag);
    return { html: div.innerHTML, handlers: document.querySelectorAll("[onerror],[onclick]").length };
  });

  step("protocol", async () => {
    const res = {};
    try {
      const r = await fetch("app://obsidian.md/index.html");
      res.internalAppOrigin = r.status;
    } catch (e) {
      res.internalAppOrigin = "ERR " + e.message;
    }
    try {
      const r = await fetch("app://obsidian.md/../../../../Windows/win.ini");
      res.traversalInternal = { status: r.status, body: (await r.text()).slice(0, 60) };
    } catch (e) {
      res.traversalInternal = "ERR " + e.message;
    }
    try {
      const r = await fetch("file:///C:/Windows/win.ini");
      res.fileProtocol = r.status;
    } catch (e) {
      res.fileProtocol = "ERR " + e.message;
    }
    return res;
  });

  step("ipcSurface", () => {
    const channels = {};
    for (const ch of ["policy", "version", "resources", "desktop-dir", "file-url", "is-quitting", "terms", "plugin-script-root"]) {
      try {
        const v = ipc.sendSync(ch, null);
        channels[ch] = typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 120);
      } catch (e) {
        channels[ch] = "ERR " + e.message;
      }
    }
    return channels;
  });

  step("trustedTypes", () => ({ trustedTypes: typeof window.trustedTypes, isSecureContext: window.isSecureContext }));

  step("electronRemote", () => {
    try {
      const remote = require("@electron/remote");
      return { available: typeof remote, BrowserWindow: typeof remote.BrowserWindow };
    } catch (e) {
      return "ERR " + e.message;
    }
  });

  step("secretStorage", async () => {
    try {
      const keys = app.secretStorage && Object.getOwnPropertyNames(Object.getPrototypeOf(app.secretStorage));
      let list = null;
      try {
        list = app.secretStorage.listSecrets ? await app.secretStorage.listSecrets() : null;
      } catch (e) {
        list = "ERR " + e.message;
      }
      return { methods: keys, secrets: list };
    } catch (e) {
      return "ERR " + e.message;
    }
  });

  await wait(500);
  return JSON.stringify(out, null, 2);
})();
