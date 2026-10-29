import { expectSuccess } from "../../services/api";
import { Card } from "@heroui/card";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Avatar } from "@heroui/avatar";
import { useEffect, useMemo, useState } from "react";
import { stringToColor } from "../../utils/colors";
import { Button, Chip, Spinner } from "@heroui/react";
import { ChevronDown, ArrowUpRight, Calendar, BanknoteArrowUp, Home, Package, NotepadText, Tags, SquareSigma, Building2, } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { api } from "../../services/api";
import { displayError } from "../../utils/handle-error";
import { addToast } from "@heroui/toast";
const formatDateToYYMMDD = (date: Date): string => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yy}/${mm}/${dd}`;
};
type InvoiceChange = {
    field: string;
    type: "modification" | "addition" | "removal";
};
type ChangeLogRow = {
    base_invoice: string | {
        _id: string;
    };
    version: number;
    changes: InvoiceChange[];
    changed_by?: string | {
        _id: string;
        username?: string;
        email?: string;
    };
    changed_at: string | Date;
};
type InvoiceVersionRow = {
    _id: string;
    version?: number;
};
const formatHistoryDate = (value: string | Date): string => {
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};
const uniq = <T,>(arr: T[]) => [...new Set(arr)];
const summarizeChangeFields = (changes: InvoiceChange[]) => {
    const categories = uniq(changes.map((c) => {
        const f = c.field || "";
        if (f.startsWith("issuer_company"))
            return "Emitter";
        if (f.startsWith("receiving_customer"))
            return "Receiver";
        if (f.startsWith("notes"))
            return "Notes";
        if (f.startsWith("products"))
            return "Product";
        if (f.toLowerCase().includes("reported"))
            return "Reported Period";
        if (f.startsWith("modifiers"))
            return "Modifiers";
        if (f.startsWith("viewers"))
            return "Viewers";
        return f.split(".")[0] || "Other";
    })).filter(Boolean);
    return categories;
};
const getPrimaryVerb = (changes: InvoiceChange[]) => {
    const types = uniq(changes.map((c) => c.type));
    if (types.length === 1) {
        if (types[0] === "addition")
            return "Added";
        if (types[0] === "removal")
            return "Removed";
    }
    // Treat "modification" as Changed/Updated (same meaning in UI)
    return "Changed";
};
export interface InvoiceNavbarCardProps {
    customerName: string;
    id: string;
    baseInvoiceId: string;
    number: number;
    total: number;
    currency: string;
    emmitedDate: Date;
    company: {
        logoUrl: string;
        name: string;
    };
    isLast?: boolean;
}
export const InvoiceNavbarCard = ({ customerName, id, baseInvoiceId, number, total, currency, emmitedDate, company, isLast = false, }: InvoiceNavbarCardProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const customerColor = useMemo(() => stringToColor(customerName), [customerName]);
    const selectedInvoiceId = useMemo(() => {
        const v = new URLSearchParams(location.search).get("invoice_id");
        return v || "";
    }, [location.search]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyRows, setHistoryRows] = useState<ChangeLogRow[]>([]);
    const [versionToInvoiceId, setVersionToInvoiceId] = useState<Record<number, string>>({});
    useEffect(() => {
        if (!historyOpen)
            return;
        if (!baseInvoiceId)
            return;
        if (historyRows.length)
            return;
        setHistoryLoading(true);
        Promise.all([
            api("/changelog", "GET")({
                query: {
                    include: ["changed_by"],
                    where: { base_invoice: { $eq: baseInvoiceId } },
                    rows: r => r({
                        select: [] as []
                    })
                },
            }).run().then(expectSuccess).then((res) => res?.rows as ChangeLogRow[] | undefined),
            api("/invoices", "GET")({
                query: {include: [], 
                    where: { base_invoice: { $eq: baseInvoiceId } },
                    rows: r => r({
                        select: ["_id", "version", "base_invoice"]
                    })
                },
            }).run().then(expectSuccess).then((res) => res?.rows as InvoiceVersionRow[] | undefined),
        ])
            .then(([logs, versions]) => {
            const sorted = [...(logs || [])].sort((a, b) => b.version - a.version);
            setHistoryRows(sorted);
            const map: Record<number, string> = {};
            for (const inv of versions || []) {
                if (typeof inv.version === "number")
                    map[inv.version] = inv._id;
            }
            setVersionToInvoiceId(map);
        })
            .catch((e) => {
            displayError(e, "[Error] Fetch invoice history");
        })
            .finally(() => setHistoryLoading(false));
    }, [baseInvoiceId, historyOpen, historyRows.length, id, number]);
    const navigateToInvoice = (invoiceId: string) => {
        const searchParams = new URLSearchParams({ invoice_id: invoiceId });
        navigate(`/?${searchParams.toString()}`);
    };
    return (<Card onPress={() => {
            navigateToInvoice(id);
        }} isPressable className={`w-full rounded-none border-0 bg-transparent shadow-none flex flex-col gap-3 px-5 py-4 text-sm ${isLast ? "" : "border-b border-divider/70"}`}>
      <span className="flex flex-row w-full justify-between gap-8 font-medium text-foreground-400 items-center">
        <Popover placement="bottom-start" isOpen={historyOpen} onOpenChange={setHistoryOpen} offset={12} shouldCloseOnBlur={false}>
          <PopoverTrigger>
            <Button color="primary" className="rounded-md font-semibold h-8 px-2 tracking-wide" endContent={<ChevronDown />}>
              #{number}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-2 border border-divider min-w-[420px] shadow-md bg-background rounded-2xl">
            <div className="flex flex-col gap-3 w-full">
              <div className="text-sm px-2 py-1 text-default-500">
                Reviews History
              </div>
              {historyLoading ? (<div className="py-6 w-full flex items-center justify-center">
                  <Spinner size="sm"/>
                </div>) : historyRows.length ? (<div className="flex flex-col gap-2">
                  {historyRows.map((row, idx) => {
                const verb = getPrimaryVerb(row.changes || []);
                const fields = summarizeChangeFields(row.changes || []);
                const fieldTokens = fields.map((label) => {
                    if (label === "Modifiers")
                        return { label, Icon: Tags as unknown as typeof Tags };
                    if (label === "Viewers")
                        return {
                            label,
                            Icon: SquareSigma as unknown as typeof SquareSigma,
                        };
                    if (label === "Emitter")
                        return {
                            label,
                            Icon: Building2 as unknown as typeof Building2,
                        };
                    if (label === "Receiver")
                        return { label, Icon: Home as unknown as typeof Home };
                    if (label === "Notes")
                        return {
                            label,
                            Icon: NotepadText as unknown as typeof NotepadText,
                        };
                    if (label === "Product")
                        return {
                            label,
                            Icon: Package as unknown as typeof Package,
                        };
                    if (label === "Reported Period")
                        return {
                            label,
                            Icon: Calendar as unknown as typeof Calendar,
                        };
                    return { label, Icon: null as null };
                });
                const userLabel = typeof row.changed_by === "object" && row.changed_by
                    ? row.changed_by.username ||
                        row.changed_by.email ||
                        "Unknown"
                    : "Unknown";
                const invoiceIdForVersion = versionToInvoiceId[row.version];
                const selected = selectedInvoiceId
                    ? invoiceIdForVersion === selectedInvoiceId
                    : invoiceIdForVersion === id;
                return (<button key={`${row.version}-${idx}`} type="button" className={`w-full text-left rounded-xl px-3 py-2 ${selected
                        ? "border-primary-200 bg-primary-50"
                        : "border-divider bg-transparent hover:bg-foreground-50"}`} onClick={() => {
                        if (invoiceIdForVersion) {
                            navigateToInvoice(invoiceIdForVersion);
                        }
                        else {
                            addToast({
                                color: "warning",
                                title: "This version is unavailable",
                            });
                        }
                    }}>
                        <div className="flex items-center gap-3">
                          <Chip size="sm" variant={selected ? "flat" : "bordered"} color={selected ? "secondary" : "default"} className="justify-center border-1">
                            v{row.version}.0
                          </Chip>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="font-semibold text-foreground truncate flex items-center gap-2">
                              <span className="text-primary-600">{verb}</span>
                              {fieldTokens.length ? (<span className="flex items-center gap-1 text-default-800 font-semibold">
                                  {fieldTokens.map((t, i) => (<span key={`${t.label}-${i}`} className="inline-flex items-center gap-1">
                                      {t.Icon ? <t.Icon size={16}/> : null}
                                      {t.label}
                                      {i < fieldTokens.length - 2 ? (<span className="text-default-400 font-medium">
                                          {","}
                                        </span>) : i === fieldTokens.length - 2 ? (<span className="text-default-400 font-medium">
                                          {"and"}
                                        </span>) : null}
                                    </span>))}
                                </span>) : null}
                            </div>
                            <div className="text-xs text-default-400">
                              {userLabel} • {formatHistoryDate(row.changed_at)}
                            </div>
                          </div>
                        </div>
                      </button>);
            })}
                </div>) : (<div className="text-sm text-default-400 px-4 pb-4">
                  No history found for this invoice.
                </div>)}
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex flex-col items-start">
          <span>Emitted</span>
          <span className="flex items-center font-semibold gap-2 text-foreground-700 tracking-wide">
            <Calendar className="stroke-blue-600" size={16}/>{" "}
            {formatDateToYYMMDD(emmitedDate)}
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span>Total</span>
          <span className="flex items-center font-semibold gap-2 text-foreground-700 tracking-wide">
            <BanknoteArrowUp className="stroke-emerald-600" size={16}/> {total}
            {currency}
          </span>
        </div>

        <ArrowUpRight />
      </span>
      <div className="flex flex-col gap-3">
        <div className="font-semibold flex flex-row gap-3 items-center justify-between">
          <span className="flex flex-row gap-3 items-center text-left text-lg">
            <img src={`/api/assets/${company.logoUrl}`} alt="company logo" className="rounded-lg w-10"/>
            {company.name}
          </span>
          <ArrowForwardRoundedIcon className="text-foreground-400"/>
        </div>
        <div className="font-semibold flex flex-row gap-3 items-center justify-between">
          <span className="flex flex-row gap-3 items-center text-left text-lg">
            <Avatar name={customerName} radius="sm" classNames={{
            name: "font-bold",
        }} style={{
            color: customerColor.text,
            background: customerColor.background,
        }}/>
            {customerName}
          </span>
          <ArrowBackRoundedIcon className="text-foreground-400"/>
        </div>
      </div>
    </Card>);
};
