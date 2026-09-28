const { execSync } = require("child_process");

const ports = [5000, 5173, 5174];

console.log("Checking and freeing required ports before starting...");

if (process.platform === "win32") {
  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`).toString().trim();
      if (output) {
        const lines = output.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const localAddress = parts[1];
          if (localAddress && localAddress.endsWith(`:${port}`)) {
            const pid = parts[parts.length - 1];
            if (pid && pid !== "0" && pid !== process.pid.toString()) {
              console.log(`Killing process ${pid} occupying port ${port}...`);
              execSync(`taskkill /F /PID ${pid}`);
            }
          }
        }
      }
    } catch (err) {
      // Ignore errors if port is not in use or command fails
    }
  }
} else {
  // Unix-based fallback
  for (const port of ports) {
    try {
      execSync(`lsof -t -i:${port} | xargs kill -9`);
    } catch (err) {
      // Ignore errors
    }
  }
}

console.log("Ports check complete.");
