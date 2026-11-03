(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  out.restrictedModeBefore = app.plugins.isEnabled?.() ?? null;
  out.safeModeConfig = app.plugins.safeMode ?? null;
  app.plugins.loadManifests();
  await wait(1200);
  out.manifests = Object.keys(app.plugins.manifests || {});
  out.manifestEntry = app.plugins.manifests && app.plugins.manifests["probe-plugin"];
  await app.plugins.enablePluginAndSave("probe-plugin");
  await wait(1500);
  out.afterEnable = {
    enabledPlugins: app.plugins.enabledPlugins,
    instanceKeys: Object.keys(app.plugins.plugins["probe-plugin"] || {}),
    observations: window.__probe,
    probeCommandInRegistry: !!app.commands.commands["probe-plugin:probe-hello"],
    settingsTabRegistered: !!(app.setting.settingTabs || []).find((t) => t.id === "probe-plugin"),
    ribbonItems: [...document.querySelectorAll(".side-dock-ribbon-action")].map((e) => e.getAttribute("aria-label")),
    statusBar: [...document.querySelectorAll(".status-bar-item")].map((e) => e.textContent),
    communityPluginsConfig: app.plugins.enabledPlugins,
  };
  await app.plugins.disablePluginAndSave("probe-plugin");
  await wait(1000);
  out.afterDisable = {
    enabledPlugins: app.plugins.enabledPlugins,
    pluginInstance: !!app.plugins.plugins["probe-plugin"],
    commandGone: !app.commands.commands["probe-plugin:probe-hello"],
    ribbonItems: [...document.querySelectorAll(".side-dock-ribbon-action")].map((e) => e.getAttribute("aria-label")),
    statusBar: [...document.querySelectorAll(".status-bar-item")].map((e) => e.textContent),
    unloaded: window.__probeUnloaded === true,
  };
  out.cssSnippets = app.customCss && {
    snippets: app.customCss.snippets,
    enabledSnippets: [...(app.customCss.enabledSnippets || [])],
    themes: app.customCss.themes,
  };
  return JSON.stringify(out, null, 2);
})();
