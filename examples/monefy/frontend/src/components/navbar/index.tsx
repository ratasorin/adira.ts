import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useAuth } from "../../context/auth";
import { useNavigate } from "react-router-dom";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ExitToAppRoundedIcon from "@mui/icons-material/ExitToAppRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, } from "@heroui/dropdown";
import Divider from "@mui/material/Divider";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Link } from "@heroui/link";
import { displayError } from "../../utils/handle-error";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { addToast } from "@heroui/toast";
import { FilterButton } from "../filter/filter-button";
import { useFilteredData } from "../filter/filter-list";
import { InvoiceNavbarCard } from "./invoice-item";
import { DockRoundedIcon } from "./assets/dock-rounded.icon";
import { SidebarToggle } from "./toggled-sidebar";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import RoleChip from "../role";
import { useInvoices } from "../../context/invoice";
import { getBaseCompanyId } from "../../utils/company";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            const res = await logout();
            navigate("/login");
            addToast({ title: res, color: "success" });
        }
        catch (err) {
            displayError(err);
        }
    };
    const [open, setOpen] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const onSidebarClick = useCallback(() => {
        setOpen((o) => !o);
    }, [setOpen]);
    const { invoices, invoiceIdsByIssuer } = useInvoices();
    const [filteredInvoices, invoiceFilterProps] = useFilteredData({
        data: invoices.map((i) => ({
            _id: i._id,
            base_invoice_id: i.base_invoice?._id || "",
            issuer_company: {
                _id: i.issuer_company?._id || "",
                base_company: i.issuer_company?.base_company || "",
                name: i.issuer_company?.name || "",
                logo: i.issuer_company?.details.assets.logo || "",
            },
            receiving_customer: {
                details: {
                    selected_name: i.receiving_customer?.details.selected_name || "",
                },
            },
            products: i.products.map((p) => ({
                product: { name: p.product?.name || "" },
            })),
            emitted_date: new Date(i.emitted_date),
            currency: i.currency,
            total: i.total,
            index: i.base_invoice?.index || 0,
        })),
        fields: [
            {
                key: "issuer_company",
                icon: (<LocalShippingRoundedIcon className="text-foreground-400" fontSize="small"/>),
                mode: "SEARCH" as const,
                value: (item: {
                    _id: string;
                    name: string;
                    logo: string;
                }) => item?.name,
            },
            {
                key: "receiving_customer",
                icon: (<StoreRoundedIcon className="text-foreground-400" fontSize="small"/>),
                mode: "MULTIPLE" as const,
                value: (item: {
                    details: {
                        selected_name: string;
                    };
                }) => item?.details.selected_name,
            },
            {
                key: "products",
                mode: "MULTIPLE" as const,
                value: (v: {
                    product: {
                        name: string;
                    } | null;
                }[]) => [
                    ...new Set(v.map((entry) => entry?.product?.name || "")),
                ],
            },
            {
                key: "emitted_date",
                mode: "RANGE" as const,
                renderKey: () => "Date Emitted",
                renderMax: (v: string) => new Date(Number(v)).toLocaleDateString(),
                renderMin: (v: string) => new Date(Number(v)).toLocaleDateString(),
                value: (v: Date) => new Date(v).getTime(),
                icon: (<CalendarMonthRoundedIcon className="text-foreground-400" fontSize="small"/>),
            },
        ],
        RenderUnit: () => null,
    });
    const groupedInvoices = useMemo(() => {
        const invoicesById = Object.fromEntries(filteredInvoices.map((invoice) => [invoice._id, invoice]));
        const consumedIds = new Set<string>();
        const groups = Object.entries(invoiceIdsByIssuer)
            .map(([baseCompanyId, ids]) => {
            const items = ids
                .map((id) => invoicesById[id])
                .filter(Boolean)
                .sort((left, right) => new Date(right.emitted_date).getTime() -
                new Date(left.emitted_date).getTime());
            items.forEach((item) => consumedIds.add(item._id));
            if (!items.length) {
                return null;
            }
            return {
                baseCompanyId,
                company: items[0]!.issuer_company,
                invoices: items,
            };
        })
            .filter(Boolean) as Array<{
            baseCompanyId: string;
            company: {
                _id: string;
                base_company: string | {
                    _id: string;
                } | null;
                name: string;
                logo: string;
            };
            invoices: typeof filteredInvoices;
        }>;
        const ungroupedMap = new Map<string, {
            baseCompanyId: string;
            company: {
                _id: string;
                base_company: string | {
                    _id: string;
                } | null;
                name: string;
                logo: string;
            };
            invoices: typeof filteredInvoices;
        }>();
        for (const invoice of filteredInvoices) {
            if (consumedIds.has(invoice._id))
                continue;
            const baseCompanyId = getBaseCompanyId(invoice.issuer_company) ||
                invoice.issuer_company._id ||
                "unknown";
            const existing = ungroupedMap.get(baseCompanyId);
            if (existing) {
                existing.invoices.push(invoice);
            }
            else {
                ungroupedMap.set(baseCompanyId, {
                    baseCompanyId,
                    company: invoice.issuer_company,
                    invoices: [invoice],
                });
            }
        }
        return [...groups, ...ungroupedMap.values()].sort((left, right) => left.company.name.localeCompare(right.company.name));
    }, [filteredInvoices, invoiceIdsByIssuer]);
    const toggleGroup = useCallback((issuerId: string) => {
        setCollapsedGroups((current) => ({
            ...current,
            [issuerId]: !current[issuerId],
        }));
    }, []);
    console.log({ groupedInvoices });
    return (<>
      <AnimatePresence>
        {open ? (<Toolbar component={motion.div} transition={{
                duration: 0.2,
                ease: "easeInOut",
            }} initial={{
                opacity: 0,
                x: -100,
            }} animate={{
                opacity: 1,
                x: 0,
            }} exit={{
                opacity: 0,
                x: -100,
            }} className="w-96" sx={{
                display: "flex",
                justifyContent: "space-between",
                flexDirection: "column",
                alignItems: "start",
                width: "auto",
                minWidth: "460px",
                height: "100vh",
                maxWidth: "min-content",
                padding: "32px !important",
            }}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                width: "100%",
                flex: 1,
                height: 0,
            }}>
              <div style={{
                display: "flex",
                gap: "24px",
                alignItems: "start",
                flexDirection: "column",
                width: "100%",
            }}>
                <div style={{
                display: "flex",
                gap: "64px",
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                  <Link href="/" style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
            }}>
                    <PaidRoundedIcon style={{ color: "#598c75", fontSize: 32 }}/>
                    <Typography variant="h2" sx={{
                fontWeight: 600,
                color: "black",
                fontSize: "1.5rem",
            }}>
                      monefy
                    </Typography>
                  </Link>
                  <Tooltip content="Close Sidebar" placement="right" closeDelay={0}>
                    <Button aria-label="Close Sidebar" isIconOnly variant="light" onPress={onSidebarClick}>
                      <DockRoundedIcon />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <Divider flexItem orientation="horizontal"></Divider>

              <div className="w-full flex items-center justify-between mt-2 gap-5">
                <Typography variant="body2" className="text-foreground-500 font-medium tracking-wide items-center flex gap-2">
                  <DescriptionOutlinedIcon className="text-medium!"/> Invoices
                </Typography>
                <div className="flex items-center gap-2 flex-1">
                  <Button color="primary" startContent={<AddRoundedIcon />} className="font-semibold flex-1" variant="flat" onPress={() => {
                navigate("/");
            }}>
                    Create
                  </Button>
                </div>
                <FilterButton {...invoiceFilterProps}/>
              </div>

              <div className="min-h-0 w-full mt-2 rounded-2xl bg-foreground-50/70 border-1 border-divider p-3">
                <ScrollShadow className="h-full overflow-y-auto" hideScrollBar style={{ scrollbarGutter: "stable" }}>
                  <div className="flex w-full min-w-0 flex-col gap-4">
                    {groupedInvoices.map((group) => (<section key={group.baseCompanyId} className="w-full min-w-0 overflow-hidden rounded-2xl border border-divider bg-background/85 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                        <button type="button" onClick={() => toggleGroup(group.baseCompanyId)} className={`grid w-full min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition hover:bg-default-50/80 ${collapsedGroups[group.baseCompanyId]
                    ? ""
                    : "border-b border-divider/70"}`}>
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-divider bg-background">
                            {group.company.logo ? (<img src={`/api/assets/${group.company.logo}`} alt={group.company.name} className="h-full w-full object-cover"/>) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">
                              {group.company.name || "Unknown emitter"}
                            </div>
                            <div className="mt-0.5 text-xs text-foreground-400">
                              {group.invoices.length} invoice
                              {group.invoices.length === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="rounded-full bg-default-100 px-2 py-1 text-[11px] font-medium text-foreground-500 whitespace-nowrap">
                              {collapsedGroups[group.baseCompanyId]
                    ? "Hidden"
                    : "Open"}
                            </div>
                            <KeyboardArrowDownRoundedIcon className={`transition ${collapsedGroups[group.baseCompanyId]
                    ? "-rotate-90"
                    : "rotate-0"}`}/>
                          </div>
                        </button>
                        <div aria-hidden={collapsedGroups[group.baseCompanyId]} className={`flex w-full min-w-0 flex-col gap-3 overflow-hidden transition-[max-height,opacity,padding,visibility] duration-200 ${collapsedGroups[group.baseCompanyId]
                    ? "invisible max-h-0 py-0 opacity-0 pointer-events-none"
                    : "visible opacity-100"}`}>
                          {group.invoices.map((item, idx) => (<InvoiceNavbarCard company={{
                        logoUrl: item.issuer_company?.logo || "",
                        name: item.issuer_company?.name || "",
                    }} currency={item.currency || "EUR"} customerName={item.receiving_customer?.details
                        .selected_name || ""} emmitedDate={item.emitted_date} id={item._id} baseInvoiceId={item.base_invoice_id} number={item.index} total={item.total} isLast={idx === group.invoices.length - 1} key={item._id}/>))}
                        </div>
                      </section>))}
                  </div>
                </ScrollShadow>
              </div>
            </div>

            {user && (<div className="w-full flex flex-col gap-4">
                <Divider flexItem orientation="horizontal"></Divider>
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    justifyContent: "flex-end",
                    gap: "24px",
                }}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                }}>
                    <Typography variant="body1">{user.email}</Typography>
                    <Typography variant="body2" className="text-zinc-400 flex gap-2">
                      {user.username} &bull;{" "}
                      <RoleChip role={user.role}></RoleChip>
                    </Typography>
                  </div>
                  <Dropdown placement="right-end" style={{ marginLeft: "12px" }}>
                    <DropdownTrigger>
                      <Button aria-label="Account menu" radius="full" className="text-3xl items-start" isIconOnly variant="solid" color="primary">
                        {user.username.slice(0, 1)}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Static Actions">
                      <DropdownItem onPress={() => navigate("/profile")} key="profile" startContent={<PersonRoundedIcon />}>
                        Profile
                      </DropdownItem>
                      <DropdownItem onPress={() => {
                    handleLogout();
                }} key="delete" className="text-danger" color="danger" startContent={<ExitToAppRoundedIcon />}>
                        Logout
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </Box>
              </div>)}
          </Toolbar>) : (<SidebarToggle toggleMenu={onSidebarClick}/>)}
      </AnimatePresence>
    </>);
};
export default Navbar;
