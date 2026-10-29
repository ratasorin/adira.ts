import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
const mountReactApp = () => {
    if (Date.now() - window.pageLoadTime > window.MIN_ANIMATION) {
        document.body.removeChild(document.getElementById("RESOURCE-TRACKER")!);
        createRoot(document.getElementById("root")!).render(<StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>);
    }
    else
        requestAnimationFrame(mountReactApp);
};
requestAnimationFrame(mountReactApp);
