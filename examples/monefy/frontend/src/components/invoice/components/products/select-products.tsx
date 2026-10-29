import { expectSuccess } from "../../../../services/api";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell, } from "@heroui/table";
import { Button } from "@heroui/button";
import { Card } from "@heroui/card";
import { Select, SelectItem, SelectSection } from "@heroui/select";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice, VIEW_MODE } from "../../invoice.types";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { displayError } from "../../../../utils/handle-error";
import { Tooltip } from "@heroui/tooltip";
import { addToast, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, NumberInput, } from "@heroui/react";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { api } from "../../../../services/api";
import { ProductDetails } from "@monefy/types/src/models/Product";
import { useProductsLines } from "../../store/products";
import { displayCurrency } from "../../../../utils/prices";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { EditableProduct, ProductVersionEditor, } from "./product-version-editor";
type IInvoiceProductLine = Invoice["products"][number];
type Props = {
    viewMode: VIEW_MODE;
    baseCompanyId?: string;
    initialProductLines?: IInvoiceProductLine[];
    total: number;
};
export type ProductBlueprint = NonNullable<Awaited<ReturnType<typeof fetchCompanyProducts>>>[number];
export type ProductLine = NonNullable<Awaited<ReturnType<typeof fillProducts>>>[number];
const fillProducts = async (productLines: IInvoiceProductLine[]) => {
    try {
        const missingProductIds = productLines
            .map((p) => p.product)
            .filter((p) => p !== undefined);
        const { run } = api("/products", "GET")({
            query: {
                where: { _id: { $in: missingProductIds } },
                include: ["base_product"],
                rows: r => r({
                    select: [] as []
                })
            },
        });
        const products = await run().then(expectSuccess).then((res) => {
            return res?.rows;
        });
        if (!products) {
            throw new Error("No product found with ids: " + missingProductIds);
        }
        return productLines.map((pl) => ({
            ...pl,
            product: products.find((p) => p._id === pl.product)!,
        }));
    }
    catch (error) {
        displayError(error, "[Error] Cannot get product lines from this invoice!");
    }
};
const getBaseProductId = (product?: {
    base_product?: string | {
        _id?: string;
    } | null;
} | null) => typeof product?.base_product === "string"
    ? product.base_product
    : product?.base_product?._id || "";
