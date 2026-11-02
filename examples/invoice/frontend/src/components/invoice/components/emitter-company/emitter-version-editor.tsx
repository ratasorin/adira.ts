import { expectSuccess } from "../../../../services/api";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Button, Checkbox, Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../services/api";
import { getBaseCompanyId } from "../../../../utils/company";
import { displayError } from "../../../../utils/handle-error";
import type { Invoice, VIEW_MODE } from "../../invoice.types";
import type { Company } from "./companies.api";
import { useEmitterCompanies } from "./use-companies";
type EditableCompany = Company;
const patchCompanyMetadata = async (companyId: string, payload: Pick<EditableCompany, "primary"> & {
    tags?: string[];
}) => {
    const { run } = api("/companies/:id/metadata", "PATCH")({
        path: { id: companyId },
        data: payload,
        query: {
            include: ["base_company"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res as EditableCompany | undefined);
};
const createCompanyVersion = async (companyId: string, payload: Pick<EditableCompany, "name" | "details">) => {
    const { run } = api("/companies/:id/version", "POST")({
        path: { id: companyId },
        data: {
            name: payload.name,
            details: payload.details
        },
        query: {
            include: ["base_company"],
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then((res) => res);
};
const sortCompanies = (companies: EditableCompany[]) => [...companies].sort((left, right) => {
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
const serializeCompanyDetails = (company?: EditableCompany) => JSON.stringify({
    name: company?.name?.trim() || "",
    street: company?.details.address.street?.trim() || "",
    zip: company?.details.address.zip?.trim() || "",
    city: company?.details.address.city?.trim() || "",
    country: company?.details.address.country?.trim() || "",
    vat_id: company?.details.vat_id?.trim() || "",
    email: company?.details.contact.email?.trim() || "",
    phone: company?.details.contact.phone?.trim() || "",
    fax: company?.details.contact.fax?.trim() || "",
    website: company?.details.contact.website?.trim() || "",
    iban: company?.details.iban?.trim() || "",
    bic: company?.details.bic?.trim() || "",
    bank_name: company?.details.bank_name?.trim() || "",
    tax_number: company?.details.tax_number?.trim() || "",
    account_number: company?.details.account_number?.trim() || "",
    bank_code: company?.details.bank_code?.trim() || "",
});
export function EmitterVersionEditor({ company, invoiceCompany, viewMode, onCompanyUpdate, isOpen, onOpenChange, }: {
    company?: Invoice["issuer_company"];
    invoiceCompany?: Invoice["issuer_company"];
    viewMode: VIEW_MODE;
    onCompanyUpdate: (company?: Invoice["issuer_company"]) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);
    const [savingMetadata, setSavingMetadata] = useState(false);
    const [companies, setCompanies] = useState<EditableCompany[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState("");
    const [primaryId, setPrimaryId] = useState("");
    const [draft, setDraft] = useState<EditableCompany | undefined>();
    const [tagInput, setTagInput] = useState("");
    const refreshCompanyOptions = useEmitterCompanies((state) => state.refreshCompanies);
    const baseCompanyId = getBaseCompanyId(company);
    const loadCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const rows = sortCompanies(await refreshCompanyOptions());
            setCompanies(rows);
            const selectedBaseRows = rows.filter((row) => getBaseCompanyId(row) === baseCompanyId);
            const nextPrimaryId = selectedBaseRows.find((row) => row.primary)?._id || company?._id || "";
            setPrimaryId(nextPrimaryId);
            const nextSelected = rows.find((row) => row._id === company?._id) ||
                rows.find((row) => row._id === nextPrimaryId) ||
                rows[0];
            setSelectedVersionId(nextSelected?._id || "");
            setDraft(nextSelected);
        }
        catch (error) {
            displayError(error, "[Error] Failed to load company versions!");
        }
        finally {
            setLoading(false);
        }
    }, [baseCompanyId, company?._id, refreshCompanyOptions]);
    useEffect(() => {
        if (!isOpen)
            return;
        loadCompanies();
    }, [isOpen, loadCompanies]);
    useEffect(() => {
        if (!companies.length)
            return;
        const nextDraft = companies.find((row) => row._id === selectedVersionId);
        if (nextDraft)
            setDraft(nextDraft);
    }, [companies, selectedVersionId]);
    const selectedVersion = useMemo(() => companies.find((row) => row._id === selectedVersionId), [companies, selectedVersionId]);
    const selectedBaseRows = useMemo(() => sortCompanies(companies.filter((row) => getBaseCompanyId(row) === baseCompanyId)), [baseCompanyId, companies]);
    const persistedPrimaryVersion = useMemo(() => selectedBaseRows.find((row) => row.primary) || null, [selectedBaseRows]);
    const currentPrimaryId = primaryId || persistedPrimaryVersion?._id || "";
    const currentUsedVersionId = invoiceCompany?._id || "";
    const isDraftPrimary = Boolean(draft?._id && draft._id === currentPrimaryId);
    const isPersistedPrimary = Boolean(draft?._id && draft._id === persistedPrimaryVersion?._id);
    const isDraftUsed = Boolean(draft?._id && draft._id === currentUsedVersionId);
    const hasCompanyDetailsChanges = serializeCompanyDetails(selectedVersion) !== serializeCompanyDetails(draft);
    const groupedCompanies = useMemo(() => {
        const others = new Map<string, {
            title: string;
            rows: EditableCompany[];
        }>();
        companies.forEach((row) => {
            const rowBaseId = getBaseCompanyId(row);
            if (rowBaseId === baseCompanyId)
                return;
            const current = others.get(rowBaseId) || { title: row.name, rows: [] };
            current.rows.push(row);
            others.set(rowBaseId, current);
        });
        return {
            current: selectedBaseRows,
            others: Array.from(others.entries())
                .map(([groupId, group]) => ({
                groupId,
                title: group.title,
                rows: sortCompanies(group.rows),
            }))
                .sort((left, right) => left.title.localeCompare(right.title)),
        };
    }, [baseCompanyId, companies, selectedBaseRows]);
    const refreshCompanies = useCallback(async (selectedId?: string) => {
        const refreshed = sortCompanies(await refreshCompanyOptions());
        setCompanies(refreshed);
        const currentBaseId = getBaseCompanyId(refreshed.find((row) => row._id === selectedId) ||
            refreshed.find((row) => row._id === company?._id));
        const nextPrimaryId = refreshed.find((row) => getBaseCompanyId(row) === currentBaseId && row.primary)?._id || "";
        setPrimaryId(nextPrimaryId);
        const nextCurrent = refreshed.find((row) => row._id === selectedId) ||
            refreshed.find((row) => row._id === company?._id) ||
            refreshed[0];
        setSelectedVersionId(nextCurrent?._id || "");
        setDraft(nextCurrent);
        if (nextCurrent && currentUsedVersionId === selectedId) {
            onCompanyUpdate({
                ...nextCurrent,
                base_company: nextCurrent.base_company?._id || "",
            });
        }
    }, [company?._id, currentUsedVersionId, onCompanyUpdate, refreshCompanyOptions]);
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
    const createVersion = useCallback(async () => {
        if (!draft?._id)
            return;
        setSavingVersion(true);
        try {
            const created = await createCompanyVersion(draft._id, {
                name: draft.name,
                details: draft.details,
            });
            if (!created) {
                throw new Error("Company version creation returned no record");
            }
            await refreshCompanies(created._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to create company version!");
        }
        finally {
            setSavingVersion(false);
        }
    }, [draft, refreshCompanies]);
    const saveMetadata = useCallback(async () => {
        if (!draft?._id)
            return;
        setSavingMetadata(true);
        try {
            if (!currentPrimaryId) {
                throw new Error("A company family must keep exactly one primary version");
            }
            const previousPrimary = selectedBaseRows.find((row) => row._id === persistedPrimaryVersion?._id);
            if (!isDraftPrimary && isPersistedPrimary) {
                throw new Error("A company family must keep exactly one primary version");
            }
            if (previousPrimary?._id && previousPrimary._id !== currentPrimaryId) {
                await patchCompanyMetadata(previousPrimary._id, {
                    primary: false,
                    tags: previousPrimary.tags || [],
                });
            }
            const updated = await patchCompanyMetadata(draft._id, {
                primary: draft._id === currentPrimaryId,
                tags: draft.tags || [],
            });
            if (!updated) {
                throw new Error("Company metadata update returned no record");
            }
            await refreshCompanies(updated._id);
        }
        catch (error) {
            displayError(error, "[Error] Failed to update company metadata!");
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
        refreshCompanies,
        selectedBaseRows,
    ]);
    if (!isOpen)
        return null;
    return (<Card shadow="none" className="mt-4 overflow-hidden rounded-2xl border border-divider bg-background w-full">
      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-divider lg:border-b-0 lg:border-r">
          <div className="mb-1 flex items-center gap-2 px-4 pt-4 text-sm font-semibold text-foreground-600">
            <HistoryRoundedIcon fontSize="small"/>
            {(company?.name || "Emitter") + " Versions"}
          </div>
          <div className="mb-4 px-4 text-xs text-foreground-400">
            Pick an emitter version to inspect or edit.
          </div>

          {loading ? (<div className="flex h-48 items-center justify-center">
              <Spinner size="sm"/>
            </div>) : (<div className="flex max-h-[760px] flex-col overflow-y-auto">
              {groupedCompanies.current.map((version, idx) => (<Card isPressable key={version._id} onClick={() => setSelectedVersionId(version._id)} className={`rounded-none border-divider px-4 py-3 shadow-none border-t-1 ${idx === groupedCompanies.current.length - 1
                    ? "border-b-1"
                    : ""} ${version._id === selectedVersionId
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
                    <div className="mt-1 flex text-left text-xs text-foreground-500">
                      {version.details.address.country},{" "}
                      {version.details.address.city}
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
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground-600">
                <span>Company details</span>
                {draft?._id ? (<Chip size="sm" variant="flat" color={isDraftPrimary ? "warning" : "default"} startContent={isDraftPrimary ? (<StarRoundedIcon fontSize="inherit"/>) : null}>
                    {draft._id}
                  </Chip>) : null}
              </div>
              <div className="text-xs text-foreground-400">
                Create a new emitter version only when the company details
                changed.
              </div>
            </div>
          </div>

          {draft ? (<div className="space-y-4">
              <Card shadow="none" className="bg-default-50/70">
                <CardBody className="gap-4 p-4">
                  <Input isDisabled={viewMode === "read"} label="Company name" value={draft.name} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? { ...current, name: event.target.value }
                : current)}/>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input isDisabled={viewMode === "read"} label="Street" value={draft.details.address.street} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        address: {
                            ...current.details.address,
                            street: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="ZIP" value={draft.details.address.zip} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        address: {
                            ...current.details.address,
                            zip: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="City" value={draft.details.address.city} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        address: {
                            ...current.details.address,
                            city: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Country" value={draft.details.address.country} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        address: {
                            ...current.details.address,
                            country: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="VAT ID" value={draft.details.vat_id} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        vat_id: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Email" value={draft.details.contact.email} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        contact: {
                            ...current.details.contact,
                            email: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Phone" value={draft.details.contact.phone} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        contact: {
                            ...current.details.contact,
                            phone: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Fax" value={draft.details.contact.fax} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        contact: {
                            ...current.details.contact,
                            fax: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Website" value={draft.details.contact.website} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        contact: {
                            ...current.details.contact,
                            website: event.target.value,
                        },
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="IBAN" value={draft.details.iban} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        iban: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="BIC" value={draft.details.bic} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        bic: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Bank Name" value={draft.details.bank_name} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        bank_name: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Tax Number" value={draft.details.tax_number} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        tax_number: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Account Number" value={draft.details.account_number} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        account_number: event.target.value,
                    },
                }
                : current)}/>
                    <Input isDisabled={viewMode === "read"} label="Bank Code" value={draft.details.bank_code} classNames={{ inputWrapper: "bg-default-200/60" }} onChange={(event) => setDraft((current) => current
                ? {
                    ...current,
                    details: {
                        ...current.details,
                        bank_code: event.target.value,
                    },
                }
                : current)}/>
                  </div>
                </CardBody>
              </Card>

              <div className="flex items-center justify-between gap-3 border-t border-divider pt-4">
                <div className="text-xs text-foreground-400">
                  {hasCompanyDetailsChanges
                ? "Creating a new version preserves the existing company history."
                : "Update the company fields to create a new version."}
                </div>
                <div className="flex items-center gap-2">

                    <Button color="primary" disabled={viewMode === "read" ||
                !hasCompanyDetailsChanges ||
                savingVersion} onPress={createVersion}>
                    {savingVersion ? "Creating..." : "New Version"}
                  </Button>
                </div>
              </div>

              <div className="border-t border-divider pt-4">
                <div className="mb-2 text-sm font-semibold text-foreground-600">
                  Metadata
                </div>
                <div className="mb-4 text-xs text-foreground-400">
                  Save the current company family metadata without creating a
                  new version.
                </div>
                <Card shadow="none" className="bg-default-50/70">
                  <CardBody className="gap-4 p-4">
                    <Checkbox isDisabled={viewMode === "read" || !draft?._id} isSelected={isDraftUsed} onValueChange={(checked) => {
                if (!checked || !draft)
                    return;
                onCompanyUpdate({
                    ...draft,
                    base_company: draft.base_company?._id || "",
                });
            }}>
                      <div className="text-base">Use this version</div>
                      <div className="text-sm text-foreground-400">
                        {isDraftUsed
                ? "This emitter version is currently used by the invoice."
                : `Currently used: ${invoiceCompany?.name || "None"}`}
                      </div>
                    </Checkbox>

                    <Checkbox isDisabled={viewMode === "read" || !draft?._id} isSelected={isDraftPrimary} onValueChange={(checked) => {
                if (!draft?._id)
                    return;
                if (!checked && isPersistedPrimary)
                    return;
                setPrimaryId(checked ? draft._id : "");
            }}>
                      <div className="text-base">
                        Set this version as primary
                      </div>
                      <div className="text-sm text-foreground-400">
                        {isPersistedPrimary
                ? "This is the current primary version. Pick another version if you want to replace it."
                : `Current primary: ${persistedPrimaryVersion?.name || "None"}`}
                      </div>
                    </Checkbox>

                    <div>
                      <div className="mb-2 text-sm font-medium text-foreground-600">
                        Tags
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(draft.tags || []).map((tag) => (<Chip key={tag} size="sm" onClose={viewMode === "read"
                    ? undefined
                    : () => removeTag(tag)}>
                            {tag}
                          </Chip>))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input isDisabled={viewMode === "read"} value={tagInput} placeholder="Add a tag" classNames={{ inputWrapper: "bg-default-200/60" }} onValueChange={setTagInput} onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                }
            }}/>
                        <button type="button" disabled={viewMode === "read" || !tagInput.trim()} className="rounded-xl bg-default-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" onClick={addTag}>
                          +
                        </button>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <div className="mt-4 flex items-center justify-end gap-2">
                <Button onPress={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button color="primary" disabled={viewMode === "read" || savingMetadata} onPress={saveMetadata}>
                    {savingMetadata ? "Saving..." : "Save Metadata"}
                  </Button>
                </div>
              </div>
            </div>) : (<div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-divider text-sm text-foreground-400">
              Pick a company version to inspect.
            </div>)}
        </div>
      </div>
    </Card>);
}
