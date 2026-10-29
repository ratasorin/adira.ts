import { Card } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { useEffect, useState } from "react";
import type { VIEW_MODE } from "../invoice.types";
import { useInvoice } from "../use-invoice";
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const months = [
    { label: "January", value: "1" },
    { label: "February", value: "2" },
    { label: "March", value: "3" },
    { label: "April", value: "4" },
    { label: "May", value: "5" },
    { label: "June", value: "6" },
    { label: "July", value: "7" },
    { label: "August", value: "8" },
    { label: "September", value: "9" },
    { label: "October", value: "10" },
    { label: "November", value: "11" },
    { label: "December", value: "12" },
];
const years = Array.from({ length: 10 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    return { label: `${year}`, value: `${year}` };
});
const isDateValid = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime()))
        return false;
    const now = new Date();
    if (date > now)
        return false;
    return true;
};
export function ReportedPeriod({ viewMode }: {
    viewMode: VIEW_MODE;
}) {
    const { reportedPeriod, setReportedPeriod } = useInvoice();
    const [dateError, setDateError] = useState(false);
    useEffect(() => {
        if (!reportedPeriod)
            return;
        setDateError(!isDateValid(reportedPeriod));
    }, [reportedPeriod]);
    const handleMonthChange = (monthValue: string) => {
        const currentYear = reportedPeriod?.getFullYear();
        const newDate = new Date(currentYear || CURRENT_YEAR, parseInt(monthValue) - 1, 1);
        setReportedPeriod(newDate);
    };
    const handleYearChange = (yearValue: string) => {
        const currentMonth = reportedPeriod?.getMonth();
        const newDate = new Date(parseInt(yearValue), currentMonth || 0, 1);
        setReportedPeriod(newDate);
    };
    return (<Card shadow="none" className="flex bg-default-50/50 flex-col gap-4 p-4 rounded-xl mt-4">
      <span>Reported period</span>
      <div className="flex gap-4">
        <Select isDisabled={viewMode === "read"} label="Month" isRequired selectedKeys={new Set([((reportedPeriod?.getMonth() || 0) + 1).toString() || ""])} onSelectionChange={(keys) => handleMonthChange(Array.from(keys)[0] as string)} isInvalid={dateError}>
          {months.map((month) => (<SelectItem key={month.value} textValue={month.value}>
              {month.label}
            </SelectItem>))}
        </Select>

        <Select isDisabled={viewMode === "read"} label="Year" isRequired selectedKeys={new Set([reportedPeriod?.getFullYear().toString() || ""])} onSelectionChange={(keys) => handleYearChange(Array.from(keys)[0] as string)} isInvalid={dateError} errorMessage={dateError ? "Cannot select a future reported period" : ""}>
          {years.map((year) => (<SelectItem key={year.value} textValue={year.value}>
              {year.label}
            </SelectItem>))}
        </Select>
      </div>
    </Card>);
}
