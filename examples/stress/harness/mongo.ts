import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
export async function temporaryMongo() {
  const port = await new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      if (!address || typeof address === "string")
        return reject(new Error("No port"));
      s.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
  const directory = await mkdtemp(join(tmpdir(), "adira-stress-"));
  let child: ChildProcess | undefined;
  const stop = async () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null)
      await new Promise<void>((resolve) => {
        child!.once("exit", () => resolve());
        child!.kill("SIGTERM");
      });
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await new Promise<void>((resolve, reject) => {
      let logs = "";
      const timeout = setTimeout(
        () => reject(new Error(`Mongo startup timed out: ${logs}`)),
        20000,
      );
      child = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
          "--dbpath",
          directory,
          "--bind_ip",
          "127.0.0.1",
          "--port",
          String(port),
          "--nounixsocket",
          "--wiredTigerCacheSizeGB",
          "0.25",
          "--setParameter",
          "diagnosticDataCollectionEnabled=false",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Mongo exited ${code}: ${logs}`));
      });
      const read = (chunk: Buffer) => {
        logs = (logs + String(chunk)).slice(-5000);
        if (logs.includes("Waiting for connections")) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child.stdout!.on("data", read);
      child.stderr!.on("data", read);
    });
    return { uri: `mongodb://127.0.0.1:${port}/adira_stress_temporary`, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
