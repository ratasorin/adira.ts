import axios from "axios";
import type { MonefyAPI } from "@monefy/types";
type AllocationResponse = MonefyAPI["/api/base-invoices/allocate/:base_company_id"]["POST"]["ResponseBody"];
import { expectSuccess } from "../../services/api";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { useCallback, useEffect, useMemo, useState, Suspense, lazy, } from "react";
import ProductsTable from "./components/products/select-products";
import CompanySelect from "./components/emitter-company/select-company";
import CustomerSelect from "./components/receiving-customer/select-customer";
import { DatePicker } from "@heroui/date-picker";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
const PDFPreview = lazy(() => import("./components/pdf-preview"));
import { displayError } from "../../utils/handle-error";
import { useSearchParams } from "react-router-dom";
import { downloadPDF } from "../../utils/download-pdf";
import { DateValue, getLocalTimeZone, parseDate, today, } from "@internationalized/date";
import { Divider } from "@heroui/divider";
import { addToast, Spinner } from "@heroui/react";
import { useInvoices } from "../../context/invoice";
import { INVOICE_ID_SEARCH_PARAMS_KEY } from "../../constants";
import { api } from "../../services/api";
import { useProductsLines } from "./store/products";
import ModifiersViewersTable from "./components/modifiers-viewers/modifiers-viewers-table";
import { InvoiceSaveVersionGraph } from "./components/invoice-save-version-graph";
import { useInvoiceOperations } from "./store/operations";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { ReceiverVersionEditor } from "./components/receiving-customer/receiver-version-editor";
import { EmitterVersionEditor } from "./components/emitter-company/emitter-version-editor";
import { EmitterCompanyWarning } from "./components/emitter-company/warning";
import NotesEditor from "./components/notes-editor";
import { ReceivingCustomerWarning } from "./components/receiving-customer/warning";
import { InvoiceLanguageNotice, InvoiceLanguagePanel, } from "./components/language/invoice-language-panel";
import { useInvoiceLanguageController } from "./components/language/use-invoice-language-controller";
import { InvoiceProvider, useInvoice } from "./invoice-provider";
import type { DraftInvoiceAllocationScope, Invoice as InvoiceDetails, VIEW_MODE, } from "./invoice.types";
import { useInvoiceModifications } from "./use-invoice-modifications";
import { ReportedPeriod } from "./components/reported-period";
import { BranchConfirm } from "./components/invoice-number/branch-confirm";
import { PickForNew } from "./components/invoice-number/pick-for-new";
import { useInvoiceNumberController } from "./components/invoice-number/use-invoice-number";
import { useInvoicePreview } from "./use-invoice-preview";
import { SaveInvoiceActions } from "./components/save-invoice-actions";
const getBaseCustomerId = (customer?: InvoiceDetails["receiving_customer"]): string => {
    const baseCustomer = customer?.base_customer;
    if (typeof baseCustomer === "string") {
        return baseCustomer;
    }
    if (baseCustomer &&
        typeof baseCustomer === "object" &&
        "_id" in baseCustomer) {
        if (baseCustomer &&
            typeof baseCustomer === "object" &&
            "_id" in baseCustomer) {
            return String((baseCustomer as {
                _id?: string;
            })._id || "");
        }
    }
    return "";
};
const getExchangeRateToEUR = (fromCurrency?: string): number => {
    const rates: Record<string, number> = {
        RON: 0.2,
        USD: 0.92,
        GBP: 1.17,
        EUR: 1,
    };
    return rates[fromCurrency || "EUR"] || 1;
};
const getNetState = (productLines: ReturnType<typeof useProductsLines.getState>["rows"]) => {
    const currencies = [
        ...new Set(productLines.map((line) => line.product?.details.currency)),
    ].filter(Boolean);
    const targetCurrency = currencies.length === 1 ? currencies[0] : "EUR";
    const total = productLines.reduce((sum, line) => {
        const price = line.product?.details.unit_price || 0;
        const currency = line.product?.details.currency;
        if (targetCurrency === "EUR" && currency && currency !== "EUR") {
            return sum + price * line.quantity * getExchangeRateToEUR(currency);
        }
        return sum + price * line.quantity;
    }, 0);
    return {
        total: Math.round(total * 100) / 100,
        currency: targetCurrency,
    };
};
export default function Invoice() {
    return (<InvoiceProvider>
      <InvoiceContent />
    </InvoiceProvider>);
}
function InvoiceContent() {
    const [, setSearchParams] = useSearchParams();
    const { invoiceId, setInvoiceId, invoice, emittedDate, reportedPeriod, invoiceNumber, baseInvoiceId, setEmittedDate, company, customer, setCompany, setCustomer, initialProductLines, initialModifierLines, initialViewerLines, languageId, setLanguageId, currentLanguageId, currentLanguageCode, notes, setNotes, resetAllFields, } = useInvoice();
    const [changedCustomer, setChangedCustomer] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [emitterEditorOpen, setEmitterEditorOpen] = useState(false);
    const [receiverEditorOpen, setReceiverEditorOpen] = useState(false);
    const [emitterEditorCompany, setEmitterEditorCompany] = useState<InvoiceDetails["issuer_company"] | undefined>(undefined);
    const [pendingCompanySwitch, setPendingCompanySwitch] = useState<InvoiceDetails["issuer_company"] | undefined>(undefined);
    const [confirmCompanySwitchOpen, setConfirmCompanySwitchOpen] = useState(false);
    const baseCompanyId = useMemo(() => {
        return company?.base_company;
    }, [company?.base_company]);
    const { selectedLanguageCode, selectedLanguageName, handleNotesCommit, panelProps: languagePanelProps, notesMeta, } = useInvoiceLanguageController({
        invoiceId,
        baseInvoiceId,
        baseCompanyId,
        hasCompany: !!company,
        settingsOpen,
        notes,
        setNotes,
        languageId,
        setLanguageId,
        currentLanguageId,
        currentLanguageCode,
    });
    const { productLines, productsPayload, modifiersPayload, viewersPayload, hasInvoiceModifications, } = useInvoiceModifications();
    const netState = getNetState(productLines);
    const [viewMode, setViewMode] = useState<VIEW_MODE>(invoiceNumber > 0 ? "read" : "edit");
    const isBaseSaveDisabled = viewMode === "read" ||
        !company?._id ||
        !customer?._id ||
        !customer.details ||
        !customer.details.selected_name ||
        !customer.details.country ||
        !customer.details.city ||
        !customer.details.address ||
        !customer.details.cif ||
        !reportedPeriod ||
        productsPayload.length === 0;
    const { assignedInvoiceNumber, beginSaveAsDifferentNumber, canSaveAsDifferentNumber, completeSaveAsDifferentNumber, draftInvoiceAllocationScope, isDraftInvoiceNumberSaveBlocked, loadingPredictedInvoiceNumber, loadPredictedInvoiceNumber, predictedInvoiceNumber, saveAsInvoiceAllocationScope, saveAsInvoiceNumber, } = useInvoiceNumberController({
        baseCompanyId: baseCompanyId ? String(baseCompanyId) : undefined,
        companyId: company?._id,
        invoiceId,
        invoiceNumber,
        settingsOpen,
        isBaseSaveDisabled,
        hasInvoiceModifications,
    });
    const isSaveDisabled = isBaseSaveDisabled || isDraftInvoiceNumberSaveBlocked;
    const saveDisabledReason = useMemo(() => {
        if (!isSaveDisabled)
            return undefined;
        const reasons: string[] = [];
        if (viewMode === "read") {
            reasons.push("the invoice is in read mode");
        }
        if (!company?._id) {
            reasons.push("select an issuer company");
        }
        if (!customer?._id) {
            reasons.push("select a receiving customer");
        }
        else {
            const missingCustomerFields = [
                !customer.details && "details",
                !customer.details?.selected_name && "name",
                !customer.details?.country && "country",
                !customer.details?.city && "city",
                !customer.details?.address && "address",
                !customer.details?.cif && "CIF",
            ].filter(Boolean);
            if (missingCustomerFields.length > 0) {
                reasons.push(`complete customer ${missingCustomerFields.join(", ")}`);
            }
        }
        if (!reportedPeriod) {
            reasons.push("select a reported period");
        }
        if (productsPayload.length === 0) {
            reasons.push("add at least one product");
        }
        if (isDraftInvoiceNumberSaveBlocked) {
            reasons.push("confirm an available invoice number");
        }
        return reasons.length > 0
            ? `Cannot save yet: ${reasons.join("; ")}.`
            : "Cannot save this invoice yet.";
    }, [
        company?._id,
        customer,
        isDraftInvoiceNumberSaveBlocked,
        isSaveDisabled,
        productsPayload.length,
        reportedPeriod,
        viewMode,
    ]);
    const { formattedPdfData, loading, pdfData, error: previewError } = useInvoicePreview({
        assignedInvoiceNumber,
    });
    const onCustomerUpdate = useCallback((customer?: InvoiceDetails["receiving_customer"]) => {
        const currentInvoiceBaseCustomerId = getBaseCustomerId(invoice?.receiving_customer);
        const nextBaseCustomerId = getBaseCustomerId(customer);
        const isEditingExistingInvoice = Boolean(invoiceId && invoice?._id);
        if (isEditingExistingInvoice &&
            currentInvoiceBaseCustomerId &&
            nextBaseCustomerId &&
            currentInvoiceBaseCustomerId !== nextBaseCustomerId) {
            setChangedCustomer(true);
        }
        else {
            setChangedCustomer(false);
        }
        if (customer && customer.base_customer)
            setCustomer({
                ...customer,
                base_customer: customer.base_customer || "",
            });
    }, [setCustomer, setChangedCustomer, invoice, invoiceId]);
    const onCompanyUpdate = useCallback((newCompany?: InvoiceDetails["issuer_company"]) => {
        if (!newCompany) {
            setCompany(undefined);
            return;
        }
        const currentBaseId = company?.base_company;
        const nextBaseId = newCompany.base_company;
        const isEditingExistingInvoice = Boolean(invoiceId && invoice?._id);
        if (isEditingExistingInvoice &&
            company?._id &&
            currentBaseId &&
            nextBaseId &&
            currentBaseId !== nextBaseId) {
            setPendingCompanySwitch(newCompany);
            setConfirmCompanySwitchOpen(true);
            return;
        }
        setCompany(newCompany);
        setEmitterEditorCompany(newCompany);
    }, [company?.base_company, company?._id, invoice?._id, invoiceId, setCompany]);
    useEffect(() => {
        // default to read-only when loading an existing invoice
        setViewMode("edit");
    }, [invoiceNumber]);
    const { addInvoice } = useInvoices();
    const patchExistingInvoice = useCallback(async ({ showToast = true, toastTitle = "Invoice Successfully Modified", }: {
        showToast?: boolean;
        toastTitle?: string;
    } = {}) => {
        if (!invoiceId)
            throw new Error("Missing invoice id");
        if (!company?._id)
            throw new Error("Missing company");
        if (!customer?._id)
            throw new Error("Missing customer");
        if (!reportedPeriod)
            throw new Error("Missing reported period");
        const { run } = api("/invoices/:id", "PATCH")({
            data: {
                emitted_date: emittedDate.toISOString(),
                issuer_company: company._id,
                receiving_customer: customer._id,
                language: languageId,
                products: productsPayload,
                modifiers: modifiersPayload,
                notes,
                reported_period: reportedPeriod.toISOString(),
                viewers: viewersPayload,
            },
            query: {include: [], 
                rows: r => r({
                    select: ["_id"]
                })
            },
            path: { id: invoiceId },
        });
        const { newInvoiceId, summary } = await run().then(expectSuccess).then((res) => {
            return {
                summary: res.related,
                newInvoiceId: res?._id,
            };
        });
        if (newInvoiceId) {
            setSearchParams({
                [INVOICE_ID_SEARCH_PARAMS_KEY]: newInvoiceId,
            });
        }
        if (showToast && newInvoiceId && summary) {
            addToast({
                title: toastTitle,
                color: "success",
                timeout: 10000,
                description: `The following fields have been modified: ${summary.changes.map((s) => s.field)}! Please report inconsistencies!`,
            });
        }
        return { newInvoiceId, summary };
    }, [
        emittedDate,
        company,
        customer,
        reportedPeriod,
        languageId,
        productsPayload,
        modifiersPayload,
        notes,
        viewersPayload,
        invoiceId,
        setSearchParams,
    ]);
    const createInvoiceWithNumber = useCallback(async ({ allocationScope, invoiceNumber, toastTitle = "Invoice Successfully Saved", }: {
        allocationScope: DraftInvoiceAllocationScope;
        invoiceNumber?: number;
        toastTitle?: string;
    }) => {
        if (!company?._id)
            throw new Error("Missing company");
        if (!customer?._id)
            throw new Error("Missing customer");
        if (!reportedPeriod)
            throw new Error("Missing reported period");
        if (!baseCompanyId)
            throw new Error("Missing base company");
        const baseInvoice = expectSuccess((await axios.post<AllocationResponse>(
            `/api/base-invoices/allocate/${encodeURIComponent(baseCompanyId)}`, {},
            { params: { ...(invoiceNumber ? { index: invoiceNumber } : {}), allocationScope } },
        )).data);
        if (!baseInvoice) {
            throw new Error("Base invoice creation failed");
        }
        const { run } = api("/invoices", "POST")({
            data: {
                emitted_date: emittedDate.toISOString(),
                issuer_company: company._id,
                receiving_customer: customer._id,
                language: languageId,
                products: productsPayload,
                modifiers: modifiersPayload,
                notes,
                reported_period: reportedPeriod.toISOString(),
                viewers: viewersPayload,
                base_invoice: baseInvoice._id,
            },
            query: {
                include: [
                    "base_invoice",
                    "issuer_company",
                    "modifiers.modifier",
                    "products.product",
                    "receiving_customer",
                    "reporter",
                    "viewers.viewer",
                ],
                rows: r => r({
                    select: [] as []
                })
            },
        });
        const newInvoice = await run().then(expectSuccess).then((res) => res);
        if (!newInvoice) {
            throw new Error("Invoice creation failed");
        }
        setSearchParams({
            [INVOICE_ID_SEARCH_PARAMS_KEY]: newInvoice._id,
        });
        setInvoiceId(newInvoice._id);
        setChangedCustomer(false);
        addToast({
            title: toastTitle,
            color: "success",
            description: `Invoice ${newInvoice._id} has been successfully created!`,
        });
        addInvoice(newInvoice);
        return newInvoice;
    }, [
        addInvoice,
        baseCompanyId,
        company,
        customer,
        emittedDate,
        languageId,
        modifiersPayload,
        notes,
        productsPayload,
        reportedPeriod,
        setSearchParams,
        viewersPayload,
    ]);
    const createInvoiceRecord = useCallback(async () => {
        if (!invoiceId && !assignedInvoiceNumber) {
            throw new Error("Missing invoice number");
        }
        return createInvoiceWithNumber({
            allocationScope: draftInvoiceAllocationScope,
            invoiceNumber: invoiceId ? undefined : assignedInvoiceNumber,
        });
    }, [
        assignedInvoiceNumber,
        createInvoiceWithNumber,
        draftInvoiceAllocationScope,
        invoiceId,
    ]);
    const handleSaveAsDifferentNumber = useCallback(async () => {
        if (!canSaveAsDifferentNumber)
            return;
        try {
            await createInvoiceWithNumber({
                allocationScope: saveAsInvoiceAllocationScope,
                invoiceNumber: saveAsInvoiceNumber,
                toastTitle: "Invoice Saved Under New Number",
            });
            completeSaveAsDifferentNumber();
        }
        catch (error) {
            displayError(error, "[Error] Cannot save invoice under new number!");
        }
    }, [
        canSaveAsDifferentNumber,
        completeSaveAsDifferentNumber,
        createInvoiceWithNumber,
        saveAsInvoiceAllocationScope,
        saveAsInvoiceNumber,
    ]);
    const handleSaveAsNew = useCallback(async () => {
        if (isSaveDisabled || !invoiceId || !hasInvoiceModifications)
            return;
        try {
            await createInvoiceWithNumber({
                allocationScope: "global",
                toastTitle: "Invoice Saved as New",
            });
        }
        catch (err) {
            displayError(err, "[Error] Cannot save invoice as new!");
        }
    }, [
        createInvoiceWithNumber,
        hasInvoiceModifications,
        invoiceId,
        isSaveDisabled,
    ]);
    const handleSaveInvoice = useCallback(async () => {
        if (isSaveDisabled)
            return;
        if (invoiceId) {
            try {
                if (changedCustomer) {
                    await createInvoiceRecord();
                }
                else {
                    await patchExistingInvoice();
                }
            }
            catch (err) {
                displayError(err, "[Error] Cannot modify invoice!");
            }
            return;
        }
        try {
            await createInvoiceRecord();
        }
        catch (err) {
            displayError(err, "[Error] Cannot create invoice!");
        }
    }, [
        changedCustomer,
        createInvoiceRecord,
        invoiceId,
        isSaveDisabled,
        patchExistingInvoice,
    ]);
    const confirmEmitterSwitch = useCallback(() => {
        if (!pendingCompanySwitch)
            return;
        setConfirmCompanySwitchOpen(false);
        setPendingCompanySwitch(undefined);
        setSettingsOpen(false);
        setReceiverEditorOpen(false);
        setChangedCustomer(false);
        setSearchParams({});
        setInvoiceId("");
        resetAllFields();
        useProductsLines.getState().init([]);
        useInvoiceOperations.getState().init([]);
        window.setTimeout(() => {
            setCompany(pendingCompanySwitch);
            setEmitterEditorCompany(pendingCompanySwitch);
            setEmitterEditorOpen(true);
        }, 120);
    }, [pendingCompanySwitch, resetAllFields, setSearchParams, setCompany]);
    useEffect(() => {
        if (!company?._id) {
            setEmitterEditorCompany(undefined);
            return;
        }
        setEmitterEditorCompany((current) => current?._id === company._id ? current : company);
    }, [company]);
    return (<>
      <BranchConfirm hasInvoiceModifications={hasInvoiceModifications} canSave={canSaveAsDifferentNumber} onSave={handleSaveAsDifferentNumber}/>

      <EmitterCompanyWarning isOpen={confirmCompanySwitchOpen} onOpenChange={(open) => {
            setConfirmCompanySwitchOpen(open);
            if (!open) {
                setPendingCompanySwitch(undefined);
            }
        }} currentCompanyName={company?.name} nextCompanyName={pendingCompanySwitch?.name} onConfirm={confirmEmitterSwitch}/>

      <div className="flex w-full @6xl:items-start items-center gap-6 h-full flex-col @6xl:flex-row justify-center">
        <Card shadow="none" className="flex-1 w-full max-w-3xl">
          <CardBody>
            <span className="flex @xl:items-center gap-3 mb-8 @xl:flex-row flex-col">
              <span className="flex flex-row items-center justify-between gap-3 w-full">
                <span className="flex flex-row items-center gap-3">
                  <h2 className="text-2xl font-semibold">
                    {invoiceNumber ? (<>Invoice #{invoiceNumber} Details</>) : (<>Create new Invoice</>)}
                  </h2>

                  {invoiceNumber ? (<>
                      <Divider orientation="vertical" className="h-6"/>
                      <span className="text-foreground-400 ">
                        {viewMode === "read" ? (<span className="flex flex-row gap-2 items-center">
                            READ ONLY <LockIcon fontSize="small"/>
                          </span>) : (<span className="flex flex-row gap-2 items-center">
                            EDIT <EditIcon fontSize="small"/>
                          </span>)}
                      </span>
                    </>) : (<></>)}
                </span>

                {invoiceNumber || !invoiceId ? (<Popover placement="bottom-end" isOpen={settingsOpen} onOpenChange={setSettingsOpen} shouldCloseOnBlur={false} offset={12} portalContainer={document.querySelector('[data-container="layout-parent"]')!}>
                    <PopoverTrigger>
                      <Button isIconOnly variant="flat" color="primary" className="ml-auto">
                        <SettingsRoundedIcon fontSize="small"/>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 border border-divider shadow-md bg-background rounded-2xl">
                      {viewMode === "read" ? (<Button color="primary" variant="flat" className="w-full font-semibold" onPress={() => {
                    setViewMode("edit");
                    setSettingsOpen(false);
                }}>
                          Edit
                        </Button>) : (<div className="flex flex-col w-96">
                          <div className="px-2 py-2 text-sm font-semibold text-foreground-500">
                            Modify Invoice Metadata
                          </div>

                          <div className="flex flex-col">
                            {invoiceId ? (<div className="px-2 pb-3 @6xl/layout-parent:hidden">
                                <InvoiceSaveVersionGraph invoiceId={invoiceId}/>
                              </div>) : null}

                            {!invoiceId ? <PickForNew /> : null}

                            <div className="px-3 pb-3">
                              <DatePicker label="Emitted Date" labelPlacement="outside" onChange={(date: DateValue | null) => {
                    if (date) {
                        const jsDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
                        setEmittedDate(jsDate);
                    }
                }} value={emittedDate
                    ? parseDate(new Date(emittedDate)
                        .toISOString()
                        .split("T")[0])
                    : today(getLocalTimeZone())}/>
                            </div>

                            <InvoiceLanguagePanel {...languagePanelProps}/>
                          </div>
                        </div>)}
                    </PopoverContent>
                  </Popover>) : null}
              </span>
            </span>

            <h2 className="text-xl font-semibold mb-2">Emitter</h2>
            <div className="flex items-start gap-2 flex-col">
              <div className="w-full">
                <CompanySelect viewMode={viewMode} defaultCompany={company} onCompanyUpdate={onCompanyUpdate} onCompanyEditRequest={(nextCompany) => {
            setEmitterEditorCompany(nextCompany);
            setEmitterEditorOpen(true);
        }}></CompanySelect>
              </div>
              <EmitterVersionEditor viewMode={viewMode} company={emitterEditorCompany} invoiceCompany={company} onCompanyUpdate={onCompanyUpdate} isOpen={emitterEditorOpen} onOpenChange={setEmitterEditorOpen}/>
            </div>

            <span className="mb-8"></span>

            <h2 className="text-xl font-semibold mb-2">Receiver</h2>
            <div className="flex items-start gap-2 flex-col">
              <div className="w-full">
                <CustomerSelect viewMode={viewMode} defaultCustomer={customer} onCustomerUpdate={onCustomerUpdate} onCustomerEditRequest={(nextCustomer) => {
            onCustomerUpdate(nextCustomer);
            setReceiverEditorOpen(true);
        }}></CustomerSelect>
              </div>
              {changedCustomer ? (<ReceivingCustomerWarning assignedInvoiceNumber={assignedInvoiceNumber} currentCustomerName={invoice?.receiving_customer?.details.selected_name} nextCustomerName={customer?.details.selected_name} loadingPredictedInvoiceNumber={loadingPredictedInvoiceNumber} onPredictedInvoiceNumberOpen={loadPredictedInvoiceNumber} predictedInvoiceNumber={predictedInvoiceNumber}/>) : null}
              <ReceiverVersionEditor viewMode={viewMode} customer={customer} onCustomerUpdate={onCustomerUpdate} isOpen={receiverEditorOpen} onOpenChange={setReceiverEditorOpen}/>
            </div>

            <span className="mb-4"></span>

            <ReportedPeriod viewMode={viewMode}/>

            <ProductsTable viewMode={viewMode} baseCompanyId={company?.base_company} initialProductLines={initialProductLines} total={netState.total}/>

            <ModifiersViewersTable viewMode={viewMode} productLines={productLines} initialModifierLines={initialModifierLines} initialViewerLines={initialViewerLines} netTotal={netState.total} netCurrency={netState.currency} selectedLanguageCode={selectedLanguageCode} selectedLanguageName={selectedLanguageName}/>

            <div className="mt-6">
              <InvoiceLanguageNotice {...notesMeta}/>
              <NotesEditor initialValue={notes} disabled={viewMode === "read"} onCommit={handleNotesCommit}/>
            </div>

            <SaveInvoiceActions disabledReason={saveDisabledReason} hasInvoiceModifications={hasInvoiceModifications} invoiceId={invoiceId} isSaveDisabled={isSaveDisabled} onSave={handleSaveInvoice} onSaveAsDifferentNumber={beginSaveAsDifferentNumber} onSaveAsNew={handleSaveAsNew}/>
          </CardBody>
        </Card>

        <div className="flex-1 max-w-xl flex flex-col justify-between p-3 gap-6 2xl:w-full">
          <div className="hidden @6xl:flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Version Graph</h2>
              <span className="text-sm text-foreground-400">
                Track invoice revisions before previewing the document.
              </span>
            </div>
            <InvoiceSaveVersionGraph invoiceId={invoiceId}/>
          </div>

          <h2 className="text-2xl font-semibold mb-4">Preview</h2>

          <Suspense fallback={<p>Loading PDF...</p>}>
            <div className="relative">
              {loading ? (<div className="absolute w-full h-full bg-black/50 flex items-center justify-center">
                  <Spinner variant="spinner" size="lg" color="white"></Spinner>
                </div>) : null}
              {previewError && <p role="alert" className="text-danger text-sm">{previewError}</p>}
              <PDFPreview data={formattedPdfData}/>
            </div>
          </Suspense>
          <Button color="primary" onPress={() => {
            downloadPDF(pdfData, invoiceId);
        }}>
            Print Document
          </Button>
        </div>
      </div>
    </>);
}
