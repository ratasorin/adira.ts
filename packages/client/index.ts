import { Frontend } from "@n/adira.core.ts";
import axios, { type AxiosRequestConfig } from "axios";

const identity = <T>(t: T) => t;

const replacePathParams = (
  path: string | number | symbol,
  pathParams?: any,
): string => {
  const pathStr = String(path);
  if (!pathParams) return pathStr;
  return pathStr.replace(/:([^/]+)/g, (_, key) => {
    const val = pathParams[key];
    if (val === undefined) {
      throw new Error(`Missing path param: ${key}`);
    }
    return encodeURIComponent(String(val));
  });
};

/**
 * Normalizes query parameters by executing identity-function helpers
 * for rows and groups if they are provided as callbacks.
 */
const normalizeQuery = (rawQuery: any) => {
  if (!rawQuery) return {};
  const { rows, groups, ...rest } = rawQuery;
  return {
    ...rest,
    rows: typeof rows === "function" ? rows(identity) : rows,
    groups: typeof groups === "function" ? groups(identity) : groups,
  };
};

export const createAxiosApiClient: Frontend.CreateAxiosApiClient = (
  baseUrl,
  __,
) => {
  type API = NonNullable<typeof __>;

  return (path, method) => {
    const apiPath = `/api${String(path).startsWith("/") ? path : `/${String(path)}`}`;

    if (method === "GET") {
      const fetchData = (
        params: Frontend.AxiosQueryFunctionParams<any, any>,
      ) => {
        return {
          run: async () => {
            const { query, path: pathParam } = params;
            const resolvedPath = replacePathParams(apiPath, pathParam);

            const config: AxiosRequestConfig = {
              method: "get",
              url: `${baseUrl}${resolvedPath}`,
              params: normalizeQuery(query),
            };

            const response = await axios(config);
            return response.data;
          },
        };
      };
      return fetchData as Frontend.AxiosApiClientQuery<API, typeof path>;
    } else {
      const mutateData: Frontend.AxiosApiClientMutate<
        API,
        typeof path & string,
        any,
        any
      > = (params: any) => {
        return {
          run: async () => {
            const { data, query, path: pathParam } = params;
            const resolvedPath = replacePathParams(apiPath, pathParam);

            const config: AxiosRequestConfig = {
              method: String(method).toLowerCase(),
              url: `${baseUrl}${resolvedPath}`,
              data,
              // Mutations can now pass include/select via query params
              params: normalizeQuery(query),
            };

            const response = await axios(config);
            return response.data;
          },
        };
      };
      return mutateData as any;
    }
  };
};

export const createApiClient = createAxiosApiClient;
