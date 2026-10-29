import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";

const required = [
  "AWS_REGION",
  "INSTANCE_ID",
  "RELEASE_BUCKET",
  "PUBLIC_ORIGIN",
  "TLS_EMAIL",
  "FRONTEND_IMAGE",
  "BACKEND_IMAGE",
  "GITHUB_SHA",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Missing ${key}`);
const env = process.env;
if (!/^i-[a-f0-9]+$/.test(env.INSTANCE_ID))
  throw new Error("Invalid instance ID");
if (!/^[a-z0-9.-]{3,63}$/.test(env.RELEASE_BUCKET))
  throw new Error("Invalid release bucket");
if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA))
  throw new Error("Invalid commit SHA");
if (!/^\d+$/.test(env.GITHUB_RUN_ID) || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT))
  throw new Error("Invalid run ID");
for (const key of ["FRONTEND_IMAGE", "BACKEND_IMAGE"]) {
  if (
    !/^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$/.test(
      env[key],
    )
  )
    throw new Error(`Use an immutable ECR digest for ${key}`);
}
if (!/^https:\/\/[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(env.PUBLIC_ORIGIN))
  throw new Error("PUBLIC_ORIGIN must be an HTTPS DNS origin without a port or path");
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const aws = (args) =>
  execFileSync("aws", [...args, "--region", env.AWS_REGION], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = await mkdtemp(join(tmpdir(), "monefy-release-"));
try {
  const release = `${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const archive = join(temporary, "release.tar.gz");
  execFileSync("tar", [
    "-czf",
    archive,
    "-C",
    root,
    "compose.yaml",
    "-C",
    join(root, "infra/aws"),
    "deploy-host.sh",
    "setup-https.sh",
  ]);
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  const object = `s3://${env.RELEASE_BUCKET}/releases/${release}.tar.gz`;
  aws(["s3", "cp", archive, object, "--only-show-errors"]);
  const directory = `/opt/monefy/releases/${release}`;
  const assignments = [
    "AWS_REGION",
    "PUBLIC_ORIGIN",
    "TLS_EMAIL",
    "FRONTEND_IMAGE",
    "BACKEND_IMAGE",
  ]
    .map((key) => `${key}=${quote(env[key])}`)
    .join(" ");
  const script = [
    "set -eu",
    `mkdir -p ${quote(directory)}`,
    `aws s3 cp ${quote(object)} ${quote(`${directory}/release.tar.gz`)} --region ${quote(env.AWS_REGION)} --only-show-errors`,
    `printf '%s\\n' ${quote(`${digest}  ${directory}/release.tar.gz`)} | sha256sum -c -`,
    `tar -xzf ${quote(`${directory}/release.tar.gz`)} -C ${quote(directory)} --no-same-owner`,
    `${assignments} bash ${quote(`${directory}/deploy-host.sh`)}`,
  ].join("\n");
  const payload = join(temporary, "command.json");
  await writeFile(
    payload,
    JSON.stringify({
      DocumentName: "AWS-RunShellScript",
      InstanceIds: [env.INSTANCE_ID],
      Comment: `Monefy ${release}`,
      Parameters: { commands: [script], executionTimeout: ["1800"] },
      TimeoutSeconds: 600,
    }),
  );
  const sent = JSON.parse(
    aws(["ssm", "send-command", "--cli-input-json", `file://${payload}`]),
  );
  const commandId = sent.Command.CommandId;
  let complete = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    let status;
    try {
      status = JSON.parse(
        aws([
          "ssm",
          "get-command-invocation",
          "--command-id",
          commandId,
          "--instance-id",
          env.INSTANCE_ID,
        ]),
      );
    } catch (error) {
      if (String(error.stderr).includes("InvocationDoesNotExist")) {
        await wait(5000);
        continue;
      }
      throw error;
    }
    if (status.Status === "Success") {
      complete = true;
      console.log("Host deployment succeeded.");
      break;
    }
    if (
      ["Failed", "Cancelled", "TimedOut", "Cancelling"].includes(status.Status)
    ) {
      console.error(status.StandardErrorContent);
      throw new Error(
        `Deployment ${status.Status}. Inspect SSM command ${commandId}.`,
      );
    }
    if (attempt % 6 === 0)
      console.log(`SSM deployment ${commandId}: ${status.Status}`);
    await wait(5000);
  }
  if (!complete)
    throw new Error(
      `Deployment did not complete. Inspect SSM command ${commandId}.`,
    );
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${env.PUBLIC_ORIGIN}/api/health/ready`, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {}
    await wait(3000);
  }
  if (!healthy)
    throw new Error(
      "Public HTTPS readiness check failed. Check DNS, nginx, certificate and instance web ingress.",
    );
  console.log(`Monefy is ready at ${env.PUBLIC_ORIGIN}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
