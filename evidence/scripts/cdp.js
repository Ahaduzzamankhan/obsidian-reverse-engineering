// Minimal Chrome DevTools Protocol client for the running Obsidian instance.
// Usage:
//   node cdp.js list
//   node cdp.js eval "<expression>"
//   node cdp.js shot <outfile.png>
//   node cdp.js html "<selector>"
const fs = require("fs");

const PORT = process.env.CDP_PORT || 9222;

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(JSON.stringify(msg.error)));
        else r(msg.result);
      }
    });
    ws.addEventListener("error", reject);
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const mid = ++id;
          ws.send(JSON.stringify({ id: mid, method, params }));
          return new Promise((r, j) => pending.set(mid, { resolve: r, reject: j }));
        },
        close: () => ws.close(),
      }),
    );
  });
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  const expr = cmd === "run" ? fs.readFileSync(arg, "utf8") : arg;
  const list = await targets();
  if (cmd === "list") {
    console.log(JSON.stringify(list.map((t) => ({ type: t.type, title: t.title, url: t.url })), null, 2));
    return;
  }
  if (cmd === "all") {
    const rows = [];
    for (const t of pages) {
      rows.push({ title: t.title, url: t.url, id: t.id });
    }
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  const pages = list.filter((t) => t.type === "page");
  const page = process.env.CDP_ANY
    ? pages[0]
    : pages.find((t) => t.url.startsWith("app://obsidian.md")) || pages[0];
  if (!page) throw new Error("no page target");
  const c = await connect(page.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  if (cmd === "eval" || cmd === "run") {
    const r = await c.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      console.log("EXCEPTION:", JSON.stringify(r.exceptionDetails, null, 2));
    } else {
      const v = r.result.value;
      console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
    }
  } else if (cmd === "shot") {
    const r = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(arg, Buffer.from(r.data, "base64"));
    console.log("saved", arg);
  } else if (cmd === "html") {
    const r = await c.send("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(arg)})?.outerHTML || "NO MATCH"`,
      returnByValue: true,
    });
    console.log(r.result.value);
  } else {
    console.error("unknown command");
    process.exitCode = 1;
  }
  c.close();
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exitCode = 1;
});
