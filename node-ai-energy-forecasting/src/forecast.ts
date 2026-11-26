export const energyUnits = ['kWh', 'kW', 'MWh'] as const;
export type EnergyUnit = (typeof energyUnits)[number];

export interface EnergyPoint {
  readonly at: string;
  readonly value: number;
}

export interface EnergySeries {
  readonly id: string;
  readonly name: string;
  readonly unit: EnergyUnit;
  readonly points: readonly EnergyPoint[];
  readonly anomalies: readonly string[];
}

export interface ForecastPoint {
  readonly at: string;
  readonly value: number;
  readonly lower: number;
  readonly upper: number;
}

export interface EnergyForecast {
  readonly seriesId: string;
  readonly method: 'seasonal-naive' | 'linear';
  readonly horizon: number;
  readonly mae: number;
  readonly points: readonly ForecastPoint[];
}

const season = 7;

export function isEnergyUnit(value: unknown): value is EnergyUnit {
  return typeof value === 'string' && energyUnits.some((unit) => unit === value);
}

export function describeSeries(
  name: string,
  unit: EnergyUnit,
  points: readonly EnergyPoint[],
  id: string,
): EnergySeries {
  const ordered = [...points].sort((left, right) => left.at.localeCompare(right.at));
  return { id, name, unit, points: ordered, anomalies: findAnomalies(ordered) };
}

export function forecastSeries(series: EnergySeries, horizon: number): EnergyForecast {
  const values = series.points.map((point) => point.value);
  const lastAt = series.points[series.points.length - 1]?.at ?? '1970-01-01';
  if (values.length >= season * 2) {
    return {
      seriesId: series.id,
      method: 'seasonal-naive',
      horizon,
      mae: round2(seasonalMae(values)),
      points: seasonalForecast(values, lastAt, horizon, seasonalMae(values)),
    };
  }
  const mae = linearMae(values);
  return {
    seriesId: series.id,
    method: 'linear',
    horizon,
    mae: round2(mae),
    points: linearForecast(values, lastAt, horizon, mae),
  };
}

export function findAnomalies(points: readonly EnergyPoint[]): string[] {
  const values = points.map((point) => point.value).sort((left, right) => left - right);
  const median = quantile(values, 0.5);
  const deviations = values
    .map((value) => Math.abs(value - median))
    .sort((left, right) => left - right);
  const mad = quantile(deviations, 0.5);
  const flagged: string[] = [];
  for (const point of points) {
    const outlier =
      mad === 0 ? point.value !== median : Math.abs(point.value - median) / (1.4826 * mad) > 3;
    if (outlier) {
      flagged.push(point.at);
    }
  }
  return flagged;
}

function seasonalForecast(
  values: readonly number[],
  lastAt: string,
  horizon: number,
  mae: number,
): ForecastPoint[] {
  const base = values.slice(-season);
  const points: ForecastPoint[] = [];
  for (let step = 1; step <= horizon; step += 1) {
    points.push(band(addDays(lastAt, step), base[(step - 1) % season] ?? 0, mae));
  }
  return points;
}

function linearForecast(
  values: readonly number[],
  lastAt: string,
  horizon: number,
  mae: number,
): ForecastPoint[] {
  const { intercept, slope } = fit(values);
  const points: ForecastPoint[] = [];
  for (let step = 1; step <= horizon; step += 1) {
    const value = Math.max(0, intercept + slope * (values.length - 1 + step));
    points.push(band(addDays(lastAt, step), value, mae));
  }
  return points;
}

function seasonalMae(values: readonly number[]): number {
  let error = 0;
  let count = 0;
  for (let index = season; index < values.length; index += 1) {
    error += Math.abs((values[index] ?? 0) - (values[index - season] ?? 0));
    count += 1;
  }
  return count === 0 ? 0 : error / count;
}

function linearMae(values: readonly number[]): number {
  const { intercept, slope } = fit(values);
  if (values.length === 0) {
    return 0;
  }
  let error = 0;
  for (let index = 0; index < values.length; index += 1) {
    error += Math.abs((values[index] ?? 0) - (intercept + slope * index));
  }
  return error / values.length;
}

function fit(values: readonly number[]): { intercept: number; slope: number } {
  const count = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let index = 0; index < count; index += 1) {
    const value = values[index] ?? 0;
    sumX += index;
    sumY += value;
    sumXY += index * value;
    sumXX += index * index;
  }
  const denominator = count * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
  const intercept = count === 0 ? 0 : (sumY - slope * sumX) / count;
  return { intercept, slope };
}

function band(at: string, value: number, mae: number): ForecastPoint {
  const point = round2(value);
  return { at, value: point, lower: round2(Math.max(0, point - mae)), upper: round2(point + mae) };
}

function quantile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const left = sorted[lower] ?? 0;
  const right = sorted[upper] ?? left;
  if (lower === upper) {
    return left;
  }
  return left + (right - left) * (position - lower);
}

function addDays(day: string, days: number): string {
  const time = Date.parse(`${day}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
