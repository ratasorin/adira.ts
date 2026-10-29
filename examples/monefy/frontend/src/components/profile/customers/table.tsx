import { expectSuccess } from "../../../services/api";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, addToast, } from "@heroui/react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { displayError } from "../../../utils/handle-error";
import z from "zod";
import DashboardTable, { useDashboardTable, withRowMetadata, } from "../../dashboard/table";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import { checkErrors } from "../../../utils";
import { api } from "../../../services/api";
import { useRef } from "react";
import { nanoid } from "nanoid";
const nameValidation = z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be less than 100 characters");
const cityValidation = z.string().min(2, "City must be at least 2 characters");
const countryValidation = z
    .string()
    .min(2, "Country must be at least 2 characters");
const addressValidation = z
    .string()
    .min(5, "Address must be at least 5 characters");
const cifValidation = z
    .string()
    .regex(/^[A-Z0-9]{3,20}$/, "CIF must be alphanumeric and 3-20 characters long");
const CUSTOMER_TABLE_ID = "profile-page__customer-table";
const CustomerTable = () => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const customerDashboardProps = useDashboardTable({
        get: async () => {
            try {
                const customers = await api("/customers", "GET")({ query: {include: [],  rows: r => r({
                            select: [] as []
                        }) } }).run().then(expectSuccess).then((res) => {
                    return res?.rows.map(withRowMetadata) || [];
                });
                return customers;
            }
            catch (err) {
                displayError(err, "[Error] Failed to get invoices");
            }
        },
        table: { elements: "customers", id: CUSTOMER_TABLE_ID },
    });
    const resolvedDeleteRef = useRef<(value: boolean) => void>(() => { });
    return (<>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (<>
              <ModalHeader className="flex gap-1">
                Delete{" "}
                <b>
                  {customerDashboardProps.itemToDelete?.details.selected_name}
                </b>
              </ModalHeader>
              <ModalBody>
                <p>This will permanently delete the customer.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={async () => {
                if (!customerDashboardProps.itemToDelete)
                    return;
                try {
                    await api("/customers/:id", "DELETE")({data: {},                         path: { id: customerDashboardProps.itemToDelete._id },
                    }).run().then(expectSuccess).then(() => { });
                    addToast({
                        color: "success",
                        title: "Customer deleted successfully",
                    });
                    resolvedDeleteRef.current(true);
                }
                catch (err) {
                    displayError(err, "[Error] Cannot delete customer!");
                    resolvedDeleteRef.current(false);
                }
                finally {
                    onClose();
                }
            }}>
                  Delete
                </Button>
              </ModalFooter>
            </>)}
        </ModalContent>
      </Modal>

      <ClickAwayListener onClickAway={customerDashboardProps.resetTableState}>
        <div id="customers" className="w-full p-5 bg-foreground-50 rounded-lg flex gap-5 flex-col">
          <div className="w-full flex justify-between items-center">
            <h2 className="font-semibold text-2xl flex items-center gap-3">
              <StoreRoundedIcon className="text-foreground-50 !text-3xl bg-foreground-600 rounded-lg p-1"/>
              Customers
            </h2>
            <Button color="primary" className="uppercase font-medium" variant="flat" onPress={() => {
            customerDashboardProps.addNewItem({
                rowId: nanoid(),
                _id: "",
                base_customer: "",
                details: {
                    selected_name: "",
                    city: "",
                    country: "",
                    address: "",
                    cif: "",
                },
                createdAt: new Date().toISOString(),
                primary: true,
                errors: {
                    "details.selected_name": checkErrors(nameValidation, ""),
                    "details.city": checkErrors(cityValidation, ""),
                    "details.country": checkErrors(countryValidation, ""),
                    "details.address": checkErrors(addressValidation, ""),
                    "details.cif": checkErrors(cifValidation, ""),
                },
            });
        }}>
              Add Customer
              <AddRoundedIcon />
            </Button>
          </div>

          <DashboardTable {...customerDashboardProps} unitName="customer" forbidDelete={() => false} onDelete={async () => {
            onOpen();
            return new Promise((resolve) => {
                resolvedDeleteRef.current = resolve;
            });
        }} onCreate={async (customer) => {
            try {
                await api("/customers", "POST")({
                    data: customer,
                    query: {
                        include: [],
                        rows: r => r({
                            select: [] as []
                        })
                    },
                }).run().then(expectSuccess).then((res) => {
                    return res;
                });
                addToast({
                    color: "success",
                    title: "[Success] Customer created successfully",
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to create customer");
                return false;
            }
        }} onUpdate={async (customer) => {
            try {
                await api("/customers/:id", "PATCH")({                    path: { id: customer._id },
                    data: customer,
                }).run().then(expectSuccess).then(() => { });
                // show success toast
                addToast({
                    color: "success",
                    title: "Customer updated successfully",
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to update customer");
                return false;
            }
        }} columnSet={{
            "details.address": {
                name: "Address",
                render: (addr) => addr,
                renderParams: {
                    inputType: "TEXT",
                    validators: [addressValidation],
                },
                isEditable: true,
            },
            "details.cif": {
                name: "CIF",
                render: (cif) => cif,
                renderParams: {
                    inputType: "TEXT",
                    validators: [cifValidation],
                },
                isEditable: true,
            },
            "details.city": {
                name: "City",
                render: (city) => city,
                renderParams: {
                    inputType: "TEXT",
                    validators: [cityValidation],
                },
                isEditable: true,
            },
            "details.country": {
                name: "Country",
                render: (country) => country,
                renderParams: {
                    inputType: "TEXT",
                    validators: [countryValidation],
                },
                isEditable: true,
            },
            "details.selected_name": {
                name: "Customer Name",
                render: (name) => name,
                renderParams: {
                    inputType: "TEXT",
                    validators: [nameValidation],
                },
                isEditable: true,
            },
        }}/>
        </div>
      </ClickAwayListener>
    </>);
};
export default CustomerTable;
