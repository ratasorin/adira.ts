import { Currency } from "../../../models/Product";
import { IViewerLineValue, IModifierLineValue, IProductLineValue, ComputedModifierLine, } from "../types";
const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const fxRateCache = new Map<string, {
    rate: number;
    expiresAt: number;
}>();
const getExchangeRate = async (from: Currency, to: Currency): Promise<number> => {
    if (from === to)
        return 1;
    const cacheKey = `from:${from};to:${to}`;
    const cached = fxRateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.rate;
    }
    const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
        throw new Error(`FX request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
        rates?: Partial<Record<Currency, number>>;
    };
    const rate = payload.rates?.[to];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid EUR rate received for ${from} to ${to}`);
    }
    fxRateCache.set(cacheKey, {
        rate,
        expiresAt: Date.now() + FX_CACHE_TTL_MS,
    });
    return rate;
};
export const convertAmount = async (amount: number, fromCurrency: Currency, toCurrency: Currency): Promise<number> => {
    const rate = await getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
};
export const normalizeProductLinesCurrency = async (productLines: IProductLineValue[], targetCurrency: Currency) => Promise.all(productLines.map(async (line) => ({
    ...line,
    product: {
        ...line.product,
        currency: targetCurrency,
        price: await convertAmount(line.product.price, line.product.currency, targetCurrency),
    },
})));
export const calculateInvoiceState = async <V extends IViewerLineValue, M extends IModifierLineValue,>(productLines: IProductLineValue[], modifierLines: M[], viewerLines: V[]) => {
    // 1. Determine Consistency & Target Currency
    const currencies = [...new Set(productLines.map((l) => l.product?.currency))];
    const isConsistent = currencies.length === 1;
    const targetCurrency = isConsistent ? currencies[0] || "EUR" : "EUR";
    const normalizedProductLines = await normalizeProductLinesCurrency(productLines, targetCurrency);
    const convertedModifiers: (M & {
        normalizedValue: number;
    })[] = [];
    for await (const mod of modifierLines) {
        let normalizedValue = mod.value;
        if (mod.type === "fixed") {
            normalizedValue = await convertAmount(mod.value, mod.currency!, targetCurrency);
        }
        convertedModifiers.push({ ...mod, normalizedValue });
    }
    // 2. Normalize and apply Line-Level Modifiers
    const processedLines = normalizedProductLines.map(line => ({ ...line, subtotal: lineSubtotal<M>(line, convertedModifiers) }));
    // 3. Prepare Global Timeline (Total Modifiers + Viewers)
    const timeline = [
        ...convertedModifiers
            .filter((m) => m.scope === "total")
            .map((m) => ({ ...m, kind: "modifier" as const })),
        ...viewerLines.map((v) => ({ ...v, kind: "viewer" as const })),
    ].sort((a, b) => a.index - b.index);
    // 4. Calculate Running Total and Snapshot Viewers
    let runningTotal = processedLines.reduce((sum, l) => sum + l.subtotal, 0);
    const calculatedViewers: (V & {
        subtotal: number;
        currency: Currency;
    })[] = [];
    for (const op of timeline) {
        if (op.kind === "modifier") {
            const mod = op;
            const amount = mod.type === "percentage"
                ? runningTotal * (mod.value / 100)
                : mod.normalizedValue;
            runningTotal =
                mod.operation === "subtract"
                    ? runningTotal - amount
                    : runningTotal + amount;
            runningTotal = Math.round(runningTotal * 100) / 100;
        }
        else {
            // It's a viewer
            calculatedViewers.push({
                ...op,
                subtotal: Math.round(runningTotal * 100) / 100,
                currency: targetCurrency,
            });
        }
    }
    return {
        total: Math.round(runningTotal * 100) / 100,
        currency: targetCurrency,
        viewers: calculatedViewers,
        modifiers: convertedModifiers,
    };
};

export function lineSubtotal<M extends IModifierLineValue>(line: IProductLineValue, modifiers: readonly (M & { normalizedValue: number })[]): number {
    let subtotal = line.product.price * line.quantity;
    for (const modifier of modifiers.filter(m => m.scope === "line" && m.targetProductLine?.includes(line._id)).sort((a, b) => a.index - b.index)) {
        const amount = modifier.type === "percentage" ? subtotal * modifier.value / 100 : modifier.normalizedValue;
        subtotal += modifier.operation === "subtract" ? -amount : amount;
    }
    return subtotal;
}
