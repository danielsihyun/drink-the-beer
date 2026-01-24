"use client"

import * as React from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import Image from "next/image"
import Link from "next/link"
import "leaflet/dist/leaflet.css"

type FriendDrinkLocation = {
  id: string
  latitude: number
  longitude: number
  drinkType: string
  createdAt: string
  photoUrl: string | null
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    drinkCount: number
    friendCount: number
  }
}

// Component to fit map bounds to all markers
function FitBounds({ locations }: { locations: FriendDrinkLocation[] }) {
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

// Create a custom icon with profile picture
function createProfileIcon(avatarUrl: string | null, username: string): L.DivIcon {
  const initial = username[0]?.toUpperCase() ?? "U"
  
  const html = avatarUrl
    ? `<div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        overflow: hidden;
        background: #4ECDC4;
      ">
        <img 
          src="${avatarUrl}" 
          style="width: 100%; height: 100%; object-fit: cover;"
          alt="${username}"
        />
      </div>`
    : `<div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        background: #4ECDC4;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
      ">${initial}</div>`

  return L.divIcon({
    html,
    className: "friend-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

// Profile card component for the popup
function ProfileCard({ location }: { location: FriendDrinkLocation }) {
  const { user, drinkType, createdAt, photoUrl } = location

  return (
    <div className="w-[200px]">
      {/* Profile header */}
      <Link 
        href={`/profile/${user.username}`}
        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
      >
        {user.avatarUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded-full flex-shrink-0">
            <Image
              src={user.avatarUrl}
              alt={user.username}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: "#4ECDC4" }}
          >
            {user.username[0]?.toUpperCase() ?? "U"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{user.displayName}</p>
          <p className="text-xs text-gray-500 truncate">@{user.username}</p>
        </div>
      </Link>

      {/* Stats */}
      <div className="flex gap-4 px-2 py-1 text-xs text-gray-500">
        <span><strong className="text-gray-700">{user.drinkCount}</strong> drinks</span>
        <span><strong className="text-gray-700">{user.friendCount}</strong> friends</span>
      </div>

      {/* Divider */}
      <div className="border-t my-2" />

      {/* Drink info */}
      {photoUrl && (
        <div className="relative h-24 w-full overflow-hidden rounded-lg mb-2">
          <Image
            src={photoUrl}
            alt={drinkType}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="px-2 pb-2">
        <p className="text-sm font-medium">{drinkType}</p>
        <p className="text-xs text-gray-500">{formatDate(createdAt)}</p>
      </div>
    </div>
  )
}

export default function FriendsMap({
  locations,
  center,
}: {
  locations: FriendDrinkLocation[]
  center: { lat: number; lng: number }
}) {
  // Group locations by user to avoid duplicate markers at same spot
  // For now, show all individual drinks

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      style={{ height: "calc(100vh - 280px)", width: "100%", minHeight: "400px" }}
      scrollWheelZoom={true}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <FitBounds locations={locations} />

      {locations.map((location) => (
        <Marker
          key={location.id}
          position={[location.latitude, location.longitude]}
          icon={createProfileIcon(location.user.avatarUrl, location.user.username)}
        >
          <Popup>
            <ProfileCard location={location} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}