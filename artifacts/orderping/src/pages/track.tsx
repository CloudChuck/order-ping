import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useGetStallBySlug,
  useGetOrder,
  useCreateOrder,
  useGetQueueStatus,
  getGetOrderQueryKey,
  getGetQueueStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, WifiOff, CheckCircle2, Clock, Search, Bell, X } from "lucide-react";
import { io } from "socket.io-client";

function playChime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  } catch (_) {}
}

function vibrateDevice() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
  } catch (_) {}
}

function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if ("wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          lockRef.current = lock;
        })
        .catch(() => {});
    }
    return () => {
      lockRef.current?.release().catch(() => {});
    };
  }, []);
}

/* ── Notification Pre-Prompt Modal ─────────────────────────────── */
function NotificationPrePrompt({
  onAllow,
  onSkip,
}: {
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      data-testid="notification-preprompt"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #0a1a18 0%, #0a0f0e 100%)",
          border: "1px solid rgba(13,148,136,0.35)",
          boxShadow: "0 0 60px rgba(13,148,136,0.12), 0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Teal glow top */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
          style={{ background: "linear-gradient(90deg, #0d9488, #14b8a6, #0d9488)" }}
        />

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-orange-300/50 hover:text-orange-300/80 transition-colors"
          data-testid="button-skip-notification"
          aria-label="Skip"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-8 pt-10 flex flex-col items-center text-center">
          {/* Animated bell */}
          <div className="relative mb-6">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(13,148,136,0.25) 0%, transparent 70%)",
                animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <div
              className="relative h-20 w-20 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(13,148,136,0.15)",
                border: "1.5px solid rgba(13,148,136,0.4)",
              }}
            >
              <Bell
                className="h-9 w-9"
                style={{
                  color: "#0d9488",
                  animation: "bellRing 1.4s ease-in-out infinite",
                  transformOrigin: "top center",
                }}
              />
            </div>
          </div>

          {/* Quote */}
          <p
            className="text-xl font-bold leading-snug mb-2"
            style={{ color: "#f0fdfa" }}
          >
            Your food is cooking.
          </p>
          <p
            className="text-lg font-semibold leading-snug mb-4"
            style={{ color: "#5eead4" }}
          >
            Don't miss the moment it's ready.
          </p>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(153,246,228,0.55)" }}>
            We'll alert your phone the instant the vendor calls your token —
            no need to keep staring at the screen.
          </p>

          {/* CTA */}
          <button
            onClick={onAllow}
            className="w-full py-4 px-6 rounded-2xl font-bold text-base transition-all active:scale-95 mb-3"
            style={{
              background: "#0d9488",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(13,148,136,0.4)",
            }}
            data-testid="button-allow-notification"
          >
            Yes, Notify Me When Ready! 🔔
          </button>

          {/* Skip link */}
          <button
            onClick={onSkip}
            className="text-sm transition-colors"
            style={{ color: "rgba(153,246,228,0.45)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(153,246,228,0.75)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(153,246,228,0.45)")}
            data-testid="button-skip-notification-link"
          >
            No thanks, I'll keep checking manually
          </button>
        </div>
      </div>

      {/* Bell ring keyframe + ping animation injected inline */}
      <style>{`
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg); }
          10%      { transform: rotate(14deg); }
          20%      { transform: rotate(-12deg); }
          30%      { transform: rotate(10deg); }
          40%      { transform: rotate(-8deg); }
          50%      { transform: rotate(6deg); }
          60%      { transform: rotate(-4deg); }
          70%      { transform: rotate(2deg); }
          80%      { transform: rotate(-2deg); }
          90%      { transform: rotate(1deg); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Main Track Component ───────────────────────────────────────── */
export default function Track() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const search = useSearch();
  const urlToken = new URLSearchParams(search).get("token") ?? "";
  const [receiptInput, setReceiptInput] = useState(urlToken);
  const [trackedReceipt, setTrackedReceipt] = useState<string | null>(null);
  const autoRegistered = useRef(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReadyFlash, setShowReadyFlash] = useState(false);
  const alreadyTriggered = useRef(false);
  const queryClient = useQueryClient();

  // Notification pre-prompt state
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const notifPromptShown = useRef(false);

  useWakeLock();

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const stall = useGetStallBySlug(slug, {
    query: { queryKey: ["stalls", slug] },
  });

  const queueStatus = useGetQueueStatus(slug, {
    query: {
      refetchInterval: 5000,
      queryKey: getGetQueueStatusQueryKey(slug),
    },
  });

  const order = useGetOrder(
    slug,
    trackedReceipt ?? "",
    {
      query: {
        enabled: !!trackedReceipt,
        refetchInterval: 5000,
        queryKey: getGetOrderQueryKey(slug, trackedReceipt ?? ""),
      },
    },
  );

  const createOrder = useCreateOrder();

  // Show notification pre-prompt once the customer starts tracking
  function maybeShowNotifPrompt() {
    if (notifPromptShown.current) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    notifPromptShown.current = true;
    // Short delay so the tracking UI settles first
    setTimeout(() => setShowNotifPrompt(true), 600);
  }

  function handleAllowNotification() {
    setShowNotifPrompt(false);
    Notification.requestPermission().catch(() => {});
  }

  function handleSkipNotification() {
    setShowNotifPrompt(false);
  }

  useEffect(() => {
    if (!urlToken || autoRegistered.current) return;
    autoRegistered.current = true;
    const receipt = urlToken.trim();
    createOrder.mutate(
      { slug, data: { receiptNumber: receipt } },
      {
        onSuccess: () => {
          setTrackedReceipt(receipt);
          alreadyTriggered.current = false;
          queryClient.invalidateQueries({ queryKey: getGetQueueStatusQueryKey(slug) });
          maybeShowNotifPrompt();
        },
        onError: () => {
          setTrackedReceipt(receipt);
          maybeShowNotifPrompt();
        },
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  const triggerReady = useCallback(() => {
    if (alreadyTriggered.current) return;
    alreadyTriggered.current = true;
    setShowReadyFlash(true);
    playChime();
    vibrateDevice();
    setTimeout(() => {
      setShowReadyFlash(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const status = order.data?.status as string | undefined;
    if (status === "ready") {
      triggerReady();
    } else if (order.data && status !== "ready") {
      alreadyTriggered.current = false;
    }
  }, [order.data?.status, triggerReady]);

  useEffect(() => {
    if (!trackedReceipt) return;
    const socket = io({ path: "/api/socket" });
    socket.emit("join:order", { slug, receiptNumber: trackedReceipt });
    socket.on("order:ready", (data: { receiptNumber: string }) => {
      if (data.receiptNumber === trackedReceipt) {
        queryClient.invalidateQueries({
          queryKey: getGetOrderQueryKey(slug, trackedReceipt),
        });
        triggerReady();
      }
    });
    socket.on("order:nudge", (data: { receiptNumber: string }) => {
      if (data.receiptNumber === trackedReceipt) {
        queryClient.invalidateQueries({
          queryKey: getGetOrderQueryKey(slug, trackedReceipt),
        });
        triggerReady();
      }
    });
    socket.on("order:updated", () => {
      queryClient.invalidateQueries({
        queryKey: getGetOrderQueryKey(slug, trackedReceipt),
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [trackedReceipt, slug, queryClient, triggerReady]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptInput.trim()) return;
    const receipt = receiptInput.trim();

    createOrder.mutate(
      { slug, data: { receiptNumber: receipt } },
      {
        onSuccess: () => {
          setTrackedReceipt(receipt);
          alreadyTriggered.current = false;
          queryClient.invalidateQueries({
            queryKey: getGetQueueStatusQueryKey(slug),
          });
          maybeShowNotifPrompt();
        },
        onError: () => {
          setTrackedReceipt(receipt);
          maybeShowNotifPrompt();
        },
      },
    );
  }

  const waitingCount = queueStatus.data?.waitingCount ?? 0;
  const currentlyServing = queueStatus.data?.currentlyServing;

  const estimatedAhead = trackedReceipt && currentlyServing
    ? (() => {
        const curr = parseInt(currentlyServing, 10);
        const mine = parseInt(trackedReceipt, 10);
        if (!isNaN(curr) && !isNaN(mine) && mine > curr) {
          return mine - curr;
        }
        return 0;
      })()
    : 0;

  const statusColor =
    order.data?.status === "ready"
      ? "border-primary/50 bg-primary/10"
      : order.data?.status === "completed"
        ? "border-muted bg-muted/30"
        : "border-accent/50 bg-accent/10";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Notification Pre-Prompt */}
      {showNotifPrompt && (
        <NotificationPrePrompt
          onAllow={handleAllowNotification}
          onSkip={handleSkipNotification}
        />
      )}

      {/* Ready Flash Overlay */}
      {showReadyFlash && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary/95 animate-pulse"
          data-testid="overlay-ready-flash"
        >
          <CheckCircle2 className="h-32 w-32 text-white mb-6" />
          <p className="text-5xl font-extrabold text-white mb-2">ORDER READY!</p>
          <p className="text-2xl font-bold text-white/80">
            Token #{trackedReceipt}
          </p>
          <p className="text-lg text-white/70 mt-2">
            Please collect your food
          </p>
          <p className="text-white/60 mt-2">
            कृपया अपना खाना लेकर जाएं
          </p>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2 text-center text-sm text-yellow-300 flex items-center justify-center gap-2" data-testid="banner-offline">
          <WifiOff className="h-4 w-4" />
          No internet connection — status may be delayed
        </div>
      )}

      <header className="p-4 border-b border-border/40 bg-card/50">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button variant="ghost" asChild size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="font-bold text-lg leading-tight" data-testid="text-track-stall-name">
              {stall.data?.name ?? slug}
            </p>
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
            <p className="text-6xl font-mono font-bold text-foreground" data-testid="text-currently-serving">
              {currentlyServing ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {waitingCount} orders waiting / {waitingCount} ऑर्डर प्रतीक्षा में
            </p>
          </CardContent>
        </Card>

        {/* Token Entry */}
        {!trackedReceipt ? (
          <Card className="w-full mb-6">
            <CardContent className="p-6">
              <p className="font-semibold text-lg mb-1">
                Enter your receipt / token number
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                अपना रसीद नंबर दर्ज करें
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={receiptInput}
                  onChange={(e) => setReceiptInput(e.target.value)}
                  placeholder="e.g. 42"
                  className="text-xl h-12 font-mono"
                  data-testid="input-receipt-number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <Button
                  type="submit"
                  className="h-12 px-5"
                  disabled={!receiptInput.trim() || createOrder.isPending}
                  data-testid="button-track-order"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tracked Order Status */}
            <Card className={`w-full mb-6 border ${statusColor}`}>
              <CardContent className="p-6 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Your Token / आपका टोकन
                </p>
                <p className="text-6xl font-mono font-bold mb-4" data-testid="text-your-token">
                  {trackedReceipt}
                </p>

                {order.data?.status === "ready" && (
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-2 text-primary font-bold text-lg" data-testid="status-ready">
                      <CheckCircle2 className="h-5 w-5" />
                      ORDER READY!
                    </span>
                    <p className="text-sm text-primary">आपका ऑर्डर तैयार है!</p>
                  </div>
                )}

                {order.data?.status === "waiting" && (
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent font-semibold" data-testid="status-waiting">
                      <Clock className="h-4 w-4" />
                      Preparing... / तैयार हो रहा है...
                    </span>
                    {estimatedAhead > 0 && (
                      <p className="text-sm text-muted-foreground">
                        ~{estimatedAhead} orders ahead / ~{estimatedAhead} ऑर्डर आगे
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2 mt-3">
                      <div
                        className="bg-accent h-2 rounded-full transition-all duration-500"
                        style={{
                          width: estimatedAhead > 0
                            ? `${Math.max(5, 100 - (estimatedAhead / 10) * 100)}%`
                            : "80%"
                        }}
                        data-testid="progress-queue"
                      />
                    </div>
                  </div>
                )}

                {order.data?.status === "completed" && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-muted-foreground font-semibold" data-testid="status-completed">
                    Order Collected / ऑर्डर ले लिया गया
                  </span>
                )}

                {!order.data && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-2 text-accent font-semibold" data-testid="status-tracking">
                    <Clock className="h-4 w-4" />
                    Tracking... / ट्रैक हो रहा है...
                  </span>
                )}
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setTrackedReceipt(null);
                setReceiptInput("");
                alreadyTriggered.current = false;
              }}
              data-testid="button-track-different"
            >
              Track a different token / दूसरा टोकन ट्रैक करें
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
