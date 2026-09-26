const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const venvPython = isWindows
  ? path.join(rootDir, ".venv", "Scripts", "python.exe")
  : path.join(rootDir, ".venv", "bin", "python");

const venvUvicorn = isWindows 
  ? path.join(rootDir, ".venv", "Scripts", "uvicorn.exe")
  : path.join(rootDir, ".venv", "bin", "uvicorn");

let cmd;
let args;

if (fs.existsSync(venvPython)) {
  cmd = venvPython;
  args = ["-m", "uvicorn", "app.main:app", "--app-dir", "ml-service", "--host", "127.0.0.1", "--port", "8000"];
} else if (fs.existsSync(venvUvicorn)) {
  cmd = venvUvicorn;
  args = ["app.main:app", "--app-dir", "ml-service", "--host", "127.0.0.1", "--port", "8000"];
} else {
  cmd = "uvicorn";
  args = ["app.main:app", "--app-dir", "ml-service", "--host", "127.0.0.1", "--port", "8000"];
}

console.log(`[ML Service] Starting with command: ${cmd} ${args.join(" ")}`);

const child = spawn(cmd, args, { cwd: rootDir, stdio: "inherit", shell: false });

child.on("exit", (code) => {
  process.exit(code || 0);
});

