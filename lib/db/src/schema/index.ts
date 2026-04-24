// TASK 1 — Drizzle schema for all Supabase tables
import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── STALLS ───────────────────────────────────────────────────────────────────
// Stores food stall/vendor records. slug is the primary URL identifier.
export const stalls = pgTable('stalls', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:             text('name').notNull(),
  mallName:         text('mall_name').notNull().default(''),
  slug:             text('slug').notNull().unique(),           // URL-safe identifier
  ownerEmail:       text('owner_email').notNull().default(''),
  passwordHash:     text('password_hash').notNull().default(''), // plain password (legacy)
  plan:             text('plan').notNull().default('free'),
  currentlyServing: text('currently_serving'),               // token last called ready
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────
// token_id = receipt_number (customer-visible number printed on receipt)
export const orders = pgTable('orders', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tokenId:     text('token_id').notNull(),            // TASK 3: multi-token uses this
  stallId:     uuid('stall_id').notNull().references(() => stalls.id, { onDelete: 'cascade' }),
  status:      text('status').notNull().default('waiting'), // waiting | ready | completed
  createdAt:   timestamp('created_at',   { withTimezone: true }).defaultNow(),
  readyAt:     timestamp('ready_at',     { withTimezone: true }),
  completedAt: timestamp('collected_at', { withTimezone: true }),
  expiresAt:   timestamp('expires_at',   { withTimezone: true })
               .default(sql`now() + interval '4 hours'`), // TASK 8: cleanup target
  nudgeCount:  integer('nudge_count').notNull().default(0),
  lastNudgeAt: timestamp('last_nudge_at', { withTimezone: true }),
});

// ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────
// TASK 4: Web Push subscription objects per token
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tokenId:      text('token_id').notNull(),
  stallId:      uuid('stall_id').notNull().references(() => stalls.id, { onDelete: 'cascade' }),
  subscription: jsonb('subscription').notNull(),
  deviceHint:   text('device_hint'),                 // 'ios' | 'android' | etc
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt:    timestamp('expires_at', { withTimezone: true })
                .default(sql`now() + interval '4 hours'`),
});

// ─── WHATSAPP SUBSCRIBERS ─────────────────────────────────────────────────────
// TASK 4: Optional WhatsApp opt-in for iOS users
export const whatsappSubscribers = pgTable('whatsapp_subscribers', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  phone:     text('phone').notNull(),
  tokenId:   text('token_id').notNull(),
  stallId:   uuid('stall_id').notNull().references(() => stalls.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
             .default(sql`now() + interval '4 hours'`),
});

// ─── ANALYTICS EVENTS ─────────────────────────────────────────────────────────
// TASK 7: Persistent event log for order lifecycle
export const analyticsEvents = pgTable('analytics_events', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  stallId:     uuid('stall_id').references(() => stalls.id, { onDelete: 'set null' }),
  eventType:   text('event_type').notNull(),  // order_created | order_ready | order_collected
  tokenId:     text('token_id'),
  prepTimeSec: integer('prep_time_sec'),      // TASK 7: ready_at - created_at
  waitTimeSec: integer('wait_time_sec'),      // TASK 7: collected_at - ready_at
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});
