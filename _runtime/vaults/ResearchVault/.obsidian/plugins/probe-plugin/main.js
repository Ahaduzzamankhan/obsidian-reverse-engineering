const { Plugin, PluginSettingTab, Setting, Notice, Modal, ItemView } = require("obsidian");
let observations = {};
module.exports = class ProbePlugin extends Plugin {
  async onload() {
    const probe = (k, fn) => { try { observations[k] = fn(); } catch (e) { observations[k] = "ERR " + e.message; } };
    probe("nodeAvailable", () => typeof require === "function");
    probe("fsRequire", () => require("fs").readdirSync(".").length > 0);
    probe("childProcess", () => typeof require("child_process").execSync === "function");
    probe("processVersion", () => process.version);
    probe("ipcRenderer", () => typeof require("electron").ipcRenderer);
    probe("vaultPath", () => this.app.vault.adapter.basePath);
    probe("manifestDir", () => this.manifest.dir);
    observations.loadCount = (window.__probeLoads = (window.__probeLoads || 0) + 1);
    this.addCommand({ id: "probe-hello", name: "Probe: hello", callback: () => new Notice("probe hello") });
    this.addRibbonIcon("flask-conical", "Probe ribbon", () => {});
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.setText("probe");
    this.addSettingTab(new (class extends PluginSettingTab {
      display() { this.containerEl.empty(); new Setting(this.containerEl).setName("Probe setting"); }
    })(this.app, this));
    this.registerDomEvent(window, "probe-event", () => {});
    this.registerInterval(window.setInterval(() => {}, 60000));
    this.app.workspace.onLayoutReady(() => { observations.layoutReadyFired = true; });
    try { this.registerMarkdownPostProcessor((el) => { el.dataset.probe = "1"; }); observations.postProcessor = true; } catch (e) { observations.postProcessor = "ERR " + e.message; }
    window.__probe = observations;
  }
  onunload() { observations.unloaded = true; window.__probeUnloaded = true; }
};
