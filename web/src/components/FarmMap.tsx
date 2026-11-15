"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

// Custom teardrop pin so we don't depend on Leaflet's default marker images
// (which break under bundlers). Pure inline SVG, green to match the theme.
const pinIcon = L.divIcon({
  className: "fieldshift-pin",
  html: `
    <svg width="34" height="46" viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C8.2 0 1 7.1 1 15.9 1 27 17 46 17 46s16-19 16-30.1C33 7.1 25.8 0 17 0z"
        fill="#15803d" stroke="#ffffff" stroke-width="2"/>
      <circle cx="17" cy="16" r="6" fill="#ffffff"/>
    </svg>`,
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

// When a pin is set (e.g. via a preset chip), glide the map to it.
function RecenterOnPin({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 8), {
        duration: 1.2,
      });
    }
  }, [position, map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function FarmMap({
  position,
  onPick,
}: {
  position: LatLng | null;
  onPick: (p: LatLng) => void;
}) {
  return (
    <MapContainer
      center={[20, 10]}
      zoom={3}
      minZoom={2}
      worldCopyJump
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <RecenterOnPin position={position} />
      {position && (
        <Marker position={[position.lat, position.lng]} icon={pinIcon} />
      )}
    </MapContainer>
  );
}
