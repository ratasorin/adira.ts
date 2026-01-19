import { createApiClient } from "@n/adira.client.ts";
import type { ExampleApiTypes } from "@examples/backend.types";
const BACKEND_API_URL = "http://localhost:5000";
export const api = createApiClient<ExampleApiTypes>(BACKEND_API_URL);

api("/categories", "GET", { query: { include: [], select: [""] } });
