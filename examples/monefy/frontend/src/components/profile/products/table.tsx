import { expectSuccess } from "../../../services/api";
import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure, addToast, } from "@heroui/react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import { displayError } from "../../../utils/handle-error";
import z from "zod";
import DashboardTable, { useDashboardTable, withRowMetadata, } from "../../dashboard/table";
import LocalMallRoundedIcon from "@mui/icons-material/LocalMallRounded";
import { useEffect, useRef, useState } from "react";
import { checkErrors } from "../../../utils";
import { api } from "../../../services/api";
import { Currency } from "@monefy/types/src/models/Product";
import { nanoid } from "nanoid";
const productNameValidation = z
    .string()
    .min(3, "Product name must be at least 3 characters");
const priceValidation = z.coerce
    .number()
    .min(0.01, "Price must be a positive non-zero number");
interface ReturnedCompany {
    _id: string;
    base_company_id?: string;
    name: string;
    details?: {
        assets?: {
            logo?: string;
            signature?: string;
            stamp?: string;
        };
    };
}
const PRODUCT_TABLE_ID = "profile-page__product-table";
const ProductTable = () => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const renderCompanyLabel = (company?: ReturnedCompany) => {
        const logo = company?.details?.assets?.logo;
        return (<div className="flex items-center gap-2 min-w-max">
        {logo ? (<img className="w-9 rounded-lg" src={`/api/assets/${logo}`} alt=""/>) : null}
        {company?.name || ""}
      </div>);
    };
    const productDashboardProps = useDashboardTable({
        get: async () => {
            try {
                return api("/products", "GET")({
                    query: {
                        include: ["base_product"],
                        rows: r => r({
                            select: [
                                "_id",
                                "base_product.base_owner_company",
                                "name",
                                "details",
                                "deletedAt",
                            ]
                        })
                    },
                }).run().then(expectSuccess).then((res) => {
                    return (res?.rows
                        .map((item) => {
                        return {
                            _id: item._id,
                            name: item.name,
                            details: item.details,
                            deletedAt: item.deletedAt,
                            base_owner_company: item.base_product?.base_owner_company,
                        };
                    })
                        .map(withRowMetadata) || []);
                });
            }
            catch (err) {
                displayError(err, "[Error] Cannot get products!");
            }
        },
        table: { elements: "products", id: PRODUCT_TABLE_ID },
    });
    const [companies, setCompanies] = useState<ReturnedCompany[]>([]);
    useEffect(() => {
        api("/companies", "GET")({
            query: {
                include: ["base_company"],
                rows: r => r({
                    select: [] as []
                })
            },
        })
            .run().then(expectSuccess).then((res) => {
            return (res?.rows.map((item) => ({
                ...item,
                base_company_id: item.base_company?._id,
            })) || []);
        }).then((rows) => {
            setCompanies(rows);
        });
    }, [setCompanies]);
    const resolvedDeleteRef = useRef<(value: boolean) => void>(() => { });
    return (<>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (<>
              <ModalHeader className="flex gap-1">
                Delete <b>{productDashboardProps.itemToDelete?.name}</b>
              </ModalHeader>
              <ModalBody>
                <p>This will permanently delete the product.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => {
                onClose();
                resolvedDeleteRef.current(false);
            }}>
                  Cancel
                </Button>
                <Button color="danger" onPress={async () => {
                if (!productDashboardProps.itemToDelete) {
                    addToast({
                        color: "danger",
                        title: "[Error] Delete product",
                        description: "No product selected for deletion.",
                    });
                    return;
                }
                try {
                    await api("/products/:id", "DELETE")({data: {},                         path: { id: productDashboardProps.itemToDelete._id },
                    }).run().then(expectSuccess).then(() => { });
                    addToast({
                        color: "success",
                        title: "Product deleted successfully",
                    });
                    resolvedDeleteRef.current(true);
                }
                catch (err) {
                    displayError(err, "[Error] Cannot delete product!");
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

      <ClickAwayListener onClickAway={productDashboardProps.resetTableState}>
        <div className="w-full p-5 bg-foreground-50 rounded-lg flex gap-5 flex-col">
          <div className="w-full flex justify-between items-center">
            <h2 className="font-semibold text-2xl flex items-center gap-3">
              <LocalMallRoundedIcon className="text-foreground-50 !text-3xl bg-foreground-600 rounded-lg p-1"/>
              Products
            </h2>
            <Button color="primary" className="uppercase font-medium" variant="flat" onPress={() => {
            productDashboardProps.addNewItem({
                rowId: nanoid(),
                _id: "",
                name: "",
                details: {
                    unit_price: 0,
                    currency: "EUR",
                },
                base_owner_company: "",
                deletedAt: null,
                createMode: true,
                errors: {
                    name: checkErrors(productNameValidation, ""),
                    "details.unit_price": checkErrors(priceValidation, 0),
                    "details.currency": [],
                },
            });
        }}>
              Add Product
              <AddRoundedIcon />
            </Button>
          </div>

          <DashboardTable {...productDashboardProps} unitName="product" forbidDelete={() => false} onDelete={() => {
            onOpen();
            return new Promise<boolean>((resolve) => {
                resolvedDeleteRef.current = resolve;
            });
        }} onCreate={async (product) => {
            try {
                await api("/products", "POST")({
                    data: {
                        ...{
                            details: product.details,
                            name: product.name,
                        },
                        base_owner_company: product.base_owner_company!
                    },
                    query: {include: [], 
                        rows: r => r({
                            select: [] as []
                        })
                    },
                }).run().then(expectSuccess).then(() => {
                    productDashboardProps.replaceItem(product, (p) => !!p.createMode);
                    addToast({
                        color: "success",
                        title: "[Success] Product created successfully",
                    });
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to create product");
                return false;
            }
        }} onUpdate={async (product) => {
            try {
                await api("/products/:id", "PATCH")({                    path: { id: product._id },
                    data: product,
                }).run().then(expectSuccess).then(() => {
                    // show success toast
                    productDashboardProps.replaceItem(product, (p) => !!p.editMode);
                    addToast({
                        color: "success",
                        title: "[Success] Product updated successfully",
                    });
                });
                return true;
            }
            catch (err) {
                displayError(err, "Failed to update product");
                return false;
            }
        }} columnSet={{
            name: {
                name: "Name",
                isEditable: true,
                render: (val) => <div>{val}</div>,
                renderParams: {
                    inputType: "TEXT",
                    validators: [productNameValidation],
                },
            },
            "details.unit_price": {
                name: "Price",
                isEditable: true,
                renderParams: {
                    inputType: "TEXT",
                    validators: [priceValidation],
                    type: "number",
                },
                render: (val) => <div>{val.toFixed(2)}</div>,
            },
            "details.currency": {
                name: "Currency",
                isEditable: true,
                renderParams: {
                    inputType: "DROPDOWN",
                    renderer: (option) => option,
                    key: (option) => option,
                    options: () => ["RON", "USD", "EUR", "GBP"] as Currency[],
                },
                render: (val) => (<Chip color="primary" variant="flat" size="sm">
                    {val}
                  </Chip>),
            },
            base_owner_company: {
                name: "Owner Company",
                render: (owner) => {
                    const company = companies.find((company) => company.base_company_id === owner);
                    return renderCompanyLabel(company);
                },
                isEditable: true,
                renderParams: {
                    inputType: "DROPDOWN",
                    options: () => companies.map((c) => c.base_company_id),
                    renderer: (company_id) => {
                        const company = companies.find((company) => company.base_company_id === company_id);
                        return renderCompanyLabel(company);
                    },
                    key: (company_id) => company_id!,
                },
            },
        }}/>
        </div>
      </ClickAwayListener>
    </>);
};
export default ProductTable;
