import { Suspense, lazy } from "react";
import { ThemeProvider as OwnThemeProvider, useThemeMode, } from "./context/theme";
import "react-toastify/dist/ReactToastify.css";
import "reactflow/dist/style.css";
import "./index.css";
import { lightTheme, darkTheme } from "./theme";
import { Route, Routes } from "react-router-dom";
import { useNavigate, useHref } from "react-router";
import Loading from "./components/Loading";
import { Spinner } from "@heroui/react";
import { InvoiceProvider } from "./context/invoice";
import UnloadCoinAnimation from "./components/Loading/unload";
const AuthProvider = lazy(() => import("./context/auth").then((p) => ({ default: p.AuthProvider })));
const LayoutWithNavbar = lazy(() => import("./layouts/with-navbar"));
const Profile = lazy(() => import("./pages/profile"));
const CheckLoadingAuth = lazy(() => import("./components/check-auth"));
const RequireAuth = lazy(() => import("./components/require-auth"));
const LoginPage = lazy(() => import("./pages/login"));
const VerifyEmail = lazy(() => import("./pages/verify-email"));
const SetPassword = lazy(() => import("./pages/set-password"));
const HomePage = lazy(() => import("./pages/home"));
const ResetPassword = lazy(() => import("./components/reset-password"));
const HeroUIProvider = lazy(() => import("@heroui/system").then((p) => ({ default: p.HeroUIProvider })));
const ToastContainer = lazy(() => import("react-toastify").then((p) => ({ default: p.ToastContainer })));
const ToastProvider = lazy(() => import("@heroui/toast").then((p) => ({ default: p.ToastProvider })));
const ThemeProvider = lazy(() => import("@mui/material/styles").then((p) => ({ default: p.ThemeProvider })));
const CssBaseline = lazy(() => import("@mui/material/CssBaseline"));
const ThemedApp = () => {
    const { isDarkMode } = useThemeMode();
    const navigate = useNavigate();
    return (<Suspense fallback={<Loading message="Loading Dynamic Content"/>}>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <ToastProvider></ToastProvider>
        <ToastContainer />
        <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
          <CssBaseline enableColorScheme/>
          <AuthProvider>
            <Routes>
              <Route element={<RequireAuth>
                    <InvoiceProvider>
                      <LayoutWithNavbar />
                    </InvoiceProvider>
                  </RequireAuth>}>
                <Route path="/" element={<Suspense fallback={<div className="w-full h-96 flex items-center justify-center">
                          <Spinner variant="spinner" size="lg"/>
                        </div>}>
                      <HomePage />
                    </Suspense>}/>
                <Route path="/profile" element={<Suspense fallback={<div className="w-full h-96 flex items-center justify-center">
                          <Spinner variant="spinner" size="lg"/>
                        </div>}>
                      <Profile />
                    </Suspense>}/>
              </Route>

              <Route path="/login" element={<CheckLoadingAuth>
                    <UnloadCoinAnimation>
                      <LoginPage />
                    </UnloadCoinAnimation>
                  </CheckLoadingAuth>}/>
              <Route path="/verify-email" element={<VerifyEmail />}/>
              <Route path="/set-password" element={<SetPassword />}/>
              <Route path="/reset-password" element={<CheckLoadingAuth>
                    <UnloadCoinAnimation>
                      <ResetPassword />
                    </UnloadCoinAnimation>
                  </CheckLoadingAuth>}/>

              <Route path="*" element={<div>Not Found</div>}/>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </HeroUIProvider>
    </Suspense>);
};
function App() {
    return (<OwnThemeProvider>
      <ThemedApp />
    </OwnThemeProvider>);
}
export default App;
