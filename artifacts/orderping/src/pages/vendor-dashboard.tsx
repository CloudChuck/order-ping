// TASK 6 — Audio TTS announcements when Ready is pressed
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  useGetStallBySlug,
  useVerifyStallPassword,
  useListOrdersByStall,
  useMarkOrderReady,
  useNudgeCustomer,
  useGetStallAnalytics,
  getListOrdersByStallQueryKey,
  getGetStallAnalyticsQueryKey,
  getGetStallBySlugQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Delete,
  Clock,
  Bell,
  CheckCircle2,
  LogIn,
} from "lucide-react";
import { io } from "socket.io-client";
import { Volume2, VolumeX } from "lucide-react";

// TASK 6 — TTS announcement function
function announceReady(tokenId: string, stallName: string): void {
  if (!("speechSynthesis" in window)) return;
  const msg    = new SpeechSynthesisUtterance(`Token ${tokenId}, your order is ready at ${stallName}`);
  msg.lang     = "en-IN";
  msg.volume   = 1.0;
  msg.rate     = 0.85;
  window.speechSynthesis.speak(msg);
}

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function VendorLogin({
  slug,
  onSuccess,
}: {
  slug: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const verifyPassword = useVerifyStallPassword();
  const stall = useGetStallBySlug(slug);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    verifyPassword.mutate(
      { slug, data: { password: values.password } },
      {
        onSuccess: () => {
          sessionStorage.setItem(`vendor_auth_${slug}`, "true");
          onSuccess();
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Invalid password",
            description: "Please check your password and try again.",
          });
        },
      },
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-4 border-b border-border/40">
        <Button variant="ghost" asChild size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Home
          </Link>
        </Button>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Vendor Login</CardTitle>
            {stall.data && (
              <p className="text-muted-foreground text-sm">
                {stall.data.name} — {stall.data.mallName}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-vendor-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyPassword.isPending}
                  data-testid="button-vendor-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {verifyPassword.isPending ? "Logging in..." : "Log In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [pendingReadyNumber, setPendingReadyNumber] = useState<string | null>(null);
  // TASK 6 — audio toggle (default ON), stored in React state (NOT localStorage per rules)
  const [audioEnabled, setAudioEnabled] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = sessionStorage.getItem(`vendor_auth_${slug}`);
    if (stored === "true") setIsAuthenticated(true);
  }, [slug]);

  const stall = useGetStallBySlug(slug, {
    query: { enabled: isAuthenticated, queryKey: getGetStallBySlugQueryKey(slug) },
  });

  const orders = useListOrdersByStall(
    slug,
    {},
    {
      query: {
        enabled: isAuthenticated,
        refetchInterval: 5000,
        queryKey: getListOrdersByStallQueryKey(slug, {}),
      },
    },
  );

  const analytics = useGetStallAnalytics(slug, {
    query: {
      enabled: isAuthenticated,
      refetchInterval: 30000,
      queryKey: getGetStallAnalyticsQueryKey(slug),
    },
  });

  const markReady = useMarkOrderReady();
  const nudgeCustomer = useNudgeCustomer();

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io({ path: "/api/socket" });
    socket.emit("join:stall", slug);
    socket.on("stall:order:updated", () => {
      queryClient.invalidateQueries({
        queryKey: getListOrdersByStallQueryKey(slug, {}),
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, slug, queryClient]);

  const handleNumpad = useCallback(
    (key: string) => {
      if (key === "DEL") {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (key === "CLR") {
        setCurrentInput("");
      } else {
        setCurrentInput((prev) => (prev.length < 6 ? prev + key : prev));
      }
    },
    [],
  );

  function handleMarkReady() {
    if (!currentInput) return;
    setPendingReadyNumber(currentInput);
  }

  function confirmMarkReady() {
    if (!pendingReadyNumber) return;
    markReady.mutate(
      { slug, receiptNumber: pendingReadyNumber },
      {
        onSuccess: () => {
          // TASK 6 — announce via TTS if audio is enabled
          if (audioEnabled) {
            announceReady(pendingReadyNumber, stall.data?.name ?? slug);
          }
          toast({
            title: "Order Ready!",
            description: `Token #${pendingReadyNumber} has been called.`,
          });
          setCurrentInput("");
          setPendingReadyNumber(null);
          queryClient.invalidateQueries({
            queryKey: getListOrdersByStallQueryKey(slug, {}),
          });
          queryClient.invalidateQueries({
            queryKey: getGetStallAnalyticsQueryKey(slug),
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not mark order ready. Was this token registered?",
          });
          setPendingReadyNumber(null);
        },
      },
    );
  }

  function handleNudge(receiptNumber: string) {
    nudgeCustomer.mutate(
      { slug, receiptNumber },
      {
        onSuccess: () => {
          toast({
            title: "Nudge sent!",
            description: `Reminded customer for token #${receiptNumber}.`,
          });
        },
      },
    );
  }

  if (!isAuthenticated) {
    return (
      <VendorLogin slug={slug} onSuccess={() => setIsAuthenticated(true)} />
    );
  }

  const activeOrders = (orders.data ?? []).filter(
    (o) => o.status === "waiting" || o.status === "ready",
  );
  const recentCompleted = (orders.data ?? [])
    .filter((o) => o.status === "completed" || o.status === "ready")
    .slice(0, 10);

  const now = Date.now();
  const needsNudge = (orders.data ?? []).filter((o) => {
    if (o.status !== "ready") return false;
    const readyAt = o.readyAt ? new Date(o.readyAt).getTime() : 0;
    return now - readyAt > 5 * 60 * 1000;
  });

  const numpadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "DEL"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border/40 bg-card/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-bold text-lg leading-tight" data-testid="text-stall-name">
              {stall.data?.name ?? slug}
            </p>
            <p className="text-xs text-muted-foreground">
              {stall.data?.mallName}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {analytics.data && (
              <div className="hidden sm:flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-bold text-xl text-primary" data-testid="text-orders-today">
                    {analytics.data.ordersToday}
                  </p>
                  <p className="text-muted-foreground text-xs">Today</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-xl text-accent">
                    {analytics.data.avgWaitTimeMinutes}m
                  </p>
                  <p className="text-muted-foreground text-xs">Avg Wait</p>
                </div>
              </div>
            )}
            {/* TASK 6 — Audio TTS toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAudioEnabled((v) => !v)}
              title={audioEnabled ? "Audio ON — click to mute" : "Audio OFF — click to enable"}
              data-testid="button-audio-toggle"
            >
              {audioEnabled
                ? <Volume2 className="h-4 w-4 text-primary" />
                : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="ml-1 text-xs">{audioEnabled ? "ON" : "OFF"}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(`vendor_auth_${slug}`);
                setIsAuthenticated(false);
              }}
              data-testid="button-logout"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Currently Serving */}
        {stall.data?.currentlyServing && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Currently Serving
              </p>
              <p
                className="text-5xl font-mono font-bold text-primary"
                data-testid="text-currently-serving"
              >
                {stall.data.currentlyServing}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Nudge Alerts */}
        {needsNudge.map((order) => (
          <Card
            key={order.id}
            className="border-accent/40 bg-accent/5"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-accent">
                  Token #{order.receiptNumber} waiting 5+ min
                </p>
                <p className="text-xs text-muted-foreground">
                  Ready since {order.readyAt ? formatTime(order.readyAt) : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-accent/50 text-accent"
                onClick={() => handleNudge(order.receiptNumber)}
                data-testid={`button-nudge-${order.receiptNumber}`}
              >
                <Bell className="mr-2 h-4 w-4" />
                Nudge
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Numpad */}
        <Card>
          <CardContent className="p-4">
            {/* Display */}
            <div
              className="bg-muted rounded-xl p-4 mb-4 text-center min-h-[4rem] flex items-center justify-center"
              data-testid="display-order-number"
            >
              {currentInput ? (
                <span className="text-4xl font-mono font-bold tracking-widest">
                  {currentInput}
                </span>
              ) : (
                <span className="text-2xl text-muted-foreground font-mono">
                  Enter Token #
                </span>
              )}
            </div>

            {/* Keys */}
            <div className="grid grid-cols-3 gap-3">
              {numpadKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumpad(key)}
                  className={`
                    h-16 rounded-xl font-bold text-xl transition-all active:scale-95
                    ${key === "CLR" ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : ""}
                    ${key === "DEL" ? "bg-muted hover:bg-muted/70 text-foreground" : ""}
                    ${!["CLR", "DEL"].includes(key) ? "bg-secondary hover:bg-secondary/70 text-foreground" : ""}
                  `}
                  data-testid={`button-numpad-${key}`}
                >
                  {key === "DEL" ? <Delete className="h-5 w-5 mx-auto" /> : key}
                </button>
              ))}
            </div>

            {/* Ready Button */}
            <Button
              className="w-full mt-4 h-16 text-xl font-bold bg-primary hover:bg-primary/90 disabled:opacity-40"
              disabled={!currentInput || markReady.isPending}
              onClick={handleMarkReady}
              data-testid="button-mark-ready"
            >
              <CheckCircle2 className="mr-2 h-6 w-6" />
              {markReady.isPending ? "Calling..." : "READY!"}
            </Button>
          </CardContent>
        </Card>

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Active Orders ({activeOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {activeOrders.slice(0, 15).map((order) => (
                  <div
                    key={order.id}
                    className="px-4 py-3 flex items-center justify-between"
                    data-testid={`row-order-${order.receiptNumber}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          order.status === "ready"
                            ? "bg-primary"
                            : "bg-accent"
                        }`}
                      />
                      <span className="font-mono font-bold text-lg">
                        #{order.receiptNumber}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.status === "ready"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/10 text-accent"
                        }`}
                        data-testid={`status-order-${order.receiptNumber}`}
                      >
                        {order.status === "ready" ? "Ready" : "Preparing"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTime(order.createdAt)}
                      </span>
                      {order.status === "waiting" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setCurrentInput(order.receiptNumber);
                          }}
                          data-testid={`button-select-${order.receiptNumber}`}
                        >
                          Select
                        </Button>
                      )}
                      {order.status === "ready" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-accent/50 text-accent hover:bg-accent/10"
                          onClick={() => handleNudge(order.receiptNumber)}
                          data-testid={`button-nudge-ready-${order.receiptNumber}`}
                        >
                          <Bell className="mr-1 h-3 w-3" />
                          Nudge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recently Called */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recently Called</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentCompleted.length === 0 ? (
              <p className="text-muted-foreground text-sm p-4 text-center">
                No orders called yet today
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentCompleted.map((order) => (
                  <div
                    key={order.id}
                    className="px-4 py-3 flex items-center justify-between"
                    data-testid={`row-recent-${order.receiptNumber}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                      <span className="font-mono text-lg text-muted-foreground">
                        #{order.receiptNumber}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {order.readyAt ? formatTime(order.readyAt) : formatTime(order.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!pendingReadyNumber} onOpenChange={(open) => !open && setPendingReadyNumber(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Token Ready?</AlertDialogTitle>
            <AlertDialogDescription>
              This will notify the customer for token{" "}
              <strong>#{pendingReadyNumber}</strong> that their food is ready.
              Their phone will vibrate and flash green.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMarkReady}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-confirm-ready"
            >
              Yes, Call It Ready!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
