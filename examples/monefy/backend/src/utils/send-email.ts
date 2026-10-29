import nodemailer from "nodemailer";
interface Email {
    recipientEmail: string;
    subject: string;
    html: string;
}
export const sendEmail = async ({ recipientEmail, subject, html }: Email) => {
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST || "mailpit", port: Number(process.env.SMTP_PORT || 1025), secure: process.env.SMTP_SECURE === "true", ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}) });
    await transport.sendMail({ from: process.env.MAIL_FROM || "Monefy <noreply@monefy.ro>", to: recipientEmail, subject, html });
};
