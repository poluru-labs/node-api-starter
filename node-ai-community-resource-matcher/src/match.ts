export interface CommunityResource {
  readonly id: string;
  readonly name: string;
  readonly needs: readonly string[];
  readonly region: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface MatchQuery {
  readonly needs: readonly string[];
  readonly region: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly limit: number;
}

export interface ResourceMatch {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly distanceKm: number | null;
  readonly matchedNeeds: readonly string[];
}

export function rankResources(
  resources: readonly CommunityResource[],
  query: MatchQuery,
): ResourceMatch[] {
  const wanted = new Set(query.needs.map((need) => need.toLowerCase()));
  const ranked: ResourceMatch[] = [];
  for (const resource of resources) {
    if (query.region !== null && resource.region !== null && resource.region !== query.region) {
      continue;
    }
    const matchedNeeds = resource.needs.filter((need) => wanted.has(need.toLowerCase()));
    if (matchedNeeds.length === 0) {
      continue;
    }
    let score = matchedNeeds.length * 10;
    if (query.region !== null && resource.region === query.region) {
      score += 5;
    }
    const distanceKm = distance(query, resource);
    if (distanceKm !== null) {
      score -= Math.min(distanceKm / 10, 20);
    }
    ranked.push({
      id: resource.id,
      name: resource.name,
      score: Math.round(score * 100) / 100,
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
      matchedNeeds,
    });
  }
  ranked.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  return ranked.slice(0, query.limit);
}

function distance(query: MatchQuery, resource: CommunityResource): number | null {
  if (
    query.latitude === null ||
    query.longitude === null ||
    resource.latitude === null ||
    resource.longitude === null
  ) {
    return null;
  }
  const earthKm = 6371;
  const lat1 = toRadians(query.latitude);
  const lat2 = toRadians(resource.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(resource.longitude - query.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
