(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  for (const [name, path] of [["canvas", "Research.canvas"], ["base", "Projects.base"]]) {
    try {
      const f = app.vault.getAbstractFileByPath(path);
      const leaf = app.workspace.getLeaf("tab");
      await leaf.openFile(f);
      await wait(2000);
      out[name] = {
        viewType: leaf.view.getViewType(),
        containerClasses: [...leaf.view.containerEl.querySelectorAll(".view-content > *")].map((e) => e.className),
        text: (leaf.view.containerEl.textContent || "").replace(/\s+/g, " ").slice(0, 700),
        data: leaf.view.getViewData ? String(leaf.view.getViewData()).slice(0, 600) : null,
      };
    } catch (e) {
      out[name] = { error: String(e && e.message || e) };
    }
  }
  return JSON.stringify(out, null, 2);
})();
