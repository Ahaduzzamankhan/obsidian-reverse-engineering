(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const leaf = app.workspace.getLeavesOfType("markdown").find((l) => l.view.file && l.view.file.path === "Sanitizer.md");
  app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.view.setState({ mode: "source", source: false }, { history: false });
  await wait(2000);
  const cm = leaf.view.containerEl.querySelector(".cm-content");
  const sizer = leaf.view.containerEl.querySelector(".markdown-preview-sizer");
  const attrs = [];
  [cm, sizer].forEach((root) => root && root.querySelectorAll("*").forEach((n) => { for (const a of n.attributes) if (/^on/i.test(a.name) || /^javascript:/i.test(a.value)) attrs.push(n.tagName + " " + a.name + "=" + a.value.slice(0, 40)); }));
  return JSON.stringify({
    mode: leaf.view.getMode(),
    cmHTML: cm ? cm.innerHTML.replace(/\s+/g, " ").slice(0, 2500) : null,
    sizerLen: sizer ? sizer.innerHTML.length : null,
    dangerousAttributes: attrs,
    xssFlags: Object.keys(window).filter((k) => k.startsWith("__xss")),
  }, null, 2);
})();
