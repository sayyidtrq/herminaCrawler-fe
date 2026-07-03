"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, Save, Activity, Map as MapIcon, DatabaseZap, 
  ShieldCheck, Info, User, Mail, Download, Globe, HardDrive
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SectionHeader, Badge } from "../components/ui";
import { useAuth } from "../lib/auth-context";

// 1. Skema Validasi Form menggunakan Zod (Sesuai System Design V2)
const profileSchema = z.object({
  // Profil Organisasi
  company_name: z.string().min(2, "Nama perusahaan minimal 2 karakter"),
  slug: z.string().min(2, "Slug diperlukan"),
  organization_type: z.string().min(2, "Tipe organisasi diperlukan"),
  industry_type: z.string().min(2, "Tipe industri diperlukan"),
  status: z.string().optional(),
  
  // Entitlements (Parameter Benefit Awal)
  ai_enable_flag: z.boolean(),
  analyze_competitor_flag: z.boolean(),
  total_enable_review: z.number(),

  // Entitlements (Tambahan yang disarankan - Placeholder)
  map_heatmap_enable_flag: z.boolean(),
  website_crawler_enable_flag: z.boolean(),
  selenium_enable_flag: z.boolean(),
  export_enable_flag: z.boolean(),
  
  // Quotas (Tambahan yang disarankan - Placeholder)
  max_locations: z.number(),
  max_sources: z.number(),
  analysis_monthly_quota: z.number(),
  retention_days: z.number(),

  // Profil Pengguna (User Akun Kredensial)
  full_name: z.string().min(2, "Nama lengkap diperlukan"),
  email: z.string().email("Format email tidak valid"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsClient() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // 2. Setup React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      company_name: "",
      slug: "",
      organization_type: "",
      industry_type: "",
      status: "active",
      ai_enable_flag: false,
      analyze_competitor_flag: false,
      map_heatmap_enable_flag: false,
      website_crawler_enable_flag: false,
      selenium_enable_flag: false,
      export_enable_flag: false,
      total_enable_review: 0,
      max_locations: 0,
      max_sources: 0,
      analysis_monthly_quota: 0,
      retention_days: 0,
      full_name: "",
      email: "",
    },
  });

  // 3. Mengisi form dengan data Real Backend + Lengkap Placeholder V2
  useEffect(() => {
    if (user) {
      reset({
        // Company Real
        company_name: user.company_name || "",
        slug: user.company_name?.toLowerCase().replace(/\s+/g, "-") || "hermina-hq",
        organization_type: "Hospital", // Placeholder
        industry_type: "Healthcare / Hospital", // Placeholder
        status: "active", // Placeholder
        
        // Entitlements Real
        ai_enable_flag: user.ai_enable_flag || false,
        analyze_competitor_flag: user.analyze_competitor_flag || false,
        total_enable_review: user.total_enable_review || 0,
        
        // Entitlements Tambahan (Placeholder)
        map_heatmap_enable_flag: true,
        website_crawler_enable_flag: false,
        selenium_enable_flag: true,
        export_enable_flag: true,
        
        // Quotas Tambahan (Placeholder)
        max_locations: 15,
        max_sources: 5,
        analysis_monthly_quota: 5000,
        retention_days: 90,

        // Data Profil Pengguna Asli
        full_name: user.full_name || "",
        email: user.email || "",
      });
    }
  }, [user, reset]);

  // 4. Dummy Handler untuk Submit
  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    console.log("Payload Lengkap V2:", data);
    
    setTimeout(() => {
      alert("Profil berhasil diperbarui secara lokal! (Cek console untuk melihat struktur JSON)");
      setIsSaving(false);
    }, 1000);
  };

  if (!user) return null;

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Settings & Profile</p>
          <h1>Pengaturan Sistem Terpadu</h1>
          <span>Kelola profil pengguna, identitas perusahaan, batas penggunaan, dan hak akses fitur VoC Anda.</span>
        </div>
        <div className="dashboard-header-actions">
          <span className="health-pill ok">Tenant Aktif</span>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-6" style={{ padding: "0 2rem" }}>
        
        {/* SECTION 1: PROFIL PENGGUNA (AKUN) */}
        <article className="panel page-panel bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8">
          <SectionHeader 
            kicker="User Profile" 
            title="Profil Pengguna" 
            helper="Informasi akun admin Anda yang digunakan untuk login." 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  {...register("full_name")}
                  type="text" 
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-slate-50/50 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  {...register("email")}
                  type="email" 
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg shadow-sm outline-none"
                  readOnly
                  title="Email tidak dapat diubah"
                />
              </div>
              {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
            </div>
          </div>
        </article>

        <hr className="border-slate-200" />

        {/* SECTION 2: INFORMASI PERUSAHAAN */}
        <article className="panel page-panel bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8">
          <SectionHeader 
            kicker="Company Identity" 
            title="Informasi Dasar Organisasi" 
            helper="Nama dan sektor industri yang merepresentasikan workspace ini." 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Nama Perusahaan / Organisasi</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  {...register("company_name")}
                  type="text" 
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-slate-50/50 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Slug (URL Identifier)</span>
                <Badge tone="warning">Placeholder</Badge>
              </label>
              <input 
                {...register("slug")}
                type="text" 
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg shadow-sm outline-none"
                readOnly
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Tipe Organisasi</span>
                <Badge tone="warning">Placeholder</Badge>
              </label>
              <input 
                {...register("organization_type")}
                type="text" 
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50/50 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Tipe Industri</span>
                <Badge tone="warning">Placeholder</Badge>
              </label>
              <input 
                {...register("industry_type")}
                type="text" 
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50/50 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Status Organisasi</span>
                <Badge tone="warning">Placeholder</Badge>
              </label>
              <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-lg shadow-sm text-slate-700 outline-none">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="capitalize">{user ? "Active" : "Inactive"}</span>
                <input type="hidden" {...register("status")} value="active" />
              </div>
            </div>
          </div>
        </article>

        {/* SECTION 3: ENTITLEMENTS (HAK AKSES FITUR) */}
        <article className="panel page-panel bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8">
          <SectionHeader 
            kicker="Entitlements" 
            title="Hak Akses Fitur (Feature Flags)" 
            helper="Modul dan kapabilitas yang aktif untuk perusahaan Anda." 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            
            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("ai_enable_flag")} className="mt-1 w-5 h-5 text-emerald-600 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <Activity size={16} className="text-emerald-600" /> Analisis AI (LLM)
                  <Badge tone="positive">Real Data</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Ekstraksi sentimen dan kategori otomatis.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("analyze_competitor_flag")} className="mt-1 w-5 h-5 text-emerald-600 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" /> Pelacakan Kompetitor
                  <Badge tone="positive">Real Data</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Mengaktifkan komparasi kompetitor publik.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("map_heatmap_enable_flag")} className="mt-1 w-5 h-5 text-amber-500 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <MapIcon size={16} className="text-amber-500" /> Peta & Heatmap
                  <Badge tone="warning">Placeholder</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Akses visualisasi densitas keluhan (Leaflet).</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("website_crawler_enable_flag")} className="mt-1 w-5 h-5 text-amber-500 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <DatabaseZap size={16} className="text-amber-500" /> Web Crawler (Firecrawl)
                  <Badge tone="warning">Placeholder</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Penarikan data keluhan web & testimonial publik.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("selenium_enable_flag")} className="mt-1 w-5 h-5 text-amber-500 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <Globe size={16} className="text-amber-500" /> Web Dinamis (Selenium)
                  <Badge tone="warning">Placeholder</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Fallback penarikan data dari situs web dinamis.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 border border-slate-200 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 hover:shadow transition-all">
              <input type="checkbox" {...register("export_enable_flag")} className="mt-1 w-5 h-5 text-amber-500 rounded" />
              <div>
                <strong className="flex items-center gap-2">
                  <Download size={16} className="text-amber-500" /> Export Data Laporan
                  <Badge tone="warning">Placeholder</Badge>
                </strong>
                <p className="text-sm text-slate-500 mt-1">Izin unduh laporan dalam format CSV dan JSON.</p>
              </div>
            </label>
            
          </div>
        </article>

        {/* SECTION 4: LIMITASI KUOTA */}
        <article className="panel page-panel bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8">
          <SectionHeader 
            kicker="Quotas" 
            title="Batas Penggunaan Resource" 
            helper="Limitasi server dan database per bulan berjalan." 
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            
            <div className="p-5 bg-emerald-50/80 border border-emerald-100 rounded-xl flex flex-col justify-between h-full shadow-sm">
              <div>
                <span className="block text-sm font-semibold text-emerald-900">Scraping Limit</span>
                <Badge tone="positive">Real Data</Badge>
              </div>
              <div className="text-3xl font-bold text-emerald-950 mt-4">
                {Number(user?.total_enable_review || 0).toLocaleString()}
              </div>
            </div>

            <div className="p-5 bg-blue-50/80 border border-blue-100 rounded-xl flex flex-col justify-between relative overflow-hidden h-full shadow-sm">
              <div className="z-10">
                <span className="block text-sm font-semibold text-blue-900">Maksimal Lokasi</span>
                <span className="text-xs text-blue-600/70 font-medium">Placeholder</span>
              </div>
              <div className="text-3xl font-bold text-blue-950 z-10 mt-4">
                15 <span className="text-sm font-normal text-blue-900/70">titik</span>
              </div>
            </div>

            <div className="p-5 bg-indigo-50/80 border border-indigo-100 rounded-xl flex flex-col justify-between relative overflow-hidden h-full shadow-sm">
              <div className="z-10">
                <span className="block text-sm font-semibold text-indigo-900">Maksimal Source</span>
                <span className="text-xs text-indigo-600/70 font-medium">Placeholder</span>
              </div>
              <div className="text-3xl font-bold text-indigo-950 z-10 mt-4">
                5 <span className="text-sm font-normal text-indigo-900/70">channel</span>
              </div>
            </div>

            <div className="p-5 bg-amber-50/80 border border-amber-100 rounded-xl flex flex-col justify-between relative overflow-hidden h-full shadow-sm">
              <div className="z-10">
                <span className="block text-sm font-semibold text-amber-900 flex gap-1 items-center">
                  <HardDrive size={14}/> Kuota AI
                </span>
                <span className="text-xs text-amber-600/70 font-medium">Placeholder</span>
              </div>
              <div className="text-3xl font-bold text-amber-950 z-10 mt-4">
                5K <span className="text-sm font-normal text-amber-900/70">analisis/bln</span>
              </div>
            </div>

          </div>
        </article>

        {/* FORM ACTIONS */}
        <div className="flex justify-end gap-4 mb-10">
          <button 
            type="button" 
            onClick={() => reset()}
            disabled={!isDirty || isSaving}
            className="px-6 py-2 rounded-md font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition"
          >
            Batal
          </button>
          <button 
            type="submit" 
            disabled={!isDirty || isSaving}
            className="px-6 py-2 rounded-md font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {isSaving ? "Menyimpan..." : <><Save size={18} /> Simpan Perubahan</>}
          </button>
        </div>

      </form>
    </AppShell>
  );
}