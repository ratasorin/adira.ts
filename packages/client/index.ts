import {
  GroupOperationsDefinition,
  Frontend,
  GroupByDefinition,
  Leafs,
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
  API extends Record<string, Partial<Record<Frontend.HTTPMethod, any>>>,
>(
  baseUrl: string,
) => {
  return async function apiCall<
    Metadata extends Frontend.ExtractMetadata<Endpoint, Method>,
    Full extends Frontend.ExtractFull<Metadata>,
    PublicPaths extends Frontend.PublicAPIPaths<API>,
    Path extends keyof PublicPaths,
    Method extends Frontend.APIMethods<
      API,
      PublicPaths[Path & string] & string
    >,
    Include extends Frontend.ExtractReqInclude<Endpoint, Method>,
    Select extends Frontend.ExtractReqSelect<Endpoint, Method, Include>,
    GroupOperations extends GroupOperationsDefinition<Full>,
    Data extends Frontend.ExtractReqBody<Endpoint, Method>,
    QueryParams extends Frontend.ExtractQueryParams<Endpoint, Method>,
    PathParam extends Frontend.ExtractReqPath<Endpoint, Method>,
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
        ? { groupBy?: GroupByDefinition<Leafs<Full>[], GroupOperations> }
        : {}) &
        QueryParams;
      data?: Method extends "GET" ? never : Data;
      path?: PathParam;
    },
  ): Promise<
    Frontend.ExtractResBody<Endpoint, Method, Include, Select, GroupOperations>
  > {
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
