import { expectSuccess } from "../../../services/api";
import { addToast, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, } from "@heroui/react";
import DashboardTable, { useDashboardTable, withRowMetadata, } from "../../dashboard/table";
import { displayError } from "../../../utils/handle-error";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import { checkErrors } from "../../../utils";
import { accountNumberValidation, addressValidation, bankCodeValidation, bicValidation, cifValidation, cityValidation, countryValidation, emailValidation, faxValidation, ibanValidation, nameValidation, phoneValidation, taxNumberValidation, urlValidation, zipValidation, } from "../../dashboard/utils";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { api } from "../../../services/api";
import { useRef } from "react";
import { nanoid } from "nanoid";
const COMPANY_TABLE_ID = "profile-page__company-table";
const CompanyTable = () => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const resolvedDeleteRef = useRef<(value: boolean) => void>(() => { });
    const companyDashboardProps = useDashboardTable({
        get: async () => {
            try {
                const companies = await api("/companies", "GET")({
                    query: {
                        include: [],
                        rows: r => r({
                            select: ["details", "name", "_id"]
                        })
                    },
                }).run().then(expectSuccess).then((res) => {
                    return res?.rows.map(withRowMetadata) || [];
                });
                return companies;
            }
            catch (err) {
                displayError(err, "Failed to fetch companies");
            }
        },
        table: { elements: "companies", id: COMPANY_TABLE_ID },
    });
    return (<>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (<>
              <ModalHeader className="flex gap-1">
                Delete <b>{companyDashboardProps.itemToDelete?.name}</b>
              </ModalHeader>
              <ModalBody>
                <p>This will permanently delete the company.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => {
                onClose();
                resolvedDeleteRef.current(false);
            }}>
                  Cancel
                </Button>
                <Button color="danger" onPress={() => {
                if (!companyDashboardProps.itemToDelete)
                    return;
                api("/companies/:id", "DELETE")({data: {},                     path: { id: companyDashboardProps.itemToDelete._id },
                }).run().then(expectSuccess).then((res) => {
                    if (!res?.error) {
                        addToast({
                            color: "success",
                            title: "Company deleted successfully",
                        });
                        onClose();
                        resolvedDeleteRef.current(true);
                    }
                });
            }}>
                  Delete
                </Button>
              </ModalFooter>
            </>)}
        </ModalContent>
      </Modal>

      <ClickAwayListener onClickAway={companyDashboardProps.resetTableState}>
        <div id="companies" className="w-full p-5 bg-foreground-50 rounded-lg flex gap-5 flex-col">
          <div className="w-full flex justify-between items-center">
            <h2 className="font-semibold text-2xl flex items-center gap-3">
              <ApartmentRoundedIcon className="text-foreground-50 text-3xl! bg-foreground-600 rounded-lg p-1"/>
              Companies
            </h2>
            <Button color="primary" className="uppercase font-medium" variant="flat" onPress={() => {
            companyDashboardProps.addNewItem({
                rowId: nanoid(),
                _id: "",
                name: "",
                details: {
                    address: {
                        country: "",
                        street: "",
                        zip: "",
                        city: "",
                    },
                    vat_id: "",
                    contact: {
                        email: "",
                        phone: "",
                        fax: "",
                        website: "",
                    },
                    iban: "",
                    bic: "",
                    bank_name: "",
                    tax_number: "",
                    account_number: "",
                    bank_code: "",
                    assets: {
                        logo: "",
                        signature: "",
                        stamp: "",
                    },
                },
                createMode: true,
                errors: {
                    name: checkErrors(nameValidation, ""),
                    "details.address.city": checkErrors(cityValidation, ""),
                    "details.address.country": checkErrors(countryValidation, ""),
                    "details.address.street": checkErrors(addressValidation, ""),
                },
            });
        }}>
              Add Company
              <AddRoundedIcon />
            </Button>
          </div>

          <DashboardTable {...companyDashboardProps} forbidDelete={() => false} onDelete={() => {
            onOpen();
            return new Promise((resolve) => {
                resolvedDeleteRef.current = resolve;
            });
        }} onCreate={async (company) => {
            try {
                await api("/companies", "POST")({                    data: {
                        ...company,
                        
                    },
                }).run().then(expectSuccess).then(() => {
                    addToast({
                        color: "success",
                        title: "[Success] Company created successfully",
                    });
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to create company");
                return false;
            }
        }} onUpdate={async (company) => {
            try {
                await api("/companies/:id", "PATCH")({
                    path: { id: company._id },
                    data: company,
                    query: {include: [], rows: r => r({select: [] as []}), },
                }).run().then(expectSuccess).then(() => {
                    addToast({
                        color: "success",
                        title: "[Success] Company updated successfully",
                    });
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to update company");
                return false;
            }
        }} columnSet={{
            name: {
                name: "Name",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [nameValidation],
                },
            },
            "details.address.street": {
                name: "Street",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [addressValidation],
                },
            },
            "details.address.zip": {
                name: "ZIP",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [zipValidation],
                },
            },
            "details.address.city": {
                name: "City",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [cityValidation],
                },
            },
            "details.address.country": {
                name: "Country",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [countryValidation],
                },
            },
            "details.vat_id": {
                name: "VAT ID",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [cifValidation],
                },
            },
            "details.contact.email": {
                name: "Email",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [emailValidation],
                },
            },
            "details.contact.phone": {
                name: "Phone",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [phoneValidation],
                },
            },
            "details.contact.fax": {
                name: "Fax",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [faxValidation],
                },
            },
            "details.contact.website": {
                name: "Website",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [urlValidation],
                },
            },
            "details.iban": {
                name: "IBAN",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [ibanValidation],
                },
            },
            "details.bic": {
                name: "BIC",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [bicValidation],
                },
            },
            "details.bank_name": {
                name: "Bank Name",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [nameValidation],
                },
            },
            "details.tax_number": {
                name: "Tax Number",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [taxNumberValidation],
                },
            },
            "details.account_number": {
                name: "Account Number",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [accountNumberValidation],
                },
            },
            "details.bank_code": {
                name: "Bank Code",
                isEditable: true,
                render: (val) => val,
                renderParams: {
                    inputType: "TEXT",
                    validators: [bankCodeValidation],
                },
            },
            "details.assets.logo": {
                name: "Logo",
                isEditable: true,
                render: (val) => val ? (<img src={`/api/assets/${val}`} alt="Company asset" className="!w-16 !max-w-16"/>) : <span>—</span>,
                renderParams: {
                    inputType: "IMAGE",
                },
            },
            "details.assets.signature": {
                name: "Signature",
                isEditable: true,
                render: (val) => val ? (<img src={`/api/assets/${val}`} alt="Company asset" className="!w-16 !max-w-16"/>) : <span>—</span>,
                renderParams: {
                    inputType: "IMAGE",
                },
            },
            "details.assets.stamp": {
                name: "Stamp",
                isEditable: true,
                render: (val) => val ? (<img src={`/api/assets/${val}`} alt="Company asset" className="!w-16 !max-w-16"/>) : <span>—</span>,
                renderParams: {
                    inputType: "IMAGE",
                },
            },
        }}/>
        </div>
      </ClickAwayListener>
    </>);
};
export default CompanyTable;
