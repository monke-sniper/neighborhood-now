import type { ScoreBreakdown } from '../types';

export interface DataPresence {
  amenityDensity: boolean;
  transitScore: boolean;
  foodAccess: boolean;
  greenSpace: boolean;
  development: boolean;
  civicScore: boolean;
  cultureScore: boolean;
  recreationScore: boolean;
  serviceScore: boolean;
}

export const ALL_PRESENT: DataPresence = {
  amenityDensity: true,
  transitScore: true,
  foodAccess: true,
  greenSpace: true,
  development: true,
  civicScore: true,
  cultureScore: true,
  recreationScore: true,
  serviceScore: true,
};

export const ALL_ABSENT: DataPresence = {
  amenityDensity: false,
  transitScore: false,
  foodAccess: false,
  greenSpace: false,
  development: false,
  civicScore: false,
  cultureScore: false,
  recreationScore: false,
  serviceScore: false,
};

export type WeightSet = Record<keyof ScoreBreakdown, number>;
