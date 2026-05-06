/**
 * TASK 1 — Supabase-backed data layer
 * Replaces in-memory Maps. All public function signatures are async but
 * otherwise IDENTICAL to the original store.ts so routes work with just `await`.
 */

import { supabase } from './supabase';
import { logAnalyticsEvent } from './analytics-logger';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

// ─── TYPES (kept identical to original) ──────────────────────────────────────

export interface Stall {
  id: string;
  name: string;
  mallName: string;
  slug: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  currentlyServing: string | null;
}

export interface Order {
  id: string;
  stallId: string;
  stallSlug: string;
  receiptNumber: string;
  status: 'waiting' | 'ready' | 'completed';
  createdAt: Date;
  readyAt: Date | null;
  completedAt: Date | null;
  nudgeCount: number;
  lastNudgeAt: Date | null;
}

// ─── MAPPERS ──────────────────────────────────────────────────────────────────

function mapStall(row: Record<string, any>): Stall {
  return {
    id:               row['id'],
    name:             row['name'],
    mallName:         row['mall_name'] ?? '',
    slug:             row['slug'] ?? '',
    email:            row['owner_email'] ?? '',
    passwordHash:     row['password_hash'] ?? '',
    createdAt:        new Date(row['created_at']),
    currentlyServing: row['currently_serving'] ?? null,
  };
}

function mapOrder(row: Record<string, any>, stallSlug: string): Order {
  return {
    id:            row['id'],
    stallId:       row['stall_id'],
    stallSlug,
    receiptNumber: row['token_id'],
    status:        row['status'] as 'waiting' | 'ready' | 'completed',
    createdAt:     new Date(row['created_at']),
    readyAt:       row['ready_at']    ? new Date(row['ready_at'])    : null,
    completedAt:   row['collected_at']? new Date(row['collected_at']): null,
    nudgeCount:    row['nudge_count'] ?? 0,
    lastNudgeAt:   row['last_nudge_at'] ? new Date(row['last_nudge_at']) : null,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── STALL FUNCTIONS ─────────────────────────────────────────────────────────

export async function createStall(data: {
  name: string;
  mallName: string;
  email: string;
  password: string;
  slug?: string;
}): Promise<Stall | { error: string }> {
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);

  const { data: existing } = await supabase
    .from('stalls')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return { error: 'Slug already exists' };

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const { data: row, error } = await supabase
    .from('stalls')
    .insert({
      name:          data.name,
      mall_name:     data.mallName,
      slug,
      owner_email:   data.email,
      password_hash: hashedPassword,
      plan:          'free',
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return mapStall(row);
}

export async function getStallBySlug(slug: string): Promise<Stall | null> {
  const { data, error } = await supabase
    .from('stalls')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  return mapStall(data);
}

export async function getAllStalls(): Promise<Stall[]> {
  const { data, error } = await supabase.from('stalls').select('*');
  if (error || !data) return [];
  return data.map((r) => mapStall(r));
}

export async function verifyPassword(slug: string, password: string): Promise<boolean> {
  const { data } = await supabase
    .from('stalls')
    .select('password_hash')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return false;

  const storedHash = data['password_hash'] as string;

  // Support legacy plaintext passwords: if stored value is not a bcrypt hash, compare directly and rehash
  if (!storedHash.startsWith('$2b$') && !storedHash.startsWith('$2a$')) {
    if (storedHash !== password) return false;
    // Migrate to bcrypt on successful login
    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await supabase.from('stalls').update({ password_hash: newHash }).eq('slug', slug);
    return true;
  }

  return bcrypt.compare(password, storedHash);
}

// ─── ORDER FUNCTIONS ──────────────────────────────────────────────────────────

export async function createOrder(
  stallSlug: string,
  receiptNumber: string,
): Promise<Order | { error: string }> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return { error: 'Stall not found' };

  // Return existing non-completed order to avoid duplicates
  const { data: existing } = await supabase
    .from('orders')
    .select('*')
    .eq('stall_id', stall.id)
    .eq('token_id', receiptNumber)
    .neq('status', 'completed')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) return mapOrder(existing, stallSlug);

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  const { data: row, error } = await supabase
    .from('orders')
    .insert({
      token_id:   receiptNumber,
      stall_id:   stall.id,
      status:     'waiting',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // TASK 7 — log order_created
  await logAnalyticsEvent({ stallId: stall.id, eventType: 'order_created', tokenId: receiptNumber });

  return mapOrder(row, stallSlug);
}

export async function getOrder(
  stallSlug: string,
  receiptNumber: string,
): Promise<Order | null> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('stall_id', stall.id)
    .eq('token_id', receiptNumber)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapOrder(data, stallSlug) : null;
}

export async function markOrderReady(
  stallSlug: string,
  receiptNumber: string,
): Promise<Order | null> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const existing = await getOrder(stallSlug, receiptNumber);

  // Auto-create if vendor calls ready before customer scanned
  if (!existing) {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('orders').insert({
      token_id:   receiptNumber,
      stall_id:   stall.id,
      status:     'waiting',
      expires_at: expiresAt,
    });
  }

  const readyAt = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('orders')
    .update({ status: 'ready', ready_at: readyAt })
    .eq('stall_id', stall.id)
    .eq('token_id', receiptNumber)
    .select()
    .maybeSingle();

  if (error || !row) return null;

  // Update stall currently_serving
  await supabase
    .from('stalls')
    .update({ currently_serving: receiptNumber })
    .eq('id', stall.id);

  // TASK 7 — log order_ready with prep time
  const prepTimeSec = existing?.createdAt
    ? Math.round((Date.now() - existing.createdAt.getTime()) / 1000)
    : undefined;
  await logAnalyticsEvent({ stallId: stall.id, eventType: 'order_ready', tokenId: receiptNumber, prepTimeSec });

  return mapOrder(row, stallSlug);
}

export async function markOrderCompleted(
  stallSlug: string,
  receiptNumber: string,
): Promise<Order | null> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const existing = await getOrder(stallSlug, receiptNumber);
  if (!existing) return null;

  const collectedAt = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('orders')
    .update({ status: 'completed', collected_at: collectedAt })
    .eq('stall_id', stall.id)
    .eq('token_id', receiptNumber)
    .select()
    .maybeSingle();

  if (error || !row) return null;

  // TASK 7 — log order_collected with wait time
  const waitTimeSec = existing.readyAt
    ? Math.round((Date.now() - existing.readyAt.getTime()) / 1000)
    : undefined;
  await logAnalyticsEvent({ stallId: stall.id, eventType: 'order_collected', tokenId: receiptNumber, waitTimeSec });

  return mapOrder(row, stallSlug);
}

