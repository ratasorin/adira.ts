import { setTimeout } from "node:timers/promises";
import { developmentDelayMs } from "./cache";
import { generatePDFToFile } from "../controller/invoice/generate-pdf";
import type { RenderPayload } from "./contracts";
export async function renderPdf(payload: RenderPayload, destination: string) {
    const delay = developmentDelayMs();
    if (delay)
        await setTimeout(delay);
    await generatePDFToFile(payload, destination);
}
