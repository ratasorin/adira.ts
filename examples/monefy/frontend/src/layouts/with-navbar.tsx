import { Outlet } from "react-router-dom";
import Navbar from "../components/navbar";
import UnloadCoinAnimation from "../components/Loading/unload";
export default function LayoutWithNavbar() {
    return (<UnloadCoinAnimation>
      <div style={{ display: "flex" }}>
        <Navbar />
        <div style={{
            padding: "2rem",
            flex: 1,
            maxHeight: "100vh",
            overflow: "auto",
        }} className="bg-zinc-100 dark:bg-zinc-900">
          <div style={{
            width: "100%",
            overflowY: "visible",
            backgroundColor: "var(--color-background-paper)",
            padding: "2rem",
            minHeight: "100%",
            borderRadius: "12px",
            position: "relative",
            zIndex: 0,
        }} className="@container/layout-parent" data-container="layout-parent">
            <Outlet />
          </div>
        </div>
      </div>
    </UnloadCoinAnimation>);
}
