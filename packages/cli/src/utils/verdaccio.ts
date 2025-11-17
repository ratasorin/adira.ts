import { spawn, ChildProcess } from "child_process";
import net from "net";

export const runCommand = (cmd: string, cwd: string = process.cwd()) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, { shell: true, stdio: "inherit", cwd });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd}`));
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to execute command ${cmd}: ${err.message}`));
    });
  });

export const isPortInUse = async (port: number): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        console.error(`Error checking port ${port}:`, err.message);
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port);
  });
};

export const startVerdaccio = async (): Promise<ChildProcess | null> => {
  const PORT = 8888;

  const portInUse = await isPortInUse(PORT);
  if (portInUse) {
    console.log(`✅ Port ${PORT} is already in use. Assuming Verdaccio is running externally.`);
    return null;
  }

  console.log(`🚀 Starting Verdaccio on port ${PORT}...`);

  const verdaccioProcess = spawn(
    "npx",
    ["verdaccio", "--listen", String(PORT)],
    {
      stdio: "inherit",
      shell: true,
    }
  );

  await new Promise((resolve) => setTimeout(resolve, 5000));

  return verdaccioProcess;
};

export const stopVerdaccio = (process: ChildProcess | null) => {
  if (process) {
    console.log("🛑 Stopping Verdaccio...");
    process.kill("SIGTERM");
  }
};