export async function nudgeOrder(
  stallSlug: string,
  receiptNumber: string,
): Promise<Order | null> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const existing = await getOrder(stallSlug, receiptNumber);
  if (!existing) return null;

  const { data: row, error } = await supabase
    .from('orders')
    .update({
      nudge_count:   existing.nudgeCount + 1,
      last_nudge_at: new Date().toISOString(),
    })
    .eq('stall_id', stall.id)
    .eq('token_id', receiptNumber)
    .select()
    .maybeSingle();

  if (error || !row) return null;
  return mapOrder(row, stallSlug);
}

export async function getOrdersByStall(
  stallSlug: string,
  status?: string,
): Promise<Order[]> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return [];

  let query = supabase
    .from('orders')
    .select('*')
    .eq('stall_id', stall.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((r) => mapOrder(r, stallSlug));
}

export async function getQueueStatus(stallSlug: string): Promise<{
  stallName: string;
  mallName: string;
  currentlyServing: string | null;
  waitingCount: number;
  recentlyServed: string[];
} | null> {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const allOrders = await getOrdersByStall(stallSlug);
  const waitingCount = allOrders.filter((o) => o.status === 'waiting').length;
  const recentlyServed = allOrders
    .filter((o) => o.status === 'ready' || o.status === 'completed')
    .slice(0, 10)
    .map((o) => o.receiptNumber);

  return {
    stallName:        stall.name,
    mallName:         stall.mallName,
    currentlyServing: stall.currentlyServing,
    waitingCount,
    recentlyServed,
  };
}

