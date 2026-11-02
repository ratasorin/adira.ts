import mongoose from "mongoose";
import { connect } from "../server/database/models";
import { listen } from "./http/app";
import { temporaryMongo } from "./mongo";
import { option, profiles, seed, type Profile } from "./seed";
import { monitor } from "./telemetry";
async function main() {
  const profile = option("profile", "medium") as Profile;
  if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown profile");
  const database = await temporaryMongo();
  let host: Awaited<ReturnType<typeof listen>> | undefined;
  try {
    await connect(database.uri);
    await seed(profile);
    monitor();
    host = await listen("both", Number(option("port", "5400")));
    console.log(
      `\nOpen ${host.url}\nPrivate MongoDB: ${database.uri}\nSeeded data lasts until this process stops. Ctrl-C cleans up this private database.`,
    );
    await new Promise<void>((resolve) => {
      process.once("SIGINT", () => resolve());
      process.once("SIGTERM", () => resolve());
    });
  } finally {
    if (host)
      await new Promise<void>((resolve) => host!.server.close(() => resolve()));
    await mongoose.disconnect();
    await database.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
