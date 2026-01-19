import { Frontend } from "@n/adira.core.ts";
import axios, { type AxiosRequestConfig } from "axios";

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

export const createAxiosApiClient: Frontend.CreateAxiosApiClient = (
  baseUrl,
) => {
  return async (url, method, { data, path, query }) => {
    const fullPath = replacePathParams(url as string, path);
    const fullUrl = `${baseUrl}${fullPath.startsWith("/") ? fullPath : `/${fullPath}`}`;

    const config: AxiosRequestConfig = {
      method: method.toLowerCase() as any,
      url: fullUrl,
      params: query,
      data,
    };

    const response = await axios(config);
    return response.data;
  };
};

// Backward compatibility
export const createApiClient = createAxiosApiClient;
