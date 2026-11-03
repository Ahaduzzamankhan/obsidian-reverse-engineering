(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = async (path) => {
    const f = app.vault.getAbstractFileByPath(path);
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(f);
    const v = leaf.view;
    await v.setState({ mode: "preview" }, { history: false });
    await wait(2200);
    const sizer = v.containerEl.querySelector(".markdown-preview-sizer");
    const wsLeaf = v.leaf && v.leaf.containerEl;
    return {
      path,
      mode: v.getMode(),
      sizerLen: sizer ? sizer.innerHTML.length : -1,
      sizerHTML: sizer ? sizer.innerHTML.replace(/\s+/g, " ").slice(0, 700) : null,
      leafDisplay: wsLeaf ? getComputedStyle(wsLeaf).display : null,
      active: v.leaf === app.workspace.activeLeaf,
    };
  };
  const out = { welcome: await check("Welcome.md"), raw: await check("RawHtml.md") };
  out.xss = Object.keys(window).filter((k) => k.startsWith("__x"));
  return JSON.stringify(out, null, 2);
})();
