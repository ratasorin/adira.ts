import { expectSuccess } from "../../../../services/api";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Checkbox, Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../services/api";
import { displayError } from "../../../../utils/handle-error";
import type { Invoice, VIEW_MODE } from "../../invoice.types";
import type { Customer } from "./select-customer";
type EditableCustomer = Customer & {
    base_customer?: string | {
        _id?: string;
        internal_name?: string;
    };
};
const fetchCustomerVersions = async (baseCustomerId: string) => {
    const { run } = api("/customers", "GET")({
        query: {
            include: ["base_customer"],
            where: {
                $and: [
                    { "base_customer._id": { $eq: baseCustomerId } },
                    {  },
                ],
            },
            rows: r => r({
                select: [] as [],
                sortBy: { "createdAt": -1 }
            })
        },
    });
    return run().then(expectSuccess).then((res) => (res?.rows || []) as EditableCustomer[]);
};
const patchCustomerMetadata = async (customerId: string, payload: Pick<EditableCustomer, "primary"> & {
    tags?: string[];
}) => {
    const { run } = api("/customers/:id/metadata", "PATCH")({
        path: { id: customerId },
        data: payload,
        query: {
            include: ["base_customer"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res as EditableCustomer | undefined);
};
const createCustomerVersion = async (customerId: string, details: EditableCustomer["details"]) => {
    const { run } = api("/customers/:id/version", "POST")({
        path: { id: customerId },
        data: {
            details,
        },
        query: {
            include: ["base_customer"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res);
};
const getBaseCustomerId = (customer?: {
    base_customer: string | undefined | null | {
        _id: string;
    };
} | undefined | null) => typeof customer?.base_customer === "string"
    ? customer.base_customer
    : customer?.base_customer?._id || "";
const getBaseCustomerName = (customer?: EditableCustomer) => typeof customer?.base_customer === "string"
    ? ""
    : customer?.base_customer?.internal_name || "";
const sortVersions = (versions: EditableCustomer[]) => [...versions].sort((left, right) => {
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
const serializeCustomerDetails = (details?: EditableCustomer["details"]) => JSON.stringify({
    selected_name: details?.selected_name?.trim() || "",
    country: details?.country?.trim() || "",
    city: details?.city?.trim() || "",
    address: details?.address?.trim() || "",
    cif: details?.cif?.trim() || "",
});
export function ReceiverVersionEditor({ customer, viewMode, onCustomerUpdate, isOpen, onOpenChange, }: {
    customer?: Invoice["receiving_customer"];
    viewMode: VIEW_MODE;
    onCustomerUpdate: (customer?: Invoice["receiving_customer"]) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);
    const [savingMetadata, setSavingMetadata] = useState(false);
    const [versions, setVersions] = useState<EditableCustomer[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState("");
    const [primaryId, setPrimaryId] = useState("");
    const [draft, setDraft] = useState<EditableCustomer | undefined>();
    const [tagInput, setTagInput] = useState("");
    const baseCustomerId = getBaseCustomerId(customer);
    const loadVersions = useCallback(async () => {
        if (!baseCustomerId) {
            setVersions([]);
            setDraft(undefined);
            setPrimaryId("");
            setSelectedVersionId("");
            return;
        }
        setLoading(true);
        try {
            const rows = sortVersions(await fetchCustomerVersions(baseCustomerId));
            setVersions(rows);
            const nextPrimaryId = rows.find((row) => row.primary)?._id || customer?._id || "";
            setPrimaryId(nextPrimaryId);
            const nextSelected = rows.find((row) => row._id === customer?._id) ||
                rows.find((row) => row._id === nextPrimaryId) ||
                rows[0];
            setSelectedVersionId(nextSelected?._id || "");
            setDraft(nextSelected);
        }
        catch (error) {
            displayError(error, "[Error] Failed to load customer versions!");
        }
        finally {
            setLoading(false);
        }
    }, [baseCustomerId, customer?._id]);
    useEffect(() => {
        if (!isOpen)
            return;
        loadVersions();
    }, [isOpen, loadVersions]);
    useEffect(() => {
        if (!versions.length)
            return;
        const nextDraft = versions.find((row) => row._id === selectedVersionId);
        if (nextDraft) {
            setDraft(nextDraft);
        }
    }, [selectedVersionId, versions]);
    const visibleVersions = useMemo(() => sortVersions(versions), [versions]);
    const selectedVersion = useMemo(() => versions.find((row) => row._id === selectedVersionId), [selectedVersionId, versions]);
    const persistedPrimaryVersion = useMemo(() => visibleVersions.find((row) => row.primary) || null, [visibleVersions]);
    const currentPrimaryId = primaryId || persistedPrimaryVersion?._id || "";
    const currentUsedVersionId = customer?._id || "";
    const isPersistedPrimary = Boolean(draft?._id && persistedPrimaryVersion?._id === draft._id);
    const isDraftPrimary = Boolean(draft?._id && draft._id === currentPrimaryId);
    const isDraftUsed = Boolean(draft?._id && draft._id === currentUsedVersionId);
    const hasBillingDetailsChanges = serializeCustomerDetails(selectedVersion?.details) !==
        serializeCustomerDetails(draft?.details);
    const addTag = useCallback(() => {
        const nextTag = tagInput.trim();
        if (!nextTag)
            return;
        setDraft((current) => current
            ? {
                ...current,
                tags: Array.from(new Set([...(current.tags || []), nextTag])),
            }
            : current);
        setTagInput("");
    }, [tagInput]);
    const removeTag = useCallback((tag: string) => {
        setDraft((current) => current
            ? {
                ...current,
                tags: (current.tags || []).filter((item) => item !== tag),
            }
            : current);
    }, []);
    const refreshVersions = useCallback(async (baseId: string, selectedId?: string) => {
        const refreshed = sortVersions(await fetchCustomerVersions(baseId));
        setVersions(refreshed);
        const nextPrimaryId = refreshed.find((row) => row.primary)?._id || "";
        setPrimaryId(nextPrimaryId);
        const nextCurrent = refreshed.find((row) => row._id === selectedId) ||
            refreshed.find((row) => row._id === customer?._id) ||
            refreshed.find((row) => row._id === nextPrimaryId) ||
            refreshed[0];
        setSelectedVersionId(nextCurrent?._id || "");
        setDraft(nextCurrent);
        onCustomerUpdate({ ...nextCurrent, base_customer: nextCurrent.base_customer?._id || "" });
    }, [customer?._id, onCustomerUpdate]);
    const createVersion = useCallback(async () => {
        if (!draft?._id)
            return;
        const draftBaseCustomerId = getBaseCustomerId(draft);
        if (!draftBaseCustomerId)
            return;
        setSavingVersion(true);
        try {
            const created = await createCustomerVersion(draft._id, draft.details);
            if (!created) {
                throw new Error("Customer version creation returned no record");
            }
            await refreshVersions(draftBaseCustomerId, created._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to create customer version!");
        }
        finally {
            setSavingVersion(false);
        }
    }, [draft, refreshVersions]);
    const saveMetadata = useCallback(async () => {
        if (!draft?._id)
            return;
        const draftBaseCustomerId = getBaseCustomerId(draft);
        if (!draftBaseCustomerId)
            return;
        setSavingMetadata(true);
        try {
            if (!currentPrimaryId) {
                throw new Error("A receiver family must keep exactly one primary version");
            }
            const previousPrimary = visibleVersions.find((row) => row._id === persistedPrimaryVersion?._id);
            if (!isDraftPrimary && isPersistedPrimary) {
                throw new Error("A receiver family must keep exactly one primary version");
            }
            if (previousPrimary?._id && previousPrimary._id !== currentPrimaryId) {
                await patchCustomerMetadata(previousPrimary._id, {
                    primary: false,
                    tags: previousPrimary.tags || [],
                });
            }
            const updated = await patchCustomerMetadata(draft._id, {
                primary: draft._id === currentPrimaryId,
                tags: draft.tags || [],
            });
            if (!updated)
                throw new Error("Customer metadata update returned no record");
            await refreshVersions(draftBaseCustomerId, updated._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to update customer metadata!");
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
    return (<>
      <Card shadow="none" className="mt-4 overflow-hidden rounded-2xl border border-divider bg-background w-full">
        <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border-b border-divider lg:border-b-0 lg:border-r">
            <div className="mb-1 flex items-center px-4 pt-4 gap-2 text-sm font-semibold text-foreground-600">
              <HistoryRoundedIcon fontSize="small"/>
              {(getBaseCustomerName(customer as EditableCustomer) ||
            "Customer") + " Versions"}
            </div>
            <div className="mb-4 text-xs text-foreground-400 px-4">
              Pick a receiver and select a version.
            </div>

            {loading ? (<div className="flex h-48 items-center justify-center">
                <Spinner size="sm"/>
              </div>) : (<div className="flex flex-col overflow-y-auto">
                {visibleVersions.map((version, idx) => (<Card isPressable key={version._id} onClick={() => setSelectedVersionId(version._id)} className={`py-3 px-4 shadow-none rounded-none border-divider ${idx === visibleVersions.length - 1 ? "border-b-1" : ""} border-t-1 ${version._id === selectedVersionId
                    ? "bg-primary-100"
                    : "bg-background"}`}>
                    <div className="flex items-start flex-col">
                      <div className="min-w-0 flex items-start flex-col gap-1">
                        <Chip size="sm" variant="flat">
                          {version._id}
                        </Chip>
                        <div className="truncate text-sm font-semibold text-foreground">
                          {version.details.selected_name}
                        </div>
                      </div>
                      <div className="mt-1 flex text-xs text-foreground-500 text-left">
                        {version.details.country}, {version.details.city}
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="w-full">
                <div className="mb-1 text-sm font-semibold text-foreground-600 flex justify-between items-center flex-wrap">
                  <span>Billing details</span>
                  <Chip size="sm" variant="flat" color={isDraftPrimary ? "warning" : "default"} startContent={isDraftPrimary ? (<StarRoundedIcon fontSize="inherit"/>) : null}>
                    {draft?._id}
                  </Chip>
                </div>
                <div className="text-xs text-foreground-400">
                  Pick a version, then adjust its billing details.
                </div>
              </div>
            </div>

            {draft ? (<div className="space-y-4">
                <Card shadow="none" className="bg-default-50/70">
                  <CardBody className="gap-4 p-4">
                    <Input isDisabled={viewMode === "read"} label="Company name" value={draft.details.selected_name} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        selected_name: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="County" value={draft.details.country} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        country: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="City" value={draft.details.city} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        city: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Address" value={draft.details.address} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        address: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="CIF" value={draft.details.cif} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        cif: event.target.value,
                    },
                }
                : current)}/>
                  </CardBody>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button color="primary" isLoading={savingVersion} isDisabled={viewMode === "read" || !hasBillingDetailsChanges} onPress={createVersion}>
                    Create New Version
                  </Button>
                </div>
                {!hasBillingDetailsChanges ? (<div className="text-right text-xs text-foreground-400">
                    Update a billing field to create a new version.
                  </div>) : null}

                <div className="border-t border-divider pt-1">
                  <div className="mb-1 text-sm font-semibold text-foreground-600">
                    Metadata
                  </div>
                  <div className="text-xs text-foreground-400">
                    Save selection and tags on this customer.
                  </div>
                </div>

                <Card shadow="none" className="bg-default-50/70">
                  <CardBody className="gap-4 p-4">
                    <Checkbox isDisabled={viewMode === "read"} isSelected={isDraftUsed} onValueChange={(checked) => {
                if (!checked || !draft)
                    return;
                onCustomerUpdate({ ...draft, base_customer: draft.base_customer?._id || "" });
            }}>
                      Use this version
                    </Checkbox>
                    <Checkbox isDisabled={viewMode === "read"} isSelected={isDraftPrimary} onValueChange={(checked) => {
                if (!checked && isPersistedPrimary) {
                    return;
                }
                setPrimaryId(checked ? draft._id : "");
            }}>
                      Set this version as primary
                    </Checkbox>

                    <div>
                      <div className="mb-2 text-sm font-medium text-foreground-600">
                        Tags
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(draft.tags || []).map((tag) => (<Chip key={tag} size="sm" variant="flat" onClose={viewMode === "read"
                    ? undefined
                    : () => removeTag(tag)}>
                            {tag}
                          </Chip>))}
                        {!draft.tags?.length ? (<div className="text-xs text-foreground-400">
                            No tags yet.
                          </div>) : null}
                      </div>
                      <div className="flex gap-2">
                        <Input isDisabled={viewMode === "read"} placeholder="Add a tag" value={tagInput} onValueChange={setTagInput} onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                }
            }}/>
                        <Button isIconOnly variant="flat" color="primary" isDisabled={viewMode === "read" || !tagInput.trim()} onPress={addTag}>
                          <AddRoundedIcon fontSize="small"/>
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button variant="light" onPress={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button color="primary" isLoading={savingMetadata} isDisabled={viewMode === "read"} onPress={saveMetadata}>
                    Save Metadata
                  </Button>
                </div>
              </div>) : (<div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-divider text-sm text-foreground-400">
                Pick a receiver version to inspect.
              </div>)}
          </div>
        </div>
      </Card>
    </>);
}
