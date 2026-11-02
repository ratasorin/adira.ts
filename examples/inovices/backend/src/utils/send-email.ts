import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { config } from "../config/env";
interface Email { recipientEmail: string; subject: string; html: string; }
export const sendEmail = async ({ recipientEmail, subject, html }: Email) => {
    const outbox = join(config.dataDir, "mail");
    await mkdir(outbox, { recursive: true });
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const result = await transport.sendMail({ from: "Inovices <noreply@inovices.ro>", to: recipientEmail, subject, html });
    const file = join(outbox, randomUUID() + ".json");
    await writeFile(file, result.message, { mode: 0o600 });
    console.log("Inovices email saved locally:", file);
};
