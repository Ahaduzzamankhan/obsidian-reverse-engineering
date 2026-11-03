#!/usr/bin/env bash
# Dump live Obsidian internals through CDP into _runtime/probes/*.json
set -uo pipefail
cd "$(dirname "$0")"
OUT=../_runtime/probes
mkdir -p "$OUT"
p() { # p <name> <expression>
  node cdp.js eval "$2" > "$OUT/$1.json" 2>"$OUT/$1.err"
  printf '%-28s %s bytes\n' "$1" "$(wc -c < "$OUT/$1.json")"
}
p commands "JSON.stringify(Object.values(app.commands.commands).map(c=>({id:c.id,name:c.name,hotkeys:(c.hotkeys||[]).map(h=>h.modifiers.join('+')+'+'+h.key)})))"
p viewtypes "JSON.stringify(Object.entries(app.viewRegistry.viewByType).map(([t,v])=>({type:t,ctor:v&&v.name})))"
p coreplugins "JSON.stringify(app.internalPlugins.manifests)"
p community "JSON.stringify({enabled:app.plugins.enabledPlugins,manifests:Object.keys(app.plugins.manifests||{})})"
p propertytypes "JSON.stringify(app.metadataTypeManager && {types:app.metadataTypeManager.registeredTypeWidgets?Object.keys(app.metadataTypeManager.registeredTypeWidgets):null, props:app.metadataTypeManager.properties})"
p settings "JSON.stringify({sections:Object.keys(app.setting.settingTabs||{}), tabs:(app.setting.settingTabs||[]).map(t=>({id:t.id,name:t.name}))})"
p hotkeys "JSON.stringify(app.hotkeyManager.customKeys)"
p workspace "JSON.stringify(app.workspace.rootSplit&&{layout:app.workspace.rootSplit.constructor.name, leaves:app.workspace.getLeavesOfType('markdown').map(l=>({type:l.view.getViewType(),file:l.view.file&&l.view.file.path})), center:app.workspace.rootSplit.children&&app.workspace.rootSplit.children.length})"
p vaultinfo "JSON.stringify({config:app.vault.config, files:app.vault.getFiles().length, name:app.vault.getName(), adapterType:app.vault.adapter.constructor.name})"
p appinfo "JSON.stringify({appId:app.appId,isMobile:app.isMobile,dom:Object.keys(app.dom),version:document.title,userAgent:navigator.userAgent,platformKeys:Object.keys(window.require('os').platform?{os:1}:{})})"
p cssvars "JSON.stringify((()=>{const s=getComputedStyle(document.body);const out={};for(const n of s){if(n.startsWith('--'))out[n]=s.getPropertyValue(n).trim()}return out})())"
p statusbar "JSON.stringify({items:[...document.querySelectorAll('.status-bar-item')].map(e=>e.getAttribute('aria-label')||e.textContent)})"
p ribbon "JSON.stringify([...document.querySelectorAll('.side-dock-ribbon-action')].map(e=>e.getAttribute('aria-label')))"
p extras "JSON.stringify({cli:!!app.cli,secretStorage:Object.keys(app.secretStorage||{}),embedRegistry:Object.keys(app.embedRegistry&&app.embedRegistry.embedByExtension||{}),foldManager:!!app.foldManager,shareReceiver:!!app.shareReceiver,renderContext:!!app.renderContext})"
