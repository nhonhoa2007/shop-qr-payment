export function getDashboardAnalyticsEndpoint(role: string | undefined, range: string): string {
  return role === 'STAFF'
    ? '/api/admin/analytics/staff'
    : `/api/admin/analytics?range=${range}`;
}
