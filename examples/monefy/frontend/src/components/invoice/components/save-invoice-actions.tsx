import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { Button } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Tooltip, } from "@heroui/react";
type SaveInvoiceActionsProps = {
    disabledReason?: string;
    hasInvoiceModifications: boolean;
    invoiceId?: string;
    isSaveDisabled: boolean;
    onSave: () => Promise<void> | void;
    onSaveAsDifferentNumber: () => void;
    onSaveAsNew: () => Promise<void> | void;
};
export function SaveInvoiceActions({ disabledReason, hasInvoiceModifications, invoiceId, isSaveDisabled, onSave, onSaveAsDifferentNumber, onSaveAsNew, }: SaveInvoiceActionsProps) {
    return (<Tooltip color="warning" content={disabledReason} isDisabled={!isSaveDisabled || !disabledReason} placement="top">
      <div className="mt-6 flex w-full">
        <Button isDisabled={isSaveDisabled} color="success" className="flex-1 rounded-r-none" onPress={onSave}>
          Save Invoice
        </Button>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly color="success" className="rounded-l-none border-l border-success-300" isDisabled={isSaveDisabled}>
              <KeyboardArrowDownRoundedIcon fontSize="small"/>
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Save invoice actions">
            <DropdownItem key="save-as-number" isDisabled={!invoiceId || !hasInvoiceModifications} onPress={onSaveAsDifferentNumber}>
              Save under different number
            </DropdownItem>
            <DropdownItem key="save-as-new" isDisabled={isSaveDisabled || !invoiceId || !hasInvoiceModifications} onPress={onSaveAsNew}>
              Save as new
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </Tooltip>);
}
