import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Select, SelectItem, SelectSection, SelectedItems, } from "@heroui/select";
import { Avatar, Button, Chip } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice, VIEW_MODE } from "../../invoice.types";
import { getBaseCompanyId } from "../../../../utils/company";
import { displayError } from "../../../../utils/handle-error";
import { stringToColor } from "../../../../utils/colors";
import type { Company } from "./companies.api";
import { sortCompaniesByDate, useEmitterCompanies } from "./use-companies";
import { useInvoice } from "../../invoice-provider";
export default function CompanySelect({ onCompanyUpdate, onCompanyEditRequest, defaultCompany, viewMode, }: {
    defaultCompany: Invoice["issuer_company"] | undefined;
    onCompanyUpdate: (company?: Invoice["issuer_company"]) => void;
    onCompanyEditRequest?: (company: Invoice["issuer_company"]) => void;
    viewMode: VIEW_MODE;
}) {
    const [selectedCompany, setSelectedCompany] = useState<Invoice["issuer_company"] | undefined>(defaultCompany);
    const companies = useEmitterCompanies((state) => state.companies);
    const refreshCompanies = useEmitterCompanies((state) => state.refreshCompanies);
    const invoiceId = useInvoice().invoiceId;
    useEffect(() => {
        setSelectedCompany(defaultCompany);
    }, [defaultCompany]);
    useEffect(() => {
        const loadCompanies = () => {
            void refreshCompanies().catch((err) => displayError(err, "[Error] Cannot fetch companies!"));
        };
        loadCompanies();
    }, [refreshCompanies]);
    const allCompanies = useMemo(() => sortCompaniesByDate(companies), [companies]);
    const selectedBaseCompanyId = getBaseCompanyId(selectedCompany);
    const companySections = useMemo(() => {
        if (!selectedBaseCompanyId) {
            const grouped = new Map<string, {
                title: string;
                rows: Company[];
            }>();
            allCompanies.forEach((company) => {
                const baseId = getBaseCompanyId(company);
                const title = company.name;
                const currentGroup = grouped.get(baseId) || { title, rows: [] };
                currentGroup.rows.push(company);
                grouped.set(baseId, currentGroup);
            });
            return {
                selectedBase: null,
                others: Array.from(grouped.entries())
                    .map(([baseId, group]) => ({
                    baseId,
                    title: group.title,
                    rows: sortCompaniesByDate(group.rows),
                }))
                    .sort((left, right) => left.title.localeCompare(right.title)),
            };
        }
        return {
            selectedBase: {
                baseId: selectedBaseCompanyId,
                title: selectedCompany?.name || "",
                rows: sortCompaniesByDate(allCompanies.filter((company) => getBaseCompanyId(company) === selectedBaseCompanyId)),
            },
            others: Array.from(allCompanies.reduce((groups, company) => {
                const baseId = getBaseCompanyId(company);
                if (baseId === selectedBaseCompanyId)
                    return groups;
                const title = company.name;
                const current = groups.get(baseId) || {
                    title,
                    rows: [] as Company[],
                };
                current.rows.push(company);
                groups.set(baseId, current);
                return groups;
            }, new Map<string, {
                title: string;
                rows: Company[];
            }>()))
                .map(([baseId, group]) => ({
                baseId,
                title: group.title,
                rows: sortCompaniesByDate(group.rows),
            }))
                .sort((left, right) => left.title.localeCompare(right.title)),
        };
    }, [allCompanies, selectedBaseCompanyId, selectedCompany]);
    const handleCompanyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const company = allCompanies.find((c) => c._id === e.target.value);
        if (!company)
            return;
        onCompanyUpdate({
            ...company,
            base_company: company.base_company?._id || "",
        });
    }, [allCompanies, onCompanyUpdate]);
    const renderCompanyItem = useCallback((company: Company, isMuted: boolean) => {
        const companyColor = stringToColor(company.name || "Company");
        const isUsed = company._id === selectedCompany?._id;
        const badges = [
            ...(isUsed ? ["Used"] : []),
            ...(company.primary ? ["Primary"] : []),
        ];
        return (<SelectItem key={company._id} className={isMuted ? "opacity-65" : ""} startContent={<Avatar name={company.name} radius="sm" size="md" classNames={{ name: "font-bold" }} style={{
                    color: companyColor.text,
                    background: companyColor.background,
                }}/>} endContent={<div className="flex items-center gap-1">
              {isMuted ? (<WarningAmberRoundedIcon fontSize="small" className="text-warning-500"/>) : null}
              <Button isIconOnly type="button" aria-label={`Edit ${company.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-500 transition hover:bg-default-100" onPress={() => {
                    onCompanyEditRequest?.({
                        ...company,
                        base_company: company.base_company?._id || "",
                    });
                }}>
                <TuneRoundedIcon fontSize="small"/>
              </Button>
            </div>}>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <span>{company.name}</span>
              {badges.map((badge) => (<Chip key={badge} size="sm" variant="flat" color={badge === "Used" ? "primary" : "warning"}>
                  {badge}
                </Chip>))}
            </div>
            <span className="text-default-500 text-tiny">
              {company.details.address.country}, {company.details.address.city}
            </span>
          </div>
        </SelectItem>);
    }, [onCompanyEditRequest, selectedCompany?._id]);
    return (<Select isDisabled={viewMode === "read"} selectedKeys={selectedCompany?._id ? new Set([selectedCompany._id]) : new Set([])} onChange={handleCompanyChange} placeholder="Select Emitter Company" required classNames={{
            trigger: "h-12",
        }} aria-label="Select a company" renderValue={(items: SelectedItems<Company>) => {
            const keys = items.map((item) => item.key);
            const selectedItems = allCompanies.filter((company) => keys.includes(company._id));
            return selectedItems.map((item) => (<div key={item._id} className="flex items-center gap-2">
            <div className="w-10 h-10 bg-background flex items-center justify-center rounded-md">
              <img className="w-9" src={`/api/assets/${item.details.assets.logo}`}/>
            </div>
            <div className="flex flex-col">
              <span>{item.name}</span>
              <span className="text-default-500 text-tiny">
                {item.details.address.country}, {item.details.address.city}{" "}
                &bull; {item._id}
              </span>
            </div>
          </div>));
        }}>
      <>
        {companySections.selectedBase ? (<SelectSection showDivider title={`${companySections.selectedBase.title} Versions`}>
            {companySections.selectedBase.rows.map((company) => renderCompanyItem(company, false))}
          </SelectSection>) : null}

        {companySections.others.map((group) => (<SelectSection key={group.baseId} showDivider title={companySections.selectedBase
                ? `${group.title} (resets invoice)`
                : group.title}>
            {group.rows.map((company) => renderCompanyItem(company, Boolean(companySections.selectedBase) && Boolean(invoiceId)))}
          </SelectSection>))}
      </>
    </Select>);
}
