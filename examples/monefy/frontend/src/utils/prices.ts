import { Currency } from "@monefy/types/src/models/Product";
export const displayCurrency = (currencyType: Currency) => {
    if (currencyType === "EUR")
        return "€";
    if (currencyType === "USD")
        return "$";
    if (currencyType === "GBP")
        return "£";
    return currencyType;
};
