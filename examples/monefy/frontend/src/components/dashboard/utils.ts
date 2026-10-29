import z from "zod";
export const nameValidation = z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be less than 100 characters");
// General text field (city, country)
export const cityValidation = z
    .string()
    .min(2)
    .max(100)
    .regex(/^[\p{L} .'-]+$/u, "Invalid city name");
export const countryValidation = z
    .string()
    .min(2)
    .max(100)
    .regex(/^[\p{L} .'-]+$/u, "Invalid country name");
// Address: allow numbers, letters, commas, dots, and slashes
export const addressValidation = z
    .string()
    .min(5)
    .max(200)
    .regex(/^[\p{L}0-9\s.,'\/\-#]+$/u, "Invalid address");
// ZIP/postal code: alphanumeric, 3–10 chars
export const zipValidation = z
    .string()
    .min(3)
    .max(10)
    .regex(/^[A-Z0-9\- ]+$/i, "Invalid ZIP code");
// CIF (e.g., EU-style company identifier): typically numbers with optional prefix
export const cifValidation = z
    .string()
    .regex(/^[A-Z]{0,2}\d{4,12}$/i, "Invalid CIF");
// Email
export const emailValidation = z.string().email("Invalid email");
// Phone number: digits, +, (), -, spaces; 5–20 chars
export const phoneValidation = z
    .string()
    .min(5)
    .max(20)
    .regex(/^[+]?[\d\s().-]{5,20}$/, "Invalid phone number");
// Fax: same validation as phone
export const faxValidation = phoneValidation;
// URL
export const urlValidation = z.string().url("Invalid URL");
// IBAN: up to 34 alphanumeric characters, starts with 2 letters
export const ibanValidation = z
    .string()
    .regex(/^[A-Z]{2}[0-9A-Z]{13,32}$/i, "Invalid IBAN");
// BIC/SWIFT: 8 or 11 uppercase alphanum
export const bicValidation = z
    .string()
    .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i, "Invalid BIC");
// Tax number: flexible alphanumeric string 5–20 chars
export const taxNumberValidation = z
    .string()
    .min(5)
    .max(20)
    .regex(/^[A-Z0-9\-\/]+$/i, "Invalid tax number");
// Account number: 6–20 digits/letters, often just digits
export const accountNumberValidation = z
    .string()
    .min(6)
    .max(20)
    .regex(/^[A-Z0-9]+$/i, "Invalid account number");
// Bank code: alphanumeric, 3–11 characters
export const bankCodeValidation = z
    .string()
    .min(3)
    .max(11)
    .regex(/^[A-Z0-9]+$/i, "Invalid bank code");
