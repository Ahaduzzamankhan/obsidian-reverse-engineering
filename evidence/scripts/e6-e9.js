// E6-E9: workspace layout/persistence, theme switching, canvas + bases file formats.
(async () => {
  const out = {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = async (name, fn) => {
    try {
      out[name] = await fn();
    } catch (e) {
      out[name] = { error: String(e && e.message ? e.message : e) };
    }
  };

  // E6: multi-tab + split, then flush workspace state
  await step("E6_layout", async () => {
    const welcome = app.vault.getAbstractFileByPath("Welcome.md");
    const a = app.workspace.getLeaf(false);
    await a.openFile(welcome);
    const b = app.workspace.getLeaf("tab");
    await b.openFile(app.vault.getAbstractFileByPath("Archive/Beta.md"));
    const c = app.workspace.getLeaf("vertical");
    await c.openFile(app.vault.getAbstractFileByPath("Daily/2026-11-03.md"));
    await app.workspace.saveLayout?.();
    app.workspace.requestSaveLayout?.();
    await wait(1500);
    const roots = [];
    const walk = (n, depth) => {
      roots.push({ depth, type: n.type || n.constructor.name, dir: n.direction, id: n.id });
      (n.children || []).forEach((c2) => walk(c2, depth + 1));
    };
    walk(app.workspace.rootSplit, 0);
    return {
      tree: roots,
      activeLeaf: app.workspace.activeLeaf && app.workspace.activeLeaf.view.file && app.workspace.activeLeaf.view.file.path,
      markdownLeaves: app.workspace.getLeavesOfType("markdown").map((l) => l.view.file && l.view.file.path),
    };
  });

  // E7: theme switching
  await step("E7_theme", async () => {
    const before = document.body.className;
    app.commands.executeCommandById("theme:toggle-light-dark");
    await wait(600);
    const after = document.body.className;
    const cs = getComputedStyle(document.body);
    const sample = {
      before,
      after,
      bodyBackground: cs.getPropertyValue("--background-primary").trim(),
      textNormal: cs.getPropertyValue("--text-normal").trim(),
      accent: cs.getPropertyValue("--interactive-accent").trim(),
      fontText: cs.getPropertyValue("--font-text-theme") || cs.getPropertyValue("--font-interface-override"),
      fontSize: cs.getPropertyValue("--font-text-size").trim(),
      radius: cs.getPropertyValue("--radius-s").trim(),
    };
    app.commands.executeCommandById("theme:toggle-light-dark");
    await wait(400);
    return sample;
  });

  // E8: canvas file creation through the core plugin
  await step("E8_canvas", async () => {
    app.commands.executeCommandById("canvas:new-file");
    await wait(1200);
    const files = app.vault.getFiles().filter((f) => f.extension === "canvas");
    return {
      files: files.map((f) => f.path),
      first: files[0] ? await app.vault.read(files[0]) : null,
    };
  });

  // E9: bases file creation through the core plugin
  await step("E9_bases", async () => {
    app.commands.executeCommandById("bases:new-file");
    await wait(1500);
    const files = app.vault.getFiles().filter((f) => f.extension === "base");
    return {
      files: files.map((f) => f.path),
      first: files[0] ? await app.vault.read(files[0]) : null,
      viewLeaf: app.workspace.activeLeaf && app.workspace.activeLeaf.view.getViewType(),
    };
  });

  return JSON.stringify(out, null, 2);
})();
