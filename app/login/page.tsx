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
    <div className="flex min-h-screen w-full bg-slate-50 font-sans">
      {/* LEFT PANEL (Branding/Illustration) */}
      <div className="hidden lg:flex lg:w-5/12 relative bg-emerald-950 items-center justify-center p-12 overflow-hidden border-r border-emerald-900/50">
        
        {/* Custom CSS for Floating Animations */}
        <style>{`
          @keyframes float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(1deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes float-delay-1 {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(15px) rotate(-2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes float-delay-2 {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(2deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }
          @keyframes float-delay-3 {
            0% { transform: translateY(0px) rotate(0deg) scale(1); }
            50% { transform: translateY(-10px) rotate(3deg) scale(1.05); }
            100% { transform: translateY(0px) rotate(0deg) scale(1); }
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.2); }
          }
        `}</style>

        {/* Decorative background blobs and glowing orbs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>
          <div className="absolute top-1/2 -right-20 w-96 h-96 bg-teal-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>
          
          {/* Animated Glowing Orbs */}
          <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-emerald-300 rounded-full shadow-[0_0_15px_rgba(110,231,183,0.8)]" style={{ animation: 'pulse-glow 4s infinite' }}></div>
          <div className="absolute top-3/4 right-1/3 w-2 h-2 bg-teal-300 rounded-full shadow-[0_0_15px_rgba(94,234,212,0.8)]" style={{ animation: 'pulse-glow 5s infinite 1s' }}></div>
          <div className="absolute top-1/2 left-10 w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.6)] opacity-50" style={{ animation: 'float-delay-1 6s infinite' }}></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-emerald-600 text-3xl font-black text-white shadow-lg shadow-emerald-900/50">
            H
          </div>
          <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight mb-4">
            Hermina Review Intelligence
          </h1>
          <p className="text-base xl:text-lg text-emerald-100/80 mb-12 leading-relaxed font-medium">
            Sistem manajemen komprehensif berbasis AI untuk mengelola pengalaman pasien dan umpan balik rumah sakit.
          </p>
          
          {/* Animated Isometric/Floating UI Composition */}
          <div className="relative w-full aspect-video mt-4 max-w-[400px]">
            {/* Main Center UI Card */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col z-20"
              style={{ animation: 'float 6s ease-in-out infinite' }}
            >
               {/* Card Header */}
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                   <Shield className="w-5 h-5 text-emerald-400" />
                 </div>
                 <div className="flex-1 space-y-2">
                   <div className="w-24 h-2.5 bg-white/30 rounded-full"></div>
                   <div className="w-16 h-2 bg-white/10 rounded-full"></div>
                 </div>
               </div>
               {/* Card Body Bars */}
               <div className="space-y-3">
                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex relative">
                    <div className="w-3/4 h-full bg-emerald-400 rounded-full relative">
                      <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 animate-pulse"></div>
                    </div>
                 </div>
                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex relative">
                    <div className="w-1/2 h-full bg-teal-400 rounded-full relative">
                      <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                 </div>
                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex relative">
                    <div className="w-5/6 h-full bg-emerald-300 rounded-full relative">
                      <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 animate-pulse" style={{ animationDelay: '1s' }}></div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Floating Top-Right Mini Card (Lock) */}
            <div 
              className="absolute -top-4 -right-4 w-32 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl p-4 flex flex-col items-center z-30"
              style={{ animation: 'float-delay-1 7s ease-in-out infinite' }}
            >
              <Lock className="w-6 h-6 text-emerald-400 mb-2" />
              <div className="w-12 h-1.5 bg-white/30 rounded-full"></div>
            </div>

            {/* Floating Top-Left Mini Bubble (User/AI) */}
            <div 
              className="absolute top-4 -left-6 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-2xl rounded-bl-none shadow-xl shadow-teal-900/50 p-3 flex items-center gap-2 z-10"
              style={{ animation: 'float-delay-3 5s ease-in-out infinite' }}
            >
              <RefreshCw className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
              <div className="w-10 h-1.5 bg-white/60 rounded-full"></div>
            </div>

            {/* Floating Bottom-Left Mini Card (Bars) */}
            <div 
              className="absolute -bottom-8 -left-8 w-40 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl p-4 flex items-end gap-2 z-30"
              style={{ animation: 'float-delay-2 8s ease-in-out infinite' }}
            >
               <div className="w-full bg-emerald-400/40 rounded-sm h-6 transition-all duration-1000 animate-pulse"></div>
               <div className="w-full bg-emerald-400/70 rounded-sm h-12 transition-all duration-1000 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
               <div className="w-full bg-emerald-300 rounded-sm h-16 transition-all duration-1000 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
               <div className="w-full bg-teal-300 rounded-sm h-10 transition-all duration-1000 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
            
            {/* Floating Bottom-Right Badge (Verified) */}
            <div 
              className="absolute -bottom-2 -right-8 bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl z-10"
              style={{ animation: 'float-delay-1 6.5s ease-in-out infinite' }}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
              <span className="text-xs font-bold text-emerald-100 tracking-wide">AI ACTIVE</span>
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT PANEL (Form) */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-12 bg-white relative">
        <div className="w-full max-w-md">
          
          {/* Mobile Header (Only visible on small screens) */}
          <div className="lg:hidden mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-emerald-600 text-2xl font-black text-white shadow-lg shadow-emerald-500/20">
              H
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Hermina Review Intelligence
            </h2>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
              {isRegister ? "Buat Akun Baru" : "Selamat Datang Kembali"}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {isRegister 
                ? "Daftarkan Rumah Sakit & dapatkan intelijen review berbasis AI." 
                : "Masuk ke Hospital Patient Experience Mission Control untuk melanjutkan."}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <strong className="font-bold block mb-0.5">Oops, terjadi kesalahan</strong>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} className="space-y-5">
            {isRegister && (
              <>
                {/* Nama Perusahaan / Rumah Sakit */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Rumah Sakit / Perusahaan</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Building className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Hermina Kemayoran"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    />
                  </div>
                </div>

                {/* Full Name Admin */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Lengkap Admin</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Shield className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Muhammad Salman"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@herminahospitals.com"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>
            </div>

            {isRegister && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4 shadow-sm mt-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Feature Entitlements</h4>
                
                <label className="flex items-start justify-between cursor-pointer group">
                  <div className="pr-4">
                    <span className="block text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">AI Review Intelligence</span>
                    <span className="text-xs font-medium text-slate-500 leading-tight block mt-0.5">Aktifkan Gemini AI analysis untuk sentimen & kategori</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <span className="block text-sm font-bold text-slate-800">Batas Scraping Review</span>
                    <span className="text-xs font-medium text-slate-500 leading-tight block mt-0.5">Maksimum review yang diperbolehkan di-fetch</span>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={totalEnableReview}
                    onChange={(e) => setTotalEnableReview(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm text-slate-800 font-bold shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <label className="flex items-start justify-between cursor-pointer group">
                  <div className="pr-4">
                    <span className="block text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Analisis Kompetitor</span>
                    <span className="text-xs font-medium text-slate-500 leading-tight block mt-0.5">Izinkan pelacakan & pipeline data kompetitor</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={competitorEnabled}
                    onChange={(e) => setCompetitorEnabled(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:bg-emerald-600 hover:shadow-emerald-600/40 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
            >
              {isLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : isRegister ? (
                <UserPlus className="h-5 w-5" />
              ) : (
                <Shield className="h-5 w-5" />
              )}
              {isLoading ? "Memproses..." : isRegister ? "Daftar Perusahaan" : "Masuk ke Mission Control"}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {isRegister ? "Sudah terdaftar? " : "Rumah Sakit Baru? "}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="font-bold text-emerald-600 hover:underline hover:text-emerald-700 transition-colors ml-1"
            >
              {isRegister ? "Login Admin" : "Daftarkan Cabang"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
