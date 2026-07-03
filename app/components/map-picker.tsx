"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { fetchJson } from "../lib/api";
import { Search, Loader2, MapPin, Check } from "lucide-react";

// Load React Leaflet MapPickerInner dynamically to prevent SSR window is not defined error
const MapPickerInner = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] w-full items-center justify-center rounded-lg border border-white/10 bg-slate-950/20">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto" />
        <p className="mt-2 text-xs text-slate-400">Loading interactive map...</p>
      </div>
    </div>
  ),
});

interface ResolvedPlace {
  external_place_id: string;
  hospital_name: string | null;
  address: string | null;
  google_maps_url: string | null;
  latitude: number;
  longitude: number;
}

interface MapPickerProps {
  onResolve: (place: ResolvedPlace) => void;
  initialLat?: number;
  initialLng?: number;
}

export function MapPicker({ onResolve, initialLat, initialLng }: MapPickerProps) {
  const [lat, setLat] = useState<number>(initialLat || -6.2088);
  const [lng, setLng] = useState<number>(initialLng || 106.8456);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedData, setResolvedData] = useState<ResolvedPlace | null>(null);

  const handleCoordinatesChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setResolvedData(null);
    setError(null);
  };

  const handleResolve = async () => {
    setIsResolving(true);
    setError(null);
    try {
      const data = await fetchJson<{
        external_place_id: string;
        hospital_name: string | null;
        address: string | null;
        google_maps_url: string | null;
      }>(`/api/places/resolve?lat=${lat}&lng=${lng}`);

      const result: ResolvedPlace = {
        ...data,
        latitude: lat,
        longitude: lng,
      };

      setResolvedData(result);
      onResolve(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mencocokkan koordinat dengan Google Places ID. Pastikan API key Google Maps valid.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
            <MapPin size={15} className="text-emerald-400" />
            Google Place ID Map Resolver
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Klik lokasi cabang di peta untuk mengambil detail alamat & Google Place ID secara otomatis.
          </p>
        </div>
      </div>

      <MapPickerInner
        initialLat={lat}
        initialLng={lng}
        onChange={handleCoordinatesChange}
      />

      <div className="flex items-center gap-4 bg-slate-950/30 p-3 rounded-lg border border-white/5 text-xs text-slate-300">
        <div>
          <span className="text-slate-500 font-semibold block uppercase tracking-wider">Latitude</span>
          <span className="font-mono text-white text-sm">{lat.toFixed(6)}</span>
        </div>
        <div className="border-l border-white/10 h-8"></div>
        <div>
          <span className="text-slate-500 font-semibold block uppercase tracking-wider">Longitude</span>
          <span className="font-mono text-white text-sm">{lng.toFixed(6)}</span>
        </div>
        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving}
          className="ml-auto flex items-center gap-1.5 rounded bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
        >
          {isResolving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Search size={13} />
          )}
          {isResolving ? "Resolving..." : "Resolve Place"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded">
          {error}
        </p>
      )}

      {resolvedData && (
        <div className="text-xs space-y-1.5 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg text-slate-300">
          <p className="text-emerald-400 font-bold flex items-center gap-1">
            <Check size={12} /> Terdeteksi: {resolvedData.hospital_name || "Tanpa Nama Cabang"}
          </p>
          <p><span className="text-slate-500">Place ID:</span> <code className="bg-white/5 px-1 py-0.5 rounded font-mono text-white">{resolvedData.external_place_id}</code></p>
          <p className="overflow-hidden text-ellipsis whitespace-nowrap"><span className="text-slate-500">Alamat:</span> {resolvedData.address}</p>
        </div>
      )}
    </div>
  );
}
