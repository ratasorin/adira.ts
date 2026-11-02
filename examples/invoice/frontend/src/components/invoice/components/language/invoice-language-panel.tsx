import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Button } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger, Input, Spinner, Textarea, } from "@heroui/react";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, } from "@heroui/modal";
import { Tooltip } from "@heroui/tooltip";
import { useCallback, useMemo, useState } from "react";
import type { InvoiceTemplateDraft, LanguageOption, } from "./invoice-language.api";
import { InteractivePDFPreview, type TranslationFieldKey, } from "./interactive-pdf-preview";
export type InvoiceLanguagePanelProps = {
    languageId: string;
    languageOptions: LanguageOption[];
    selectedLanguageCode: string;
    selectedLanguageName: string;
    hasCompany: boolean;
    hasSelectedLanguageClosingRemark: boolean;
    closingRemarkAccordionOpen: boolean;
    draftClosingRemark: string;
    isSavingClosingRemark: boolean;
    addLanguageOpen: boolean;
    isCreatingLanguage: boolean;
    newLanguageDraft: InvoiceTemplateDraft;
    onLanguageChange: (languageId: string) => void;
    onToggleClosingRemarkAccordion: () => void;
    onDraftClosingRemarkChange: (value: string) => void;
    onSaveClosingRemark: () => void;
    onCancelClosingRemark: () => void;
    onToggleAddLanguage: () => void;
    onLanguageDraftChange: (field: Exclude<keyof InvoiceTemplateDraft, "table_headers">, value: string) => void;
    onTableHeaderDraftChange: (field: keyof InvoiceTemplateDraft["table_headers"], value: string) => void;
    onCreateLanguage: () => void;
    onCancelAddLanguage: () => void;
};
const DEFAULT_ENGLISH_TRANSLATION: InvoiceTemplateDraft = {
    language_code: "en",
    language_name: "English",
    opening: "For",
    invoice: "Invoice",
    table_headers: {
        description: "Description",
        quantity: "Quantity",
        unit_price: "Unit price",
        subtotal: "Subtotal",
        total: "TOTAL",
    },
    affects: "Affects",
    reported_period: "Reported period",
    bank_name: "Bank name",
    account_beneficiary: "Account beneficiary",
    account_number: "Account number",
    bank_code: "Bank code",
    thanks: "Thank you for your business.",
};
export function InvoiceLanguagePanel({ languageId, languageOptions, selectedLanguageCode, selectedLanguageName, hasCompany, hasSelectedLanguageClosingRemark, closingRemarkAccordionOpen, draftClosingRemark, isSavingClosingRemark, addLanguageOpen, isCreatingLanguage, newLanguageDraft, onLanguageChange, onToggleClosingRemarkAccordion, onDraftClosingRemarkChange, onSaveClosingRemark, onCancelClosingRemark, onToggleAddLanguage, onLanguageDraftChange, onTableHeaderDraftChange, onCreateLanguage, onCancelAddLanguage, }: InvoiceLanguagePanelProps) {
    const [focusedField, setFocusedField] = useState<TranslationFieldKey | null>(null);
    const allFieldsFilled = useMemo(() => {
        const { language_code, language_name, opening, invoice, affects, reported_period, bank_name, account_beneficiary, account_number, bank_code, thanks, table_headers, } = newLanguageDraft;
        const topLevelFilled = !!(language_code.trim() &&
            language_name.trim() &&
            opening.trim() &&
            invoice.trim() &&
            affects.trim() &&
            reported_period.trim() &&
            bank_name.trim() &&
            account_beneficiary.trim() &&
            account_number.trim() &&
            bank_code.trim() &&
            thanks.trim());
        const tableHeadersFilled = !!(table_headers.description.trim() &&
            table_headers.quantity.trim() &&
            table_headers.unit_price.trim() &&
            table_headers.subtotal.trim() &&
            table_headers.total.trim());
        return topLevelFilled && tableHeadersFilled;
    }, [newLanguageDraft]);
    const mergeWithDefaults = useCallback((draft: InvoiceTemplateDraft): InvoiceTemplateDraft => ({
        ...DEFAULT_ENGLISH_TRANSLATION,
        ...draft,
        table_headers: {
            ...DEFAULT_ENGLISH_TRANSLATION.table_headers,
            ...draft.table_headers,
        },
    }), []);
    return (<div className="flex flex-col">
      <Dropdown placement="right-start">
        <DropdownTrigger>
          <Button variant="light" className="w-full justify-between">
            <span className="flex items-center gap-3 text-base font-semibold">
              <TranslateRoundedIcon />
              Language
            </span>
            <ChevronRightRoundedIcon className="text-foreground-400"/>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Select invoice language" selectionMode="single" selectedKeys={languageId ? new Set([languageId]) : new Set([])} onSelectionChange={(keys) => {
            const next = String(Array.from(keys)[0] || "");
            if (next === "__add_language__") {
                onToggleAddLanguage();
                return;
            }
            onLanguageChange(next);
        }}>
          <DropdownSection>
            {languageOptions.map((option) => (<DropdownItem key={option._id}>{option.name}</DropdownItem>))}
          </DropdownSection>
          <DropdownSection showDivider={false}>
            <DropdownItem key="__add_language__" startContent={<AddRoundedIcon fontSize="small"/>}>
              Add Language
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>

      <Modal isOpen={addLanguageOpen} onClose={onCancelAddLanguage} scrollBehavior="inside" size="5xl" classNames={{
            body: "z-[99999]",
            wrapper: "z-[3000]",
            backdrop: "z-[2999]",
        }}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <AddRoundedIcon fontSize="small"/>
            Add Language
          </ModalHeader>
          <ModalBody className="flex gap-6 flex-row">
            <div className="flex flex-1 flex-col gap-3 overflow-scroll p-3">
              <Input label="Language code" value={newLanguageDraft.language_code} onValueChange={(value) => onLanguageDraftChange("language_code", value)} placeholder="en" isRequired/>
              <Input label="Language name" value={newLanguageDraft.language_name} onValueChange={(value) => onLanguageDraftChange("language_name", value)} placeholder="English" isRequired/>

              <Input label="Opening" value={newLanguageDraft.opening} onValueChange={(value) => onLanguageDraftChange("opening", value)} onFocus={() => setFocusedField("opening")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Invoice label" value={newLanguageDraft.invoice} onValueChange={(value) => onLanguageDraftChange("invoice", value)} onFocus={() => setFocusedField("invoice")} onBlur={() => setFocusedField(null)} isRequired/>

              <Input label="Header: Description" value={newLanguageDraft.table_headers.description} onValueChange={(value) => onTableHeaderDraftChange("description", value)} onFocus={() => setFocusedField("description")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Header: Quantity" value={newLanguageDraft.table_headers.quantity} onValueChange={(value) => onTableHeaderDraftChange("quantity", value)} onFocus={() => setFocusedField("quantity")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Header: Unit Price" value={newLanguageDraft.table_headers.unit_price} onValueChange={(value) => onTableHeaderDraftChange("unit_price", value)} onFocus={() => setFocusedField("unit_price")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Header: Subtotal" value={newLanguageDraft.table_headers.subtotal} onValueChange={(value) => onTableHeaderDraftChange("subtotal", value)} onFocus={() => setFocusedField("subtotal")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Header: Total" value={newLanguageDraft.table_headers.total} onValueChange={(value) => onTableHeaderDraftChange("total", value)} onFocus={() => setFocusedField("total")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Affects label" value={newLanguageDraft.affects} onValueChange={(value) => onLanguageDraftChange("affects", value)} onFocus={() => setFocusedField("affects")} onBlur={() => setFocusedField(null)} isRequired/>

              <Input label="Reported period" value={newLanguageDraft.reported_period} onValueChange={(value) => onLanguageDraftChange("reported_period", value)} onFocus={() => setFocusedField("reported_period")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Bank name label" value={newLanguageDraft.bank_name} onValueChange={(value) => onLanguageDraftChange("bank_name", value)} onFocus={() => setFocusedField("bank_name")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Account beneficiary" value={newLanguageDraft.account_beneficiary} onValueChange={(value) => onLanguageDraftChange("account_beneficiary", value)} onFocus={() => setFocusedField("account_beneficiary")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Account number" value={newLanguageDraft.account_number} onValueChange={(value) => onLanguageDraftChange("account_number", value)} onFocus={() => setFocusedField("account_number")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Bank code" value={newLanguageDraft.bank_code} onValueChange={(value) => onLanguageDraftChange("bank_code", value)} onFocus={() => setFocusedField("bank_code")} onBlur={() => setFocusedField(null)} isRequired/>
              <Input label="Thanks text" value={newLanguageDraft.thanks} onValueChange={(value) => onLanguageDraftChange("thanks", value)} onFocus={() => setFocusedField("thanks")} onBlur={() => setFocusedField(null)} isRequired/>
            </div>

            <div className="flex h-full w-4/7 flex-col">
              <div className="mb-2 text-sm font-semibold text-gray-600">
                Preview
              </div>
              <div className="flex overflow-auto rounded-lg border border-gray-200">
                <InteractivePDFPreview translation={mergeWithDefaults(newLanguageDraft)} focusedField={focusedField}/>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" isDisabled={isCreatingLanguage} onPress={onCancelAddLanguage}>
              Cancel
            </Button>
            <Button color="primary" className="font-semibold" isLoading={isCreatingLanguage} isDisabled={!allFieldsFilled || isCreatingLanguage} onPress={onCreateLanguage}>
              Add Language
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {hasCompany &&
            selectedLanguageCode &&
            !hasSelectedLanguageClosingRemark ? (<div className="px-3 pt-2">
          <div className="w-full rounded-xl border border-warning-200 bg-warning-50/70 px-3 py-2 text-left">
            <button type="button" className="w-full text-left" onClick={onToggleClosingRemarkAccordion}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-warning-700">
                  Missing closing remark for{" "}
                  <span className="font-bold">
                    {selectedLanguageName || selectedLanguageCode}
                  </span>
                </div>
                <ChevronRightRoundedIcon className={`text-warning-600 transition-transform ${closingRemarkAccordionOpen ? "rotate-90" : ""}`}/>
              </div>
              <div className="mt-0.5 text-xs text-warning-700/80">
                Click to add one (used at the end of the invoice).
              </div>
            </button>

            <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${closingRemarkAccordionOpen
                ? "max-h-[420px] opacity-100"
                : "max-h-0 opacity-0"}`}>
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <Textarea minRows={4} value={draftClosingRemark} onValueChange={onDraftClosingRemarkChange} placeholder="Type the closing remark…" classNames={{
                inputWrapper: "shadow-none border border-warning-200 bg-warning-50/70",
            }}/>
                <div className="mt-2 flex gap-2">
                  <Button color="warning" className="flex-1 font-semibold" isDisabled={!draftClosingRemark.trim() || isSavingClosingRemark} isLoading={isSavingClosingRemark} onPress={onSaveClosingRemark}>
                    Add
                  </Button>
                  <Button variant="light" className="flex-1" isDisabled={isSavingClosingRemark} onPress={onCancelClosingRemark}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>) : null}
    </div>);
}
export type InvoiceLanguageNoticeProps = {
    isTranslatingNotes: boolean;
    languageChangeWarning: string | null;
};
export function InvoiceLanguageNotice({ isTranslatingNotes, languageChangeWarning, }: InvoiceLanguageNoticeProps) {
    return (<div className="mb-2 flex items-center gap-2">
      <h3 className="font-semibold">Notices</h3>
      {isTranslatingNotes ? <Spinner size="sm"/> : null}
      {languageChangeWarning ? (<Tooltip color="warning" content={`Warning, the language was changed to ${languageChangeWarning}`}>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning text-warning-contrast-text text-xs font-bold">
            !
          </span>
        </Tooltip>) : null}
    </div>);
}
