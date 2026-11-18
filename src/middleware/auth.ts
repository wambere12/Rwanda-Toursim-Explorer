import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles, userRoles } from '../db/schema.ts';

export interface AuthProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  nationality: string | null;
  travelStyle: string | null;
  preferredCurrency: string | null;
  travelHistory: string[];
}

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  profile?: AuthProfile;
  roles?: string[];
}

const BOOTSTRAP_ADMIN_EMAILS = new Set(['m66601267@gmail.com']);

export async function syncUserProfile(decoded: DecodedIdToken): Promise<{
  profile: AuthProfile;
  roles: string[];
}> {
  const email = (decoded.email || `${decoded.uid}@users.rwandatourism.rw`).toLowerCase();
  const fullName = decoded.name || email.split('@')[0] || 'Traveler';
  const avatarUrl = decoded.picture || null;

  const [upserted] = await db
    .insert(profiles)
    .values({
      uid: decoded.uid,
      email,
      fullName,
      avatarUrl,
    })
    .onConflictDoUpdate({
      target: profiles.uid,
      set: {
        email,
        avatarUrl: avatarUrl ?? undefined,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Ensure tourist role exists
  await db
    .insert(userRoles)
    .values({
      userId: upserted.id,
      role: 'tourist',
      assignedBy: 'system',
    })
    .onConflictDoNothing();

  // Bootstrap admin role for configured owner email or first registered account if no admins exist
  const existingAdmins = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.role, 'admin'))
    .limit(1);

  if (BOOTSTRAP_ADMIN_EMAILS.has(email) || existingAdmins.length === 0) {
    await db
      .insert(userRoles)
      .values({
        userId: upserted.id,
        role: 'admin',
        assignedBy: 'bootstrap',
      })
      .onConflictDoNothing();
  }

  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, upserted.id));

  return {
    profile: {
      id: upserted.id,
      uid: upserted.uid,
      email: upserted.email,
      fullName: upserted.fullName,
      avatarUrl: upserted.avatarUrl,
      nationality: upserted.nationality,
      travelStyle: upserted.travelStyle,
      preferredCurrency: upserted.preferredCurrency,
      travelHistory: upserted.travelHistory ?? [],
    },
    roles: roleRows.map((r) => r.role),
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Empty token.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const { profile, roles } = await syncUserProfile(decoded);
    req.profile = profile;
    req.roles = roles;
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const { profile, roles } = await syncUserProfile(decoded);
    req.profile = profile;
    req.roles = roles;
  } catch {
    // Proceed as unauthenticated guest when optional token fails
  }
  next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRolesList = req.roles || [];
    const hasRole = allowedRoles.some((role) => userRolesList.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        error: `Access restricted. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
};
