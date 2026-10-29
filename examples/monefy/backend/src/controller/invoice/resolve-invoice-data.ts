import Product from "../../models/Product";
import Modifier from "../../models/Modifier";
import Viewer from "../../models/Viewer";
import { ApiError } from "../../utils/api-errors";
import { IModifierLineValue, IProductLineValue } from "./types";
import { buildModifierViewerTranslationKey, resolveModifierViewerNames, } from "./resolve-modifier-viewer-names";
export const resolveInvoiceData = async (body: {
    productLines: {
        _id: string;
        product: string;
        quantity: number;
        index: number;
    }[];
    modifierLines: {
        modifier: string;
        index: number;
        targetProductLine?: string[];
    }[];
    viewerLines: {
        viewer: string;
        index: number;
        _id: string;
    }[];
    languageCode?: string;
}) => {
    const products = await Product.find({
        _id: { $in: body.productLines.map((p) => p.product) },
    }).lean();
    const modifiers = await Modifier.find({
        _id: { $in: body.modifierLines.map((m) => m.modifier) },
    }).lean();
    const productLines: IProductLineValue[] = body.productLines.map((pl) => {
        const product = products.find((p) => p._id.toString() === pl.product);
        if (!product)
            throw new ApiError(400, `Product ${pl.product} not found`);
        return {
            _id: pl._id,
            product: {
                name: product.name,
                price: product.details.unit_price,
                currency: product.details.currency,
            },
            quantity: pl.quantity,
            index: pl.index,
        };
    });
    const viewers = await Viewer.find({
        _id: { $in: body.viewerLines.map((v) => v.viewer) },
    }).lean();
    const resolvedNames = await resolveModifierViewerNames({
        languageCode: body.languageCode,
        entries: [
            ...modifiers.map((modifier) => ({
                entityType: "modifier" as const,
                entityId: String(modifier._id),
                fallbackName: modifier.name,
            })),
            ...viewers.map((viewer) => ({
                entityType: "viewer" as const,
                entityId: String(viewer._id),
                fallbackName: viewer.name,
            })),
        ],
    });
    const viewerLines = body.viewerLines.map((v) => {
        const def = viewers.find((d) => d._id.toString() === v.viewer.toString());
        if (!def)
            throw new ApiError(400, `Viewer ${v.viewer} not found!`);
        return {
            ...v,
            name: resolvedNames.get(buildModifierViewerTranslationKey("viewer", String(def._id)))?.text || def.name,
        };
    });
    const modifierLines = body.modifierLines.map((m) => {
        const def = modifiers.find((d) => d._id.toString() === m.modifier.toString());
        if (!def)
            throw new ApiError(400, `Modifier ${m.modifier} not found`);
        return {
            ...m,
            value: def.value,
            name: resolvedNames.get(buildModifierViewerTranslationKey("modifier", String(def._id)))?.text || def.name,
            scope: def.scope,
            type: def.type,
            operation: def.operation,
            currency: def.currency,
        };
    }) as IModifierLineValue[];
    return { productLines, modifierLines, viewerLines };
};
