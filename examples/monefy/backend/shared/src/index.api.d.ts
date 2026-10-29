import { Account } from "./controller/auth";
import { GetBaseCompanies, PatchBaseCompany } from "./controller/base-company/index";
import { GetBaseInvoices, PostBaseInvoice } from "./controller/base-invoice/index";
import { GetInvoiceChangeLogsExecutor } from "./controller/changelog/index";
import { GetInvoicesFn, PatchInvoiceFn, PostInvoiceFn } from "./controller/invoice/base";
import { InvoiceVersionGraphEdge, InvoiceVersionGraphNode } from "./controller/invoice/handlers/get-invoice-version-graph";
import { InvoiceDraft, InvoiceInput } from "./controller/invoice/types/index";
import { GetTemplateTranslationsFn, PatchTemplateTranslationsFn, PostTemplateTranslationsFn } from "./controller/languages/index";
import { GetTranslationsQuery, UpsertTranslationBody } from "./controller/modifier-viewer-translations/index";
import { GetModifiersExecutor, PatchModifierExecutor, PostModifierExecutor } from "./controller/modifiers/index";
import { TranslationResponse } from "./controller/notes-translations/index";
import { GetViewersExecutor, PatchViewerExecutor, PostViewerExecutor } from "./controller/viewers/index";
import { CompanyDetails, ICompany } from "./models/Company";
import { CustomerDetails, ICustomer } from "./models/Customer";
import { IModifierViewerTranslation } from "./models/ModifierViewerTranslation";
import { IProduct, ProductDetails } from "./models/Product";
import { IUser } from "./models/User";
import { IInvoiceChangeLog } from "./models/invoice/ChangeLog";
import { IInvoiceTemplateTranslation } from "./models/invoice/TemplateTranslations";
import { PdfJobStatus, PreviewJobResponse } from "./pdf/contracts";
import { CompaniesGetExecutor, CompaniesPatchExecutor, CompanyMetadataPatchExecutor, CompanyPostExecutor } from "./routes/company";
import { CustomerGetExecutor, CustomerMetadataPatchExecutor, CustomerPatchExecutor, CustomerPostExecutor } from "./routes/customer";
import { ProductMetadataPatchExecutor, ProductsGetExecutor, ProductsPatchExecutor, ProductsPostExecutor } from "./routes/products";
import { UploadRequestBody, UploadResponse } from "./routes/upload";
import { UserGetExecutor, UserPatchExecutor, UsersPostExecutor } from "./routes/users";
import { ErrorResponse, ReturnResponse } from "./types/index";
import { Json } from "./types/json";
import { Backend } from "@n/adira.core.ts";


