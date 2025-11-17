import { IUser } from '../src/models/User';

export type InvoicifyAPI = {
  "/users": {
    "GET": {
      ResponseBody?: IUser[];
    };
    "POST": {
      RequestParams?: {};
      RequestBody?: { name: string; email: string; age: number };
      ResponseBody?: IUser & { age: number };
    };
  };
};