const sortProducts = <T extends {
    primary: boolean;
    createdAt?: Date | string | null;
},>(products: T[]) => [...products].sort((left, right) => {
    if (left.primary !== right.primary)
        return left.primary ? -1 : 1;
    return (new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime());
});
const fetchCompanyProducts = async (baseCompanyId: string) => {
    try {
        const { run } = api("/products", "GET")({
            query: {
                include: ["base_product"],
                where: {
                    $and: [
                        { "base_product.base_owner_company": { $eq: baseCompanyId } },
                        {  },
                    ],
                },
                rows: r => r({
                    select: [] as [],
                    sortBy: { "createdAt": -1 }
                })
            },
        });
        const products = await run().then(expectSuccess).then((res) => {
            return res?.rows;
        });
        return products;
    }
    catch (error) {
        displayError(error, "[Error] Cannot get company products!");
    }
};
type ProductPayload = {
    details: ProductDetails;
    name: string;
    owner_company: string;
};
const handleCreateProduct = async (baseCompanyId: string | undefined, product: ProductPayload | undefined) => {
    if (!product || !baseCompanyId) {
        addToast({
            color: "danger",
            title: "Empty product details!",
            description: "Cannot create an empty product",
        });
        return;
    }
    try {
        const { run } = api("/products", "POST")({
            data: {
                ...{
                    details: product.details,
                    name: product.name,
                    hidden: false,
                    primary: true,
                    deletedAt: null,
                },
                base_owner_company: baseCompanyId
            },
            query: {
                include: ["base_product"],
                rows: r => r({
                    select: [] as []
                })
            },
        });
        const createdProduct = await run().then(expectSuccess).then((res) => {
            return res;
        });
        return createdProduct as ProductBlueprint | undefined;
    }
    catch (error) {
        displayError(error, "[Error] Cannot create the new product!");
    }
};
export default function ProductsTable({ baseCompanyId, viewMode, initialProductLines, }: Props) {
    const [availableProducts, setAvailableProducts] = useState<ProductBlueprint[]>([]);
    const [openSelector, setOpenSelector] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [newProduct, setNewProduct] = useState<ProductPayload | undefined>(undefined);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [editingLineId, setEditingLineId] = useState<string | null>(null);
    const [productEditorOpen, setProductEditorOpen] = useState(false);
    const products = useProductsLines((state) => state.rows);
    const updateProduct = useProductsLines((state) => state.update);
    const initProducts = useProductsLines((state) => state.init);
    const insertProduct = useProductsLines((state) => state.insert);
    const removeProduct = useProductsLines((state) => state.remove);
    const loadAvailableProducts = useCallback(async () => {
        if (!baseCompanyId) {
            setAvailableProducts([]);
            return;
        }
        const prods = await fetchCompanyProducts(baseCompanyId);
        if (prods)
            setAvailableProducts(sortProducts(prods));
    }, [baseCompanyId]);
    useEffect(() => {
        if (!baseCompanyId)
            return;
        loadAvailableProducts();
        return () => {
            initProducts([]);
        };
    }, [baseCompanyId, initProducts, loadAvailableProducts]);
    useEffect(() => {
        if (!initialProductLines)
            return;
        if (initialProductLines.length === 0)
            initProducts([]);
        fillProducts(initialProductLines).then((productLines) => {
            if (productLines)
                initProducts(productLines.map((pl) => ({
                    _id: pl._id,
                    product: pl.product || null,
                    quantity: pl.quantity,
                    index: pl.index,
                })));
        });
    }, [initialProductLines, initProducts]);
    const handleAddNewProductRow = (selectedProductId: string) => {
        const productToAdd = availableProducts.find((p) => p._id === selectedProductId);
        if (!productToAdd)
            return;
        insertProduct({
            product: productToAdd,
            quantity: 1,
        });
        setSelectedProductId("");
        setOpenSelector(false);
    };
    const editingRow = useMemo(() => products.find((row) => row._id === editingLineId) || null, [editingLineId, products]);
    useEffect(() => {
        if (!editingLineId)
            return;
        if (!editingRow) {
            setEditingLineId(null);
            setProductEditorOpen(false);
        }
    }, [editingLineId, editingRow]);
    const availableProductSections = useMemo(() => {
        const grouped = new Map<string, {
            title: string;
            rows: ProductBlueprint[];
        }>();
        sortProducts(availableProducts).forEach((product) => {
            const baseId = getBaseProductId(product) || product._id;
            const current = grouped.get(baseId) || {
                title: product.name,
                rows: [] as ProductBlueprint[],
            };
            current.rows.push(product);
            grouped.set(baseId, current);
        });
        return Array.from(grouped.entries())
            .map(([baseId, group]) => ({
            baseId,
            title: group.title,
            rows: sortProducts(group.rows),
        }))
            .sort((left, right) => left.title.localeCompare(right.title));
    }, [availableProducts]);
    const handleProductLineVersionChange = useCallback((lineId: string, product?: EditableProduct) => {
        if (!product)
            return;
        updateProduct(lineId, {
            product: product as ProductLine["product"],
        });
        loadAvailableProducts();
    }, [loadAvailableProducts, updateProduct]);
    return (<>
      <Modal isOpen={openSelector} onClose={() => setOpenSelector(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>Add Product</h2>
          </ModalHeader>
          <ModalBody>
            <Select label="Select Product" selectedKeys={selectedProductId ? new Set([selectedProductId]) : new Set()} onSelectionChange={(keys) => setSelectedProductId(String(Array.from(keys)[0] || ""))}>
              {availableProductSections.map((group) => (<SelectSection key={group.baseId} title={group.title} showDivider>
                  {group.rows.map(({ _id, details, name, primary }) => (<SelectItem key={_id} textValue={`${name} ${details.unit_price}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {name}: {details.unit_price}
                          {displayCurrency(details.currency)}
                        </span>
                        {primary ? (<span className="text-[11px] font-semibold text-warning-600">
                            Primary
                          </span>) : null}
                      </div>
                    </SelectItem>))}
                </SelectSection>))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={() => handleAddNewProductRow(selectedProductId)}>
              Add Product
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={openDialog} onClose={() => setOpenDialog(false)}>
        <ModalContent>
          <ModalHeader>
            <h2>Create New Product</h2>
          </ModalHeader>
          <ModalBody className="px-6 py-0">
            <Card shadow="none" className="flex bg-default-50/50 flex-col gap-4 rounded-xl">
              <Input isRequired label="Product Name" fullWidth className="w-full" classNames={{
            mainWrapper: "w-full",
        }} value={newProduct?.name} onChange={(e) => {
            const name = e.target.value;
            if (!name)
                return;
            setNewProduct((p) => p
                ? { ...p, name }
                : {
                    details: { currency: "EUR", unit_price: 0 },
                    name,
                    owner_company: baseCompanyId!,
                });
        }} autoFocus/>

              <NumberInput label="Unit Price" isRequired classNames={{
            inputWrapper: "bg-default-200/60",
        }} formatOptions={{
            style: "currency",
            currency: newProduct?.details.currency || "EUR",
        }} value={newProduct?.details.unit_price} onValueChange={(value) => setNewProduct((p) => p
            ? { ...p, details: { ...p.details, unit_price: value } }
            : {
                details: { currency: "EUR", unit_price: value },
                name: "",
                owner_company: baseCompanyId!,
            })}/>

              <Select aria-label="Select product currency" selectedKeys={new Set([newProduct?.details.currency || "EUR"])} classNames={{
            trigger: "bg-default-200/60 min-h-10",
        }} onSelectionChange={(keys) => {
            const currency = String(Array.from(keys)[0] || "EUR") as "EUR" | "USD" | "RON" | "GBP";
            setNewProduct((p) => p
                ? {
                    ...p,
                    details: { ...p.details, currency },
                }
                : {
                    name: "",
                    details: { currency, unit_price: 0 },
                    owner_company: baseCompanyId!,
                });
        }}>
                <SelectItem key="EUR">EUR €</SelectItem>
                <SelectItem key="USD">USD $</SelectItem>
                <SelectItem key="RON">RON</SelectItem>
                <SelectItem key="GBP">GBP £</SelectItem>
              </Select>
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button variant="solid" color="success" className="w-full" isDisabled={!(newProduct?.name && newProduct?.details.unit_price)} onPress={() => {
            if (!newProduct)
                return;
            handleCreateProduct(baseCompanyId, newProduct).then((createdProduct) => {
                if (createdProduct) {
                    addToast({
                        color: "success",
                        title: "Product added successfully!",
                        description: `Product ${newProduct.name} was added to the catalogue!`,
                    });
                    setAvailableProducts((prods) => sortProducts([...prods, createdProduct]));
                    setOpenDialog(false);
                }
            });
        }}>
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <div className="mt-6 w-full flex justify-between items-center">
        <h3 className="font-semibold">Products</h3>

        <Tooltip content="Select a parent company first" isDisabled={!!baseCompanyId || viewMode === "read"} closeDelay={0} color="warning">
          <div className="flex items-center">
            <Button size="sm" variant="flat" onPress={() => setOpenSelector(true)} isDisabled={!baseCompanyId || viewMode === "read"} color="secondary" className="rounded-r-none" startContent={<ShoppingCartOutlinedIcon className="text-medium!"/>}>
              Add Product
            </Button>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="flat" isDisabled={!baseCompanyId || viewMode === "read"} color="secondary" className="rounded-l-none border-l border-secondary-200">
                  <KeyboardArrowDownRoundedIcon fontSize="small"/>
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Product actions">
                <DropdownItem key="create-item" onPress={() => setOpenDialog(true)}>
                  Create Item
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </Tooltip>
      </div>
      <Table disabledKeys={viewMode === "read" ? new Set(products.map((p) => p._id)) : new Set()} removeWrapper isKeyboardNavigationDisabled aria-label="Products table" className="my-4">
        <TableHeader>
          <TableColumn>Item</TableColumn>
          <TableColumn>Price</TableColumn>
          <TableColumn className="w-24">Quantity</TableColumn>
          <TableColumn className="w-28">Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {products.map((p) => (<TableRow key={p._id}>
              <TableCell>{p.product?.name || ""}</TableCell>
              <TableCell>{`${p.product?.details.unit_price}${displayCurrency(p.product?.details.currency)}`}</TableCell>
              <TableCell>
                <Input isDisabled={viewMode === "read"} value={`${p.quantity}`} variant="flat" size="sm" type="number" min={1} onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }} onChange={(event) => {
                const quantity = Number(event.currentTarget.value);
                if (quantity)
                    updateProduct(p._id, { quantity });
            }} classNames={{
                inputWrapper: "bg-default-100/60",
            }} errorMessage="Minimum 1" defaultValue={`${p.quantity}`}></Input>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button isDisabled={viewMode === "read"} isIconOnly size="sm" variant="flat" onPress={() => {
                setEditingLineId(p._id);
                setProductEditorOpen(true);
            }}>
                    <TuneRoundedIcon />
                  </Button>
                  <Button isDisabled={viewMode === "read"} isIconOnly size="sm" color="danger" variant="flat" onPress={() => removeProduct(p._id)}>
                    <DeleteOutlineRoundedIcon />
                  </Button>
                </div>
              </TableCell>
            </TableRow>))}
        </TableBody>
      </Table>

      <ProductVersionEditor viewMode={viewMode} isOpen={productEditorOpen} onOpenChange={setProductEditorOpen} product={editingRow?.product as EditableProduct | undefined} invoiceProduct={editingRow?.product as EditableProduct | undefined} onProductUpdate={(product) => {
            if (!editingRow?._id)
                return;
            handleProductLineVersionChange(editingRow._id, product);
        }} onProductsChange={loadAvailableProducts}/>

      <Divider />
    </>);
}
