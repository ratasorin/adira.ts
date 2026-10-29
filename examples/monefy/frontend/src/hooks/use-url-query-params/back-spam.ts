import { PARAM_HISTORY_COUNT } from "./constant";
const SPAM_TIME_WINDOW_MS = 600;
const SPAM_THRESHOLD = 5;
let backPressTimestamps: number[] = [];
const tryGoBack = (delta: number, timeout = 100) => {
    return new Promise<number>((resolve, reject) => {
        const before = window.location.href;
        window.history.go(-delta);
        setTimeout(() => {
            const after = window.location.href;
            console.log({ before, after, equal: before === after });
            if (before === after) {
                reject(new Error(`❌ window.history.go(-${delta}) likely failed`));
            }
            else
                resolve(delta);
        }, timeout);
    });
};
function handleBackSpamDetected() {
    console.log("🔥 Detected back spam");
    const count = window.history.state[PARAM_HISTORY_COUNT] || 0;
    if (count) {
        tryGoBack(count)
            .then((delta) => {
            console.log(`✅ window.history.go(-${delta}) worked`);
        })
            .catch((err) => {
            console.log(`[ERROR::tryGoBack] ${err.message}`);
        })
            .finally(() => {
            console.log("📦 Back spam handled");
        });
    }
}
export function handlePopstateSpamAware() {
    const now = Date.now();
    // Add current timestamp
    backPressTimestamps.push(now);
    const currentCount = window.history.state[PARAM_HISTORY_COUNT] || 0;
    console.log("The no. of remaining states:", currentCount > 0 ? currentCount - 1 : "NONE (currently at 0)");
    // Remove old timestamps (outside of time window)
    backPressTimestamps = backPressTimestamps.filter((timestamp) => now - timestamp <= SPAM_TIME_WINDOW_MS);
    // Trigger spam logic immediately if threshold is reached
    if (backPressTimestamps.length >= SPAM_THRESHOLD) {
        handleBackSpamDetected();
        // Reset
        backPressTimestamps.length = 0;
    }
}
