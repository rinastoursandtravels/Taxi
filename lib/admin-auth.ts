import jwt from 'jsonwebtoken'

const INSECURE_DEFAULT = 'your-secret-key-change-in-production'

/**
 * Returns the admin-JWT signing secret, or throws if it is missing or still set
 * to the old insecure placeholder. Called lazily (not at module load) so a
 * misconfigured deploy fails CLOSED on auth — every token is rejected — instead
 * of silently signing/verifying with a publicly-known default secret.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret === INSECURE_DEFAULT) {
    throw new Error('JWT_SECRET environment variable is not configured')
  }
  return secret
}

export type AdminJwtPayload = {
  id: string
  email: string
  full_name?: string
  role?: string
  iat?: number
  exp?: number
}

export function requireAdminRequest(request: Request): Response | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    jwt.verify(authHeader.slice('Bearer '.length), getJwtSecret())
    return null
  } catch {
    return Response.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
  }
}

export function getAdminFromRequest(request: Request): AdminJwtPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(authHeader.slice('Bearer '.length), getJwtSecret())
    return decoded as AdminJwtPayload
  } catch {
    return null
  }
}
