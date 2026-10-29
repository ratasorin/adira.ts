import { expectSuccess } from "../../../../services/api";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Checkbox, Select, SelectItem, Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../services/api";
import { displayCurrency } from "../../../../utils/prices";
import { displayError } from "../../../../utils/handle-error";
import type { ProductDetails } from "@monefy/types/src/models/Product";
import type { VIEW_MODE } from "../../invoice.types";
export type EditableProduct = {
    _id: string;
    name: string;
    details: ProductDetails;
    primary: boolean;
    createdAt?: Date | string;
    base_product?: string | {
        _id?: string;
    } | null;
};
const getBaseProductId = (product?: EditableProduct | null) => typeof product?.base_product === "string"
    ? product.base_product
    : product?.base_product?._id || "";
const fetchProductVersions = async (baseProductId: string) => {
    const { run } = api("/products", "GET")({
        query: {
            include: ["base_product"],
            where: {
                $and: [
                    { "base_product._id": { $eq: baseProductId } },
                    {  },
                ],
            },
            rows: r => r({
                select: [] as [],
                sortBy: { "createdAt": -1 }
            })
        },
    });
    return run().then(expectSuccess).then((res) => (res?.rows || []) as EditableProduct[]);
};
const patchProductMetadata = async (productId: string, payload: Pick<EditableProduct, "primary">) => {
    const { run } = api("/products/:id/metadata", "PATCH")({
        path: { id: productId },
        data: payload,
        query: {
            include: ["base_product"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res as EditableProduct | undefined);
};
const createProductVersion = async (productId: string, payload: Pick<EditableProduct, "name" | "details">) => {
    const { run } = api("/products/:id/version", "POST")({
        path: { id: productId },
        data: payload,
        query: {
            include: ["base_product"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res as EditableProduct | undefined);
};
const sortProducts = (products: EditableProduct[]) => [...products].sort((left, right) => {
    if (left.primary !== right.primary)
        return left.primary ? -1 : 1;
    return (new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime());
});
const formatCreatedAt = (value?: Date | string) => {
    if (!value)
        return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "Unknown date";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
};
const serializeProductDetails = (product?: EditableProduct) => JSON.stringify({
    name: product?.name?.trim() || "",
    unit_price: product?.details?.unit_price || 0,
    currency: product?.details?.currency || "EUR",
});
export function ProductVersionEditor({ product, invoiceProduct, viewMode, onProductUpdate, onProductsChange, isOpen, onOpenChange, }: {
    product?: EditableProduct;
    invoiceProduct?: EditableProduct;
    viewMode: VIEW_MODE;
    onProductUpdate: (product?: EditableProduct) => void;
    onProductsChange?: () => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);
    const [savingMetadata, setSavingMetadata] = useState(false);
    const [versions, setVersions] = useState<EditableProduct[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState("");
    const [primaryId, setPrimaryId] = useState("");
    const [draft, setDraft] = useState<EditableProduct | undefined>();
    const baseProductId = getBaseProductId(product);
    const loadVersions = useCallback(async () => {
        if (!baseProductId) {
            setVersions([]);
            setSelectedVersionId("");
            setPrimaryId("");
            setDraft(undefined);
            return;
        }
        setLoading(true);
        try {
            const rows = sortProducts(await fetchProductVersions(baseProductId));
            setVersions(rows);
            const nextPrimaryId = rows.find((row) => row.primary)?._id || invoiceProduct?._id || "";
            setPrimaryId(nextPrimaryId);
            const nextSelected = rows.find((row) => row._id === product?._id) ||
                rows.find((row) => row._id === invoiceProduct?._id) ||
                rows.find((row) => row._id === nextPrimaryId) ||
                rows[0];
            setSelectedVersionId(nextSelected?._id || "");
            setDraft(nextSelected);
        }
        catch (error) {
            displayError(error, "[Error] Failed to load product versions!");
        }
        finally {
            setLoading(false);
        }
    }, [baseProductId, invoiceProduct?._id, product?._id]);
    useEffect(() => {
        if (!isOpen)
            return;
        loadVersions();
    }, [isOpen, loadVersions]);
    useEffect(() => {
        if (!versions.length)
            return;
        const nextDraft = versions.find((row) => row._id === selectedVersionId);
        if (nextDraft)
            setDraft(nextDraft);
    }, [selectedVersionId, versions]);
    const visibleVersions = useMemo(() => sortProducts(versions), [versions]);
    const selectedVersion = useMemo(() => versions.find((row) => row._id === selectedVersionId), [selectedVersionId, versions]);
    const persistedPrimaryVersion = useMemo(() => visibleVersions.find((row) => row.primary) || null, [visibleVersions]);
    const currentPrimaryId = primaryId || persistedPrimaryVersion?._id || "";
    const currentUsedVersionId = invoiceProduct?._id || "";
    const isDraftPrimary = Boolean(draft?._id && draft._id === currentPrimaryId);
    const isPersistedPrimary = Boolean(draft?._id && draft._id === persistedPrimaryVersion?._id);
    const isDraftUsed = Boolean(draft?._id && draft._id === currentUsedVersionId);
    const hasProductDetailsChanges = serializeProductDetails(selectedVersion) !== serializeProductDetails(draft);
    const refreshVersions = useCallback(async (selectedId?: string) => {
        if (!baseProductId)
            return;
        const refreshed = sortProducts(await fetchProductVersions(baseProductId));
        setVersions(refreshed);
        const nextPrimaryId = refreshed.find((row) => row.primary)?._id || "";
        setPrimaryId(nextPrimaryId);
        const nextCurrent = refreshed.find((row) => row._id === selectedId) ||
            refreshed.find((row) => row._id === invoiceProduct?._id) ||
            refreshed[0];
        setSelectedVersionId(nextCurrent?._id || "");
        setDraft(nextCurrent);
        if (nextCurrent && currentUsedVersionId === selectedId) {
            onProductUpdate(nextCurrent);
        }
        onProductsChange?.();
    }, [baseProductId, currentUsedVersionId, invoiceProduct?._id, onProductUpdate, onProductsChange]);
    const createVersion = useCallback(async () => {
        if (!draft?._id)
            return;
        setSavingVersion(true);
        try {
            const created = await createProductVersion(draft._id, {
                name: draft.name,
                details: draft.details,
            });
            if (!created) {
                throw new Error("Product version creation returned no record");
            }
            await refreshVersions(created._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to create product version!");
        }
        finally {
            setSavingVersion(false);
        }
    }, [draft, refreshVersions]);
    const saveMetadata = useCallback(async () => {
        if (!draft?._id)
            return;
        setSavingMetadata(true);
        try {
            if (!currentPrimaryId) {
                throw new Error("A product family must keep exactly one primary version");
            }
            const previousPrimary = visibleVersions.find((row) => row._id === persistedPrimaryVersion?._id);
            if (!isDraftPrimary && isPersistedPrimary) {
                throw new Error("A product family must keep exactly one primary version");
            }
            if (previousPrimary?._id && previousPrimary._id !== currentPrimaryId) {
                await patchProductMetadata(previousPrimary._id, {
                    primary: false,
                });
            }
            const updated = await patchProductMetadata(draft._id, {
                primary: draft._id === currentPrimaryId,
            });
            if (!updated) {
                throw new Error("Product metadata update returned no record");
            }
            await refreshVersions(updated._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to update product metadata!");
        }
        finally {
            setSavingMetadata(false);
        }
    }, [
        currentPrimaryId,
        draft,
        isDraftPrimary,
        isPersistedPrimary,
        persistedPrimaryVersion?._id,
        refreshVersions,
        visibleVersions,
    ]);
    if (!isOpen)
        return null;
    return (<Card shadow="none" className="mt-4 overflow-hidden rounded-2xl border border-divider bg-background">
      <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-divider lg:border-b-0 lg:border-r">
          <div className="mb-1 flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-foreground-600">
            <HistoryRoundedIcon fontSize="small"/>
            {(product?.name || "Product") + " Versions"}
          </div>
          <div className="mb-4 px-4 text-xs text-foreground-400">
            Pick a product version to inspect or edit.
          </div>

          {loading ? (<div className="flex h-48 items-center justify-center">
              <Spinner size="sm"/>
            </div>) : (<div className="flex max-h-[520px] flex-col overflow-y-auto">
              {visibleVersions.map((version, idx) => (<Card isPressable key={version._id} onClick={() => setSelectedVersionId(version._id)} className={`rounded-none border-divider px-4 py-3 shadow-none border-t-1 ${idx === visibleVersions.length - 1 ? "border-b-1" : ""} ${version._id === selectedVersionId
                    ? "bg-primary-50"
                    : "bg-background"}`}>
                  <div className="flex flex-col items-start">
                    <div className="min-w-0 flex items-start flex-col gap-1">
                      <Chip size="sm" variant="flat">
                        {version._id}
                      </Chip>
                      <div className="truncate text-sm font-semibold text-foreground">
                        {version.name}
                      </div>
                    </div>
                    <div className="mt-1 text-left text-xs text-foreground-500">
                      {version.details.unit_price}
                      {displayCurrency(version.details.currency)}
                    </div>
                  </div>
                  <div className="mt-3 flex w-full items-center justify-between text-xs text-foreground-400">
                    {formatCreatedAt(version.createdAt)}
                    <div className="flex items-center gap-2">
                      {version._id === currentUsedVersionId ? (<Chip size="sm" variant="flat" color="primary" startContent={<CheckRoundedIcon fontSize="inherit"/>}>
                          Used
                        </Chip>) : null}
                      {version._id === currentPrimaryId ? (<Chip size="sm" variant="flat" color="warning" startContent={<StarRoundedIcon fontSize="inherit"/>}>
                          Primary
                        </Chip>) : null}
                    </div>
                  </div>
                </Card>))}
            </div>)}
        </div>

        <div className="p-4">
          {draft ? (<div className="space-y-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground-600">
                <span>Product details</span>
                <Chip size="sm" variant="flat" color={isDraftPrimary ? "warning" : "default"} startContent={isDraftPrimary ? <StarRoundedIcon fontSize="inherit"/> : null}>
                  {draft._id}
                </Chip>
              </div>

              <Card shadow="none" className="bg-default-50/70">
                <CardBody className="gap-4 p-4">
                  <Input isDisabled={viewMode === "read"} label="Product name" value={draft.name} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? { ...current, name: event.target.value }
                : current)}/>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input isDisabled={viewMode === "read"} label="Unit price" type="number" min={0} step="0.01" value={String(draft.details.unit_price)} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        unit_price: Number(event.target.value || 0),
                    },
                }
                : current)}/>
                    <Select isDisabled={viewMode === "read"} label="Currency" selectedKeys={new Set([draft.details.currency])} classNames={{ trigger: "bg-default-200/60" }} onSelectionChange={(keys) => {
                const currency = String(Array.from(keys)[0] || "EUR");
                setDraft((current) => current
                    ? {
                        ...current,
                        details: {
                            ...current.details,
                            currency: currency as ProductDetails["currency"],
                        },
                    }
                    : current);
            }}>
                      {["EUR", "USD", "RON", "GBP"].map((currency) => (<SelectItem key={currency}>{currency}</SelectItem>))}
                    </Select>
                  </div>
                </CardBody>
              </Card>

              <div className="flex items-center justify-between gap-3 border-t border-divider pt-4">
                <div className="text-xs text-foreground-400">
                  {hasProductDetailsChanges
                ? "Creating a new version preserves the existing product history."
                : "Update the product fields to create a new version."}
                </div>
                <Button color="primary" isDisabled={viewMode === "read" ||
                !hasProductDetailsChanges ||
                savingVersion} onPress={createVersion}>
                  {savingVersion ? "Creating..." : "New Version"}
                </Button>
              </div>

              <div className="border-t border-divider pt-4">
                <div className="mb-2 text-sm font-semibold text-foreground-600">
                  Metadata
                </div>
                <div className="mb-4 text-xs text-foreground-400">
                  Save the current product family metadata without creating a new
                  version.
                </div>
                <Card shadow="none" className="bg-default-50/70">
                  <CardBody className="gap-4 p-4">
                    <Checkbox isDisabled={viewMode === "read" || !draft?._id} isSelected={isDraftUsed} onValueChange={(checked) => {
                if (!checked || !draft)
                    return;
                onProductUpdate(draft);
            }}>
                      <div className="text-base">Use this version</div>
                      <div className="text-sm text-foreground-400">
                        {isDraftUsed
                ? "This product version is currently used in the selected row."
                : `Currently used: ${invoiceProduct?.name || "None"}`}
                      </div>
                    </Checkbox>

                    <Checkbox isDisabled={viewMode === "read" || !draft?._id} isSelected={isDraftPrimary} onValueChange={(checked) => {
                if (!draft?._id)
                    return;
                if (!checked && isPersistedPrimary)
                    return;
                setPrimaryId(checked ? draft._id : "");
            }}>
                      <div className="text-base">Set this version as primary</div>
                      <div className="text-sm text-foreground-400">
                        {isPersistedPrimary
                ? "This is the current primary version. Pick another version if you want to replace it."
                : `Current primary: ${persistedPrimaryVersion?.name || "None"}`}
                      </div>
                    </Checkbox>
                  </CardBody>
                </Card>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="light" onPress={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button color="primary" isDisabled={viewMode === "read" || savingMetadata} onPress={saveMetadata}>
                    {savingMetadata ? "Saving..." : "Save Metadata"}
                  </Button>
                </div>
              </div>
            </div>) : (<div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-divider text-sm text-foreground-400">
              Pick a product version to inspect.
            </div>)}
        </div>
      </div>
    </Card>);
}
