"use client";

import { useEffect } from "react";
import type { LatLngBoundsExpression } from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { formatNumber } from "../lib/format";
import { issueLabel } from "../lib/review-labels";

export type DashboardMapMarker = {
  id: number;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  reviews: number;
  averageRating: number | null;
  negativeCount: number;
  criticalCount: number;
  risk: "stable" | "watch" | "critical";
  topIssue: string | null;
  isActive: boolean;
  isEstimatedCoordinate: boolean;
  source: string;
  latestFetch: string;
};

const INDONESIA_CENTER: [number, number] = [-2.5, 118];
const INDONESIA_MAX_BOUNDS: [[number, number], [number, number]] = [[-13, 94], [8, 142]];

type MapRiskLevel = "low" | "medium" | "high" | "very-high";

function mapRiskLevel(marker: DashboardMapMarker): MapRiskLevel {
  if (marker.risk === "stable") return "low";
  if (marker.risk === "watch") return "medium";
  if (marker.criticalCount > 1 || (marker.averageRating !== null && marker.averageRating < 3.5)) return "very-high";
  return "high";
}

function markerColor(level: MapRiskLevel) {
  if (level === "very-high") return "#e11d48";
  if (level === "high") return "#f97316";
  if (level === "medium") return "#f59e0b";
  return "#10b981";
}

function markerLabel(level: MapRiskLevel) {
  if (level === "very-high") return "Risiko Sangat Tinggi";
  if (level === "high") return "Risiko Tinggi";
  if (level === "medium") return "Risiko Sedang";
  return "Risiko Rendah";
}

function markerSize(marker: DashboardMapMarker) {
  return Math.max(8, Math.min(20, 8 + Math.sqrt(marker.reviews || 1) * 1.15));
}

function FitMapToMarkers({ markers }: { markers: DashboardMapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 0);

    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 8);
      return;
    }

    if (markers.length > 1) {
      const bounds = markers.map((marker) => [marker.latitude, marker.longitude]) as LatLngBoundsExpression;
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 8 });
      return;
    }

    map.setView(INDONESIA_CENTER, 4);
  }, [map, markers]);

  return null;
}

export function DashboardMap({ markers }: { markers: DashboardMapMarker[] }) {
  return (
    <div className="dashboard-map-shell">
      <MapContainer
        attributionControl={false}
        center={INDONESIA_CENTER}
        className="dashboard-leaflet-map"
        maxBounds={INDONESIA_MAX_BOUNDS}
        maxBoundsViscosity={0.8}
        minZoom={4}
        scrollWheelZoom
        zoom={4}
        zoomControl
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToMarkers markers={markers} />
        {markers.map((marker) => {
          const level = mapRiskLevel(marker);
          const color = markerColor(level);
          return (
            <CircleMarker
              center={[marker.latitude, marker.longitude]}
              color="#ffffff"
              eventHandlers={{
                click: () => {
                  window.location.href = `/reviews?location_id=${marker.id}`;
                },
              }}
              fillColor={color}
              fillOpacity={0.86}
              key={marker.id}
              pathOptions={{
                className: marker.isEstimatedCoordinate ? "dashboard-map-circle estimated" : "dashboard-map-circle",
              }}
              radius={markerSize(marker)}
              stroke
              weight={2}
            >
              <Tooltip className="dashboard-map-tooltip" direction="auto" offset={[0, -8]} opacity={1}>
                <div className="map-popup-content">
                  <strong>{marker.name}</strong>
                  <span>{marker.city ?? "Kota belum diisi"} · {markerLabel(level)}</span>
                  <p>{formatNumber(marker.reviews)} review · {marker.averageRating ? `${marker.averageRating.toFixed(1)} rating` : "Belum ada rating"}</p>
                  <dl>
                    <div className="hover-negative"><dt>Negatif</dt><dd>{formatNumber(marker.negativeCount)}</dd></div>
                    <div className="hover-critical"><dt>Kritis</dt><dd>{formatNumber(marker.criticalCount)}</dd></div>
                    <div className="hover-neutral"><dt>Isu utama</dt><dd>{marker.topIssue ? issueLabel(marker.topIssue) : "Belum ada"}</dd></div>
                    <div className="hover-neutral"><dt>Update</dt><dd>{marker.latestFetch}</dd></div>
                  </dl>
                  <em>Klik marker untuk membuka review cabang</em>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="dashboard-map-legend" aria-label="Keterangan warna marker">
        <span><i className="risk-low" /> Risiko Rendah</span>
        <span><i className="risk-medium" /> Risiko Sedang</span>
        <span><i className="risk-high" /> Risiko Tinggi</span>
        <span><i className="risk-very-high" /> Risiko Sangat Tinggi</span>
      </div>
    </div>
  );
}
