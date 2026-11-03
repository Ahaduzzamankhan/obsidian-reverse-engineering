(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { steps: [] };
  out.apiKeys = Object.keys(app.plugins).filter((k) => typeof app.plugins[k] !== "object");
  out.beforeIsEnabled = app.plugins.isEnabled();
  try { await app.plugins.setEnable(true); out.steps.push("setEnable(true)"); } catch (e) { out.steps.push("setEnable err " + e.message); }
  await wait(600);
  out.afterSetEnable = app.plugins.isEnabled();
  out.loaded = app.plugins.loadPlugin ? "has loadPlugin" : "no loadPlugin";
  try {
    await app.plugins.enablePlugin("probe-plugin");
    out.steps.push("enablePlugin");
  } catch (e) { out.steps.push("enablePlugin err " + e.message); }
  await wait(1500);
  out.afterEnable = {
    enabledPlugins: app.plugins.enabledPlugins,
    instancePresent: !!app.plugins.plugins["probe-plugin"],
    observations: window.__probe,
    command: !!app.commands.commands["probe-plugin:probe-hello"],
    settingTab: !!(app.setting.settingTabs || []).find((t) => t.id === "probe-plugin"),
    ribbon: [...document.querySelectorAll(".side-dock-ribbon-action")].map((e) => e.getAttribute("aria-label")),
    statusBar: [...document.querySelectorAll(".status-bar-item")].map((e) => e.textContent),
  };
  await app.plugins.disablePlugin("probe-plugin");
  await wait(800);
  out.afterDisable = {
    instancePresent: !!app.plugins.plugins["probe-plugin"],
    commandGone: !app.commands.commands["probe-plugin:probe-hello"],
    unloaded: window.__probeUnloaded === true,
    ribbon: [...document.querySelectorAll(".side-dock-ribbon-action")].map((e) => e.getAttribute("aria-label")),
  };
  return JSON.stringify(out, null, 2);
})();
