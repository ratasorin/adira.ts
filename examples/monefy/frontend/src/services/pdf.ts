import axios from "axios";
import type { PreviewJobResponse, PdfJobStatus } from "@monefy/types/src/pdf/contracts";

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = window.setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function awaitPdf(job: PreviewJobResponse, signal?: AbortSignal): Promise<ArrayBuffer> {
  let status: PdfJobStatus = job;
  const deadline = Date.now() + 120000;
  while (status.status !== "ready") {
    if (status.status === "failed") throw new Error(status.message || "PDF generation failed. Please retry.");
    if (Date.now() > deadline) throw new Error("The PDF is taking longer than expected. Please retry.");
    await pause(250, signal);
    status = (await axios.get<PdfJobStatus>(job.statusUrl, { signal })).data;
  }
  if (!status.artifactUrl?.startsWith("/api/")) throw new Error("PDF artifact unavailable");
  return (await axios.get<ArrayBuffer>(status.artifactUrl, { responseType: "arraybuffer", signal })).data;
}
