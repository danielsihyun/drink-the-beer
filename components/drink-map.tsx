"use client"

import * as React from "react"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
import Image from "next/image"
import "leaflet/dist/leaflet.css"

type DrinkLocation = {
  id: string
  latitude: number
  longitude: number
  drinkType: string
  createdAt: string
  photoUrl: string | null
}

// Component to fit map bounds to all markers
function FitBounds({ locations }: { locations: DrinkLocation[] }) {
  const map = useMap()

  React.useEffect(() => {
    if (locations.length === 0) return

    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 14)
      return
    }

    const bounds = locations.map((loc) => [loc.latitude, loc.longitude] as [number, number])
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [locations, map])

  return null
}

// Get color based on drink type
function getDrinkColor(drinkType: string): string {
  const colors: Record<string, string> = {
    Beer: "#F59E0B", // Amber
    Seltzer: "#06B6D4", // Cyan
    Wine: "#DC2626", // Red
    Cocktail: "#8B5CF6", // Purple
    Shot: "#10B981", // Emerald
    Spirit: "#F97316", // Orange
    Other: "#6B7280", // Gray
  }
  return colors[drinkType] || colors.Other
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// Calculate intensity based on how many drinks are at similar locations
function calculateIntensity(
  location: DrinkLocation,
  allLocations: DrinkLocation[],
  radius: number = 0.001 // ~100m
): number {
  const nearby = allLocations.filter((loc) => {
    const latDiff = Math.abs(loc.latitude - location.latitude)
    const lngDiff = Math.abs(loc.longitude - location.longitude)
    return latDiff < radius && lngDiff < radius
  })
  // Scale from 0.4 to 1 based on density
  return Math.min(1, 0.4 + nearby.length * 0.12)
}

export default function DrinkMap({
  locations,
  center,
}: {
  locations: DrinkLocation[]
  center: { lat: number; lng: number }
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      style={{ height: "calc(100vh - 200px)", width: "100%", minHeight: "400px" }}
      scrollWheelZoom={true}
    >
      {/* CartoDB Positron tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        maxZoom={20}
      />

      <FitBounds locations={locations} />

      {locations.map((location) => {
        const intensity = calculateIntensity(location, locations)
        const color = getDrinkColor(location.drinkType)

        return (
          <CircleMarker
            key={location.id}
            center={[location.latitude, location.longitude]}
            radius={10 + intensity * 6}
            fillColor={color}
            fillOpacity={intensity * 0.7}
            color={color}
            weight={2}
            opacity={0.9}
          >
            <Popup>
              <div className="min-w-[150px]">
                {location.photoUrl && (
                  <div className="relative mb-2 h-24 w-full overflow-hidden rounded-lg">
                    <Image
                      src={location.photoUrl}
                      alt={location.drinkType}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="font-semibold">{location.drinkType}</div>
                <div className="text-xs text-gray-500">{formatDate(location.createdAt)}</div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
