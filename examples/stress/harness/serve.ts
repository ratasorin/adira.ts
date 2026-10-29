import mongoose from "mongoose";
import { connect } from "../server/database/models";
import { listen, type Mode } from "./http/app";
import { option } from "./seed";
import { monitor } from "./telemetry";

if (require.main === module)
  (async () => {
    await connect(
      option(
        "uri",
        process.env.STRESS_MONGO_URI ??
          "mongodb://127.0.0.1:27017/adira_stress",
      ),
    );
    monitor();
    const mode = option("backend", "both");
    if (!["adira", "reference", "both"].includes(mode))
      throw new Error("Unknown backend");
    const { server, url } = await listen(
      mode as Mode,
      Number(option("port", "5400")),
    );
    console.log(`Adira commerce: ${url} (${mode})`);
    const stop = () =>
      server.close(() => {
        mongoose.disconnect().then(() => process.exit(0));
      });
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  })().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
