(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const leaf = app.workspace.getLeavesOfType("markdown").find((l) => l.view.file && l.view.file.path === "Sanitizer.md");
  app.workspace.setActiveLeaf(leaf, { focus: true });
  await wait(2500);
  const el = leaf.view.containerEl.querySelector(".markdown-preview-view");
  const attrs = [];
  el.querySelectorAll("*").forEach((n) => { for (const a of n.attributes) if (/^on/i.test(a.name) || /^javascript:/i.test(a.value)) attrs.push(n.tagName + " " + a.name + "=" + a.value.slice(0, 40)); });
  return JSON.stringify({
    mode: leaf.view.getMode(),
    html: el.innerHTML.replace(/\s+/g, " ").slice(0, 3000),
    dangerousAttributes: attrs,
    scriptCount: el.querySelectorAll("script").length,
    iframes: [...el.querySelectorAll("iframe")].map((i) => i.getAttribute("src")),
    imgSrcs: [...el.querySelectorAll("img")].map((i) => i.getAttribute("src")),
    xssFlags: Object.keys(window).filter((k) => k.startsWith("__xss")),
  }, null, 2);
})();
