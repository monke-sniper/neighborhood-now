import { CONFIG } from '../config';
import type { LatLon } from '../types';

export interface AirQuality {
  aqi: number;
  pm25: number;
  pm10: number;
}

const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY ?? '';

interface OpenWeatherPayload {
  list?: Array<{
    main: { aqi: number };
    components: { pm2_5?: number; pm10?: number };
  }>;
}

export async function fetchAirQuality(coords: LatLon): Promise<AirQuality | null> {
  if (!OPENWEATHER_KEY) return null;
  const url =
    `${CONFIG.openweather.base}/air_pollution` +
    `?lat=${coords.lat}&lon=${coords.lon}&appid=${OPENWEATHER_KEY}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenWeatherPayload;
    const first = data.list?.[0];
    if (!first) return null;
    return {
      aqi: first.main.aqi,
      pm25: first.components.pm2_5 ?? 0,
      pm10: first.components.pm10 ?? 0,
    };
  } catch {
    return null;
  }
}
