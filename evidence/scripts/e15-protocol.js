(async () => {
  const out = {};
  const token = require("electron").ipcRenderer.sendSync("file-url", null);
  out.token = token;
  const tryFetch = async (url) => {
    try {
      const r = await fetch(url);
      const text = await r.text();
      return { url, status: r.status, len: text.length, head: text.slice(0, 80).replace(/\s+/g, " ") };
    } catch (e) {
      return { url, error: String(e && e.message ? e.message : e) };
    }
  };
  out.tests = [];
  out.tests.push(await tryFetch("app://obsidian.md/index.html"));
  out.tests.push(await tryFetch("app://obsidian.md/app.css"));
  out.tests.push(await tryFetch("app://obsidian.md/../resources/obsidian.asar"));
  out.tests.push(await tryFetch("app://obsidian.md/../../../../Windows/win.ini"));
  out.tests.push(await tryFetch(token + "Welcome.md"));
  out.tests.push(await tryFetch(token + "../../../../Windows/win.ini"));
  out.tests.push(await tryFetch(token + "attachments/projects.png"));
  out.secureContexts = {
    appOriginIsSecure: window.isSecureContext,
    sanitizeGlobal: typeof window.sanitizeHTMLToDom,
    obsidianGlobals: Object.keys(window).filter((k) => /sanit|md|render/i.test(k)).slice(0, 25),
  };
  // external link pipeline: does clicking a link call main-process openExternal?
  out.external = { openExternalInWindow: typeof window.openExternal, electronOpenExternal: typeof require("electron").shell?.openExternal };
  try {
    const shell = require("electron").shell;
    out.external.hasShell = !!shell;
    out.external.openPathType = typeof shell.openPath;
  } catch (e) {
    out.external.err = e.message;
  }
  return JSON.stringify(out, null, 2);
})();
