import { createReadContext } from "@n/adira.backend.ts";
import { schema } from "@n/adira.core.ts";
import { type RequestContext } from "../harness/telemetry";

export const reads = createReadContext<RequestContext>();

export const finiteNumber = schema.number();