export async function getStallAnalytics(stallSlug: string) {
  const stall = await getStallBySlug(stallSlug);
  if (!stall) return null;

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const allOrders  = await getOrdersByStall(stallSlug);
  const todayOrders    = allOrders.filter((o) => o.createdAt >= todayStart);
  const completedToday = todayOrders.filter((o) => o.status === 'completed' && o.readyAt);

  let avgWaitTimeMinutes = 0;
  if (completedToday.length > 0) {
    const totalWait = completedToday.reduce(
      (sum, o) => sum + (o.readyAt!.getTime() - o.createdAt.getTime()) / 60000,
      0,
    );
    avgWaitTimeMinutes = totalWait / completedToday.length;
  }

  const hourlyBreakdown: { hour: string; count: number }[] = [];
  for (let h = 8; h <= 22; h++) {
    const hourStart = new Date(todayStart.getTime() + h * 3600000);
    const hourEnd   = new Date(hourStart.getTime() + 3600000);
    const count     = todayOrders.filter((o) => o.createdAt >= hourStart && o.createdAt < hourEnd).length;
    const label     = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
    hourlyBreakdown.push({ hour: label, count });
  }

  return {
    ordersToday:        todayOrders.length,
    avgWaitTimeMinutes: Math.round(avgWaitTimeMinutes * 10) / 10,
    recentOrders:       allOrders.slice(0, 20),
    hourlyBreakdown,
  };
}

export async function getAdminAnalytics() {
  const allStalls  = await getAllStalls();
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let totalOrdersToday = 0;

  const stallSummaries = await Promise.all(
    allStalls.map(async (stall) => {
      const stallOrders    = await getOrdersByStall(stall.slug);
      const todayOrders    = stallOrders.filter((o) => o.createdAt >= todayStart);
      const completedToday = todayOrders.filter((o) => o.status === 'completed' && o.readyAt);

      let avgWaitTimeMinutes = 0;
      if (completedToday.length > 0) {
        const totalWait = completedToday.reduce(
          (sum, o) => sum + (o.readyAt!.getTime() - o.createdAt.getTime()) / 60000,
          0,
        );
        avgWaitTimeMinutes = totalWait / completedToday.length;
      }

      const activeOrders = stallOrders.filter(
        (o) => o.status === 'waiting' || o.status === 'ready',
      ).length;
      totalOrdersToday += todayOrders.length;

      return {
        stallId:            stall.id,
        stallName:          stall.name,
        mallName:           stall.mallName,
        slug:               stall.slug,
        ordersToday:        todayOrders.length,
        avgWaitTimeMinutes: Math.round(avgWaitTimeMinutes * 10) / 10,
        activeOrders,
      };
    }),
  );

  return { stalls: stallSummaries, totalOrdersToday, totalStalls: allStalls.length };
}

// TASK 8 — Delete expired push_subscriptions + whatsapp_subscribers
export async function deleteExpiredRows(): Promise<{ subs: number; whatsapp: number }> {
  const now = new Date().toISOString();

  const [subsResult, waResult] = await Promise.all([
    supabase.from('push_subscriptions').delete().lt('expires_at', now).select('id'),
    supabase.from('whatsapp_subscribers').delete().lt('expires_at', now).select('id'),
  ]);

  return {
    subs:     subsResult.data?.length ?? 0,
    whatsapp: waResult.data?.length   ?? 0,
  };
}

// TASK 4 — WhatsApp subscriber helpers
export async function saveWhatsAppSubscriber(
  phone: string,
  tokenId: string,
  stallId: string,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_subscribers')
    .insert({ phone, token_id: tokenId, stall_id: stallId });

  if (error) throw error;
}

// Stub: replace with real WhatsApp Business API in production
export function sendWhatsAppNotification(phone: string, tokenId: string, stallName: string): void {
  console.log(`[WhatsApp stub] Token ${tokenId} ready at ${stallName} → ${phone}`);
}
