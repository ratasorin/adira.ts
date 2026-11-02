import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, } from "@heroui/modal";
import { NumberInput, Spinner } from "@heroui/react";
import { useBranchConfirmInvoiceNumber } from "./use-invoice-number";
type BranchConfirmProps = {
    canSave: boolean;
    hasInvoiceModifications: boolean;
    onSave: () => void;
};
export function BranchConfirm({ canSave, hasInvoiceModifications, onSave, }: BranchConfirmProps) {
    const { allocationScope, availabilityStatus, canCheckInvoiceNumber, invoiceNumber, isOpen, onAllocationScopeChange, onCheckInvoiceNumber, onInvoiceNumberChange, onOpenChange, } = useBranchConfirmInvoiceNumber();
    return (<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Save Under Different Invoice Number</ModalHeader>
        <ModalBody className="gap-3">
          <div className="rounded-xl border border-warning-200 bg-warning-50/70 px-3 py-2 text-sm text-warning-800">
            This saves the current editor changes under a new base invoice
            number. Choose whether the company counter should be updated too.
          </div>
          {!hasInvoiceModifications ? (<div className="rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-sm text-foreground-500">
              There are no modifications to save under a different number.
            </div>) : null}
          <div className="flex items-end gap-2">
            <NumberInput label="Base Invoice Number" labelPlacement="outside" minValue={1} value={invoiceNumber > 0 ? invoiceNumber : undefined} onValueChange={(value) => onInvoiceNumberChange(Number.isFinite(value) ? value : 0)} className="flex-1" endContent={availabilityStatus === "checking" ? (<Spinner size="sm"/>) : availabilityStatus === "available" ? (<CheckRoundedIcon className="text-success-500"/>) : availabilityStatus === "taken" ? (<CloseRoundedIcon className="text-danger-500"/>) : null}/>
            <Button isIconOnly variant="flat" color="primary" onPress={onCheckInvoiceNumber} isDisabled={!canCheckInvoiceNumber}>
              <CheckRoundedIcon fontSize="small"/>
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground-600">
              Counter Update
            </span>
            <div className="flex overflow-hidden rounded-xl border border-divider">
              <Button className="flex-1 rounded-none" color={allocationScope === "local" ? "primary" : "default"} variant={allocationScope === "local" ? "solid" : "light"} onPress={() => onAllocationScopeChange("local")}>
                Local
              </Button>
              <Button className="flex-1 rounded-none" color={allocationScope === "global" ? "primary" : "default"} variant={allocationScope === "global" ? "solid" : "light"} onPress={() => onAllocationScopeChange("global")}>
                Global
              </Button>
            </div>
            <div className="text-xs text-foreground-500">
              {allocationScope === "local"
            ? "Local creates a new base invoice without changing the company counter."
            : "Global updates the company counter to the selected number before saving."}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button color="success" isDisabled={!canSave} onPress={onSave}>
            Save Under This Number
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>);
}
