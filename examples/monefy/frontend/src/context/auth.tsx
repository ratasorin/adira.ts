import { isAxiosError } from "axios";
import { expectSuccess } from "../services/api";
import React, { createContext, useState, useContext, useEffect, useCallback, } from "react";
import { displayError } from "../utils/handle-error";
import { api } from "../services/api";
const MIN_LOADING_TIME = 600;
type LoginParams = {
    email: string;
    password: string;
};
const doLogin = (params: LoginParams) => {
    const { run } = api("/auth/login", "POST")({ data: params });
    return run().then(expectSuccess).then((res) => {
        return res;
    });
};
const doCheckAuth = () => {
    const { run } = api("/auth/me", "GET")({query: {} });
    return run().then(expectSuccess).then((res) => {
        return res;
    });
};
const doCheckout = () => {
    const { run } = api("/auth/logout", "POST")({data: {}, });
    return run().then(expectSuccess).then((res) => {
        return res.message;
    });
};
type User = NonNullable<Awaited<ReturnType<typeof doLogin>>> & {
    email: string;
};
type AuthContextType = {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<string | null>;
    logout: () => Promise<string | null>;
    checkAuth: () => void;
    loading: boolean;
};
const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    login: async () => "",
    logout: async () => "",
    checkAuth: async () => { },
    loading: true,
});
export const AuthProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children, }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        const started = Date.now();
        let timer: ReturnType<typeof setTimeout>;
        doCheckAuth().then(user => { if (active) setUser(user); }).catch(() => {}).finally(() => {
            timer = setTimeout(() => { if (active) setLoading(false); }, Math.max(0, MIN_LOADING_TIME - (Date.now() - started)));
        });
        return () => { active = false; clearTimeout(timer); };
    }, []);
    const login = async (email: string, password: string) => {
        try {
            const user = await doLogin({ email, password });
            if (user) {
                setUser(user);
                return "Login Successfull";
            }
            return null;
        }
        catch (err) {
            displayError(err, "[Error] Cannot login!");
            return null;
        }
    };
    const checkAuth = useCallback(async () => {
        try {
            const user = await doCheckAuth();
            if (user) {
                setUser(user);
            }
        }
        catch (err) {
            if (isAxiosError(err) && err.response?.status === 401) {
                setUser(null);
                return;
            }
            displayError(err, "[Error] Cannot validate user!");
        }
    }, []);
    const logout = async () => {
        try {
            const message = await doCheckout();
            if (message) {
                setUser(null);
                return message;
            }
            return null;
        }
        catch (err) {
            displayError(err, "[Error] Cannot logout!");
            return null;
        }
        finally {
            setUser(null);
        }
    };
    return (<AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            logout,
            checkAuth,
            loading,
        }}>
      {children}
    </AuthContext.Provider>);
};
export const useAuth = () => useContext(AuthContext);
