(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const runQuery = async (q) => {
    app.commands.executeCommandById("global-search:open");
    await wait(600);
    const leaf = app.workspace.getLeavesOfType("search")[0];
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await wait(300);
    const input = leaf.view.containerEl.querySelector("input");
    if (!input) return { error: "no input" };
    input.value = q;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(900);
    const resultsEl = leaf.view.containerEl.querySelector(".search-results");
    return {
      query: q,
      count: leaf.view.containerEl.querySelectorAll(".search-result-file-title, .tree-item-self.search-result-file-title").length,
      matches: leaf.view.containerEl.querySelectorAll(".search-result-file-match").length,
      text: (resultsEl ? resultsEl.textContent : "").replace(/\s+/g, " ").slice(0, 500),
      empty: !!leaf.view.containerEl.querySelector(".search-empty-state"),
    };
  };

  try {
    out.plain = await runQuery("Alpha");
    out.operatorTag = await runQuery("tag:#project");
    out.operatorPath = await runQuery("path:Daily");
    out.operatorFile = await runQuery("file:Beta");
    out.operatorBool = await runQuery("Alpha OR Beta");
    out.operatorNeg = await runQuery("-Beta research");
    out.operatorRegex = await runQuery("/Alph[a-z]/");
    out.property = await runQuery("[status:active]");
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  }

  try {
    app.commands.executeCommandById("graph:open");
    await wait(2000);
    const leaf = app.workspace.getLeavesOfType("graph")[0];
    const v = leaf && leaf.view;
    out.graph = {
      viewType: v && v.getViewType(),
      renderer: v && v.renderer && v.renderer.constructor.name,
      nodeCount: v && v.renderer && v.renderer.nodes && v.renderer.nodes.size,
      linkCount: v && v.renderer && v.renderer.links && v.renderer.links.size,
      controls: v && [...v.containerEl.querySelectorAll(".graph-controls .setting-item-name")].map((e) => e.textContent),
    };
  } catch (e) {
    out.graph = { error: String(e && e.message ? e.message : e) };
  }

  return JSON.stringify(out, null, 2);
})();
