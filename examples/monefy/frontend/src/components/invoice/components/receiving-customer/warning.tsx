import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/react";
import { Tooltip } from "@heroui/tooltip";
type ReceivingCustomerWarningProps = {
    assignedInvoiceNumber: number;
    currentCustomerName?: string;
    nextCustomerName?: string;
    loadingPredictedInvoiceNumber: boolean;
    onPredictedInvoiceNumberOpen: () => void;
    predictedInvoiceNumber: number | null | undefined;
};
export function ReceivingCustomerWarning({ assignedInvoiceNumber, currentCustomerName, nextCustomerName, loadingPredictedInvoiceNumber, onPredictedInvoiceNumberOpen, predictedInvoiceNumber, }: ReceivingCustomerWarningProps) {
    return (<Card shadow="none" className="mt-4 w-full rounded-2xl border border-warning-200 bg-warning-50/70">
      <CardBody className="gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-warning-100 p-2 text-warning-700">
            <WarningAmberRoundedIcon fontSize="small"/>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-warning-900">
              Base customer change detected
            </div>
            <div className="mt-1 text-sm text-warning-800">
              Changing from "{currentCustomerName || "current customer"}" to "
              {nextCustomerName || "selected customer"}" will create a{" "}
              <Tooltip color="warning" placement="bottom" onOpenChange={(open) => {
            if (open) {
                onPredictedInvoiceNumberOpen();
            }
        }} content={<div className="min-w-40 text-sm">
                    <div className="font-medium text-foreground">
                      Invoice No:{" "}
                      {loadingPredictedInvoiceNumber ? (<span className="inline-flex items-center gap-2">
                          <Spinner size="sm"/>
                        </span>) : predictedInvoiceNumber != null ? (predictedInvoiceNumber) : ("Unavailable")}
                    </div>
                  </div>}>
                <span className="cursor-help underline decoration-dashed underline-offset-4 decoration-warning-500">
                  new invoice
                </span>
              </Tooltip>
              , not update{" "}
              <Tooltip color="warning" placement="bottom" content={<div className="min-w-32 text-sm">
                    <div className="font-medium text-foreground">
                      Invoice No: {assignedInvoiceNumber || "Unavailable"}
                    </div>
                  </div>}>
                <span className="cursor-help underline decoration-dashed underline-offset-4 decoration-warning-500">
                  this one
                </span>
              </Tooltip>
              !
            </div>
          </div>
        </div>
      </CardBody>
    </Card>);
}
