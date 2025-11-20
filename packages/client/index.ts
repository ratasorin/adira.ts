import {
  GroupOperationsDefinition,
  APIMethods,
  GroupBy,
  HTTPMethod,
  InferBaseAndPopulated,
  InferQueryParams,
  InferResponseBody,
  PublicAPIPaths,
  RequestBody,
  RequestParamInclude,
  RequestParamSelect,
  InferRequestPath,
} from "@n/adira.core.ts";
import axios, { type AxiosRequestConfig } from "axios";
export * from "@n/adira.core.ts";

const replacePathParams = (path: string, pathParams?: any): string => {
  if (!pathParams) return path;
  return path.replace(/:([^/]+)/g, (_, key) => {
    const val = pathParams[key];
    if (val === undefined) {
      throw new Error(`Missing path param: ${key}`);
    }
    return encodeURIComponent(String(val));
  });
};

export const createApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
) => {
  return async function apiCall<
    PublicPaths extends PublicAPIPaths<API>,
    Path extends keyof PublicPaths,
    Method extends APIMethods<API, PublicPaths[Path & string] & string>,
    Include extends RequestParamInclude<Endpoint, Method>,
    Select extends RequestParamSelect<Endpoint, Method, Include>,
    Agg extends GroupOperationsDefinition<Full>,
    Full extends InferBaseAndPopulated<Endpoint, Method>["full"],
    Data extends RequestBody<Endpoint, Method>,
    QueryParams extends InferQueryParams<Endpoint, Method>,
    PathParam extends InferRequestPath<Endpoint, Method>,
    Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
  >(
    url: Path,
    method: Method,
    {
      data,
      path,
      query,
    }: {
      query?: { include: Include; select: Select } & (Method extends "GET"
        ? { groupBy?: GroupBy<Full, Agg> }
        : {}) &
        QueryParams;
      data?: Data;
      path?: PathParam;
    },
  ): Promise<InferResponseBody<Endpoint, Method, Include, Select, Agg>> {
    const fullPath = replacePathParams(url as string, path);
    const fullUrl = `${baseUrl}${
      fullPath.startsWith("/") ? fullPath : `/${fullPath}`
    }`;

    const config: AxiosRequestConfig = {
      method: method.toLowerCase() as any,
      url: fullUrl,
      params: query,
      data,
    };
    const response = await axios(config);
    return response.data as any;
  };
};
