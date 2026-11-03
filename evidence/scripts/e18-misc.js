(async () => {
  const out = {};
  const step = (k, fn) => {
    try {
      out[k] = fn();
    } catch (e) {
      out[k] = "ERR " + (e && e.message ? e.message : e);
    }
  };
  out.hotkeys = await (async () => {
    try {
      const hk = app.hotkeyManager;
      const def = hk.defaultKeys || {};
      const sample = Object.entries(def).slice(0, 40).map(([id, keys]) => [id, (keys[0] && (keys[0].modifiers.join("+") + "+" + keys[0].key)) || ""]);
      return { total: Object.keys(def).length, sample };
    } catch (e) {
      return "ERR " + e.message;
    }
  })();
  step("fileRecovery", () => {
    const p = app.internalPlugins.plugins["file-recovery"];
    const i = p && p.instance;
    return {
      keys: i ? Object.keys(i) : null,
      interval: i && i.snapshotInterval,
      historyLength: i && i.historyLength,
      counts: i && i.snapshots && Object.keys(i.snapshots).length,
      dbName: i && i.idb && i.idb.name,
    };
  });
  step("sync", () => {
    const p = app.internalPlugins.plugins["sync"];
    return p ? { enabled: p.enabled, instanceKeys: p.instance ? Object.keys(p.instance).slice(0, 20) : null } : null;
  });
  step("publish", () => {
    const p = app.internalPlugins.plugins["publish"];
    return p ? { enabled: p.enabled, instanceKeys: p.instance ? Object.keys(p.instance).slice(0, 20) : null } : null;
  });
  step("icons", () => {
    const api = app.viewRegistry;
    return { lucideCount: (window.getIconIds ? window.getIconIds() : []).length };
  });
  step("settingsSections", () => ({
    sections: (app.setting.settingTabs || []).map((t) => ({ id: t.id, name: t.name, cls: t.constructor && t.constructor.name })),
    pluginTabs: (app.setting.pluginTabs || []).map((t) => t.id),
  }));
  step("layoutClasses", () => ({
    body: document.body.className,
    workspaceChildren: [...document.querySelector('.workspace').children].map((e) => e.className),
    ribbonIcons: [...document.querySelectorAll('.side-dock-ribbon-action')].map((e) => ({ label: e.getAttribute('aria-label'), icon: e.querySelector('svg')?.getAttribute('class') })),
    statusBar: [...document.querySelectorAll('.status-bar-item')].map((e) => e.className),
    tabCount: document.querySelectorAll('.workspace-tab-header').length,
  }));
  step("editorCm", () => {
    const v = app.workspace.getActiveViewOfType(Object.getPrototypeOf(app.workspace.getLeavesOfType('markdown')[0].view).constructor);
    const ed = v && v.editor;
    return {
      editorKeys: ed ? Object.keys(ed).slice(0, 30) : null,
      cmProto: ed && ed.cm ? Object.getOwnPropertyNames(Object.getPrototypeOf(ed.cm)).slice(0, 40) : null,
      cmVersion: window.CodeMirror6 ? "cm6" : document.querySelector('.cm-editor') ? 'cm6-dom' : 'unknown',
      stateFields: ed && ed.cm && ed.cm.state ? Object.keys(ed.cm.state) : null,
    };
  });
  return JSON.stringify(out, null, 2);
})();
