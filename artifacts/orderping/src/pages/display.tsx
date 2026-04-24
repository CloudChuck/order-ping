/**
 * TASK 5 — TV Token Display Board
 * Route: /display/:stallId (no auth required)
 * Fullscreen dark board with READY | PREPARING columns.
 * Live via Supabase Realtime + hard 30s auto-refresh fallback.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { createClient } from "@supabase/supabase-js";

// TASK 5: Supabase client for Realtime subscription
const supabaseUrl  = import.meta.env["VITE_SUPABASE_URL"]      as string | undefined;
const supabaseAnon = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

const supabaseClient =
  supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

interface DisplayData {
  ready:     string[];
  preparing: string[];
}

export default function DisplayBoard() {
  const params  = useParams<{ stallId: string }>();
  const stallId = params.stallId ?? "";

  const [data,    setData]    = useState<DisplayData>({ ready: [], preparing: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // TASK 5: fetch display data from backend
  const fetchDisplay = useCallback(async () => {
    if (!stallId) return;
    try {
      const res = await fetch(`/api/display/${stallId}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ ready: json.ready ?? [], preparing: json.preparing ?? [] });
      setLastUpdate(new Date());
    } catch (_) {}
    finally { setLoading(false); }
  }, [stallId]);

  // Initial load
  useEffect(() => {
    fetchDisplay();
  }, [fetchDisplay]);

  // TASK 5: Supabase Realtime subscription on orders table for this stallId
  useEffect(() => {
    if (!supabaseClient || !stallId) return;

    const channel = supabaseClient
      .channel(`display-${stallId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "orders",
          filter: `stall_id=eq.${stallId}`,
        },
        () => {
          // Re-fetch on any change — keeps display in sync
          fetchDisplay();
        },
      )
      .subscribe();

    return () => { supabaseClient.removeChannel(channel); };
  }, [stallId, fetchDisplay]);

  // TASK 5: 30s auto-refresh hard fallback
  useEffect(() => {
    const interval = setInterval(fetchDisplay, 30_000);
    return () => clearInterval(interval);
  }, [fetchDisplay]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-4xl font-mono animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="py-6 px-8 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-wide uppercase text-white/90">
          Order Status Board
        </h1>
        <p className="text-sm text-white/40 font-mono">
          Updated {lastUpdate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </header>

      {/* Two-column board */}
      <div className="flex-1 grid grid-cols-2 gap-0">
        {/* READY column */}
        <div className="border-r border-white/10 p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-4 w-4 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
            <h2 className="text-4xl font-extrabold text-green-400 uppercase tracking-widest">
              🟢 READY
            </h2>
          </div>
          <div className="flex flex-wrap gap-4">
            {data.ready.length === 0 ? (
              <p className="text-white/30 text-2xl font-mono">—</p>
            ) : (
              data.ready.map((token) => (
                <span
                  key={token}
                  className="font-mono font-black text-green-300 bg-green-400/10 border border-green-400/30 rounded-2xl px-6 py-4 text-5xl shadow-lg shadow-green-400/10 animate-pulse"
                  style={{ minWidth: "120px", textAlign: "center" }}
                >
                  {token}
                </span>
              ))
            )}
          </div>
        </div>

        {/* PREPARING column */}
        <div className="p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-4 w-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
            <h2 className="text-4xl font-extrabold text-yellow-400 uppercase tracking-widest">
              🟡 PREPARING
            </h2>
          </div>
          <div className="flex flex-wrap gap-4">
            {data.preparing.length === 0 ? (
              <p className="text-white/30 text-2xl font-mono">—</p>
            ) : (
              data.preparing.map((token) => (
                <span
                  key={token}
                  className="font-mono font-bold text-yellow-300/80 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl px-6 py-4 text-5xl"
                  style={{ minWidth: "120px", textAlign: "center" }}
                >
                  {token}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <footer className="py-3 px-8 border-t border-white/10 text-center">
        <p className="text-sm text-white/30 font-mono">
          Live updates • Auto-refresh every 30s • Stall {stallId}
        </p>
      </footer>
    </div>
  );
}
