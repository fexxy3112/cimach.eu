export function hasAdminSession(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('user' in value)) return false
  const user = (value as { user?: unknown }).user
  return !!user && typeof user === 'object' && 'role' in user && (user as { role?: unknown }).role === 'admin'
}
