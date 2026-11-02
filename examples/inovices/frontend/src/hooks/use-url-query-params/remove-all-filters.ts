import { REMOVE_ALL_URL_FILTERS } from "./constant";
type ClearAllCallback = () => void;
export class ClearAllManager {
    private static instance: ClearAllManager;
    private listeners = new Set<ClearAllCallback>();
    private constructor() {
        document.addEventListener(REMOVE_ALL_URL_FILTERS, this.emit);
    }
    static getInstance() {
        if (!ClearAllManager.instance) {
            ClearAllManager.instance = new ClearAllManager();
        }
        return ClearAllManager.instance;
    }
    private emit = () => {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.pushState({}, "", url);
        for (const listener of this.listeners) {
            listener();
        }
    };
    subscribe(listener: ClearAllCallback) {
        this.listeners.add(listener);
    }
    unsubscribe(listener: ClearAllCallback) {
        this.listeners.delete(listener);
    }
}
