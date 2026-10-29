import type { TableCell } from "pdfmake/interfaces";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { pdfAsset } from "../../utils/assets";
import path from "path";
import PdfPrinter from "pdfmake";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import InvoiceTranslation, { IInvoiceTemplateTranslation, } from "../../models/invoice/TemplateTranslations";
import { displayCurrency } from "../../utils/currency";
import { ResolvedInvoice } from "./types";
import type { Json } from "../../types/json";
import { convertAmount, normalizeProductLinesCurrency, lineSubtotal } from "./utils/total";
const sumSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sigma-icon lucide-sigma"><path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/></svg>';
const modSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-percent-icon lucide-percent"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>';
export const DEFAULT_ENGLISH_TEMPLATE: Omit<IInvoiceTemplateTranslation & {
    closing_remark: string;
}, "_id" | "language"> = {
    reported_period: "Reported period",
    affects: "Affects",
    account_beneficiary: "Account beneficiary",
    thanks: "Thank you for your business.",
    opening: "For",
    table_headers: {
        description: "Description",
        quantity: "Quantity",
        unit_price: "Unit price",
        subtotal: "Subtotal",
        total: "TOTAL",
    },
    closing_remark: "Have a good day!",
    account_number: "Account number",
    bank_code: "Bank code",
    bank_name: "Bank name",
    invoice: "Invoice",
};
export async function generatePDFToFile(params: ResolvedInvoice, destination: string): Promise<void> {
    const { issuer_company: company, receiving_customer: customer, products: items, modifiers = [], viewers = [], invoiceNumber, emittedDate, reportedPeriod, notes, translation, total, } = params;
    const bundledFonts: Record<string, string> = require("pdfmake/build/vfs_fonts.js");
    const font = (name: string) => Buffer.from(bundledFonts[name], "base64");
    const printer = new PdfPrinter({ Roboto: { normal: font("Roboto-Regular.ttf"), bold: font("Roboto-Medium.ttf"), italics: font("Roboto-Italic.ttf"), bolditalics: font("Roboto-MediumItalic.ttf") } });
    const logo = await pdfAsset(company?.assets?.logo);
    const signature = await pdfAsset(company?.assets?.signature);
    const stamp = await pdfAsset(company?.assets?.stamp);
    const invoiceCurrency = params.currency || items?.[0]?.product.currency || ("EUR" as const);
    const normalizedItems = await normalizeProductLinesCurrency(items || [], invoiceCurrency);
    const docDefinition: TDocumentDefinitions = {
        content: [
            {
                columns: [
                    {
                        ...logo,
                        width: 150,
                    },
                    {
                        stack: [
                            {
                                text: company?.name || "",
                                style: "header",
                            },
                            {
                                text: `${company?.address?.street || ""}\n${company?.address?.zip || ""}-${company?.address?.city || ""}, VAT-IdNr: ${company?.vat_id || ""}\n\n${company?.contact?.website || ""}    E-mail: ${company?.contact?.email || ""}\nTel: ${company?.contact?.phone || ""}, Fax: ${company?.contact?.fax || ""}`,
                            },
                        ],
                        alignment: "right",
                    },
                ],
            },
            {
                table: {
                    widths: ["*"],
                    body: [[" "], [" "]],
                },
                layout: {
                    hLineWidth: function (i, node) {
                        return i === 0 || i === node.table.body.length ? 0 : 2;
                    },
                    vLineWidth: function (i, node) {
                        return 0;
                    },
                },
            },
            {
                stack: [
                    {
                        text: translation.opening,
                        marginBottom: 8,
                    },
                    {
                        text: customer?.selected_name || "",
                        bold: true,
                        marginBottom: 4,
                    },
                    {
                        text: `${customer?.address || ""}, ${customer?.country || ""}, ${customer?.city || ""}`,
                        marginBottom: 4,
                    },
                    {
                        text: `VAT-ID: ${customer?.cif || ""}`,
                        marginBottom: 20,
                    },
                ],
            },
            {
                stack: [
                    {
                        text: translation.invoice,
                        bold: true,
                    },
                    {
                        text: `No. ${invoiceNumber || 0}/${emittedDate ? new Date(emittedDate).toLocaleDateString() : ""}`,
                        alignment: "right",
                    },
                ],
            },
            {
                marginBottom: 20,
                layout: {
                    paddingLeft: () => 4,
                    paddingRight: () => 4,
                    paddingTop: () => 6,
                    paddingBottom: () => 6,
                },
                table: {
                    widths: ["auto", "*", "auto", "auto", "auto"],
                    body: [
                        [
                            { text: "#", bold: true, alignment: "center" },
                            {
                                text: translation.table_headers.description,
                                bold: true,
                                alignment: "center",
                            },
                            {
                                text: translation.table_headers.quantity,
                                bold: true,
                                alignment: "center",
                            },
                            {
                                text: translation.table_headers.unit_price,
                                bold: true,
                                alignment: "center",
                            },
                            {
                                text: translation.table_headers.subtotal,
                                bold: true,
                                alignment: "right",
                            },
                        ],
                        // Display products first
                        ...normalizedItems.map((item, index) => {
                            let priceDisplay: TableCell;
                            let subtotalDisplay: TableCell;
                            const itemDiscounts = modifiers
                                .filter((m) => m.scope === "line" &&
                                m.targetProductLine?.includes(item._id))
                                .sort((a, b) => a.index - b.index); // Ensure they apply in the correct order
                            const basePrice = item.product.price;
                            let discountedPrice = basePrice;
                            // Iterate through each modifier to calculate the cumulative effect
                            if (itemDiscounts.length > 0) {
                                const discountedSubtotal = lineSubtotal(item, modifiers);
                                discountedPrice = item.quantity ? discountedSubtotal / item.quantity : basePrice;
                                priceDisplay = [
                                    {
                                        text: `${basePrice.toFixed(2)} ${displayCurrency(item.product.currency)}`,
                                        decoration: "lineThrough",
                                        color: "red",
                                    },
                                    {
                                        text: `${discountedPrice.toFixed(2)} ${displayCurrency(item.product.currency)}`,
                                        bold: true,
                                        alignment: "right",
                                    },
                                ];
                                subtotalDisplay = {
                                    text: `${lineSubtotal(item, modifiers).toFixed(2)} ${displayCurrency(item.product.currency)}`,
                                    alignment: "right",
                                };
                            }
                            else {
                                priceDisplay = `${item.product.price.toFixed(2)} ${displayCurrency(item.product.currency)}`;
                                subtotalDisplay = {
                                    alignment: "right",
                                    text: `${(item.quantity * item.product.price).toFixed(2)} ${displayCurrency(item.product.currency)}`,
                                };
                            }
                            return [
                                index + 1,
                                item.product.name,
                                item.quantity.toString(),
                                priceDisplay,
                                subtotalDisplay,
                            ];
                        }),
                        // Display modifiers and viewers mixed based on their index
                        ...(() => {
                            const lines = normalizedItems;
                            const lineById = new Map(lines.map((l) => [l._id, l]));
                            const lineIndexById = new Map(lines.map((l, idx) => [l._id, idx + 1]));
                            
                            let runningTotal = lines.reduce((total, line) => total + lineSubtotal(line, modifiers), 0);
                            const combinedItems = [
                                ...modifiers.map((m) => ({
                                    type: "modifier" as const,
                                    data: m,
                                    index: m.index,
                                })),
                                ...viewers.map((v) => ({
                                    type: "viewer" as const,
                                    data: v,
                                    index: v.index,
                                })),
                            ].sort((a, b) => a.index - b.index);
                            const processedItems: TableCell[][] = [];
                            for (const item of combinedItems) {
                                if (item.type === "modifier") {
                                    const mod = item.data;
                                    const symbol = mod.operation === "add" ? "+" : "-";
                                    const percentageValue = mod.type === "percentage"
                                        ? `${symbol}${mod.value}%`
                                        : `${symbol}${mod.value}${displayCurrency(mod.currency)}`;
                                    let rightText = "";
                                    if (mod.scope === "line") {
                                        const affected = (mod.targetProductLine || [])
                                            .map((id) => lineIndexById.get(id))
                                            .filter((v): v is number => typeof v === "number")
                                            .map((n) => `#${n}`);
                                        rightText = affected.length
                                            ? `${translation.affects}: ${affected.join(", ")}`
                                            : `${translation.affects}: -`;
                                    }
                                    else if (mod.scope === "total") {
                                        const before = runningTotal;
                                        const amount = mod.type === "percentage"
                                            ? before * (mod.value / 100)
                                            : mod.normalizedValue;
                                        runningTotal += mod.operation === "add" ? amount : -amount;
                                        rightText = `${mod.operation === "add" ? "+" : "-"}${amount.toFixed(2)} ${displayCurrency(invoiceCurrency)}`;
                                    }
                                    processedItems.push([
                                        {
                                            columns: [
                                                { svg: modSvg, width: 14, height: 14 },
                                                {
                                                    text: `${mod.name} ${percentageValue ? `: ${percentageValue}` : ""}`,
                                                },
                                            ],
                                            colSpan: 4,
                                            columnGap: 6,
                                            margin: [12, 2, 12, 0],
                                            style: "modifier",
                                        },
                                        {},
                                        {},
                                        {},
                                        {
                                            text: rightText,
                                            alignment: "right",
                                            style: "modifier",
                                            color: "gray",
                                        },
                                    ]);
                                }
                                else {
                                    const viewer = item.data;
                                    processedItems.push([
                                        {
                                            columns: [
                                                { svg: sumSvg, width: 18, height: 18 },
                                                { text: ` ${viewer.name}`, margin: [0, 2, 0, 0] },
                                            ],
                                            style: "viewer",
                                            colSpan: 4,
                                            margin: [12, 0, 12, 0],
                                            columnGap: 6,
                                        },
                                        {},
                                        {},
                                        {},
                                        {
                                            text: `${viewer.subtotal.toFixed(2)} ${displayCurrency(params.currency || "EUR")}`,
                                            style: "viewer",
                                            alignment: "right",
                                        },
                                    ]);
                                }
                            }
                            return processedItems;
                        })(),
                        [
                            {
                                text: translation.table_headers.total,
                                colSpan: 4,
                                bold: true,
                            },
                            {},
                            {},
                            {},
                            {
                                text: `${(() => {
                                    return total?.toFixed(2);
                                })()} ${displayCurrency(invoiceCurrency)}`,
                                alignment: "right",
                                bold: true,
                            },
                        ],
                    ],
                },
            },
            {
                text: `${translation.reported_period}: ${(reportedPeriod ? new Date(reportedPeriod) : new Date()).toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                })}`,
                marginBottom: 12,
            },
            {
                text: notes || "",
                marginBottom: 12,
            },
            {
                stack: [
                    {
                        columns: [
                            {
                                text: `${translation.account_beneficiary}:`,
                            },
                            {
                                text: ` ${company?.name || ""}`,
                                bold: true,
                            },
                        ],
                    },
                    {
                        columns: [
                            {
                                text: `${translation.account_number}:`,
                            },
                            {
                                text: ` ${company?.iban || ""}`,
                                bold: true,
                            },
                        ],
                    },
                    {
                        columns: [
                            {
                                text: `${translation.bank_code}:`,
                            },
                            {
                                text: ` ${company?.bic || ""}`,
                                bold: true,
                            },
                        ],
                    },
                    {
                        columns: [
                            {
                                text: `${translation.bank_name}:`,
                            },
                            {
                                text: ` ${company?.bank_name || ""}`,
                                bold: true,
                            },
                        ],
                    },
                    {
                        text: `\n\n${translation.thanks}\n`,
                    },
                ],
            },
            {
                columns: [
                    {
                        ...signature,
                        width: 100,
                    },
                    {
                        ...stamp,
                        width: 100,
                    },
                ],
            },
            {
                text: params.translation.closing_remark,
            },
        ],
        // @ts-ignore
        footer: function (_, __, pageSize) {
            return {
                stack: [
                    {
                        canvas: [
                            {
                                type: "line",
                                x1: 40,
                                y1: 0,
                                x2: pageSize.width - 40,
                                y2: 0,
                                lineWidth: 2,
                                lineColor: "black",
                            },
                        ],
                        margin: [0, 0, 0, 5], // bottom margin below line
                    },
                    {
                        text: `Bankverbindung: ${company?.bank_name || ""}, Konto Nr.: ${company?.account_number || ""}, BLZ ${company?.bank_code || ""}, Steuernr: ${company?.tax_number || ""}`,
                        alignment: "center",
                        fontSize: 9,
                        margin: [40, 0, 40, 10],
                    },
                ],
            };
        },
        defaultStyle: {
            font: "Roboto",
        },
        styles: {
            header: { fontSize: 18, bold: true, margin: [0, 10, 0, 10] },
            invoiceTitle: { fontSize: 16, bold: true, margin: [0, 10, 0, 20] },
            modifier: { fontSize: 12, bold: true },
            viewer: {
                fontSize: 12,
                bold: true,
                color: "black",
            },
        },
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const finished = pipeline(pdfDoc, createWriteStream(destination, { flags: "wx", mode: 0o640 }));
    pdfDoc.end();
    await finished;
}
