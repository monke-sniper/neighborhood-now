export type LatLon = { lat: number; lon: number };

export interface GeocodeResult extends LatLon {
  displayName: string;
  bbox?: [number, number, number, number];
}

export type AmenityKind =
  | 'restaurant'
  | 'cafe'
  | 'school'
  | 'grocery'
  | 'park'
  | 'bus_stop'
  | 'transit'
  | 'construction';

export interface Amenity {
  id: string;
  kind: AmenityKind;
  name?: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface OverpassResponse {
  amenities: Amenity[];
  buildings: Amenity[];
  transit: Amenity[];
  landuse: Amenity[];
  rawCount: number;
}

export interface Permit {
  id: string;
  address: string;
  lat: number;
  lon: number;
  description: string;
  issuedDate: string;
  structureType: string;
  constructionValue?: number;
  status: string;
}

export interface Complaint {
  id: string;
  type: string;
  date: string;
  lat: number;
  lon: number;
  status: string;
}

export interface ScoreBreakdown {
  amenityDensity: number;
  transitScore: number;
  foodAccess: number;
  greenSpace: number;
  development: number;
}

export interface LivabilityScore {
  total: number;
  breakdown: ScoreBreakdown;
  cityAverage: number;
  ranking: Ranking;
}

export interface Ranking {
  percentile: number;
  label: string;
}

export interface Signal {
  name: string;
  current: number;
  baseline: number;
  unit: string;
}

export interface Anomaly {
  signal: string;
  zscore: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface Trend {
  signal: string;
  current: number;
  slope: number;
  history: number[];
  forecast6m: number;
  forecast12m: number;
  forecast24m: number;
  r2: number;
  confidence: 'high' | 'medium' | 'low';
  method?: 'ewma' | 'ols' | 'flat';
  band?: {
    forecast6m: { value: number; low: number; high: number };
    forecast12m: { value: number; low: number; high: number };
    forecast24m: { value: number; low: number; high: number };
  };
}

export interface Scenario {
  id: string;
  name: string;
  emoji: string;
  description: string;
  impact: {
    amenityDensity?: number | ((current: ScoreBreakdown) => number);
    transitScore?: number | ((current: ScoreBreakdown) => number);
    foodAccess?: number | ((current: ScoreBreakdown) => number);
    greenSpace?: number | ((current: ScoreBreakdown) => number);
    development?: number | ((current: ScoreBreakdown) => number);
  };
}

export interface ScenarioResult {
  scenarioId: string;
  before: number;
  after: number;
  delta: number;
  modifiedBreakdown: ScoreBreakdown;
}

export interface NeighborhoodReport {
  address: string;
  coords: LatLon;
  fetchedAt: string;
  score: LivabilityScore;
  amenities: OverpassResponse;
  permits: Permit[];
  complaints: Complaint[];
  anomalies: Anomaly[];
  trends: Trend[];
  sources: {
    overpass: 'ok' | 'failed' | 'partial';
    builddata: 'ok' | 'failed' | 'skipped';
    complaints: 'ok' | 'failed' | 'skipped';
    census: 'ok' | 'failed' | 'skipped';
    weather: 'ok' | 'failed' | 'skipped';
  };
}

export interface ChatRequest {
  question: string;
  report: NeighborhoodReport;
}

export interface ChatResponse {
  answer: string;
  modelUsed: string;
}
