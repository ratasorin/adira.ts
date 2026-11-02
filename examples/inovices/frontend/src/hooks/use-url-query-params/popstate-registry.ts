import { handlePopstateSpamAware } from "./back-spam";
type Callback = () => void;
const subscribers = new Set<Callback>();
let isListenerAttached = false;
function notifySubscribers() {
    for (const callback of subscribers) {
        try {
            callback();
        }
        catch (error) {
            console.error("[popstateRegistry] Subscriber threw:", error);
        }
    }
}
function handlePopstateEvent() {
    handlePopstateSpamAware();
    notifySubscribers();
}
/**
 * Subscribes a callback to the singleton popstate handler.
 * Automatically sets up and tears down the global listener.
 */
export function subscribeToPopstate(callback: Callback): () => void {
    subscribers.add(callback);
    if (!isListenerAttached) {
        window.addEventListener("popstate", handlePopstateEvent);
        isListenerAttached = true;
    }
    return () => {
        subscribers.delete(callback);
        if (isListenerAttached) {
            window.removeEventListener("popstate", handlePopstateEvent);
            isListenerAttached = false;
        }
    };
}
