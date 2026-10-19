export type LocationQuality = 'PRECISE' | 'APPROXIMATE' | 'UNRELIABLE';

export interface DeviceLocationSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export const PRECISE_LOCATION_THRESHOLD_METERS = 200;
export const USABLE_LOCATION_THRESHOLD_METERS = 1000;

export function classifyLocationAccuracy(accuracy: number): LocationQuality {
  if (accuracy <= PRECISE_LOCATION_THRESHOLD_METERS) return 'PRECISE';
  if (accuracy <= USABLE_LOCATION_THRESHOLD_METERS) return 'APPROXIMATE';
  return 'UNRELIABLE';
}

export function isBetterLocationSample(
  candidate: DeviceLocationSample,
  current: DeviceLocationSample | null
): boolean {
  if (!current) return true;
  if (candidate.timestamp > current.timestamp + 30_000 && candidate.accuracy <= current.accuracy * 1.5) {
    return true;
  }
  return candidate.accuracy < current.accuracy;
}

export function formatAccuracy(accuracy: number): string {
  if (accuracy < 1000) return `khoảng ${Math.max(1, Math.round(accuracy))} m`;
  return `khoảng ${(accuracy / 1000).toFixed(1)} km`;
}
