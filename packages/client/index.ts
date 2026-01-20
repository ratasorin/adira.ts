import { Frontend } from "@n/adira.core.ts";
import axios, { type AxiosRequestConfig } from "axios";

const replacePathParams = (
  path: string | number | symbol,
  pathParams?: any,
): string => {
  path = String(path);
  if (!pathParams) return path;
  return path.replace(/:([^/]+)/g, (_, key) => {
    const val = pathParams[key];
    if (val === undefined) {
      throw new Error(`Missing path param: ${key}`);
    }
    return encodeURIComponent(String(val));
  });
};

export const createAxiosApiClient: Frontend.CreateAxiosApiClient = (
  baseUrl,
  __,
) => {
  type API = NonNullable<typeof __>;
  return (path, method) => {
    if (method === "GET") {
      const fetchData: Frontend.AxiosApiClientQuery<
        API,
        typeof path & string
      > = async (query, pathParam) => {
        const fullPath = replacePathParams(path, pathParam);
        const fullUrl = `${baseUrl}/api${fullPath.startsWith("/") ? fullPath : `/${fullPath}`}`;

        const config: AxiosRequestConfig = {
          method: "get",
          url: fullUrl,
          params: query,
        };

        const response = await axios(config);
        return response.data;
      };

      return fetchData as any;
    } else {
      let updatedMethod: "POST" | "PATCH" | "DELETE" = method;
      const mutateData: Frontend.AxiosApiClientMutate<
        API,
        typeof path & string,
        typeof updatedMethod
      > = async (data, pathParam) => {
        const fullPath = replacePathParams(path, pathParam);
        const fullUrl = `${baseUrl}/api${fullPath.startsWith("/") ? fullPath : `/${fullPath}`}`;

        const config: AxiosRequestConfig = {
          method: method.toLowerCase(),
          url: fullUrl,
          data,
        };

        const response = await axios(config);
        return response.data;
      };
      return mutateData as any;
    }
  };
};

// Backward compatibility
export const createApiClient = createAxiosApiClient;
