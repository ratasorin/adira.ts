export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value);

export const formatBytes = (bytes: number) =>
  `${formatNumber(bytes / 1024, 1)} KB`;
