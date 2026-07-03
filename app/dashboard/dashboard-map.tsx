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

function markerColor(risk: DashboardMapMarker["risk"]) {
  if (risk === "critical") return "#e11d48";
  if (risk === "watch") return "#f59e0b";
  return "#10b981";
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
          const color = markerColor(marker.risk);
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
              <Tooltip className="dashboard-map-tooltip" direction="top" offset={[0, -10]} opacity={1}>
                <div className="map-popup-content">
                  <strong>{marker.name}</strong>
                  <span>{marker.city ?? "Kota belum diisi"} · {marker.source} · {marker.risk}</span>
                  <p>{formatNumber(marker.reviews)} reviews · {marker.averageRating ? marker.averageRating.toFixed(1) : "No"} avg</p>
                  <dl>
                    <div className="hover-negative"><dt>Negative</dt><dd>{formatNumber(marker.negativeCount)}</dd></div>
                    <div className="hover-critical"><dt>Critical</dt><dd>{formatNumber(marker.criticalCount)}</dd></div>
                    <div className="hover-neutral"><dt>Top issue</dt><dd>{marker.topIssue ? issueLabel(marker.topIssue) : "None"}</dd></div>
                    <div className="hover-neutral"><dt>Latest fetch</dt><dd>{marker.latestFetch}</dd></div>
                  </dl>
                  <a href={`/reviews?location_id=${marker.id}`}>Buka review cabang</a>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="dashboard-map-legend" aria-label="Keterangan warna marker">
        <span><i className="risk-stable" /> Stable</span>
        <span><i className="risk-watch" /> Watch</span>
        <span><i className="risk-critical" /> Critical</span>
        <span><i className="risk-estimated" /> Koordinat estimasi</span>
      </div>
    </div>
  );
}
