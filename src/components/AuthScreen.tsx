import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLoginMutation } from "@/store/api/authApi";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";
import { useToast } from "@/components/ui/custom-toaster";
import { Spinner } from "@/components/ui/loading";
import { dataInitializer } from "@/services/dataInitializer";
import { useSendOTPMutation, useVerifyOTPMutation } from "@/store/api/authApi";
import { OtpVerification } from "./OtpVerification";
import { TbLockPassword } from "react-icons/tb";
import { FiEye, FiEyeOff } from "react-icons/fi";

// Color palette
const palette = {
  primary: "#cd0447",
  cherub: "#f6d0db",
  cranberry: "#e05b80",
  deepBlush: "#e77b9c",
  carissma: "#e7849c",
  cabaret: "#dc3c74",
  maroonFlush: "#d41b5c",
};

export const AuthScreen = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration state
  const [regStep, setRegStep] = useState<"form" | "otp">("form");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCompanyName, setRegCompanyName] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regCountdown, setRegCountdown] = useState(0);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [login, { isLoading, error: loginApiError, isSuccess }] =
    useLoginMutation();
  const [sendOTP, { isLoading: isSendingOTP, error: sendOTPError }] =
    useSendOTPMutation();
  const [
    verifyOTP,
    {
      isLoading: isVerifyingOTP,
      error: verifyOTPError,
      isSuccess: isRegSuccess,
    },
  ] = useVerifyOTPMutation();

  const signUpNameInputRef = useRef<HTMLInputElement>(null);
  const loginEmailInputRef = useRef<HTMLInputElement>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Login error handling
  useEffect(() => {
    if (loginApiError) {
      const errorMessage =
        "data" in loginApiError
          ? (loginApiError.data as { message?: string })?.message ||
            "Login failed"
          : "Network error occurred";

      toast.error("Login Failed", errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginApiError]);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Login Successful", "Welcome to Iverto AI");
      setEmail("");
      setPassword("");
      navigate("/dashboard"); // Move navigation here for instant redirect
      (async () => {
        dataInitializer.clearCache();
        await dataInitializer.initialize();
        await dataInitializer.refreshCamerasData();
        // navigate("/dashboard"); // Remove navigation from here
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, dispatch, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login({ email, password }).unwrap();
      if (result.success && result.data) {
        const { token, refreshToken, user } = result.data;
        dispatch(setCredentials({ user, token, refreshToken }));
        if (user.isApproved === false) {
          toast.error(
            "Registration Pending",
            `Hey ${user.name}, your registration is pending approval.`
          );
        }
        // Remove duplicate success toast - it's handled in useEffect
      } else {
        toast.error("Login Failed", "Invalid response format");
      }
    } catch (err) {
      // Error is handled by the useEffect above
      console.error("Login error:", err);
    }
  };

  // Registration: OTP countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (regCountdown > 0) {
      timer = setTimeout(() => setRegCountdown(regCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [regCountdown]);

  useEffect(() => {
    if (isRegSuccess) {
      toast.success(
        "Registration Successful",
        "Welcome to Iverto AI! You are now logged in."
      );
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegCompanyName("");
      setRegOtp("");
      setRegStep("form");
      setIsSignUp(false); // Switch to login panel
      (async () => {
        dataInitializer.clearCache();
        await dataInitializer.initialize();
        navigate("/dashboard");
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegSuccess, dispatch, navigate]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword || !regCompanyName) {
      toast.error("Validation Error", "Please fill in all fields");
      return;
    }
    try {
      await sendOTP({
        name: regName,
        email: regEmail,
        companyName: regCompanyName,
      }).unwrap();
      setRegCountdown(60);
      toast.success(
        "OTP Sent",
        "Please check your email for the verification code."
      );
      // Navigate to OTP verification page with registration data
      navigate("/otp-verification", {
        state: {
          email: regEmail,
          name: regName,
          password: regPassword,
          companyName: regCompanyName,
        },
      });
    } catch (err: any) {
      console.error("Send OTP error:", err);
      // Show error toast immediately on every registration attempt
      const errorMessage =
        err?.data?.message || "Failed to send OTP. Please try again.";
      toast.error("Registration Error", errorMessage);
    }
  };

  const handleVerifyOTP = async (otpValue: string) => {
    try {
      const result = await verifyOTP({
        email: regEmail,
        otp: otpValue,
        name: regName,
        password: regPassword,
        companyName: regCompanyName,
      }).unwrap();
      if (result.success && result.data) {
        const { token, refreshToken, user } = result.data;
        dispatch(setCredentials({ user, token, refreshToken }));
        if (user.isApproved === false) {
          navigate("/pending-registration");
          return;
        }
        toast.success(
          "Registration Successful",
          "Welcome to Iverto AI! You are now logged in."
        );
        setRegName("");
        setRegEmail("");
        setRegPassword("");
        setRegCompanyName("");
        setRegOtp("");
        setRegStep("form");
        setIsSignUp(false);
        setTimeout(() => {
          loginEmailInputRef.current?.focus();
        }, 400);
        (async () => {
          dataInitializer.clearCache();
          await dataInitializer.initialize();
          navigate("/dashboard");
        })();
      } else {
        toast.error("Registration Failed", "Invalid response format");
      }
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      // Show error toast immediately on every OTP verification attempt
      const errorMessage =
        err?.data?.message || "OTP verification failed. Please try again.";
      toast.error("OTP Verification Error", errorMessage);
    }
  };

  const handleResendOTP = async () => {
    try {
      await sendOTP({
        name: regName,
        email: regEmail,
        companyName: regCompanyName,
      }).unwrap();
      setRegCountdown(60);
      toast.success(
        "OTP Resent",
        "A new verification code has been sent to your email."
      );
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      // Show error toast immediately on every resend attempt
      const errorMessage =
        err?.data?.message || "Failed to resend OTP. Please try again.";
      toast.error("Resend Error", errorMessage);
    }
  };

  const handleBackToForm = () => {
    setRegStep("form");
    setRegOtp("");
    setRegCountdown(0);
  };

  // OTP Verification step for registration
  if (isSignUp && regStep === "otp") {
    // REMOVE this block, navigation now handles OTP step
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: `url('/src/background.jpg') center center / cover no-repeat fixed`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        margin: 0,
      }}
    >
      <div
        className={`auth-container${isSignUp ? " right-panel-active" : ""}`}
        style={{
          background: "none",
          backgroundColor: "transparent",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow:
            "0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 32,
            marginBottom: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img
              src="/src/iverto.png"
              alt="Iverto Logo"
              style={{ width: 120, height: "auto" }}
            />
            <span
              style={{ color: "#cd0447", fontSize: 24, fontWeight: "bold" }}
            >
              iverto.ai
            </span>
          </div>
        </div>
        {/* Sign Up Panel */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSendOTP}>
            <h1 style={{ fontWeight: "bold", fontSize: 28, marginBottom: 8 }}>
              Create Account
            </h1>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: 14,
                  color: "#cd0447",
                }}
              >
                <svg width="28" height="28" fill="black" viewBox="2 -5 24 24">
                  <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </span>
              <input
                ref={signUpNameInputRef}
                type="text"
                placeholder="Name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={isSendingOTP}
                required
                autoComplete="username"
                style={{
                  paddingLeft: 36,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
            </div>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: 14,
                  color: "#cd0447",
                }}
              >
                <svg width="28" height="28" fill="black" viewBox="2 -2 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Company Name"
                value={regCompanyName}
                onChange={(e) => setRegCompanyName(e.target.value)}
                disabled={isSendingOTP}
                required
                autoComplete="organization"
                style={{
                  paddingLeft: 36,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
            </div>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 9,
                  top: 14,
                  color: "#cd0447",
                }}
              >
                <svg width="28" height="28" fill="black" viewBox="2 -5 24 24">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                disabled={isSendingOTP}
                required
                autoComplete="email"
                style={{
                  paddingLeft: 36,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
            </div>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 9,
                  top: 16,
                  color: "#cd0447",
                }}
              >
                <TbLockPassword
                  size={28}
                  color="black"
                  style={{ verticalAlign: "middle" }}
                />
              </span>
              <input
                type={showRegPassword ? "text" : "password"}
                placeholder="Password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                disabled={isSendingOTP}
                required
                autoComplete="new-password"
                style={{
                  width: "100%",
                  paddingRight: "40px",
                  paddingLeft: 36,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
              <span
                onClick={() => setShowRegPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 20,
                  top: 19,
                  cursor: "pointer",
                  color: "black",
                }}
                tabIndex={0}
                aria-label={showRegPassword ? "Hide password" : "Show password"}
              >
                {showRegPassword ? <FiEyeOff size={22} /> : <FiEye size={22} />}
              </span>
            </div>

            <button
              type="submit"
              disabled={
                isSendingOTP ||
                !regName ||
                !regEmail ||
                !regPassword ||
                !regCompanyName
              }
              style={{
                fontWeight: "bold",
                fontSize: 16,
                letterSpacing: 1,
                marginTop: 8,
                borderRadius: 20,
                boxShadow: "0 2px 8px rgba(205,4,71,0.08)",
                transition: "background 0.2s",
                background: "#cd0447",
                color: "#fff",
              }}
            >
              {isSendingOTP ? <span>Sending OTP...</span> : "Register"}
            </button>
            <div style={{ marginTop: 12, textAlign: "center", fontSize: 15 }}>
              Already have an account?{" "}
              <span
                style={{
                  color: "#cd0447",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                onClick={() => {
                  setIsSignUp(false);
                  setRegStep("form");
                }}
              >
                Login
              </span>
            </div>
          </form>
        </div>
        {/* Sign In Panel */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleLoginSubmit}>
            <h1
              style={{
                fontWeight: "bold",
                fontSize: 38,
                marginBottom: 8,
                marginTop: 4,
              }}
            >
              Sign in
            </h1>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 12 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 8,
                  top: 14,
                  color: "#cd0447",
                }}
              >
                <svg width="28" height="28" fill="black " viewBox="2 -4 24 24">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </span>
              <input
                ref={loginEmailInputRef}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
                style={{
                  paddingLeft: 38,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
            </div>
            <div
              style={{ position: "relative", width: "100%", marginBottom: 14 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 8,
                  top: 14,
                  color: "#cd0447",
                }}
              >
                <TbLockPassword
                  size={29}
                  color="black"
                  style={{ verticalAlign: "middle" }}
                />
              </span>
              <input
                type={showLoginPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="current-password"
                style={{
                  paddingLeft: 38,
                  borderRadius: 8,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "1px solid #eee",
                }}
              />
              <span
                onClick={() => setShowLoginPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 17,
                  top: 19,
                  cursor: "pointer",
                  color: "black",
                }}
                tabIndex={0}
                aria-label={
                  showLoginPassword ? "Hide password" : "Show password"
                }
              >
                {showLoginPassword ? (
                  <FiEyeOff size={22} />
                ) : (
                  <FiEye size={22} />
                )}
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              style={{
                fontWeight: "bold",
                fontSize: 16,
                letterSpacing: 1,
                marginTop: 8,
                borderRadius: 20,
                boxShadow: "0 2px 8px rgba(205,4,71,0.08)",
                transition: "background 0.2s",
                background: "#cd0447",
                color: "#fff",
              }}
            >
              {isLoading ? <span>Signing in...</span> : "Sign In"}
            </button>
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 15 }}>
              Create account?{" "}
              <span
                style={{
                  color: "#cd0447",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                onClick={() => {
                  setIsSignUp(true);
                }}
              >
                Register
              </span>
            </div>
          </form>
        </div>
        {/* Overlay Panel */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 26,
                  marginTop: 5,
                }}
              >
                <img
                  src="/src/iverto.png"
                  alt="Iverto Logo"
                  style={{
                    width: 80,
                    height: "auto",
                  }}
                />
                <span
                  style={{ color: "white", fontSize: 48, fontWeight: "bold" }}
                >
                  iverto.ai
                </span>
              </div>
              <h1 style={{ fontWeight: 750, fontSize: 32, marginBottom: 8 }}>
                Join Us
              </h1>
              <p style={{ fontWeight: 500, fontSize: 18, marginBottom: 18 }}>
                where cameras become intelligent eyes.
              </p>
              <button
                className="ghost"
                onClick={() => {
                  setIsSignUp(false);
                  setRegStep("form");
                }}
              >
                Login
              </button>
            </div>
            <div
              className="overlay-panel overlay-right"
              style={{ backgroundColor: "transparent", background: "none" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 26,
                  marginTop: 5,
                }}
              >
                <img
                  src="/src/iverto.png"
                  alt="Iverto Logo"
                  style={{
                    width: 80,
                    height: "auto",
                  }}
                />
                <span
                  style={{ color: "#cd0447", fontSize: 48, fontWeight: "bold" }}
                >
                  iverto.ai
                </span>
              </div>
              <h1
                style={{
                  fontWeight: 750,
                  fontSize: 32,
                  marginBottom: 8,
                  color: "#cd0447",
                }}
              >
                Your eyes on everything
              </h1>
              <p
                style={{
                  fontWeight: 500,
                  fontSize: 18,
                  marginBottom: 18,
                  color: "#cd0447",
                }}
              >
                powered by Iverto.ai.
              </p>
              <button
                className="ghost"
                onClick={() => {
                  setIsSignUp(true);
                  setTimeout(() => {
                    signUpNameInputRef.current?.focus();
                  }, 400); // Wait for panel animation
                }}
              >
                Register
              </button>
            </div>
          </div>
        </div>
        {/* Add styles inline or import a CSS file for the double slider effect */}
        <style>{`
          .auth-container {
            /* background: linear-gradient(135deg, #cd0447 0%, #fff 100%); */
            /* The background is now set inline via style prop for bg.jpg */
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
            position: relative;
            overflow: hidden;
            width: 768px;
            max-width: 100%;
            min-height: 480px;
            margin: 40px auto;
          }
          .form-container {
            position: absolute;
            top: 0;
            height: 100%;
            transition: all 0.6s ease-in-out;
            background: rgba(255,255,255,0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
          .sign-in-container {
            left: 0;
            width: 50%;
            z-index: 2;
          }
          .auth-container.right-panel-active .sign-in-container {
            transform: translateX(100%);
          }
          .sign-up-container {
            left: 0;
            width: 50%;
            opacity: 0;
            z-index: 1;
          }
          .auth-container.right-panel-active .sign-up-container {
            transform: translateX(100%);
            opacity: 1;
            z-index: 5;
            animation: show 0.6s;
          }
          @keyframes show {
            0%, 49.99% {
              opacity: 0;
              z-index: 1;
            }
            50%, 100% {
              opacity: 1;
              z-index: 5;
            }
          }
          .overlay-container {
            position: absolute;
            top: 0;
            left: 50%;
            width: 50%;
            height: 100%;
            overflow: hidden;
            transition: transform 0.6s ease-in-out;
            z-index: 100;
          }
          .auth-container.right-panel-active .overlay-container {
            transform: translateX(-100%);
          }
          .overlay {
            background: url('/src/bg.jpg') center center / cover no-repeat fixed;
            background-repeat: no-repeat;
            background-size: cover;
            background-position: 0 0;
            color: #FFFFFF;
            position: relative;
            left: -100%;
            height: 100%;
            width: 200%;
            transform: translateX(0);
            transition: transform 0.6s ease-in-out;
          }
          .auth-container.right-panel-active .overlay {
            transform: translateX(50%);
          }
          .overlay-panel {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            padding: 0 40px;
            text-align: center;
            top: 0;
            height: 100%;
            width: 50%;
            transform: translateX(0);
            transition: transform 0.6s ease-in-out;
          }
          .overlay-left {
            transform: translateX(-20%);
          }
          .auth-container.right-panel-active .overlay-left {
            transform: translateX(0);
          }
          .overlay-right {
            right: 0;
            transform: translateX(0);
          }
          .auth-container.right-panel-active .overlay-right {
            transform: translateX(20%);
          }
          .social-container {
            margin: 20px 0;
          }
          .social-container a {
            border: 1px solid #DDDDDD;
            border-radius: 50%;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            margin: 0 5px;
            height: 40px;
            width: 40px;
          }
          .error-message {
            color: #fff;
            background: #e05b80;
            border-radius: 8px;
            padding: 8px 12px;
            margin: 10px 0;
          }
          form {
            background-color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            padding: 0 50px;
            height: 100%;
            text-align: center;
          }
          input {
            background-color: #eee;
            border: none;
            padding: 12px 15px;
            margin: 8px 0;
            width: 100%;
          }
          button {
            border-radius: 20px;
            border: 1px solid #cd0447;
            background-color: #cd0447;
            color: #FFFFFF;
            font-size: 12px;
            font-weight: bold;
            padding: 12px 45px;
            letter-spacing: 1px;
            text-transform: uppercase;
            transition: transform 80ms ease-in;
          }
          button:active {
            transform: scale(0.95);
          }
          button:focus {
            outline: none;
          }
          button.ghost {
            background-color: transparent;
            border-color: #FFFFFF;
          }
        `}</style>
      </div>
    </div>
  );
};
