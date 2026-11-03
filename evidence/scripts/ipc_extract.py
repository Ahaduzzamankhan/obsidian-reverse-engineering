#!/usr/bin/env python
"""Extract IPC channel names and protocol registrations from Obsidian main.js."""
import re
import sys

path = sys.argv[1]
src = open(path, "r", encoding="utf-8", errors="replace").read()

print("== ipcMain.on ==")
for m in sorted(set(re.findall(r'ipcMain\.on\("([^"]+)"', src))):
    print(" ", m)
print("== ipcMain.handle ==")
for m in sorted(set(re.findall(r'ipcMain\.handle\("([^"]+)"', src))):
    print(" ", m)
print("== ipcMain.once ==")
for m in sorted(set(re.findall(r'ipcMain\.once\("([^"]+)"', src))):
    print(" ", m)
print("== webContents.send / sender.send ==")
for m in sorted(set(re.findall(r'(?:webContents|sender)\.send\("([^"]+)"', src))):
    print(" ", m)
print("== ipcRenderer (main.js references) ==")
for m in sorted(set(re.findall(r'ipcRenderer\.(?:send|invoke|sendSync)\("([^"]+)"', src))):
    print(" ", m)
print("== protocol registrations ==")
for m in sorted(set(re.findall(r'(?:registerFileProtocol|registerBufferProtocol|registerStringProtocol|registerHttpProtocol|protocol\.handle|handleScheme|registerSchemesAsPrivileged|setAsDefaultProtocolClient|isDefaultProtocolClient)\(\s*"?([A-Za-z0-9_-]+)"?', src))):
    print(" ", m)
print("== scheme strings ==")
for m in sorted(set(re.findall(r'"(app|obsidian|file|capacitor|chrome-extension|devtools|blob|data)://', src))):
    print(" ", m)
print("== BrowserWindow webPreferences keys ==")
for m in sorted(set(re.findall(r'(nodeIntegration\w*|contextIsolation|sandbox|webSecurity|allowRunningInsecureContent|experimentalFeatures|enableRemoteModule|spellcheck|webviewTag|backgroundThrottling|partition|preload|zoomFactor|safeDialogs|disableBlinkFeatures|additionalArguments|nodeIntegrationInSubFrames|nodeIntegrationInWorker)\s*:', src))):
    print(" ", m)
print("== app.commandLine.appendSwitch ==")
for m in sorted(set(re.findall(r'appendSwitch\("([^"]+)"(?:,\s*"?([^",)]*))?', src))):
    print(" ", m)
print("== require('electron') destructured ==")
for m in sorted(set(re.findall(r'require\("electron"\)', src))):
    print(" ", m)
