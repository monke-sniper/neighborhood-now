'use client';

import { useEffect, useRef } from 'react';
import type { LatLon, Permit } from '@/lib/types';

interface Props {
  coords: LatLon;
  permits: Permit[];
  radiusMeters?: number;
}

const STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ACCENT = '#5eead4';
const WARN = '#fbbf24';

const RADIUS_SOURCE_ID = 'nn-radius-src';
const RADIUS_FILL_LAYER_ID = 'nn-radius-fill';
const RADIUS_LINE_LAYER_ID = 'nn-radius-line';

function metersToDegreesLat(m: number): number {
  return m / 111_320;
}

function metersToDegreesLon(m: number, lat: number): number {
  return m / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
}

function ringPolygon(
  center: LatLon,
  radiusMeters: number,
  steps = 96,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = metersToDegreesLon(radiusMeters * Math.cos(angle), center.lat);
    const dy = metersToDegreesLat(radiusMeters * Math.sin(angle));
    coords.push([center.lon + dx, center.lat + dy]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function markerEl(color: string, sizePx: number, glow: boolean): HTMLDivElement {
  const el = document.createElement('div');
  const shadow = glow
    ? `box-shadow:0 0 0 3px ${ACCENT}40,0 0 12px ${ACCENT}80;`
    : 'border:1px solid #000;';
  el.style.cssText = `width:${sizePx}px;height:${sizePx}px;background:${color};${shadow}`;
  return el;
}

interface MapHandle {
  map: { remove: () => void; getStyle: () => unknown };
  centerMarker: { remove: () => void; setLngLat: (p: [number, number]) => unknown };
  permitMarkers: Array<{ remove: () => void }>;
  hasRadiusSource: () => boolean;
  ensureRadiusSource: (c: LatLon, r: number) => void;
  updateCenter: (c: LatLon) => void;
  setPermits: (permits: Permit[]) => void;
}

export function MapView({ coords, permits, radiusMeters }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const coordsRef = useRef<LatLon>(coords);
  const permitsRef = useRef<Permit[]>(permits);
  const radiusRef = useRef<number | undefined>(radiusMeters);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);
  useEffect(() => {
    permitsRef.current = permits;
  }, [permits]);
  useEffect(() => {
    radiusRef.current = radiusMeters;
  }, [radiusMeters]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const permitMarkers: Array<{ remove: () => void }> = [];
    let centerMarker: { remove: () => void; setLngLat: (p: [number, number]) => unknown } | null = null;
    let map: { remove: () => void; getStyle: () => unknown } | null = null;
    let radiusSourceReady = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !containerRef.current) return;

      const initialCoords = coordsRef.current;
      const initialPermits = permitsRef.current;
      const m = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [initialCoords.lon, initialCoords.lat],
        zoom: 14,
        attributionControl: false,
      });
      map = m as unknown as { remove: () => void; getStyle: () => unknown };
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right',
      );

      m.on('load', () => {
        const pin = markerEl(ACCENT, 14, true);
        centerMarker = new maplibregl.Marker({ element: pin })
          .setLngLat([initialCoords.lon, initialCoords.lat])
          .addTo(m) as unknown as typeof centerMarker;

        for (const p of initialPermits.slice(0, 200)) {
          const el = markerEl(WARN, 6, false);
          permitMarkers.push(
            new maplibregl.Marker({ element: el })
              .setLngLat([p.lon, p.lat])
              .addTo(m) as unknown as { remove: () => void },
          );
        }
      });

      handleRef.current = {
        map: map as { remove: () => void; getStyle: () => unknown },
        centerMarker: null as unknown as { remove: () => void; setLngLat: (p: [number, number]) => unknown },
        permitMarkers,
        hasRadiusSource: () => radiusSourceReady,
        ensureRadiusSource: (c: LatLon, r: number) => {
          const style = m.getStyle();
          if (!style || typeof style !== 'object') return;
          const feature = ringPolygon(c, r);
          const src = m.getSource(RADIUS_SOURCE_ID) as
            | { setData: (d: GeoJSON.Feature<GeoJSON.Polygon>) => void }
            | undefined;
          if (src) {
            src.setData(feature);
            return;
          }
          m.addSource(RADIUS_SOURCE_ID, { type: 'geojson', data: feature });
          m.addLayer({
            id: RADIUS_FILL_LAYER_ID,
            type: 'fill',
            source: RADIUS_SOURCE_ID,
            paint: {
              'fill-color': ACCENT,
              'fill-opacity': 0.08,
            },
          });
          m.addLayer({
            id: RADIUS_LINE_LAYER_ID,
            type: 'line',
            source: RADIUS_SOURCE_ID,
            paint: {
              'line-color': ACCENT,
              'line-opacity': 0.55,
              'line-width': 1.5,
              'line-dasharray': [2, 2],
            },
          });
          radiusSourceReady = true;
        },
        updateCenter: (c: LatLon) => {
          if (centerMarker) centerMarker.setLngLat([c.lon, c.lat]);
          m.jumpTo({ center: [c.lon, c.lat] });
        },
        setPermits: (newPermits: Permit[]) => {
          for (const mk of permitMarkers) mk.remove();
          permitMarkers.length = 0;
          for (const p of newPermits.slice(0, 200)) {
            const el = markerEl(WARN, 6, false);
            permitMarkers.push(
              new maplibregl.Marker({ element: el })
                .setLngLat([p.lon, p.lat])
                .addTo(m) as unknown as { remove: () => void },
            );
          }
        },
      };
      if (handleRef.current && centerMarker) {
        handleRef.current.centerMarker = centerMarker as unknown as {
          remove: () => void;
          setLngLat: (p: [number, number]) => unknown;
        };
      }
    })();

    return () => {
      cancelled = true;
      if (handleRef.current) {
        try {
          handleRef.current.permitMarkers.forEach((mk) => mk.remove());
        } catch {
          // ignore
        }
        try {
          handleRef.current.centerMarker.remove();
        } catch {
          // ignore
        }
        try {
          handleRef.current.map.remove();
        } catch {
          // ignore
        }
        handleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const applyLatest = () => {
      const h = handleRef.current;
      if (!h) return;
      const c = coordsRef.current;
      try {
        h.updateCenter(c);
      } catch {
        // ignore — map may be mid-init
      }
    };
    const styleReady = (() => {
      const h = handleRef.current;
      return Boolean(h && typeof h.map.getStyle === 'function' && h.map.getStyle() != null);
    })();
    if (styleReady) {
      applyLatest();
      return;
    }
    const id = window.setInterval(() => {
      const h = handleRef.current;
      if (h && h.map.getStyle()) {
        window.clearInterval(id);
        applyLatest();
      }
    }, 200);
    window.setTimeout(() => window.clearInterval(id), 10000);
  }, [coords.lat, coords.lon]);

  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    try {
      h.setPermits(permitsRef.current);
    } catch {
      // ignore
    }
  }, [permits]);

  useEffect(() => {
    const tryAdd = () => {
      const h = handleRef.current;
      if (!h) return;
      const r = radiusRef.current;
      if (!r) return;
      const c = coordsRef.current;
      try {
        h.ensureRadiusSource(c, r);
      } catch {
        // ignore
      }
    };
    const h = handleRef.current;
    if (!h) return;
    if (h.hasRadiusSource()) {
      tryAdd();
      return;
    }
    const id = window.setInterval(() => {
      const cur = handleRef.current;
      if (cur && cur.map.getStyle()) {
        window.clearInterval(id);
        tryAdd();
      }
    }, 200);
    window.setTimeout(() => window.clearInterval(id), 10000);
  }, [coords.lat, coords.lon, radiusMeters]);

  return (
    <div className="relative w-full h-80 border border-[var(--color-border)] bg-black overflow-hidden">
      <div className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-widest text-[var(--color-accent)] bg-black/80 px-2 py-1 border border-[var(--color-border)] pointer-events-none">
        [ MAP // {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
        {radiusMeters ? ` · ${radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)}KM RADIUS` : `${radiusMeters}M RADIUS`}` : ''} ]
      </div>
      <div
        ref={containerRef}
        className="w-full h-full"
      />
    </div>
  );
}
