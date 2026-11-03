// Talk to Obsidian's local CLI socket (named pipe on Windows) directly.
// Usage: node cli_client.js ["help"] ["--json"]
const net = require("net");
const os = require("os");

const pipe = `\\\\.\\pipe\\obsidian-cli-${os.userInfo().username}`;
const argv = process.argv.slice(2);
const payload = JSON.stringify({ argv, tty: false, cwd: process.cwd() });

const socket = net.createConnection(pipe);
socket.setNoDelay(true);
let out = "";
socket.on("connect", () => socket.write(payload + "\n"));
socket.on("data", (d) => (out += d.toString()));
socket.on("end", () => {
  console.log(out);
});
socket.on("error", (e) => {
  console.error("CLI socket error:", e.message);
  process.exitCode = 1;
});
setTimeout(() => {
  console.log(out);
  socket.destroy();
}, 8000);
