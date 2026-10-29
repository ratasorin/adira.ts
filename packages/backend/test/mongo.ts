import { spawn, ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

/** A dedicated local database process: no downloads and no existing database. */
export async function temporaryMongo(): Promise<{
  uri: string;
  stop(): Promise<void>;
}> {
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("No test port"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
  const directory = await mkdtemp(join(tmpdir(), "adira-mongo-"));
  let process: ChildProcess | undefined;
  const stop = async () => {
    if (
      process?.pid &&
      process.exitCode === null &&
      process.signalCode === null
    ) {
      await new Promise<void>((resolve) => {
        process!.once("exit", () => resolve());
        process!.kill("SIGTERM");
      });
    }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`mongod did not become ready: ${logs}`)),
        20_000,
      );
      let logs = "";
      process = spawn(
        globalThis.process.env.MONGOD_BINARY ?? "mongod",
        [
          "--dbpath",
          directory,
          "--bind_ip",
          "127.0.0.1",
          "--port",
          String(port),
          "--nounixsocket",
          "--setParameter",
          "diagnosticDataCollectionEnabled=false",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      const finish = (error?: Error) => {
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      process.once("error", (error) => finish(error));
      process.once("exit", (code) => {
        if (code !== null)
          finish(new Error(`mongod exited (${code}): ${logs}`));
      });
      process.stdout!.on("data", (data) => {
        const message = String(data);
        logs = (logs + message).slice(-6000);
        if (message.includes("Waiting for connections")) finish();
      });
      process.stderr!.on("data", (data) => {
        logs = (logs + String(data)).slice(-6000);
      });
    });
    return { uri: `mongodb://127.0.0.1:${port}/adira_test`, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
