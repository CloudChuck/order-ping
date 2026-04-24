// TASK 7 — Analytics event logger: writes to Supabase analytics_events table
// Supports: order_created | order_ready | order_collected
import { supabase } from './supabase';

export interface AnalyticsEventPayload {
  stallId?: string;
  eventType: 'order_created' | 'order_ready' | 'order_collected';
  tokenId?: string;
  prepTimeSec?: number;   // TASK 7: ready_at - created_at in seconds
  waitTimeSec?: number;   // TASK 7: collected_at - ready_at in seconds
}

export async function logAnalyticsEvent(payload: AnalyticsEventPayload): Promise<void> {
  const { error } = await supabase.from('analytics_events').insert({
    stall_id:      payload.stallId ?? null,
    event_type:    payload.eventType,
    token_id:      payload.tokenId ?? null,
    prep_time_sec: payload.prepTimeSec ?? null,
    wait_time_sec: payload.waitTimeSec ?? null,
  });

  if (error) {
    // Non-fatal — log but don't throw, analytics must never break order flow
    console.error('[analytics] Failed to log event:', error.message);
  }
}