export type MonefyAPI = {
    "/api/base-companies/:id": {
        "GET": {
            RequestPath: {
    id: string;
};
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetBaseCompanies>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetBaseCompanies> | ErrorResponse>;
        };
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<PatchBaseCompany>>;
            RequestQuery: Backend.InferHandlerParams<PatchBaseCompany>;
            ResponseBody: Json<Backend.InferHandlerResponse<PatchBaseCompany> | ErrorResponse>;
        };
    };
    "/api/base-invoices/:id": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetBaseInvoices>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetBaseInvoices> | ErrorResponse>;
        };
    };
    "/api/base-invoices/allocate/:base_company_id": {
        "POST": {
            RequestPath: {
    base_company_id?: string;
};
            RequestBody: never;
            RequestQuery: {
    index?: number;
    allocationScope?: "local" | "global";
};
            ResponseBody: Json<{
    _id: string;
    index: number;
    latest_version: number;
} | ErrorResponse>;
        };
    };
    "/api/base-invoices": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<Backend.InferRequestBody<PostBaseInvoice>>;
            RequestQuery: Backend.InferHandlerParams<PostBaseInvoice>;
            ResponseBody: Json<Backend.InferHandlerResponse<PostBaseInvoice> | ErrorResponse>;
        };
    };
    "/api/changelog": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetInvoiceChangeLogsExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetInvoiceChangeLogsExecutor> | ErrorResponse>;
        };
    };
    "/api/generate/preview": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<InvoiceDraft>;
            RequestQuery: {};
            ResponseBody: Json<PreviewJobResponse | ErrorResponse>;
        };
    };
    "/api/generate/invoice/:id": {
        "GET": {
            RequestPath: {
    id: string;
};
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Json<PreviewJobResponse | ErrorResponse>;
        };
    };
    "/api/templates": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetTemplateTranslationsFn>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetTemplateTranslationsFn> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    language_code: string;
    language_name: string;
    opening: string;
    invoice: string;
    table_headers: {
        description: string;
        quantity: string;
        unit_price: string;
        subtotal: string;
        total: string;
    };
    affects: string;
    reported_period: string;
    bank_name: string;
    account_beneficiary: string;
    account_number: string;
    bank_code: string;
    thanks: string;
}>;
            RequestQuery: Backend.InferHandlerParams<PostTemplateTranslationsFn>;
            ResponseBody: Json<Pick<IInvoiceTemplateTranslation, "_id" | "language"> | ErrorResponse>;
        };
    };
    "/api/templates/:id": {
        "PATCH": {
            RequestPath: {
    id?: string;
};
            RequestBody: Json<Backend.InferRequestBody<PatchTemplateTranslationsFn>>;
            RequestQuery: Backend.InferHandlerParams<PatchTemplateTranslationsFn>;
            ResponseBody: Json<Backend.InferHandlerResponse<PatchTemplateTranslationsFn> | ErrorResponse>;
        };
    };
    "/api/modifier-viewer-translations": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: GetTranslationsQuery;
            ResponseBody: Json<ErrorResponse | {
    rows: IModifierViewerTranslation[];
}>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<UpsertTranslationBody>;
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | IModifierViewerTranslation>;
        };
    };
    "/api/modifiers": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetModifiersExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetModifiersExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<Backend.InferRequestBody<PostModifierExecutor>>;
            RequestQuery: Backend.InferHandlerParams<PostModifierExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<PostModifierExecutor> | ErrorResponse>;
        };
    };
    "/api/modifiers/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<PatchModifierExecutor>>;
            RequestQuery: {};
            ResponseBody: Json<Backend.InferHandlerResponse<PatchModifierExecutor> | ErrorResponse>;
        };
    };
    "/api/notes-translations/translate": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    text: string;
    source_language_code: string;
    target_language_code: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<TranslationResponse | ErrorResponse>;
        };
    };
    "/api/upload": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<UploadRequestBody>;
            RequestQuery: {};
            ResponseBody: Json<UploadResponse | ErrorResponse>;
        };
    };
    "/api/users": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<UserGetExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<UserGetExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Pick<IUser, "username" | "email" | "role">;
            RequestQuery: Backend.InferHandlerParams<UsersPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<UsersPostExecutor> | ErrorResponse>;
        };
    };
    "/api/users/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Partial<Pick<IUser, "username" | "email" | "role">>;
            RequestQuery: {};
            ResponseBody: Json<Backend.InferHandlerResponse<UserPatchExecutor> | ErrorResponse>;
        };
        "DELETE": {
            RequestPath: {
    id: string;
};
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    error: false;
}>;
        };
    };
    "/api/users/register/:token_id": {
        "POST": {
            RequestPath: {
    token_id: string;
};
            RequestBody: Json<{
    password: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    message: string;
    error: false;
}>;
        };
    };
    "/api/viewers": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetViewersExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetViewersExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<Backend.InferRequestBody<PostViewerExecutor>>;
            RequestQuery: Backend.InferHandlerParams<PostViewerExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<PostViewerExecutor> | ErrorResponse>;
        };
    };
    "/api/viewers/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<PatchViewerExecutor>>;
            RequestQuery: Backend.InferHandlerParams<PatchViewerExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<PatchViewerExecutor> | ErrorResponse>;
        };
    };
    "/api/auth/register": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    username: string;
    email: string;
    password: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<ReturnResponse>;
        };
    };
    "/api/auth/login": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    email: string;
    password: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<Account>;
        };
    };
    "/api/auth/logout": {
        "POST": {
            RequestPath: never;
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ReturnResponse>;
        };
    };
    "/api/auth/me": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Json<Account>;
        };
    };
    "/api/auth/forgot-password": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    email: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<ReturnResponse>;
        };
    };
    "/api/auth/reset-password": {
        "POST": {
            RequestPath: never;
            RequestBody: Json<{
    token: string;
    newPassword: string;
}>;
            RequestQuery: {};
            ResponseBody: Json<ReturnResponse>;
        };
    };
    "/api/auth/verify-email": {
        "GET": {
            RequestPath: never;
            RequestBody: {};
            RequestQuery: {
    token: string;
};
            ResponseBody: Json<ReturnResponse>;
        };
    };
    "/api/invoices": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<GetInvoicesFn>;
            ResponseBody: Json<Backend.InferHandlerResponse<GetInvoicesFn> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: InvoiceInput;
            RequestQuery: Backend.InferHandlerParams<PostInvoiceFn>;
            ResponseBody: Json<Backend.InferHandlerResponse<PostInvoiceFn> | ErrorResponse>;
        };
    };
    "/api/invoice-groups/by-issuer": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Json<{
    groups: {
        [key: string]: string[];
    };
} | ErrorResponse>;
        };
    };
    "/api/invoices/availability/number": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: {
    index?: number;
    baseInvoiceId?: string;
};
            ResponseBody: Json<{
    available: boolean;
    takenByBaseInvoiceId?: string;
} | ErrorResponse>;
        };
    };
    "/api/invoices/:id/version-graph": {
        "GET": {
            RequestPath: {
    id: string;
};
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Json<{
    nodes: Record<string, InvoiceVersionGraphNode>;
    adjacency: Record<string, InvoiceVersionGraphEdge[]>;
    root_ids: string[];
    current_invoice_id: string;
} | ErrorResponse>;
        };
    };
    "/api/invoices/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Partial<Omit<InvoiceInput, "base_invoice">>;
            RequestQuery: Backend.InferHandlerParams<PatchInvoiceFn>;
            ResponseBody: Json<Backend.InferHandlerResponse<PatchInvoiceFn, IInvoiceChangeLog | null> | ErrorResponse>;
        };
        "DELETE": {
            RequestPath: {
    id: string;
};
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    error: false;
}>;
        };
    };
    "/api/draft/invoices/seqnum/:base_company_id": {
        "GET": {
            RequestPath: {
    base_company_id?: string;
};
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Json<{
    seqNum: number;
} | ErrorResponse>;
        };
    };
    "/api/invoice/jobs/:id": {
        "GET": {
            RequestPath: {
    id: string;
};
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: PdfJobStatus | ErrorResponse;
        };
    };
    "/api/invoice/artifacts/:id": {
        "GET": {
            RequestPath: {
    id: string;
};
            RequestBody: never;
            RequestQuery: {};
            ResponseBody: Buffer | ErrorResponse;
        };
    };
    "/api/companies": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<CompaniesGetExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CompaniesGetExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<Pick<ICompany, "name" | "details"> & {
    tags?: string[];
}>;
            RequestQuery: {};
            ResponseBody: Json<Backend.InferHandlerResponse<CompanyPostExecutor> | ErrorResponse>;
        };
    };
    "/api/companies/:id/version": {
        "POST": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<{
    name: string;
    details: CompanyDetails;
}>;
            RequestQuery: Backend.InferHandlerParams<CompanyPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CompanyPostExecutor> | ErrorResponse>;
        };
    };
    "/api/companies/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<CompaniesPatchExecutor>>;
            RequestQuery: Backend.InferHandlerParams<CompaniesPatchExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CompaniesPatchExecutor> | ErrorResponse>;
        };
        "DELETE": {
            RequestPath: {
    id: string;
};
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    error: false;
}>;
        };
    };
    "/api/companies/:id/metadata": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<CompanyMetadataPatchExecutor>>;
            RequestQuery: Backend.InferHandlerParams<CompanyMetadataPatchExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CompanyMetadataPatchExecutor> | ErrorResponse>;
        };
    };
    "/api/products": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<ProductsGetExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<ProductsGetExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<Pick<IProduct, "name" | "details"> & {
    base_owner_company: string;
    tags?: string[];
}>;
            RequestQuery: Backend.InferHandlerParams<ProductsPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<ProductsPostExecutor> | ErrorResponse>;
        };
    };
    "/api/products/:id/version": {
        "POST": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<{
    name: string;
    details: ProductDetails;
}>;
            RequestQuery: Backend.InferHandlerParams<ProductsPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<ProductsPostExecutor> | ErrorResponse>;
        };
    };
    "/api/products/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<ProductsPatchExecutor>>;
            RequestQuery: {};
            ResponseBody: Json<Backend.InferHandlerResponse<ProductsPatchExecutor> | ErrorResponse>;
        };
        "DELETE": {
            RequestPath: {
    id: string;
};
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    error: false;
}>;
        };
    };
    "/api/products/:id/metadata": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<ProductMetadataPatchExecutor>>;
            RequestQuery: Backend.InferHandlerParams<ProductMetadataPatchExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<ProductMetadataPatchExecutor> | ErrorResponse>;
        };
    };
    "/api/customers": {
        "GET": {
            RequestPath: never;
            RequestBody: never;
            RequestQuery: Backend.InferHandlerParams<CustomerGetExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CustomerGetExecutor> | ErrorResponse>;
        };
        "POST": {
            RequestPath: never;
            RequestBody: Json<Pick<ICustomer, "details"> & {
    base_customer?: string;
    tags?: string[];
}>;
            RequestQuery: Backend.InferHandlerParams<CustomerPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CustomerPostExecutor> | ErrorResponse>;
        };
    };
    "/api/customers/:id/version": {
        "POST": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<{
    details: CustomerDetails;
}>;
            RequestQuery: Backend.InferHandlerParams<CustomerPostExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CustomerPostExecutor> | ErrorResponse>;
        };
    };
    "/api/customers/:id": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<CustomerPatchExecutor>>;
            RequestQuery: {};
            ResponseBody: Json<Backend.InferHandlerResponse<CustomerPatchExecutor> | ErrorResponse>;
        };
        "DELETE": {
            RequestPath: {
    id: string;
};
            RequestBody: {};
            RequestQuery: {};
            ResponseBody: Json<ErrorResponse | {
    error: false;
}>;
        };
    };
    "/api/customers/:id/metadata": {
        "PATCH": {
            RequestPath: {
    id: string;
};
            RequestBody: Json<Backend.InferRequestBody<CustomerMetadataPatchExecutor>>;
            RequestQuery: Backend.InferHandlerParams<CustomerMetadataPatchExecutor>;
            ResponseBody: Json<Backend.InferHandlerResponse<CustomerMetadataPatchExecutor> | ErrorResponse>;
        };
    };
};