(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const leaf = app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "canvas", state: { file: "Research.canvas" } });
  await wait(2500);
  const view = leaf.view;
  const canvas = view.canvas || view;
  return JSON.stringify({
    viewType: view.getViewType(),
    nodeCount: canvas.nodes && canvas.nodes.size,
    edgeCount: canvas.edges && canvas.edges.size,
    nodes: canvas.nodes && [...canvas.nodes.values()].map((n) => ({ id: n.id, type: n.getData && n.getData().type, x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.width), h: Math.round(n.height) })),
    saveDataWritten: view.file && (await app.vault.read(view.file)).slice(0, 200),
  }, null, 2);
})();
