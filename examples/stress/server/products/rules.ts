export const daysCover = (available: number, sold: number) =>
  Math.floor(available / Math.max(1, sold / 90));

export const stockStatus = (available: number) =>
  available < 0 ? "backorder" : available < 30 ? "low" : "healthy";
