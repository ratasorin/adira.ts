import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Button } from "@heroui/button";
import { NumberInput, Spinner } from "@heroui/react";
import { usePickForNewInvoiceNumber } from "./use-invoice-number";
export function PickForNew() {
    const { allocationScope, assignedInvoiceNumber, availabilityStatus, canCheckDraftInvoiceNumber, canUseGlobalInvoiceNumber, currentDraftInvoiceCounter, draftInvoiceOriginalNumber, hasCompany, isDraftInvoiceNumberUnchanged, isOpen, onAllocationScopeChange, onAssignedInvoiceNumberChange, onCheckInvoiceNumber, onOpenChange, } = usePickForNewInvoiceNumber();
    return (<div className="mb-2 flex flex-col gap-1">
      <button type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-default-100 hover:cursor-pointer" onClick={() => onOpenChange(!isOpen)}>
        <span className="text-sm font-medium">#Invoice Number</span>
        <KeyboardArrowDownRoundedIcon className={`transition-transform ${isOpen ? "rotate-180" : ""}`} fontSize="small"/>
      </button>

      {isOpen ? (<div className="p-3 bg-foreground-50 rounded-xl">
          {!hasCompany ? (<div className="rounded-xl border border-warning-200 bg-warning-50/70 px-3 py-2 text-sm text-warning-800">
              <div className="flex items-start gap-2">
                <WarningAmberRoundedIcon fontSize="small"/>
                <span>
                  Select a company before setting the base invoice number.
                </span>
              </div>
            </div>) : null}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground-600">
              Base Invoice Number
            </span>
            <div className="flex items-end gap-2">
              <NumberInput labelPlacement="outside" minValue={1} value={assignedInvoiceNumber > 0 ? assignedInvoiceNumber : undefined} onValueChange={(value) => onAssignedInvoiceNumberChange(Number.isFinite(value) ? value : 0)} isDisabled={!hasCompany} className="flex-1" endContent={availabilityStatus === "checking" ? (<Spinner size="sm"/>) : isDraftInvoiceNumberUnchanged ? (<CheckRoundedIcon className="text-default-400"/>) : availabilityStatus === "available" ? (<CheckRoundedIcon className="text-success-500"/>) : availabilityStatus === "taken" ? (<CloseRoundedIcon className="text-danger-500"/>) : null}/>
              <Button isIconOnly variant="flat" color="primary" onPress={onCheckInvoiceNumber} isDisabled={!canCheckDraftInvoiceNumber ||
                availabilityStatus === "checking"}>
                <CheckRoundedIcon fontSize="small"/>
              </Button>
            </div>
            {hasCompany && currentDraftInvoiceCounter != null ? (<div className="text-xs text-foreground-500">
                Suggested next number: {draftInvoiceOriginalNumber}. Current
                counter: {currentDraftInvoiceCounter}.
              </div>) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground-600">
              Counter Update
            </span>
            <div className="flex overflow-hidden rounded-xl border border-divider">
              <Button className="flex-1 rounded-none" color={allocationScope === "local" ? "primary" : "default"} variant={allocationScope === "local" ? "solid" : "light"} onPress={() => onAllocationScopeChange("local")} isDisabled={!hasCompany}>
                Local
              </Button>
              <Button className="flex-1 rounded-none" color={allocationScope === "global" ? "primary" : "default"} variant={allocationScope === "global" ? "solid" : "light"} onPress={() => onAllocationScopeChange("global")} isDisabled={!hasCompany || !canUseGlobalInvoiceNumber}>
                Global
              </Button>
            </div>
            <div className="text-xs text-foreground-500">
              {allocationScope === "local"
                ? "Local only updates this draft base invoice index and leaves the company counter unchanged."
                : "Global updates the company counter to this number before creating the base invoice."}
            </div>
            {hasCompany &&
                currentDraftInvoiceCounter != null &&
                assignedInvoiceNumber > 0 &&
                assignedInvoiceNumber <= currentDraftInvoiceCounter ? (<div className="text-xs text-warning-700">
                Global is available only for numbers greater than{" "}
                {currentDraftInvoiceCounter}.
              </div>) : null}
          </div>
        </div>) : null}
    </div>);
}
