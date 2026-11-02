import React from "react";
import type { InvoiceTemplateDraft } from "./invoice-language.api";
export type TranslationFieldKey = "opening" | "invoice" | "description" | "quantity" | "unit_price" | "subtotal" | "total" | "affects" | "reported_period" | "bank_name" | "account_beneficiary" | "account_number" | "bank_code" | "thanks";
export type InteractivePDFPreviewProps = {
    translation: InvoiceTemplateDraft;
    focusedField: TranslationFieldKey | null;
};
const HIGHLIGHT_CLASSES = "ring-2 ring-secondary bg-secondary/5 border-secondary rounded px-1 py-0.5 transition-all duration-200";
const DEFAULT_STYLES = {
    fontFamily: "'Roboto', 'Inter', system-ui, sans-serif",
};
const DEMO_COMPANY = {
    name: "Demo Company GmbH",
    street: "Musterstraße 42",
    zip: "10115",
    city: "Berlin",
    vat_id: "DE123456789",
    website: "www.demo-company.com",
    email: "contact@demo-company.com",
    phone: "+49 30 12345678",
    fax: "+49 30 12345679",
    iban: "DE89 3704 0044 0532 0130 00",
    bic: "COBADEFFXXX",
    bank_name: "Commerzbank AG",
};
const DEMO_CUSTOMER = {
    name: "ACME Corporation",
    address: "Innovations Avenue 100",
    country: "Germany",
    city: "Munich",
    vat_id: "DE987654321",
};
const DEMO_ITEMS = [
    {
        name: "Web Development Services",
        quantity: 20,
        price: 85.0,
        currency: "EUR",
    },
    {
        name: "UI/UX Design Consulting",
        quantity: 10,
        price: 95.0,
        currency: "EUR",
    },
];
const DEMO_MODIFIER = {
    name: "Early Bird Discount",
    value: 10,
    type: "percentage",
    affects: "#1, #2",
};
const DEMO_VIEWER = {
    name: "VAT 19%",
    subtotal: 342.0,
};
function HighlightableText({ field, focusedField, bold = false, children, }: {
    field: TranslationFieldKey;
    focusedField: TranslationFieldKey | null;
    bold?: boolean;
    children: React.ReactNode;
}) {
    const isFocused = field === focusedField;
    return (<span className={isFocused ? HIGHLIGHT_CLASSES : ""} style={bold ? { fontWeight: 600 } : undefined}>
      {children}
    </span>);
}
export function InteractivePDFPreview({ translation, focusedField, }: InteractivePDFPreviewProps) {
    const subtotal = DEMO_ITEMS.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = subtotal * (DEMO_MODIFIER.value / 100);
    const afterDiscount = subtotal - discountAmount;
    const vatAmount = DEMO_VIEWER.subtotal;
    const total = afterDiscount + vatAmount;
    return (<div className="flex h-full w-full flex-col rounded-lg border border-gray-200 bg-white p-6 text-gray-800 shadow-sm" style={{ ...DEFAULT_STYLES, fontSize: "12px", lineHeight: "1.5" }}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-16 w-32 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
          [Company Logo]
        </div>
        <div className="max-w-[50%] text-right text-xs">
          <p className="text-base font-semibold">{DEMO_COMPANY.name}</p>
          <p>
            {DEMO_COMPANY.street}
            <br />
            {DEMO_COMPANY.zip}-{DEMO_COMPANY.city}, VAT-IdNr:{" "}
            {DEMO_COMPANY.vat_id}
          </p>
          <p>
            {DEMO_COMPANY.website} E-mail: {DEMO_COMPANY.email}
          </p>
          <p>
            Tel: {DEMO_COMPANY.phone}, Fax: {DEMO_COMPANY.fax}
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="mb-4 border-t-2 border-gray-300"/>

      {/* Opening section */}
      <div className="mb-4">
        <p className="mb-2">
          <HighlightableText field="opening" focusedField={focusedField}>
            {translation.opening || "For"}
          </HighlightableText>
        </p>
        <p className="mb-1 font-semibold">{DEMO_CUSTOMER.name}</p>
        <p className="mb-1">
          {DEMO_CUSTOMER.address}, {DEMO_CUSTOMER.country}, {DEMO_CUSTOMER.city}
        </p>
        <p>VAT-ID: {DEMO_CUSTOMER.vat_id}</p>
      </div>

      {/* Invoice title */}
      <div className="mb-4 flex items-start justify-between">
        <p className="text-base font-semibold">
          <HighlightableText field="invoice" focusedField={focusedField}>
            {translation.invoice || "Invoice"}
          </HighlightableText>
        </p>
        <p className="text-right text-sm">No. 2024-001/01.15.2024</p>
      </div>

      {/* Items table */}
      <div className="mb-4 rounded border border-gray-200">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="p-2 text-center text-xs font-semibold">#</th>
              <th className="p-2 text-center text-xs font-semibold">
                <HighlightableText field="description" focusedField={focusedField}>
                  {translation.table_headers.description || "Description"}
                </HighlightableText>
              </th>
              <th className="p-2 text-center text-xs font-semibold">
                <HighlightableText field="quantity" focusedField={focusedField}>
                  {translation.table_headers.quantity || "Quantity"}
                </HighlightableText>
              </th>
              <th className="p-2 text-center text-xs font-semibold">
                <HighlightableText field="unit_price" focusedField={focusedField}>
                  {translation.table_headers.unit_price || "Unit price"}
                </HighlightableText>
              </th>
              <th className="p-2 text-right text-xs font-semibold">
                <HighlightableText field="subtotal" focusedField={focusedField}>
                  {translation.table_headers.subtotal || "Subtotal"}
                </HighlightableText>
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ITEMS.map((item, idx) => (<tr key={idx} className="border-b border-gray-100">
                <td className="p-2 text-center">{idx + 1}</td>
                <td className="p-2">{item.name}</td>
                <td className="p-2 text-center">{item.quantity}</td>
                <td className="p-2 text-right">
                  {item.price.toFixed(2)} {item.currency}
                </td>
                <td className="p-2 text-right">
                  {(item.price * item.quantity).toFixed(2)} {item.currency}
                </td>
              </tr>))}

            {/* Modifier */}
            <tr className="border-b border-gray-100">
              <td colSpan={4} className="p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200">
                    %
                  </span>
                  <span>
                    {DEMO_MODIFIER.name}: -{DEMO_MODIFIER.value}%
                  </span>
                </div>
              </td>
              <td className="p-2 text-right text-xs text-gray-500">
                <HighlightableText field="affects" focusedField={focusedField}>
                  {translation.affects || "Affects"}
                </HighlightableText>
                : {DEMO_MODIFIER.affects}
              </td>
            </tr>

            {/* Viewer */}
            <tr className="border-b border-gray-100">
              <td colSpan={4} className="p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200">
                    Σ
                  </span>
                  <span>{DEMO_VIEWER.name}</span>
                </div>
              </td>
              <td className="p-2 text-right text-xs font-semibold">
                {DEMO_VIEWER.subtotal.toFixed(2)} EUR
              </td>
            </tr>

            {/* Total row */}
            <tr className="bg-gray-50">
              <td colSpan={4} className="p-2 text-right font-semibold">
                <HighlightableText field="total" focusedField={focusedField}>
                  {translation.table_headers.total || "TOTAL"}
                </HighlightableText>
              </td>
              <td className="p-2 text-right font-semibold">
                {total.toFixed(2)} EUR
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reported period */}
      <div className="mb-3">
        <HighlightableText field="reported_period" focusedField={focusedField}>
          {translation.reported_period || "Reported period"}
        </HighlightableText>
        : January 2024
      </div>

      {/* Notes placeholder */}
      <div className="mb-3 text-gray-600">
        Invoice notes placeholder text...
      </div>

      {/* Bank details */}
      <div className="mb-4 space-y-1 text-sm">
        <div className="flex">
          <span className="min-w-[180px]">
            <HighlightableText field="account_beneficiary" focusedField={focusedField}>
              {translation.account_beneficiary || "Account beneficiary"}
            </HighlightableText>
            :
          </span>
          <span className="font-semibold">{DEMO_COMPANY.name}</span>
        </div>
        <div className="flex">
          <span className="min-w-[180px]">
            <HighlightableText field="account_number" focusedField={focusedField}>
              {translation.account_number || "Account number"}
            </HighlightableText>
            :
          </span>
          <span className="font-semibold">{DEMO_COMPANY.iban}</span>
        </div>
        <div className="flex">
          <span className="min-w-[180px]">
            <HighlightableText field="bank_code" focusedField={focusedField}>
              {translation.bank_code || "Bank code"}
            </HighlightableText>
            :
          </span>
          <span className="font-semibold">{DEMO_COMPANY.bic}</span>
        </div>
        <div className="flex">
          <span className="min-w-[180px]">
            <HighlightableText field="bank_name" focusedField={focusedField}>
              {translation.bank_name || "Bank name"}
            </HighlightableText>
            :
          </span>
          <span className="font-semibold">{DEMO_COMPANY.bank_name}</span>
        </div>
      </div>

      {/* Thanks */}
      <div className="mt-auto pt-4 border-t border-gray-200 text-center">
        <HighlightableText field="thanks" focusedField={focusedField}>
          {translation.thanks || "Thank you for your business."}
        </HighlightableText>
      </div>
    </div>);
}
