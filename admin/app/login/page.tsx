"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { setToken } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordLogin = async () => {
    if (phone.replace("+91", "").length < 10) { setError("Enter a valid phone number"); return; }
    if (!password) { setError("Enter your password"); return; }
    const fullPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/login-password", { phone: fullPhone, password });
      const { access_token, user } = res.data;
      if (user?.role !== "admin") {
        setError("Access denied. Admin account required.");
        setLoading(false);
        return;
      }
      setToken(access_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid phone number or password");
    } finally { setLoading(false); }
  };

  const handleSendOTP = async () => {
    if (phone.length < 10) { setError("Enter a valid phone number"); return; }
    const fullPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
    setLoading(true); setError("");
    try {
      await api.post("/auth/send-otp", { phone: fullPhone });
      setPhone(fullPhone);
      setStep("otp");
    } catch {
      setError("Failed to send OTP");
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp.length < 4) { setError("Enter OTP"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", { phone, code: otp });
      const { access_token, user } = res.data;
      if (user?.role !== "admin") {
        setError("Access denied. Admin account required.");
        setLoading(false);
        return;
      }
      setToken(access_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid OTP");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-forest flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Washing Bells" className="inline-block w-16 h-16 rounded-2xl mb-4 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Washing<span className="text-gold">Bells</span> Admin</h1>
          <p className="text-white/50 text-sm mt-1">Super Admin Panel</p>
        </div>

        {sessionExpired && (
          <div className="mb-4 p-3 bg-amber-900/50 border border-amber-600 rounded-xl text-amber-300 text-sm text-center">
            Session expired. Please sign in again.
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          {step === "phone" ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Sign In</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your admin mobile number</p>
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-xl px-3 flex items-center text-gray-300 text-sm">🇮🇳 +91</div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={phone.replace("+91", "")}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <button
                onClick={handlePasswordLogin}
                disabled={loading || phone.replace("+91", "").length < 10 || !password}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-forest font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? "Signing in..." : "Login with Password"}
              </button>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>
              <button
                onClick={handleSendOTP}
                disabled={loading || phone.replace("+91", "").length < 10}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-amber-400 font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? "Sending..." : "Get OTP instead"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep("phone")} className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
                ← Back
              </button>
              <h2 className="text-lg font-semibold text-white mb-1">Enter OTP</h2>
              <p className="text-gray-400 text-sm mb-6">Sent to <span className="text-amber-400">{phone}</span></p>
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">OTP Code</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <button
                onClick={handleVerify}
                disabled={loading || otp.length < 4}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-forest font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                {loading ? "Verifying..." : "Sign In"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary during prerender (Next 16)
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-forest" />}>
      <LoginForm />
    </Suspense>
  );
}
