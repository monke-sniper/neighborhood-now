import type { Amenity, AmenityKind, LatLon, NeighborhoodReport } from '@/lib/types';
import { haversineMeters } from '@/lib/utils/geo';
import { hasRealName, pickName } from '@/lib/utils/amenity';

interface Props {
  report: NeighborhoodReport;
  radiusMeters: number;
}

interface Section {
  key: AmenityKind;
  label: string;
  defaultOpen: boolean;
}

const SECTIONS: Section[] = [
  { key: 'school', label: 'SCHOOLS', defaultOpen: true },
  { key: 'restaurant', label: 'RESTAURANTS', defaultOpen: true },
  { key: 'cafe', label: 'CAFÉS', defaultOpen: true },
  { key: 'grocery', label: 'GROCERY', defaultOpen: false },
  { key: 'park', label: 'PARKS', defaultOpen: false },
  { key: 'recreation', label: 'RECREATION', defaultOpen: false },
  { key: 'civic', label: 'CIVIC', defaultOpen: false },
  { key: 'culture', label: 'CULTURE', defaultOpen: false },
  { key: 'service', label: 'SERVICES', defaultOpen: false },
  { key: 'bus_stop', label: 'BUS STOPS', defaultOpen: false },
  { key: 'transit', label: 'TRANSIT STATIONS', defaultOpen: false },
  { key: 'construction', label: 'CONSTRUCTION SITES', defaultOpen: false },
];

const PER_SECTION = 12;

function distanceKm(amenity: Amenity, center: LatLon): number {
  return haversineMeters(amenity, center) / 1000;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

function radiusLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}KM` : `${m}M`;
}

export function AmenityList({ report, radiusMeters }: Props) {
  const center = report.coords;
  const byKind = new Map<AmenityKind, Amenity[]>();
  for (const a of report.amenities.amenities) {
    const arr = byKind.get(a.kind) ?? [];
    arr.push(a);
    byKind.set(a.kind, arr);
  }

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ NAMED PLACES // {radiusLabel(radiusMeters)} RADIUS ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          SOURCE: OSM
        </div>
      </div>

      {SECTIONS.map(({ key, label, defaultOpen }) => {
        const items = (byKind.get(key) ?? []).slice();
        items.sort(
          (a, b) => distanceKm(a, center) - distanceKm(b, center),
        );
        const total = items.length;
        const shown = items.slice(0, PER_SECTION);
        if (total === 0) return null;

        return (
          <details
            key={key}
            open={defaultOpen}
            className="group border border-[var(--color-border)] bg-black"
          >
            <summary className="cursor-pointer select-none px-3 py-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition">
              <span>
                [ {label} // {total} ]{' '}
                {total > PER_SECTION ? (
                  <span className="text-[var(--color-text-mute)]">
                    (showing {PER_SECTION})
                  </span>
                ) : null}
              </span>
              <span className="text-[var(--color-text-mute)] group-open:rotate-90 transition-transform">
                ▶
              </span>
            </summary>
            <ul className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {shown.map((a) => {
                const real = hasRealName(a);
                return (
                  <li
                    key={a.id}
                    className="px-3 py-1 flex items-center justify-between gap-3 text-xs"
                  >
                    <span
                      className={`truncate ${
                        real
                          ? 'text-[var(--color-text)]'
                          : 'text-[var(--color-text-mute)] italic'
                      }`}
                      title={a.tags?.name ?? pickName(a)}
                    >
                      {pickName(a)}
                    </span>
                    <span className="text-[var(--color-text-mute)] tabular-nums whitespace-nowrap">
                      {formatDistance(distanceKm(a, center))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {SECTIONS.every((s) => (byKind.get(s.key) ?? []).length === 0) && (
        <div className="text-xs text-[var(--color-text-mute)] uppercase tracking-wider py-2 text-center">
          [ NO NAMED PLACES FOUND IN RADIUS ]
        </div>
      )}
    </div>
  );
}
