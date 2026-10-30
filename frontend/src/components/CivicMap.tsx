"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface CivicMapProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  issues?: any[];
  selectedIssueId?: number | null;
  onSelectIssue?: (id: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onIssueClick?: (issue: any) => void;
  isPicker?: boolean;
  pickerCoords?: { lat: number; lng: number } | null;
  pickerLat?: number;
  pickerLng?: number;
  onLocationPick?: (coords: { lat: number; lng: number }) => void;
  onLocationSelect?: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
  center?: [number, number];
  interactive?: boolean;
}

const DEFAULT_CENTER: [number, number] = [17.4435, 78.3772];

export default function CivicMap({
  issues = [],
  selectedIssueId,
  onSelectIssue,
  onIssueClick,
  isPicker = false,
  pickerCoords,
  pickerLat,
  pickerLng,
  onLocationPick,
  onLocationSelect,
  height = "550px",
  zoom = 13,
  center = DEFAULT_CENTER,
  interactive = true,
}: CivicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<{ [id: number]: any }>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickerMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const optionsRef = useRef({
    center,
    zoom,
    interactive,
    isPicker,
    pickerCoords,
    pickerLat,
    pickerLng,
    onLocationPick,
    onLocationSelect,
  });

  useEffect(() => {
    optionsRef.current = {
      center,
      zoom,
      interactive,
      isPicker,
      pickerCoords,
      pickerLat,
      pickerLng,
      onLocationPick,
      onLocationSelect,
    };
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      const {
        center: initCenter,
        zoom: initZoom,
        interactive: initInteractive,
        isPicker: initIsPicker,
        pickerCoords: initPickerCoords,
        pickerLat: initPickerLat,
        pickerLng: initPickerLng,
      } = optionsRef.current;

      const activePicker = initPickerCoords || (initPickerLat && initPickerLng ? { lat: initPickerLat, lng: initPickerLng } : null);
      const initialCenter = activePicker ? [activePicker.lat, activePicker.lng] : initCenter;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter as [number, number],
        zoom: initZoom,
        zoomControl: initInteractive,
        dragging: initInteractive,
        scrollWheelZoom: initInteractive,
        doubleClickZoom: initInteractive,
        attributionControl: true,
      });

      // Free, standard OpenStreetMap tiles - zero API keys required, ultra-reliable
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Force Leaflet to recalculate container dimensions once DOM settles
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      if (initIsPicker) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", (e: any) => {
          if (optionsRef.current.onLocationPick) optionsRef.current.onLocationPick({ lat: e.latlng.lat, lng: e.latlng.lng });
          if (optionsRef.current.onLocationSelect) optionsRef.current.onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ResizeObserver to automatically resize map when viewport or parent dimensions change
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
    };
  }, []);

  // Handle center changes from parent (e.g. Near Me button)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    if (center && center.length === 2) {
      mapInstanceRef.current.setView(center, zoom, { animate: true });
    }
  }, [center, mapReady, zoom]);

  // Update Issues Markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || isPicker) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing markers
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const bounds = L.latLngBounds([]);

      issues.forEach((issue) => {
        if (!issue.latitude || !issue.longitude) return;

        const isResolved = issue.status?.toLowerCase() === "resolved";
        const priority = issue.priority?.toLowerCase();

        let color = "#2563eb"; // blue default
        let ringColor = "rgba(37, 99, 235, 0.3)";
        if (isResolved) {
          color = "#64748b"; // slate
          ringColor = "rgba(100, 116, 139, 0.2)";
        } else if (priority === "critical") {
          color = "#dc2626"; // red
          ringColor = "rgba(220, 38, 38, 0.4)";
        } else if (priority === "high") {
          color = "#ea580c"; // orange
          ringColor = "rgba(234, 88, 12, 0.4)";
        } else if (priority === "medium") {
          color = "#ca8a04"; // yellow
          ringColor = "rgba(202, 138, 4, 0.3)";
        } else if (priority === "low") {
          color = "#16a34a"; // green
          ringColor = "rgba(22, 163, 74, 0.3)";
        }

        const isSelected = selectedIssueId === issue.id;
        const count = issue.complaint_count || 1;
        const size = Math.min(46, Math.max(32, 28 + Math.log2(count) * 4));

        const iconHtml = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${color};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 14px ${ringColor}, 0 2px 4px rgba(0,0,0,0.25);
            border: ${isSelected ? "3px solid #ffffff" : "2px solid #ffffff"};
            transform: ${isSelected ? "scale(1.2)" : "scale(1)"};
            transition: all 0.2s ease;
            cursor: pointer;
          ">
            ${count > 1 ? count : "!"}
          </div>
        `;

        const icon = L.divIcon({
          className: "custom-civic-marker",
          html: iconHtml,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([issue.latitude, issue.longitude], { icon }).addTo(map);

        marker.on("click", () => {
          if (onSelectIssue) onSelectIssue(issue.id);
          if (onIssueClick) onIssueClick(issue);
        });

        // Hover Tooltip
        marker.bindTooltip(`
          <div style="font-family: inherit; padding: 4px 6px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">
              Issue #${issue.id} • ${issue.department || "General"}
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">
              ${issue.title}
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${issue.complaint_count || 1} citizen report${(issue.complaint_count || 1) > 1 ? "s" : ""} • ${issue.priority} Priority
            </div>
          </div>
        `, { direction: "top", offset: [0, -size / 2] });

        markersRef.current[issue.id] = marker;
        bounds.extend([issue.latitude, issue.longitude]);
      });

      if (bounds.isValid() && issues.length > 0 && !selectedIssueId) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    });
  }, [mapReady, issues, selectedIssueId, isPicker, onIssueClick, onSelectIssue]);

  // Center on Selected Issue & Draw City Memory Catchment Circle (1.0 km)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (!selectedIssueId) return;

    const selected = issues.find((i) => i.id === selectedIssueId);
    if (selected && selected.latitude && selected.longitude) {
      map.flyTo([selected.latitude, selected.longitude], 15, { duration: 1 });

      import("leaflet").then((L) => {
        if (!mapInstanceRef.current) return;
        if (circleRef.current) {
          circleRef.current.remove();
        }
        const circle = L.circle([selected.latitude!, selected.longitude!], {
          radius: 1000, // 1.0 km City Memory clustering radius
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: "4, 6",
        }).addTo(mapInstanceRef.current);

        circle.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; font-weight: 700; color: #1e40af;">
            City Memory Catchment (1.0 km)
           </div>`,
          { permanent: false, direction: "center" }
        );

        circleRef.current = circle;
      });
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
    };
  }, [mapReady, selectedIssueId, issues]);

  // Handle Picker Marker
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !isPicker) return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.remove();
        pickerMarkerRef.current = null;
      }

      const activePicker = pickerCoords || (pickerLat && pickerLng ? { lat: pickerLat, lng: pickerLng } : null);

      if (activePicker) {
        // High-precision teardrop SVG pin marker with white center and crisp shadow
        const pinHtml = `
          <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.059 27.941 0 18 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="18" cy="18" r="6" fill="#ffffff"/>
            </svg>
          </div>
        `;

        const pinIcon = L.divIcon({
          className: "custom-picker-pin",
          html: pinHtml,
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -44],
        });

        const marker = L.marker([activePicker.lat, activePicker.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          if (onLocationPick) {
            onLocationPick({ lat: latlng.lat, lng: latlng.lng });
          }
          if (onLocationSelect) {
            onLocationSelect(latlng.lat, latlng.lng);
          }
        });

        pickerMarkerRef.current = marker;
        map.panTo([activePicker.lat, activePicker.lng]);
      }
    });
  }, [mapReady, pickerCoords, pickerLat, pickerLng, isPicker, onLocationPick, onLocationSelect]);

  const isFullHeight = height === "100%";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100 ${
        isFullHeight ? "h-full min-h-[400px]" : ""
      }`}
      style={{
        height: height,
        minHeight: isFullHeight ? "100%" : height,
      }}
    >
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", minHeight: isFullHeight ? "400px" : height }}
        className="z-10"
      />

      {/* Legend overlay in bottom-right */}
      {!isPicker && (
        <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] flex items-center gap-3">
          <span className="font-semibold text-slate-700">Priority:</span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Critical
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> High
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Medium
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Resolved
          </span>
        </div>
      )}
    </div>
  );
}
