/**
 * Compatibility Controller (Presentation & Routing Facade)
 * Exposes public and admin HTTP API endpoints for compatibility checks,
 * accessory listings, and rule governance.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/auth-options.ts';
import { prisma as globalPrisma } from '../../database/prisma.ts';
import {
  checkCompatibility,
  listCompatibleAccessories,
  draftCompatibilityRule,
  activateCompatibilityRule,
  revokeCompatibilityRule,
  listCompatibilityRules,
} from './compatibility.service.ts';
import type { DraftCompatibilityRuleInput } from '../../../shared/types/compatibility.ts';

export interface ApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
}

/**
 * Public handler for evaluating compatibility between a host device and an accessory.
 */
export async function handleCheckCompatibility(
  query: {
    deviceVariantId?: string;
    deviceProductId?: string;
    accessoryVariantId?: string;
    accessoryProductId?: string;
  },
  db: any = globalPrisma
): Promise<ApiResponse> {
  if (!query.deviceVariantId && !query.deviceProductId) {
    return {
      status: 400,
      error: 'deviceVariantId or deviceProductId is required',
    };
  }

  if (!query.accessoryVariantId && !query.accessoryProductId) {
    return {
      status: 400,
      error: 'accessoryVariantId or accessoryProductId is required',
    };
  }

  try {
    const result = await checkCompatibility(query, db);
    return {
      status: 200,
      data: result,
    };
  } catch (err: any) {
    return {
      status: 500,
      error: err.message || 'Internal server error while evaluating compatibility',
    };
  }
}

/**
 * Public handler for listing all compatible accessories for a given device variant.
 */
export async function handleListCompatibleAccessories(
  deviceVariantId: string,
  db: any = globalPrisma
): Promise<ApiResponse> {
  if (!deviceVariantId || typeof deviceVariantId !== 'string') {
    return {
      status: 400,
      error: 'deviceVariantId is required',
    };
  }

  try {
    const list = await listCompatibleAccessories(deviceVariantId, db);
    return {
      status: 200,
      data: list,
    };
  } catch (err: any) {
    return {
      status: 500,
      error: err.message || 'Failed to list compatible accessories',
    };
  }
}

/**
 * Admin/Staff handler for drafting a new compatibility rule.
 */
export async function handleDraftRule(
  body: DraftCompatibilityRuleInput,
  actorId: string,
  db: any = globalPrisma
): Promise<ApiResponse> {
  try {
    const rule = await draftCompatibilityRule(body, actorId, db);
    return {
      status: 201,
      data: rule,
    };
  } catch (err: any) {
    const status = err.message?.toLowerCase().includes('forbidden') ? 403 : 400;
    return {
      status,
      error: err.message || 'Failed to draft compatibility rule',
    };
  }
}

/**
 * Admin handler for activating a drafted compatibility rule.
 */
export async function handleActivateRule(
  ruleId: string,
  actorId: string,
  db: any = globalPrisma
): Promise<ApiResponse> {
  try {
    const rule = await activateCompatibilityRule(ruleId, actorId, db);
    return {
      status: 200,
      data: rule,
    };
  } catch (err: any) {
    const status = err.message?.toLowerCase().includes('unauthorized') ? 403 : 400;
    return {
      status,
      error: err.message || 'Failed to activate compatibility rule',
    };
  }
}

/**
 * Admin handler for revoking an active compatibility rule.
 */
export async function handleRevokeRule(
  ruleId: string,
  actorId: string,
  reason: string,
  db: any = globalPrisma
): Promise<ApiResponse> {
  try {
    const rule = await revokeCompatibilityRule(ruleId, actorId, reason, db);
    return {
      status: 200,
      data: rule,
    };
  } catch (err: any) {
    const status = err.message?.toLowerCase().includes('unauthorized') ? 403 : 400;
    return {
      status,
      error: err.message || 'Failed to revoke compatibility rule',
    };
  }
}

// ==========================================
// NEXT.JS ROUTE HANDLERS
// ==========================================

export async function GET_CHECK(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = {
    deviceVariantId: searchParams.get('deviceVariantId') || undefined,
    deviceProductId: searchParams.get('deviceProductId') || undefined,
    accessoryVariantId: searchParams.get('accessoryVariantId') || undefined,
    accessoryProductId: searchParams.get('accessoryProductId') || undefined,
  };

  const res = await handleCheckCompatibility(query);
  return NextResponse.json(res.data || { error: res.error }, { status: res.status });
}

export async function GET_ACCESSORIES(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceVariantId = searchParams.get('deviceVariantId') || '';

  const res = await handleListCompatibleAccessories(deviceVariantId);
  return NextResponse.json(res.data || { error: res.error }, { status: res.status });
}

export async function GET_ADMIN_RULES(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const market = searchParams.get('market') || undefined;

  const rules = await listCompatibilityRules({ status, market });
  return NextResponse.json({ rules });
}

export async function POST_ADMIN_RULES(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const res = await handleDraftRule(body, session.user.id);
  return NextResponse.json(res.data || { error: res.error }, { status: res.status });
}

export async function POST_ADMIN_ACTIVATE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const res = await handleActivateRule(id, session.user.id);
  return NextResponse.json(res.data || { error: res.error }, { status: res.status });
}

export async function POST_ADMIN_REVOKE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || 'Revoked by administrator';

  const res = await handleRevokeRule(id, session.user.id, reason);
  return NextResponse.json(res.data || { error: res.error }, { status: res.status });
}
