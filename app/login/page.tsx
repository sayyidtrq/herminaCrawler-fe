"use client";

import { useState } from "react";
import { postJson } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { AlertCircle, Lock, Mail, Shield, Building, UserPlus, RefreshCw } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Entitlement options (Register only)
  const [aiEnabled, setAiEnabled] = useState(true);
  const [totalEnableReview, setTotalEnableReview] = useState(100);
  const [competitorEnabled, setCompetitorEnabled] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Backend expects OAuth2 Form data (username/password)
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Email atau password salah.");
      }

      const { access_token } = await response.json();
      await login(access_token);
    } catch (err: any) {
      setError(err.message || "Gagal melakukan login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        company_name: companyName,
        admin_email: email,
        admin_password: password,
        admin_full_name: fullName || null,
        ai_enable_flag: aiEnabled,
        total_enable_review: totalEnableReview,
        analyze_competitor_flag: competitorEnabled,
      };

      const response = await postJson<{ id: number }>("/api/auth/register", payload);
      
      // Auto login after successful registration by fetching token
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const loginResponse = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const { access_token } = await loginResponse.json();
      await login(access_token);
    } catch (err: any) {
      setError(err.message || "Gagal melakukan registrasi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 bg-cover px-4 py-12" style={{
      backgroundImage: `radial-gradient(circle at 10% 20%, rgba(15, 23, 42, 0.95), rgba(17, 28, 48, 0.95)), url("https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop")`,
      backgroundBlendMode: "multiply"
    }}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/15">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-600 text-xl font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            H
          </div>
          <h2 className="bg-gradient-to-r from-emerald-200 to-teal-100 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Hermina Review Intelligence
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            {isRegister 
              ? "Daftarkan Rumah Sakit & dapatkan intelijen review berbasis AI." 
              : "Masuk ke Hospital Patient Experience Mission Control."}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <strong className="font-semibold">Error</strong>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} className="space-y-5">
          {isRegister && (
            <>
              {/* Nama Perusahaan / Rumah Sakit */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nama Rumah Sakit / Perusahaan</label>
                <div className="relative mt-1.5">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Building className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Hermina Kemayoran"
                    className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Full Name Admin */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nama Lengkap Admin</label>
                <div className="relative mt-1.5">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Shield className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Muhammad Salman"
                    className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@herminahospitals.com"
                className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white/10 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {isRegister && (
            <div className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Feature Entitlements</h4>
              
              <div className="flex items-center justify-between">
                <div className="pr-2">
                  <span className="block text-sm font-semibold text-slate-200">AI Review Intelligence</span>
                  <span className="text-xs text-slate-400">Aktifkan Gemini AI analysis untuk sentimen & kategori</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="pr-2">
                  <span className="block text-sm font-semibold text-slate-200">Batas Scraping Review</span>
                  <span className="text-xs text-slate-400">Maksimum review yang diperbolehkan di-fetch</span>
                </div>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={totalEnableReview}
                  onChange={(e) => setTotalEnableReview(Number(e.target.value))}
                  className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="pr-2">
                  <span className="block text-sm font-semibold text-slate-200">Analisis Kompetitor</span>
                  <span className="text-xs text-slate-400">Izinkan pelacakan & pipeline data kompetitor</span>
                </div>
                <input
                  type="checkbox"
                  checked={competitorEnabled}
                  onChange={(e) => setCompetitorEnabled(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition duration-200 hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isRegister ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            {isLoading ? "Memproses..." : isRegister ? "Daftar Perusahaan" : "Masuk"}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center text-sm text-slate-400">
          {isRegister ? "Sudah terdaftar? " : "Rumah Sakit Baru? "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="font-semibold text-emerald-400 hover:underline hover:text-emerald-300"
          >
            {isRegister ? "Login Admin" : "Daftarkan Cabang/Perusahaan"}
          </button>
        </div>

      </div>
    </div>
  );
}
