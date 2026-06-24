'use client';

import { useEffect, useRef } from 'react';
import type { LatLon, Permit } from '@/lib/types';

interface Props {
  coords: LatLon;
  permits: Permit[];
}

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

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
        pin.style.cssText =
          'width:18px;height:18px;background:#10b981;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(16,185,129,0.25);';
        new maplibregl.Marker({ element: pin })
          .setLngLat([coords.lon, coords.lat])
          .addTo(map);

        for (const p of permits.slice(0, 200)) {
          const el = document.createElement('div');
          el.style.cssText =
            'width:8px;height:8px;background:#f59e0b;border-radius:50%;opacity:0.85;';
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
    <div
      ref={containerRef}
      className="w-full h-80 rounded border border-zinc-800 overflow-hidden bg-zinc-900"
    />
  );
}
