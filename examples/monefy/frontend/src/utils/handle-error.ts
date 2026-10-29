import { addToast } from "@heroui/toast";
import { ErrorResponse } from "@monefy/types/src/types";
import axios from "axios";
export const displayError = <PossibleError>(error: unknown, title?: string) => {
    let errorMessage: string = "";
    if (axios.isAxiosError<PossibleError>(error)) {
        if (error.response?.data && isErrorMessage(error.response?.data))
            errorMessage += `${error.response.data.message} `;
        const status = error.response?.status ?? error.status;
        if (!status || status < 400) {
            errorMessage ||= error.message;
            addToast({
                title: title || "[Error] Something went wrong!",
                description: errorMessage,
                color: "danger",
            });
            return;
        }
        // Log specific error messages based on the error status code
        switch (status) {
            case 400:
                errorMessage += `Bad Request (400)`;
                break;
            case 401:
                errorMessage += `Unauthorized (401)`;
                break;
            case 402:
                errorMessage += `Payment Required (402)`;
                break;
            case 403:
                errorMessage += `Forbidden (403)`;
                break;
            case 404:
                errorMessage += `Not Found (404)`;
                break;
            case 405:
                errorMessage += `Method Not Allowed (405)`;
                break;
            case 406:
                errorMessage += `Not Acceptable (406)`;
                break;
            case 407:
                errorMessage += `Proxy Authentication Required (407)`;
                break;
            case 408:
                errorMessage += `Request Timeout (408)`;
                break;
            case 409:
                errorMessage += `Conflict (409)`;
                break;
            case 410:
                errorMessage += `Gone (410)`;
                break;
            case 411:
                errorMessage += `Length Required (411)`;
                break;
            case 412:
                errorMessage += `Precondition Failed (412)`;
                break;
            case 413:
                errorMessage += `Payload Too Large (413)`;
                break;
            case 414:
                errorMessage += `URI Too Long (414)`;
                break;
            case 415:
                errorMessage += `Unsupported Media Type (415)`;
                break;
            case 416:
                errorMessage += `Range Not Satisfiable (416)`;
                break;
            case 417:
                errorMessage += `Expectation Failed (417)`;
                break;
            case 426:
                errorMessage += `Upgrade Required (426)`;
                break;
            case 429:
                errorMessage = `Too Many Requests (429)`;
                break;
            case 500:
                errorMessage += `Internal Server Error (500)`;
                break;
            case 501:
                errorMessage += `Not Implemented (501)`;
                break;
            case 502:
                errorMessage += `Bad Gateway (502)`;
                break;
            case 503:
                errorMessage += `Service Unavailable (503)`;
                break;
            case 504:
                errorMessage += `Gateway Timeout (504)`;
                break;
            case 505:
                errorMessage += `HTTP Version Not Supported (505)`;
                break;
            case 507:
                errorMessage += `Insufficient Storage (507)`;
                break;
            case 508:
                errorMessage += `Loop Detected (508)`;
                break;
            case 510:
                errorMessage += `Not Extended (510)`;
                break;
            default:
                errorMessage += `Unexpected Error (${status})`;
                break;
        }
    }
    else if (error instanceof Error) {
        errorMessage = error.message;
    }
    addToast({
        title: title || "[Error] Something went wrong!",
        description: errorMessage,
        color: "danger",
    });
};
const isErrorMessage = <T>(data: ErrorResponse | T | undefined): data is ErrorResponse => {
    return (data as ErrorResponse).error;
};
