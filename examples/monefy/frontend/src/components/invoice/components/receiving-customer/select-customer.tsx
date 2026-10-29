import { expectSuccess } from "../../../../services/api";
import { Select, SelectedItems, SelectItem, SelectSection, } from "@heroui/select";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, } from "@heroui/modal";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Input } from "@heroui/input";
import { addToast, Avatar, Button, Card, Chip } from "@heroui/react";
import { stringToColor } from "../../../../utils/colors";
import type { Invoice, VIEW_MODE } from "../../invoice.types";
import { api } from "../../../../services/api";
import { displayError } from "../../../../utils/handle-error";
import { zipMerge } from "../../../../utils";
const fetchCustomers = () => {
    const { run } = api("/customers", "GET")({
        query: {
            include: ["base_customer"],
            
            rows: r => r({
                select: [] as [],
                sortBy: { "createdAt": -1 }
            })
        },
    });
    return run().then(expectSuccess).then((res) => {
        return res?.rows;
    });
};
export type Customer = NonNullable<Awaited<ReturnType<typeof fetchCustomers>>>[number];
const getBaseCustomerId = (customer?: {
    base_customer?: string | undefined | null | {
        _id?: string;
        internal_name?: string;
    };
} | undefined | null) => typeof customer?.base_customer === "string"
    ? customer.base_customer
    : customer?.base_customer?._id || "";
const sortCustomersByDate = <T extends {
    createdAt: Date | string | undefined | null;
}>(customers: T[]): T[] => [...customers].sort((left, right) => new Date(right.createdAt || 0).getTime() -
    new Date(left.createdAt || 0).getTime());
