"use client";

import { useState } from "react";

interface MapPickerInnerProps {
  initialLat?: number;
  initialLng?: number;
  onChange: (lat: number, lng: number) => void;
}

const INDONESIA_BOUNDS = {
  minLatitude: -11,
  maxLatitude: 6,
  minLongitude: 95,
  maxLongitude: 141,
};

function toPosition(latitude: number, longitude: number) {
  const x =
    ((longitude - INDONESIA_BOUNDS.minLongitude) /
      (INDONESIA_BOUNDS.maxLongitude - INDONESIA_BOUNDS.minLongitude)) *
    100;
  const y =
    ((INDONESIA_BOUNDS.maxLatitude - latitude) /
      (INDONESIA_BOUNDS.maxLatitude - INDONESIA_BOUNDS.minLatitude)) *
    100;
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(6, Math.min(94, y)),
  };
}

function toCoordinates(x: number, y: number) {
  const longitude =
    INDONESIA_BOUNDS.minLongitude +
    (x / 100) * (INDONESIA_BOUNDS.maxLongitude - INDONESIA_BOUNDS.minLongitude);
  const latitude =
    INDONESIA_BOUNDS.maxLatitude -
    (y / 100) * (INDONESIA_BOUNDS.maxLatitude - INDONESIA_BOUNDS.minLatitude);
  return {
    latitude,
    longitude,
  };
}

export default function MapPickerInner({ initialLat, initialLng, onChange }: MapPickerInnerProps) {
  const defaultLat = initialLat || -6.2088;
  const defaultLng = initialLng || 106.8456;
  const [position, setPosition] = useState(() => toPosition(defaultLat, defaultLng));

  function handlePick(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const nextPosition = {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(6, Math.min(94, y)),
    };
    const coordinates = toCoordinates(nextPosition.x, nextPosition.y);
    setPosition(nextPosition);
    onChange(coordinates.latitude, coordinates.longitude);
  }

  return (
    <button
      type="button"
      onClick={handlePick}
      className="relative h-[350px] w-full overflow-hidden rounded-lg border border-white/10 bg-sky-950/30 text-left"
      aria-label="Pilih koordinat cabang pada peta Indonesia"
    >
      <svg className="absolute inset-[8%_4%_13%] h-[79%] w-[92%] drop-shadow-xl" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M70 171 C112 144 179 148 243 164 C293 176 342 169 383 151 C425 133 470 135 497 160 C426 193 326 206 222 193 C156 185 106 190 70 171 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M271 248 C342 219 432 211 513 232 C584 250 651 249 714 230 C743 251 717 281 646 290 C546 302 451 282 367 275 C321 271 285 268 271 248 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M544 121 C605 98 686 101 740 132 C720 160 648 172 584 158 C547 150 523 139 544 121 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M704 168 C761 137 842 139 908 173 C871 213 769 219 705 190 C690 183 690 175 704 168 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M764 283 C817 257 900 257 949 291 C916 326 833 334 776 309 C752 299 746 291 764 283 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M520 331 C575 312 662 313 715 342 C690 374 602 382 543 359 C512 347 502 338 520 331 Z" />
        <path fill="rgba(16,185,129,.34)" stroke="rgba(16,185,129,.38)" strokeWidth="2" d="M120 305 C162 285 227 289 259 313 C230 339 166 345 122 325 C104 317 103 311 120 305 Z" />
      </svg>
      <span
        className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-emerald-500 shadow-lg shadow-black/30"
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-bold text-slate-200">
        Klik area peta untuk memilih koordinat
      </span>
    </button>
  );
}
