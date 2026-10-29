import { FC, ReactNode } from "react";
import { useAuth } from "../context/auth";
import Loading from "./Loading";
const CheckLoadingAuth: FC<{
    children: ReactNode;
}> = ({ children }) => {
    const { loading } = useAuth();
    if (loading)
        return <Loading message="Gathering User Data"/>;
    return children;
};
export default CheckLoadingAuth;
