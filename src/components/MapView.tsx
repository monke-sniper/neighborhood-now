'use client';

import { useEffect, useRef } from 'react';
import type { LatLon, Permit } from '@/lib/types';

interface Props {
  coords: LatLon;
  permits: Permit[];
}

const STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ACCENT = '#5eead4';
const WARN = '#fbbf24';

export function MapView({ coords, permits }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [coords.lon, coords.lat],
        zoom: 14,
        attributionControl: false,
      });
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right',
      );

      map.on('load', () => {
        const pin = document.createElement('div');
        pin.style.cssText = `width:14px;height:14px;background:${ACCENT};border:2px solid #000;box-shadow:0 0 0 3px ${ACCENT}40,0 0 12px ${ACCENT}80;`;
        new maplibregl.Marker({ element: pin })
          .setLngLat([coords.lon, coords.lat])
          .addTo(map);

        for (const p of permits.slice(0, 200)) {
          const el = document.createElement('div');
          el.style.cssText = `width:6px;height:6px;background:${WARN};border:1px solid #000;opacity:0.9;`;
          new maplibregl.Marker({ element: el })
            .setLngLat([p.lon, p.lat])
            .addTo(map);
        }
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m && typeof m.remove === 'function') m.remove();
      mapRef.current = null;
    };
  }, [coords.lat, coords.lon, permits]);

  return (
    <div className="relative w-full h-80 border border-[var(--color-border)] bg-black overflow-hidden">
      <div className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-widest text-[var(--color-accent)] bg-black/80 px-2 py-1 border border-[var(--color-border)] pointer-events-none">
        [ MAP // {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)} ]
      </div>
      <div
        ref={containerRef}
        className="w-full h-full"
      />
    </div>
  );
}
