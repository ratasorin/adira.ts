import { join, resolve, relative, isAbsolute } from "node:path";
import { readFile, access } from "node:fs/promises";
import type { Content } from "pdfmake/interfaces";
export const assetsDirectory = process.env.ASSET_DIR || "/data/assets";
export function assetPath(name: string): string {
    const target = resolve(assetsDirectory, name);
    const child = relative(resolve(assetsDirectory), target);
    if (!child || child.startsWith("..") || isAbsolute(child))
        throw new Error("Invalid asset path");
    return target;
}
export async function pdfAsset(name?: string): Promise<Exclude<Content, string | number | boolean | null | undefined | Content[]>> {
    if (!name)
        return { text: "" };
    try {
        const target = assetPath(name);
        await access(target);
        if (/\.svg$/i.test(name))
            return { svg: await readFile(target, "utf8") };
        if (/\.(png|jpe?g)$/i.test(name))
            return { image: target };
    }
    catch { /* A removed company image must not prevent rendering an invoice. */ }
    return { text: "monefy", color: "#598c75", bold: true, fontSize: 22 };
}
