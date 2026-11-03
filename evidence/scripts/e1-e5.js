// E1-E5: file lifecycle, links, rename/move, frontmatter effects (idempotent, step-guarded).
(async () => {
  const out = {};
  const V = app.vault;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = (p) => V.read(V.getAbstractFileByPath(p));
  const step = async (name, fn) => {
    try {
      out[name] = await fn();
    } catch (e) {
      out[name] = { error: String(e && e.message ? e.message : e) };
    }
  };

  await step("E1_create_file", async () => {
    if (!V.getAbstractFileByPath("Experiments")) await V.createFolder("Experiments");
    const t0 = Date.now();
    let f = V.getAbstractFileByPath("Experiments/Created by API.md");
    if (!f) f = await V.create("Experiments/Created by API.md", "created " + new Date().toISOString() + "\n");
    await wait(300);
    return {
      path: f.path,
      stat: { size: f.stat.size, mtime: f.stat.mtime, ctime: f.stat.ctime },
      elapsedMs: Date.now() - t0,
      indexed: !!app.metadataCache.getCache("Experiments/Created by API.md"),
      vaultDotObsidian: (await app.vault.adapter.list(".obsidian")).files,
    };
  });

  await step("E2_backlinks", async () => {
    const alpha = V.getAbstractFileByPath("Projects/Alpha Renamed.md") || V.getAbstractFileByPath("Projects/Alpha.md");
    const bl = app.metadataCache.getBacklinksForFile(alpha);
    return {
      isMap: bl.data instanceof Map,
      keys: [...bl.data.keys()],
      sample: [...bl.data.entries()].slice(0, 2),
    };
  });

  await step("E3_rename_result", async () => ({
    alphaCurrentPath: (V.getAbstractFileByPath("Projects/Alpha Renamed.md") || { path: null }).path,
    welcomeLinesWithAlpha: (await read("Welcome.md")).split("\n").filter((l) => l.includes("Alpha")),
    betaLinesWithAlpha: (await read("Projects/Beta.md")).split("\n").filter((l) => l.includes("Alpha")),
    oldPathGone: !V.getAbstractFileByPath("Projects/Alpha.md"),
    resolved: app.metadataCache.resolvedLinks["Welcome.md"],
  }));

  await step("E4_move_file", async () => {
    if (!V.getAbstractFileByPath("Archive")) await V.createFolder("Archive");
    const beta = V.getAbstractFileByPath("Projects/Beta.md");
    if (beta) await app.fileManager.renameFile(beta, "Archive/Beta.md");
    await wait(800);
    return {
      movedTo: (V.getAbstractFileByPath("Archive/Beta.md") || { path: null }).path,
      welcomeLinesWithBeta: (await read("Welcome.md")).split("\n").filter((l) => l.includes("Beta")),
      resolvedFromWelcome: app.metadataCache.resolvedLinks["Welcome.md"],
      unresolvedFromWelcome: app.metadataCache.unresolvedLinks["Welcome.md"],
    };
  });

  await step("E5_frontmatter", async () => {
    const welcome = V.getAbstractFileByPath("Welcome.md");
    await V.process(welcome, (t) => t.replace("priority: 7", "priority: 8\nprogress: 42").replace("priority: 3", "priority: 8\nprogress: 42"));
    await wait(800);
    const c = app.metadataCache.getCache("Welcome.md");
    return {
      parsedFrontmatter: c.frontmatter,
      propertyTypes: app.metadataTypeManager.properties,
      registeredWidgets: Object.keys(app.metadataTypeManager.registeredTypeWidgets || {}),
      frontmatterRange: c.frontmatterPosition,
    };
  });

  await step("E6_tags_and_links", async () => {
    const c = app.metadataCache.getCache("Welcome.md");
    return {
      tags: c.tags,
      allVaultTags: Object.fromEntries(app.metadataCache.getTags()),
      resolvedAll: app.metadataCache.resolvedLinks,
      unresolvedAll: app.metadataCache.unresolvedLinks,
    };
  });

  return JSON.stringify(out, null, 2);
})();
