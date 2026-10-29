const verificationRequests = new Map<string, Promise<boolean>>();
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Unload from "../components/Loading/unload";
import { useAuth } from "../context/auth";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [navigate, isAuthenticated]);

  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [countDown, setCountDown] = useState(5);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    let active = true;
    // StrictMode can remount effects; share the same verification request.
    const key = `monefy-verify-${token}`;
    const pending =
      verificationRequests.get(key) ||
      fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`).then(
        (res) => res.ok,
      );
    verificationRequests.set(key, pending);
    pending
      .then((ok) => {
        if (active) setStatus(ok ? "success" : "error");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (status !== "success") return;

    const timer = setInterval(() => {
      setCountDown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, navigate]);

  if (isAuthenticated) return <h3>Already authenticated! Redirecting!</h3>;

  return (
    <div style={{ textAlign: "center", fontSize: "20px", marginTop: "20px" }}>
      {status === "loading" && <p>Checking token...</p>}
      {status === "success" && (
        <p>
          Email successfully verified! Redirecting to login in: {countDown}{" "}
          seconds
        </p>
      )}
      {status === "error" && (
        <p style={{ color: "red" }}>Invalid or expired token.</p>
      )}
    </div>
  );
};

export default function CompleteVerifyEmail() {
  return (
    <Unload>
      <VerifyEmail />
    </Unload>
  );
}
