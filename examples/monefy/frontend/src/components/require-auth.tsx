import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import CheckLoadingAuth from "./check-auth";
interface RequireAuthProps {
    children: ReactNode;
}
export default function RequireAuth({ children }: RequireAuthProps) {
    const { isAuthenticated, loading, checkAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        if (!loading && isAuthenticated) checkAuth();
    }, [location.pathname, checkAuth, loading, isAuthenticated]);
    useEffect(() => {
        if (!loading && !isAuthenticated)
            navigate("/login");
    }, [isAuthenticated, loading, navigate]);
    return <CheckLoadingAuth>{isAuthenticated && children}</CheckLoadingAuth>;
}
