'use client';

import { useEffect, useRef } from 'react';
import type { LatLon, NeighborhoodReport, Permit } from '@/lib/types';

interface Props {
  a: NeighborhoodReport;
  b: NeighborhoodReport;
  radiusMeters: number;
}

const STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ACCENT_A = '#5eead4';
const ACCENT_B = '#fbbf24';

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

function ringPolygonFor(
  center: LatLon,
  radiusMeters: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  return ringPolygon(center, radiusMeters);
}

function buildCollection(
  a: LatLon,
  b: LatLon,
  r: number,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: [ringPolygonFor(a, r), ringPolygonFor(b, r)],
  };
}

interface CompareHandle {
  map: { remove: () => void; getStyle: () => unknown };
  setData: (a: LatLon, b: LatLon, r: number) => void;
  setPermits: (a: Permit[], b: Permit[]) => void;
}

function markerEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 6px;background:${color};color:#000;font-family:var(--font-mono);font-size:9px;font-weight:700;text-transform:uppercase;border:1px solid #000;box-shadow:0 0 0 2px ${color}40;`;
  el.textContent = label;
  return el;
}

function permitEl(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width:5px;height:5px;background:${color};border:1px solid #000;`;
  return el;
}

export function CompareMap({ a, b, radiusMeters }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CompareHandle | null>(null);
  const aRef = useRef<NeighborhoodReport>(a);
  const bRef = useRef<NeighborhoodReport>(b);
  const radiusRef = useRef<number>(radiusMeters);

  useEffect(() => {
    aRef.current = a;
  }, [a]);
  useEffect(() => {
    bRef.current = b;
  }, [b]);
  useEffect(() => {
    radiusRef.current = radiusMeters;
  }, [radiusMeters]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: { remove: () => void; getStyle: () => unknown } | null = null;
    const permitMarkers: Array<{ remove: () => void }> = [];

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (cancelled || !containerRef.current) return;

      const initA = aRef.current;
      const initB = bRef.current;
      const initR = radiusRef.current;
      const center: [number, number] = [
        (initA.coords.lon + initB.coords.lon) / 2,
        (initA.coords.lat + initB.coords.lat) / 2,
      ];
      const m = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center,
        zoom: 12,
        attributionControl: false,
      });
      map = m as unknown as { remove: () => void; getStyle: () => unknown };
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right',
      );

      const onLoad = () => {
        m.addSource('nn-compare-circles', {
          type: 'geojson',
          data: buildCollection(initA.coords, initB.coords, initR),
        });
        m.addLayer({
          id: 'nn-compare-circles-fill',
          type: 'fill',
          source: 'nn-compare-circles',
          paint: {
            'fill-color': ['match', ['get', 'color'], '#A', ACCENT_A, ACCENT_B],
            'fill-opacity': 0.06,
          },
        });
        m.addLayer({
          id: 'nn-compare-circles-line',
          type: 'line',
          source: 'nn-compare-circles',
          paint: {
            'line-color': ['match', ['get', 'color'], '#A', ACCENT_A, ACCENT_B],
            'line-width': 1.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.75,
          },
        });

        const pinA = markerEl(ACCENT_A, 'A');
        new maplibregl.Marker({ element: pinA })
          .setLngLat([initA.coords.lon, initA.coords.lat])
          .addTo(m);

        const pinB = markerEl(ACCENT_B, 'B');
        new maplibregl.Marker({ element: pinB })
          .setLngLat([initB.coords.lon, initB.coords.lat])
          .addTo(m);

        for (const p of initA.permits.slice(0, 80)) {
          permitMarkers.push(
            new maplibregl.Marker({ element: permitEl(ACCENT_A) })
              .setLngLat([p.lon, p.lat])
              .addTo(m) as unknown as { remove: () => void },
          );
        }
        for (const p of initB.permits.slice(0, 80)) {
          permitMarkers.push(
            new maplibregl.Marker({ element: permitEl(ACCENT_B) })
              .setLngLat([p.lon, p.lat])
              .addTo(m) as unknown as { remove: () => void },
          );
        }
      };
      m.on('load', onLoad);

      handleRef.current = {
        map: map as { remove: () => void; getStyle: () => unknown },
        setData: (ac: LatLon, bc: LatLon, r: number) => {
          const src = m.getSource('nn-compare-circles') as
            | { setData: (d: GeoJSON.FeatureCollection<GeoJSON.Polygon>) => void }
            | undefined;
          if (src) src.setData(buildCollection(ac, bc, r));
        },
        setPermits: (pa: Permit[], pb: Permit[]) => {
          for (const mk of permitMarkers) mk.remove();
          permitMarkers.length = 0;
          for (const p of pa.slice(0, 80)) {
            permitMarkers.push(
              new maplibregl.Marker({ element: permitEl(ACCENT_A) })
                .setLngLat([p.lon, p.lat])
                .addTo(m) as unknown as { remove: () => void },
            );
          }
          for (const p of pb.slice(0, 80)) {
            permitMarkers.push(
              new maplibregl.Marker({ element: permitEl(ACCENT_B) })
                .setLngLat([p.lon, p.lat])
                .addTo(m) as unknown as { remove: () => void },
            );
          }
        },
      };
    })();

    return () => {
      cancelled = true;
      try {
        for (const mk of permitMarkers) mk.remove();
      } catch {
        // ignore
      }
      try {
        map?.remove();
      } catch {
        // ignore
      }
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const applyLatest = () => {
      const h = handleRef.current;
      if (!h) return;
      try {
        h.setData(aRef.current.coords, bRef.current.coords, radiusRef.current);
      } catch {
        // ignore
      }
    };
    const h0 = handleRef.current;
    if (h0 && h0.map.getStyle()) {
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
  }, [a.coords.lat, a.coords.lon, b.coords.lat, b.coords.lon, radiusMeters]);

  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    try {
      h.setPermits(aRef.current.permits, bRef.current.permits);
    } catch {
      // ignore
    }
  }, [a.permits, b.permits]);

  return (
    <div className="relative w-full h-80 border border-[var(--color-border)] bg-black overflow-hidden">
      <div className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-widest text-[var(--color-accent)] bg-black/80 px-2 py-1 border border-[var(--color-border)] pointer-events-none">
        [ COMPARE MAP // A={a.coords.lat.toFixed(3)},{a.coords.lon.toFixed(3)} · B={b.coords.lat.toFixed(3)},{b.coords.lon.toFixed(3)} · {radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)}KM` : `${radiusMeters}M`} RADIUS ]
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
