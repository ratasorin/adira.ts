import "./env";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import connectDB from "./database";
import User from "../models/User";
import Company, { BaseCompany } from "../models/Company";
import Customer, { BaseCustomer } from "../models/Customer";
import Product, { BaseProduct } from "../models/Product";
import Invoice, { BaseInvoice } from "../models/invoice/Invoice";
import Languages from "../models/Languages";
import Templates from "../models/invoice/TemplateTranslations";
import Modifier from "../models/Modifier";
import Viewer from "../models/Viewer";
import { Counter } from "../models/Counter";
import { DEFAULT_ENGLISH_TEMPLATE } from "../controller/invoice/generate-pdf";
import { assetsDirectory } from "../utils/assets";
export async function seedDatabase() {
    if (process.env.NODE_ENV !== "development")
        throw new Error("Demo seeding requires development mode");
    await connectDB();
    await mkdir(assetsDirectory, { recursive: true });
    await writeFile(assetsDirectory + "/icon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 45"><text x="0" y="35" font-family="sans-serif" font-size="36" font-weight="bold" fill="#598c75">monefy</text></svg>');
    let user = await User.findOne({ email: "demo@monefy.ro" });
    if (!user)
        user = await User.create({ username: "Monefy Demo", email: "demo@monefy.ro", password: await bcrypt.hash(process.env.DEMO_PASSWORD || "MonefyDemo2026!", 12), role: "ADVANCED", isAdminCreated: false, isVerified: true, deletedAt: null });
    const english = await Languages.findOneAndUpdate({ code: "en" }, { $setOnInsert: { name: "English", code: "en" } }, { upsert: true, new: true });
    const romanian = await Languages.findOneAndUpdate({ code: "ro" }, { $setOnInsert: { name: "Română", code: "ro" } }, { upsert: true, new: true });
    const { closing_remark, ...template } = DEFAULT_ENGLISH_TEMPLATE;
    await Templates.updateOne({ language: english._id }, { $setOnInsert: { ...template, language: english._id } }, { upsert: true });
    await Templates.updateOne({ language: romanian._id }, { $setOnInsert: { ...template, language: romanian._id, invoice: "Factură", opening: "Pentru", thanks: "Vă mulțumim!", reported_period: "Perioadă raportată", table_headers: { description: "Descriere", quantity: "Cantitate", unit_price: "Preț unitar", subtotal: "Subtotal", total: "TOTAL" } } }, { upsert: true });
    let company = await Company.findOne({ name: "Monefy Demo", primary: true, deletedAt: null });
    if (!company) {
        const base = await BaseCompany.create({ closing_remark: [{ language_code: "en", text: "Thank you for your business. Monefy" }, { language_code: "ro", text: "Vă mulțumim pentru colaborare. Monefy" }] });
        company = await Company.create({ base_company: base._id, name: "Monefy Demo", primary: true, hidden: false, deletedAt: null, createdAt: new Date(), details: { address: { street: "1 Example Street", zip: "500000", city: "Brașov", country: "Romania" }, vat_id: "RO-DEMO", contact: { email: "demo@monefy.ro", phone: "+40 000 000 000", fax: "", website: "https://monefy.ro" }, iban: "RO00 DEMO 0000 0000 0000 0000", bic: "DEMO", bank_name: "Demo Bank", tax_number: "DEMO", bank_code: "DEMO", account_number: "DEMO", assets: { logo: "icon.svg", signature: "", stamp: "" } } });
    }
    let customer = await Customer.findOne({ "details.selected_name": "Evergreen Clinic", primary: true, deletedAt: null });
    if (!customer) {
        const base = await BaseCustomer.create({ internal_name: "Evergreen Clinic" });
        customer = await Customer.create({ base_customer: base._id, primary: true, deletedAt: null, createdAt: new Date(), details: { selected_name: "Evergreen Clinic", city: "Brașov", country: "Romania", address: "24 Example Avenue", cif: "RO-DEMO-CLINIC" } });
    }
    for (const [name, price] of [["Revenue cycle support", 250], ["Reporting and reconciliation", 125], ["Practice software subscription", 49]] as const) {
        if (!await Product.exists({ name, primary: true, deletedAt: null })) {
            const base = await BaseProduct.create({ base_owner_company: company.base_company });
            await Product.create({ base_product: base._id, name, primary: true, hidden: false, deletedAt: null, createdAt: new Date(), details: { unit_price: price, currency: "EUR" } });
        }
    }
    await Modifier.updateOne({ name: "VAT 19%" }, { $setOnInsert: { name: "VAT 19%", scope: "total", type: "percentage", operation: "add", value: 19 } }, { upsert: true });
    await Modifier.updateOne({ name: "Service discount" }, { $setOnInsert: { name: "Service discount", scope: "total", type: "percentage", operation: "subtract", value: 10 } }, { upsert: true });
    await Viewer.updateOne({ name: "Subtotal" }, { $setOnInsert: { name: "Subtotal" } }, { upsert: true });
    await Counter.updateOne({ scope: String(company.base_company) }, { $setOnInsert: { scope: String(company.base_company), value: 1 } }, { upsert: true });
    if (!await Invoice.exists({ issuer_company: company._id, deletedAt: null })) {
        const product = await Product.findOne({ primary: true, deletedAt: null });
        const base = await BaseInvoice.create({ index: 1, latest_version: 1 });
        await Invoice.create({ base_invoice: base._id, issuer_company: company._id, receiving_customer: customer._id, reporter: user._id, language: english._id, version: 1, total: product!.details.unit_price, currency: "EUR", notes: "Demo invoice", products: [{ _id: new Types.ObjectId().toString(), product: product!._id, quantity: 1, index: 0 }], modifiers: [], viewers: [], emitted_date: new Date(new Date().toISOString().slice(0, 10)), reported_period: new Date(new Date().toISOString().slice(0, 7) + "-01"), deletedAt: null });
    }
    console.log("Monefy v1.1 demo ready: demo@monefy.ro");
    await mongoose.disconnect();
}
if (require.main === module)
    seedDatabase().catch(error => { console.error(error); process.exit(1); });
