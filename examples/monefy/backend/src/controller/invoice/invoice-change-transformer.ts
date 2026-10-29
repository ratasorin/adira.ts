import { Types } from "mongoose";
import Product from "../../models/Product";
import Modifier from "../../models/Modifier";
import Viewer from "../../models/Viewer";
import Languages from "../../models/Languages";
import Invoice, { IInvoice } from "../../models/invoice/Invoice";
import { DiffTransformMap, DiffValue } from "../../utils/diff";
const isStringRef = (value: DiffValue | undefined | null): value is string => typeof value === "string" && value.length > 0;
const languageCache = new Map<string, DiffValue>();
const productCache = new Map<string, DiffValue>();
const modifierCache = new Map<string, DiffValue>();
const viewerCache = new Map<string, DiffValue>();
const loadCached = async (ids: string[], cache: Map<string, DiffValue>, loader: (ids: string[]) => Promise<Map<string, DiffValue>>) => {
    const missingIds = ids.filter((id) => !cache.has(id));

    if (!missingIds.length)
        return;
    const fetched = await loader(missingIds);

    fetched.forEach((value, key) => cache.set(key, value));
};
const formatRef = (value: DiffValue | undefined | null, cache: Map<string, DiffValue>) => {
    const formattedValue = cache.get(String(value)) || value;

    return formattedValue;
};
const toId = (value: unknown): string | undefined => {
    if (value == null)
        return undefined;
    if (typeof value === "string" && value.length > 0)
        return value;
    if (value instanceof Types.ObjectId)
        return value.toString();
    return undefined;
};
type InvoiceChangeTransformMap = Omit<DiffTransformMap<IInvoice & {
    __v: number;
}>, "products" | "modifiers" | "viewers"> & DiffTransformMap<NonNullable<IInvoice["products"]>[number], "products"> & DiffTransformMap<NonNullable<IInvoice["modifiers"]>[number], "modifiers"> & DiffTransformMap<NonNullable<IInvoice["viewers"]>[number], "viewers">;
export const invoiceChangeTransformer: InvoiceChangeTransformMap = {
    language: async (oldV, newV) => {

        const ids = [oldV, newV]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, languageCache, async (missingIds) => {
            const languages = await Languages.find({ _id: { $in: missingIds } })
                .select({ _id: 1, code: 1, name: 1 })
                .lean();
            return new Map(languages.map((language) => [
                String(language._id),
                {
                    _id: String(language._id),
                    code: language.code,
                    name: language.name,
                },
            ]));
        });
        return {
            old: formatRef(oldV, languageCache),
            new: formatRef(newV, languageCache),
        };
    },
    "products.product": async (oldV, newV) => {
        const ids = [oldV, newV]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, productCache, async (missingIds) => {
            const products = await Product.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1, details: 1 })
                .lean();
            return new Map(products.map((product) => [
                String(product._id),
                {
                    _id: String(product._id),
                    name: product.name,
                    details: product.details,
                },
            ]));
        });
        return {
            old: formatRef(toId(oldV), productCache),
            new: formatRef(toId(newV), productCache),
        };
    },
    products: async (oldV, newV) => {
        const ids = [oldV?.product, newV?.product]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, productCache, async (missingIds) => {
            const products = await Product.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1, details: 1 })
                .lean();
            return new Map(products.map((product) => [
                String(product._id),
                {
                    _id: String(product._id),
                    name: product.name,
                    details: product.details,
                },
            ]));
        });
        const formatProductLine = (value: typeof oldV | typeof newV) => {
            if (!value)
                return value;
            const productId = String(value.product);
            return { ...value, product: productCache.get(productId) || productId };
        };
        return { old: formatProductLine(oldV), new: formatProductLine(newV) };
    },
    "modifiers.modifier": async (oldV, newV) => {
        const ids = [oldV, newV]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, modifierCache, async (missingIds) => {
            const modifiers = await Modifier.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1, scope: 1, type: 1, operation: 1, value: 1 })
                .lean();
            return new Map(modifiers.map((modifier) => [
                String(modifier._id),
                {
                    _id: String(modifier._id),
                    name: modifier.name,
                    scope: modifier.scope,
                    type: modifier.type,
                    operation: modifier.operation,
                    value: modifier.value,
                },
            ]));
        });
        return {
            old: formatRef(toId(oldV), modifierCache),
            new: formatRef(toId(newV), modifierCache),
        };
    },
    modifiers: async (oldV, newV) => {
        const ids = [oldV?.modifier, newV?.modifier]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, modifierCache, async (missingIds) => {
            const modifiers = await Modifier.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1, scope: 1, type: 1, operation: 1, value: 1 })
                .lean();
            return new Map(modifiers.map((modifier) => [
                String(modifier._id),
                {
                    _id: String(modifier._id),
                    name: modifier.name,
                    scope: modifier.scope,
                    type: modifier.type,
                    operation: modifier.operation,
                    value: modifier.value,
                },
            ]));
        });
        const formatModifierLine = (value: typeof oldV | typeof newV) => {
            if (!value)
                return value;
            const modifierId = String(value.modifier);
            return {
                ...value,
                modifier: modifierCache.get(modifierId) || modifierId,
            };
        };
        return { old: formatModifierLine(oldV), new: formatModifierLine(newV) };
    },
    "viewers.viewer": async (oldV, newV) => {
        const ids = [oldV, newV]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, viewerCache, async (missingIds) => {
            const viewers = await Viewer.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1 })
                .lean();
            return new Map(viewers.map((viewer) => [
                String(viewer._id),
                {
                    _id: String(viewer._id),
                    name: viewer.name,
                },
            ]));
        });
        return {
            old: formatRef(toId(oldV), viewerCache),
            new: formatRef(toId(newV), viewerCache),
        };
    },
    viewers: async (oldV, newV) => {
        const ids = [oldV?.viewer, newV?.viewer]
            .map(toId)
            .filter((value): value is string => Boolean(value));
        await loadCached(ids, viewerCache, async (missingIds) => {
            const viewers = await Viewer.find({ _id: { $in: missingIds } })
                .select({ _id: 1, name: 1 })
                .lean();
            return new Map(viewers.map((viewer) => [
                String(viewer._id),
                {
                    _id: String(viewer._id),
                    name: viewer.name,
                },
            ]));
        });
        const formatViewerLine = (value: typeof oldV | typeof newV) => {
            if (!value)
                return value;
            const viewerId = String(value.viewer);
            return { ...value, viewer: viewerCache.get(viewerId) || viewerId };
        };
        return { old: formatViewerLine(oldV), new: formatViewerLine(newV) };
    },
};
export const invoiceObjectChangeTransformer: DiffTransformMap<IInvoice & {
    __v: number;
}> = {
    language: invoiceChangeTransformer.language,
};
