import { ProductDetails } from "../models/Product";
export const displayCurrency = (currencyType: ProductDetails["currency"]) => {
    if (currencyType === "EUR")
        return "€";
    if (currencyType === "USD")
        return "$";
    if (currencyType === "RON")
        return "RON";
    if (currencyType === "GBP")
        return "£";
    return "()";
};
