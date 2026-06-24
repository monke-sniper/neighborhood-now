import type { NeighborhoodReport } from '@/lib/types';

interface Props {
  report: NeighborhoodReport;
}

const LABELS: Record<keyof NeighborhoodReport['score']['breakdown'], string> = {
  amenityDensity: 'Amenity density',
  transitScore: 'Transit access',
  foodAccess: 'Food access',
  greenSpace: 'Green space',
  development: 'Development activity',
};

function colorFor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-300';
  return 'text-rose-400';
}

export function ReportCard({ report }: Props) {
  const { score, amenities, permits, complaints, sources } = report;
  const rest = amenities.amenities.filter((a) => a.kind === 'restaurant').length;
  const cafes = amenities.amenities.filter((a) => a.kind === 'cafe').length;
  const schools = amenities.amenities.filter((a) => a.kind === 'school').length;
  const groceries = amenities.amenities.filter((a) => a.kind === 'grocery').length;
  const parks = amenities.amenities.filter((a) => a.kind === 'park').length;
  const transit = amenities.transit.length + amenities.amenities.filter(
    (a) => a.kind === 'bus_stop' || a.kind === 'transit',
  ).length;

  return (
    <div className="flex flex-col gap-4 p-4 rounded border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-400">
          Livability score
        </h2>
        <div className="text-xs text-zinc-500">
          City avg {score.cityAverage}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <div className={`text-5xl font-bold ${colorFor(score.total)}`}>
          {score.total}
        </div>
        <div className="text-zinc-500 text-lg">/ 100</div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {Object.entries(score.breakdown).map(([k, v]) => {
          const key = k as keyof typeof score.breakdown;
          return (
            <div key={k} className="flex items-center gap-3 text-sm">
              <div className="w-32 text-zinc-400">{LABELS[key]}</div>
              <div className="flex-1 h-2 bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`h-full ${v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${v}%` }}
                />
              </div>
              <div className="w-10 text-right text-zinc-300 tabular-nums">
                {v}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm pt-2 border-t border-zinc-800">
        <div><span className="text-zinc-500">Restaurants</span> <span className="float-right text-zinc-200">{rest}</span></div>
        <div><span className="text-zinc-500">Cafés</span> <span className="float-right text-zinc-200">{cafes}</span></div>
        <div><span className="text-zinc-500">Schools</span> <span className="float-right text-zinc-200">{schools}</span></div>
        <div><span className="text-zinc-500">Grocery</span> <span className="float-right text-zinc-200">{groceries}</span></div>
        <div><span className="text-zinc-500">Parks</span> <span className="float-right text-zinc-200">{parks}</span></div>
        <div><span className="text-zinc-500">Transit</span> <span className="float-right text-zinc-200">{transit}</span></div>
        <div><span className="text-zinc-500">Permits (500m)</span> <span className="float-right text-amber-300">{permits.length}</span></div>
        <div><span className="text-zinc-500">Complaints</span> <span className="float-right text-rose-300">{complaints.length}</span></div>
      </div>

      <div className="text-[10px] text-zinc-600 flex flex-wrap gap-2 pt-1 border-t border-zinc-800">
        <span>OSM {sources.overpass}</span>
        <span>·</span>
        <span>Permits {sources.builddata}</span>
        <span>·</span>
        <span>311 {sources.complaints}</span>
        <span>·</span>
        <span>Census {sources.census}</span>
        <span>·</span>
        <span>Air {sources.weather}</span>
      </div>
    </div>
  );
}