const dedupeCustomersById = <T extends {
    _id: string;
},>(customers: T[]): T[] => {
    const seen = new Set<string>();
    return customers.filter((customer) => {
        if (seen.has(customer._id))
            return false;
        seen.add(customer._id);
        return true;
    });
};
export default function CustomerSelect({ onCustomerUpdate, onCustomerEditRequest, defaultCustomer, viewMode, }: {
    onCustomerUpdate: (customer?: Invoice["receiving_customer"]) => void;
    onCustomerEditRequest?: (customer: Invoice["receiving_customer"]) => void;
    defaultCustomer: Invoice["receiving_customer"] | undefined;
    viewMode: VIEW_MODE;
}) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [customerName, setCustomerName] = useState("");
    useEffect(() => {
        if (defaultCustomer) {
            const populatedDefaultCustomer = customers.find((c) => c._id === defaultCustomer._id);
            if (populatedDefaultCustomer) {
                setSelectedCustomer(populatedDefaultCustomer);
            }
        }
    }, [defaultCustomer, customers]);
    useEffect(() => {
        const doFetch = async () => {
            try {
                const customers = await fetchCustomers();
                if (customers) {
                    setCustomers(sortCustomersByDate(customers));
                }
            }
            catch (err) {
                displayError(err, "[Error] Failed to fetch customers!");
            }
        };
        doFetch();
    }, []);
    const handleCustomerChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === "__create_new__") {
            // Don't select anything — just open modal
            setOpenCreateDialog(true);
            return;
        }
        const customer = customers.find((c) => c._id === value);
        if (customer) {
            onCustomerUpdate({ ...customer, base_customer: customer.base_customer?._id || "" });
            setSelectedCustomer({ ...customer });
        }
    }, [customers, onCustomerUpdate]);
    const [billingDetails, setBillingDetails] = useState<Customer["details"]>({
        selected_name: "",
        city: "",
        country: "",
        address: "",
        cif: "",
    });
    const handleCreateCustomer = async () => {
        try {
            const { run } = api("/customers", "POST")({
                data: {
                    base_customer: "",
                    details: { ...billingDetails, selected_name: customerName },
                },
                query: {
                    include: ["base_customer"],
                    rows: r => r({
                        select: [] as []
                    })
                },
            });
            const customer = await run().then(expectSuccess).then((res) => {
                return res;
            });
            if (customer) {
                setOpenCreateDialog(false);
                setCustomerName("");
                addToast({
                    color: "success",
                    title: "[Success] Customer successfully created!",
                    description: `Added ${customerName} to the list of customers`,
                });
                setCustomers((current) => {
                    const newCustomers = [...current, customer].filter((c): c is NonNullable<typeof c> => c !== null);
                    const deduped = dedupeCustomersById(newCustomers);
                    return sortCustomersByDate(deduped);
                });
                setSelectedCustomer(customer);
                onCustomerUpdate({ ...customer, base_customer: customer.base_customer?._id || "" });
            }
        }
        catch (err) {
            displayError(err, "[Error] Failed to create customer");
        }
    };
    const allCustomers = useMemo(() => {
        const mergedCustomers = selectedCustomer
            ? zipMerge(customers, [selectedCustomer], (a, b) => a?._id === b?._id)
            : customers;
        const filteredCustomers = mergedCustomers.filter((c): c is NonNullable<typeof c> => c !== null);
        return sortCustomersByDate(dedupeCustomersById(filteredCustomers));
    }, [selectedCustomer, customers]);
    const customerSections = useMemo(() => {
        const selectedBaseCustomerId = getBaseCustomerId(selectedCustomer);
        if (!selectedBaseCustomerId) {
            const grouped = new Map<string, {
                title: string;
                rows: Customer[];
            }>();
            allCustomers.forEach((customer) => {
                const baseId = getBaseCustomerId(customer);
                const title = customer.base_customer?.internal_name || customer.details.selected_name;
                const currentGroup = grouped.get(baseId) || { title, rows: [] };
                currentGroup.rows.push(customer);
                grouped.set(baseId, currentGroup);
            });
            return {
                selectedBase: null,
                groups: Array.from(grouped.entries())
                    .map(([baseId, group]) => ({
                    baseId,
                    title: group.title,
                    rows: sortCustomersByDate(group.rows),
                }))
                    .sort((left, right) => left.title.localeCompare(right.title)),
            };
        }
        return {
            selectedBase: {
                baseId: selectedBaseCustomerId,
                title: selectedCustomer?.base_customer?.internal_name ||
                    selectedCustomer?.details.selected_name ||
                    "Customer",
                rows: sortCustomersByDate(allCustomers.filter((customer) => getBaseCustomerId(customer) === selectedBaseCustomerId)),
            },
            groups: Array.from(allCustomers.reduce((grouped, customer) => {
                const baseId = getBaseCustomerId(customer);
                if (baseId === selectedBaseCustomerId)
                    return grouped;
                const title = customer.base_customer?.internal_name ||
                    customer.details.selected_name;
                const currentGroup = grouped.get(baseId) || { title, rows: [] as Customer[] };
                currentGroup.rows.push(customer);
                grouped.set(baseId, currentGroup);
                return grouped;
            }, new Map<string, {
                title: string;
                rows: Customer[];
            }>()))
                .map(([baseId, group]) => ({
                baseId,
                title: group.title,
                rows: sortCustomersByDate(group.rows),
            }))
                .sort((left, right) => left.title.localeCompare(right.title)),
        };
    }, [allCustomers, selectedCustomer]);
    const renderCustomerItem = useCallback((customer: Customer) => {
        const customerColor = stringToColor(customer.base_customer?.internal_name || customer.details.selected_name);
        const badges = [
            ...(customer._id === selectedCustomer?._id ? ["Used In Invoice"] : []),
            ...(customer.primary ? ["Primary"] : []),
        ];
        return (<SelectItem key={customer._id} endContent={<Button isIconOnly type="button" aria-label={`Edit ${customer.details.selected_name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-500 transition hover:bg-default-100" onPress={() => {
                    setSelectedCustomer(customer);
                    onCustomerUpdate({ ...customer, base_customer: customer.base_customer?._id || "" });
                    onCustomerEditRequest?.({ ...customer, base_customer: customer.base_customer?._id || "" });
                }}>
              <TuneRoundedIcon fontSize="small"/>
            </Button>} startContent={<Avatar name={customer.details.selected_name} radius="sm" size="md" isBordered classNames={{
                    name: "font-bold",
                }} style={{
                    color: customerColor.text,
                    background: customerColor.background,
                }}/>}>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <span>{customer.details.selected_name}</span>
              {badges.map((badge) => (<Chip key={badge} size="sm" variant="flat" color={badge === "Used In Invoice" ? "primary" : "warning"}>
                  {badge}
                </Chip>))}
            </div>
            <span className="text-default-500 text-tiny">
              {customer.details.country}, {customer.details.city} &bull;{" "}
              {customer._id}
            </span>
          </div>
        </SelectItem>);
    }, [onCustomerEditRequest, onCustomerUpdate, selectedCustomer?._id]);
    return (<>
      <Modal isOpen={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>Create New Customer</h2>
          </ModalHeader>
          <ModalBody>
            <span className="text-foreground-400">Customer Identifier</span>
            <Input placeholder="Select an internal name for the customer" labelPlacement="outside-left" fullWidth className="w-full" classNames={{
            mainWrapper: "w-full",
        }} value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoFocus/>

            <Card shadow="none" className="flex bg-default-50/50 flex-col gap-4 mt-4 p-4 rounded-xl">
              <h2 className="text-foreground-400">Billing details</h2>
              <Input label="Company name" isRequired classNames={{
            inputWrapper: "bg-default-200/60",
        }} value={billingDetails.selected_name} onChange={(e) => setBillingDetails((prev) => ({
            ...prev,
            selected_name: e.target.value,
        }))}/>
              <Input label="County" isRequired value={billingDetails.country} classNames={{
            inputWrapper: "bg-default-200/60",
        }} onChange={(e) => {
            setBillingDetails((prev) => ({
                ...prev,
                country: e.target.value,
            }));
        }}/>
              <Input label="City" isRequired value={billingDetails.city} classNames={{
            inputWrapper: "bg-default-200/60",
        }} onChange={(e) => setBillingDetails((prev) => ({
            ...prev,
            city: e.target.value,
        }))}/>
              <Input label="Address" isRequired classNames={{
            inputWrapper: "bg-default-200/60",
        }} value={billingDetails.address} onChange={(e) => setBillingDetails((prev) => ({
            ...prev,
            address: e.target.value,
        }))}/>
              <Input label="CIF" classNames={{
            inputWrapper: "bg-default-200/60",
        }} isRequired value={billingDetails.cif} onChange={(e) => setBillingDetails((prev) => ({
            ...prev,
            cif: e.target.value,
        }))}/>
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" color="success" className="w-full" onPress={handleCreateCustomer}>
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Select isDisabled={viewMode === "read"} onChange={handleCustomerChange} selectedKeys={!selectedCustomer?._id || selectedCustomer._id === ""
            ? new Set([])
            : new Set([selectedCustomer._id])} placeholder="Select a customer" required aria-label="Select a customer" classNames={{
            trigger: "h-12",
        }} scrollShadowProps={{
            className: "h-[500px] max-h-[500px]! max-h-[500px] w-full",
        }} renderValue={(items: SelectedItems<Customer>) => {
            const keys = items.map((item) => item.key);
            const selectedItems = allCustomers.filter((customer) => keys.includes(customer._id));
            return selectedItems.map((item) => {
                const customerColor = stringToColor(item.base_customer?.internal_name || item.details.selected_name);
                return (<div key={item._id} className="flex items-center gap-2">
                <Avatar name={item.base_customer?.internal_name || item.details.selected_name} size="md" radius="sm" className="border-2 border-white" classNames={{
                        name: "font-bold",
                    }} style={{
                        color: customerColor.text,
                        background: customerColor.background,
                    }}></Avatar>
                <div className="flex flex-col">
                  <span>{item.details.selected_name}</span>
                  <span className="text-default-500 text-tiny">
                    {item.details.country}, {item.details.city} &bull; {item._id}
                  </span>
                </div>
              </div>);
            });
        }}>
        <>
          {customerSections.selectedBase ? (<SelectSection showDivider title={`${customerSections.selectedBase.title} Versions`}>
              {customerSections.selectedBase.rows.map((customer) => renderCustomerItem(customer))}
            </SelectSection>) : null}

          {customerSections.groups.map((group) => (<SelectSection key={group.baseId} showDivider title={group.title}>
              {group.rows.map((customer) => renderCustomerItem(customer))}
            </SelectSection>))}

          <SelectItem key="__create_new__" textValue="__create_new__" startContent={<AddRoundedIcon />}>
            Create New Customer
          </SelectItem>
        </>
      </Select>
    </>);
}
