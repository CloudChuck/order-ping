import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useGetAdminAnalytics, getGetAdminAnalyticsQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Store, Clock, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export default function Admin() {
  const [password, setPassword] = useState<string | null>(null);
  const [enteredPassword, setEnteredPassword] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });

  const analytics = useGetAdminAnalytics(
    { password: enteredPassword ?? "" },
    {
      query: {
        enabled: !!enteredPassword,
        queryKey: getGetAdminAnalyticsQueryKey({ password: enteredPassword ?? "" }),
        retry: false,
      },
    },
  );

  function onSubmit(values: z.infer<typeof loginSchema>) {
    setEnteredPassword(values.password);
    setPassword(values.password);
  }

  const isWrongPassword = analytics.isError && enteredPassword;

  if (!password || !analytics.data) {
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
              <CardTitle>Admin Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">Enter admin password</p>
            </CardHeader>
            <CardContent>
              {isWrongPassword && (
                <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">Incorrect password.</p>
                </div>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-admin-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={analytics.isLoading}
                    data-testid="button-admin-login"
                  >
                    {analytics.isLoading ? "Loading..." : "View Analytics"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const data = analytics.data;

  const chartData = data.stalls.map((s) => ({
    name: s.stallName.length > 10 ? s.stallName.slice(0, 10) + "…" : s.stallName,
    orders: s.ordersToday,
    wait: s.avgWaitTimeMinutes,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border/40 bg-card/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <p className="font-bold text-lg">Admin Analytics</p>
              <p className="text-xs text-muted-foreground">OrderPing Dashboard</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPassword(null);
              setEnteredPassword(null);
            }}
            data-testid="button-admin-logout"
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary" data-testid="text-total-orders">
                {data.totalOrdersToday}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Orders Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-accent">
                {data.totalStalls}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active Stalls</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-foreground">
                {data.stalls.length > 0
                  ? Math.round(
                      (data.stalls.reduce((s, st) => s + st.avgWaitTimeMinutes, 0) /
                        data.stalls.length) * 10
                    ) / 10
                  : 0}
                m
              </p>
              <p className="text-xs text-muted-foreground mt-1">Avg Wait (All)</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Orders Per Stall Today</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={index} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Stall Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Stalls</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.stalls.length === 0 ? (
              <p className="text-muted-foreground text-sm p-4 text-center">
                No stalls registered yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.stalls.map((stall) => (
                  <div
                    key={stall.stallId}
                    className="px-4 py-4"
                    data-testid={`row-stall-${stall.slug}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{stall.stallName}</p>
                          <p className="text-xs text-muted-foreground">
                            {stall.mallName} · /{stall.slug}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/vendor/${stall.slug}`}>Dashboard</Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span className="font-bold text-primary">{stall.ordersToday}</span>
                        <span className="text-muted-foreground text-xs">today</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-accent" />
                        <span className="font-bold text-accent">{stall.avgWaitTimeMinutes}m</span>
                        <span className="text-muted-foreground text-xs">avg</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span
                          className={`h-2 w-2 rounded-full ${stall.activeOrders > 0 ? "bg-primary" : "bg-muted-foreground/30"}`}
                        />
                        <span className="font-bold">{stall.activeOrders}</span>
                        <span className="text-muted-foreground text-xs">active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
