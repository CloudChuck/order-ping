/**
 * TASK 2 — Supabase Realtime subscription on orders table per token
 * TASK 3 — Multi-token support: watch multiple orders simultaneously
 * TASK 4 — iOS fallback: tab flash + visibility resume + iOS banner + WhatsApp stub
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useSearch } from "wouter";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useGetStallBySlug,
  useCreateOrder,
  useGetQueueStatus,
  getGetQueueStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, WifiOff, CheckCircle2, Clock, Search, Bell, X, Plus } from "lucide-react";
import { io } from "socket.io-client";

// ─── Supabase frontend client (TASK 2) ───────────────────────────────────────
// VITE_ env vars are injected at build time — add to Railway as VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
const supabaseUrl  = import.meta.env["VITE_SUPABASE_URL"]  as string | undefined;
const supabaseAnon = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

const supabaseClient =
  supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

// ─── iOS detection (TASK 4) ───────────────────────────────────────────────────
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad)/.test(navigator.userAgent) &&
    /WebKit/.test(navigator.userAgent) &&
    !/CriOS|FxiOS/.test(navigator.userAgent)
  );
}

// ─── Audio chime ──────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx   = new AudioContext();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type          = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch (_) {}
}

function vibrateDevice() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  } catch (_) {}
}

// ─── Wake Lock ────────────────────────────────────────────────────────────────
function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => { lockRef.current = l; }).catch(() => {});
    }
    return () => { lockRef.current?.release().catch(() => {}); };
  }, []);
}

// ─── Tab title flash (TASK 4-A) ───────────────────────────────────────────────
function useTabFlash(readyTokens: string[]) {
  const originalTitle = useRef(document.title);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (readyTokens.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.title = originalTitle.current;
      return;
    }
    const label = readyTokens.join(", ");
    let toggle  = false;
    intervalRef.current = setInterval(() => {
      document.title = toggle
        ? originalTitle.current
        : `🔔 Token ${label} READY! 🍽`;
      toggle = !toggle;
    }, 800);

    // TASK 4-A: stop flashing when user focuses tab
    const stopFlash = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.title = originalTitle.current;
    };
    window.addEventListener("focus", stopFlash, { once: true });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", stopFlash);
      document.title = originalTitle.current;
    };
  }, [readyTokens]);
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface WatchedToken {
  receiptNumber: string;
  status: "waiting" | "ready" | "completed" | "tracking";
  stallId?: string; // Supabase UUID — populated after createOrder
}

// ─── Notification Pre-Prompt ──────────────────────────────────────────────────
function NotificationPrePrompt({ onAllow, onSkip }: { onAllow: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}>
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #0a1a18 0%, #0a0f0e 100%)",
          border: "1px solid rgba(13,148,136,0.35)",
        }}>
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
          style={{ background: "linear-gradient(90deg, #0d9488, #14b8a6, #0d9488)" }} />
        <button onClick={onSkip} className="absolute top-4 right-4 text-orange-300/50 hover:text-orange-300/80">
          <X className="h-5 w-5" />
        </button>
        <div className="p-8 pt-10 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(13,148,136,0.25) 0%, transparent 70%)", animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
            <div className="relative h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(13,148,136,0.15)", border: "1.5px solid rgba(13,148,136,0.4)" }}>
              <Bell className="h-9 w-9" style={{ color: "#0d9488", animation: "bellRing 1.4s ease-in-out infinite", transformOrigin: "top center" }} />
            </div>
          </div>
          <p className="text-xl font-bold mb-2" style={{ color: "#f0fdfa" }}>Your food is cooking.</p>
          <p className="text-lg font-semibold mb-4" style={{ color: "#5eead4" }}>Don't miss the moment it's ready.</p>
          <p className="text-sm mb-8" style={{ color: "rgba(153,246,228,0.55)" }}>
            We'll alert your phone the instant the vendor calls your token.
          </p>
          <button onClick={onAllow} className="w-full py-4 px-6 rounded-2xl font-bold text-base active:scale-95 mb-3"
            style={{ background: "#0d9488", color: "#fff", boxShadow: "0 4px 24px rgba(13,148,136,0.4)" }}>
            Yes, Notify Me When Ready! 🔔
          </button>
          <button onClick={onSkip} className="text-sm" style={{ color: "rgba(153,246,228,0.45)" }}>
            No thanks
          </button>
        </div>
      </div>
      <style>{`
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg); } 10% { transform: rotate(14deg); }
          20% { transform: rotate(-12deg); } 30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }  50% { transform: rotate(6deg); }
        }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}

// ─── WhatsApp Opt-In (TASK 4-D) ───────────────────────────────────────────────
function WhatsAppOptIn({ stallId, tokenId, onDismiss }: { stallId: string; tokenId: string; onDismiss: () => void }) {
  const [phone,    setPhone]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/push/whatsapp-register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: phone.trim(), tokenId, stallId }),
      });
      setSubmitted(true);
      setTimeout(onDismiss, 2000);
    } catch (_) {
      onDismiss();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-4">
      {submitted ? (
        <p className="text-sm text-green-400 text-center">✅ WhatsApp registered!</p>
      ) : (
        <>
          <p className="text-sm font-semibold mb-2">📲 Want alerts even if you switch apps?</p>
          <p className="text-xs text-muted-foreground mb-3">Enter WhatsApp number (optional)</p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9999999999" inputMode="tel"
              className="h-9 text-sm flex-1"
            />
            <Button type="submit" size="sm" className="h-9 px-3" disabled={!phone.trim() || loading}>
              {loading ? "…" : "Notify Me"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground" onClick={onDismiss}>
              No thanks
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

// ─── Single Token Card (TASK 3) ───────────────────────────────────────────────
function TokenCard({
  token,
  stallName,
  stallId,
  onCollected,
}: {
  token: WatchedToken;
  stallName: string;
  stallId?: string;
  onCollected: (receipt: string) => void;
}) {
  const statusColor =
    token.status === "ready"
      ? "border-primary/50 bg-primary/10"
      : token.status === "completed"
        ? "border-muted bg-muted/30"
        : "border-accent/50 bg-accent/10";

  return (
    <Card className={`w-full mb-4 border ${statusColor} transition-all duration-500`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Token / टोकन
            </p>
            <p className="text-5xl font-mono font-bold">{token.receiptNumber}</p>
          </div>
          <span className="text-xs text-muted-foreground mt-1">{stallName}</span>
        </div>

        {/* TASK 3: animated status pill */}
        {token.status === "ready" && (
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-2 text-primary font-bold animate-pulse">
              <CheckCircle2 className="h-5 w-5" />
              ORDER READY! — आपका ऑर्डर तैयार है!
            </span>
            {/* TASK 3: Collected button removes card */}
            <Button
              size="sm"
              className="mt-2 w-full bg-primary/80 hover:bg-primary"
              onClick={() => onCollected(token.receiptNumber)}
            >
              Collected ✓
            </Button>
          </div>
        )}
        {token.status === "waiting" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent font-semibold">
            <Clock className="h-4 w-4 animate-spin" style={{ animationDuration: "3s" }} />
            Preparing... / तैयार हो रहा है...
          </span>
        )}
        {token.status === "completed" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-muted-foreground font-semibold">
            Order Collected ✓
          </span>
        )}
        {token.status === "tracking" && (
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent font-semibold">
            <Clock className="h-4 w-4" />
            Tracking... / ट्रैक हो रहा है...
          </span>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Track Component ─────────────────────────────────────────────────────
export default function Track() {
  const params   = useParams<{ slug: string }>();
  const slug     = params.slug ?? "";
  const search   = useSearch();
  const urlToken = new URLSearchParams(search).get("token") ?? "";

  // TASK 3: multiple watched tokens (NO localStorage per rules)
  const [watchedTokens, setWatchedTokens] = useState<WatchedToken[]>([]);
  const [newTokenInput,  setNewTokenInput] = useState(urlToken);
  const [isOffline,      setIsOffline]     = useState(!navigator.onLine);
  const queryClient   = useQueryClient();
  const autoAdded     = useRef(false);
  const ios           = isIOSSafari();

  // TASK 4-C: iOS banner state
  const [showIOSBanner,   setShowIOSBanner]   = useState(false);
  const [showWhatsApp,    setShowWhatsApp]     = useState(false);
  const [showNotifPrompt, setShowNotifPrompt]  = useState(false);
  const notifShown       = useRef(false);
  const whatsAppShown    = useRef(false);

  useWakeLock();

  // TASK 4-A: flash tab title for ready tokens
  const readyTokens = watchedTokens.filter((t) => t.status === "ready").map((t) => t.receiptNumber);
  useTabFlash(readyTokens);

  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const stall       = useGetStallBySlug(slug, { query: { queryKey: ["stalls", slug] } });
  const queueStatus = useGetQueueStatus(slug, {
    query: { refetchInterval: 5000, queryKey: getGetQueueStatusQueryKey(slug) },
  });
  const createOrderMutation = useCreateOrder();

  // ── Helper: trigger ready effects ─────────────────────────────────────────
  const triggerReadyEffects = useCallback(() => {
    playChime();
    vibrateDevice();
  }, []);

  // ── Add token to watch list ────────────────────────────────────────────────
  const addToken = useCallback(
    (receipt: string) => {
      if (!receipt.trim()) return;
      const r = receipt.trim();
      // Prevent duplicate
      if (watchedTokens.some((t) => t.receiptNumber === r)) return;

      setWatchedTokens((prev) => [...prev, { receiptNumber: r, status: "tracking" }]);

      createOrderMutation.mutate(
        { slug, data: { receiptNumber: r } },
        {
          onSuccess: (order: any) => {
            setWatchedTokens((prev) =>
              prev.map((t) =>
                t.receiptNumber === r
                  ? { ...t, status: order.status as WatchedToken["status"], stallId: order.stallId }
                  : t,
              ),
            );
            queryClient.invalidateQueries({ queryKey: getGetQueueStatusQueryKey(slug) });

            // TASK 4-C: show iOS banner after first token
            if (ios && !showIOSBanner) setShowIOSBanner(true);

            // Notification pre-prompt
            if (!notifShown.current && "Notification" in window && Notification.permission === "default") {
              notifShown.current = true;
              setTimeout(() => setShowNotifPrompt(true), 700);
            }
            // TASK 4-D: WhatsApp opt-in (iOS only, once)
            if (ios && !whatsAppShown.current) {
              whatsAppShown.current = true;
              setTimeout(() => setShowWhatsApp(true), 3000);
            }

            if (order.status === "ready") triggerReadyEffects();
          },
          onError: () => {
            setWatchedTokens((prev) =>
              prev.map((t) => (t.receiptNumber === r ? { ...t, status: "tracking" } : t)),
            );
          },
        },
      );
    },
    [watchedTokens, slug, createOrderMutation, queryClient, ios, showIOSBanner, triggerReadyEffects],
  );

  // Auto-add URL token on mount
  useEffect(() => {
    if (urlToken && !autoAdded.current) {
      autoAdded.current = true;
      addToken(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  // TASK 4-B: on visibilitychange → re-fetch all tracked tokens
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      // Re-query all watched tokens from API
      for (const token of watchedTokens) {
        try {
          const res  = await fetch(`/api/stalls/${slug}/orders/${token.receiptNumber}`);
          if (!res.ok) continue;
          const data = await res.json();
          setWatchedTokens((prev) =>
            prev.map((t) =>
              t.receiptNumber === token.receiptNumber
                ? { ...t, status: data.status as WatchedToken["status"] }
                : t,
            ),
          );
          if (data.status === "ready") triggerReadyEffects();
        } catch (_) {}
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [watchedTokens, slug, triggerReadyEffects]);

  // TASK 2: Supabase Realtime subscriptions per token (alongside Socket.IO)
  useEffect(() => {
    if (!supabaseClient || watchedTokens.length === 0) return;

    const channels = watchedTokens
      .filter((t) => t.stallId)
      .map((t) =>
        supabaseClient
          .channel(`order-${t.stallId}-${t.receiptNumber}`)
          .on(
            "postgres_changes",
            {
              event:  "UPDATE",
              schema: "public",
              table:  "orders",
              filter: `token_id=eq.${t.receiptNumber}`,
            },
            (payload: any) => {
              const newStatus = payload.new?.status as WatchedToken["status"] | undefined;
              if (!newStatus) return;
              setWatchedTokens((prev) =>
                prev.map((tok) =>
                  tok.receiptNumber === t.receiptNumber ? { ...tok, status: newStatus } : tok,
                ),
              );
              if (newStatus === "ready") triggerReadyEffects();
            },
          )
          .subscribe(),
      );

    return () => {
      channels.forEach((ch) => supabaseClient.removeChannel(ch));
    };
  }, [watchedTokens.map((t) => `${t.receiptNumber}:${t.stallId}`).join(","), triggerReadyEffects]);

  // Socket.IO fallback (TASK 2: keep alongside Supabase RT)
  useEffect(() => {
    if (watchedTokens.length === 0) return;
    const socket = io({ path: "/api/socket" });

    watchedTokens.forEach((t) => {
      socket.emit("join:order", { slug, receiptNumber: t.receiptNumber });
    });

    socket.on("order:ready", (data: { receiptNumber: string }) => {
      setWatchedTokens((prev) =>
        prev.map((t) => (t.receiptNumber === data.receiptNumber ? { ...t, status: "ready" } : t)),
      );
      triggerReadyEffects();
    });
    socket.on("order:updated", (data: { receiptNumber: string }) => {
      fetch(`/api/stalls/${slug}/orders/${data.receiptNumber}`)
        .then((r) => r.json())
        .then((d) => {
          setWatchedTokens((prev) =>
            prev.map((t) => (t.receiptNumber === d.receiptNumber ? { ...t, status: d.status } : t)),
          );
        })
        .catch(() => {});
    });

    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedTokens.length, slug]);

  // TASK 3: remove card when Collected is pressed
  function handleCollected(receipt: string) {
    setWatchedTokens((prev) => prev.filter((t) => t.receiptNumber !== receipt));
  }

  function handleAddToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenInput.trim()) return;
    addToken(newTokenInput.trim());
    setNewTokenInput("");
  }

  const allCollected = watchedTokens.length > 0 &&
    watchedTokens.every((t) => t.status === "completed");

  const waitingCount     = queueStatus.data?.waitingCount     ?? 0;
  const currentlyServing = queueStatus.data?.currentlyServing ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Notification Pre-Prompt */}
      {showNotifPrompt && (
        <NotificationPrePrompt
          onAllow={() => { setShowNotifPrompt(false); Notification.requestPermission().catch(() => {}); }}
          onSkip={() => setShowNotifPrompt(false)}
        />
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2 text-center text-sm text-yellow-300 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          No internet connection — status may be delayed
        </div>
      )}

      {/* TASK 4-C: iOS banner */}
      {ios && showIOSBanner && (
        <div className="relative bg-teal-900/80 border-b border-teal-500/40 px-4 py-2 text-center text-sm text-teal-200 flex items-center justify-center gap-2">
          <Bell className="h-4 w-4 flex-shrink-0" />
          🔔 Keep this page open for instant updates.
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400/60 hover:text-teal-300"
            onClick={() => {
              setShowIOSBanner(false);
            }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <header className="p-4 border-b border-border/40 bg-card/50">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button variant="ghost" asChild size="sm">
            <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <p className="font-bold text-lg leading-tight">{stall.data?.name ?? slug}</p>
            <p className="text-xs text-muted-foreground">{stall.data?.mallName}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 max-w-md mx-auto w-full">

        {/* Queue Board */}
        <Card className="w-full mb-6 mt-4 border-border/60">
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              Currently Serving / अभी सर्व हो रहा है
            </p>
            <p className="text-6xl font-mono font-bold text-foreground">
              {currentlyServing ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {waitingCount} orders waiting
            </p>
          </CardContent>
        </Card>

        {/* TASK 3: All-collected message */}
        {allCollected && (
          <div className="w-full mb-6 text-center rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <p className="text-2xl font-bold text-primary mb-1">All orders collected!</p>
            <p className="text-lg">Enjoy your meal 🍽</p>
          </div>
        )}

        {/* TASK 3: Render one card per watched token */}
        {watchedTokens.map((token) => (
          <TokenCard
            key={token.receiptNumber}
            token={token}
            stallName={stall.data?.name ?? slug}
            stallId={token.stallId}
            onCollected={handleCollected}
          />
        ))}

        {/* TASK 3: "+ Watch another order" is always visible */}
        <Card className="w-full mb-4">
          <CardContent className="p-4">
            <p className="font-semibold mb-1 text-sm">
              {watchedTokens.length === 0
                ? "Enter your receipt / token number"
                : "Watch another order"}
            </p>
            <form onSubmit={handleAddToken} className="flex gap-2">
              <Input
                value={newTokenInput}
                onChange={(e) => setNewTokenInput(e.target.value)}
                placeholder="e.g. 42"
                className="text-xl h-12 font-mono"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <Button type="submit" className="h-12 px-4"
                disabled={!newTokenInput.trim() || createOrderMutation.isPending}>
                {watchedTokens.length === 0
                  ? <Search className="h-5 w-5" />
                  : <Plus className="h-5 w-5" />}
              </Button>
            </form>

            {/* TASK 4-D: WhatsApp opt-in (iOS only) */}
            {ios && showWhatsApp && watchedTokens.length > 0 && (
              <WhatsAppOptIn
                stallId={watchedTokens[0]?.stallId ?? ""}
                tokenId={watchedTokens[0]?.receiptNumber ?? ""}
                onDismiss={() => setShowWhatsApp(false)}
              />
            )}
          </CardContent>
        </Card>

        {/* TASK 4-E: Privacy line on all devices */}
        <p className="text-xs text-muted-foreground text-center mt-2 px-4">
          🔒 No login. No phone number. No app. Your privacy is protected.
        </p>

      </main>
    </div>
  );
}
