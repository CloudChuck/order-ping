import { useState, useRef } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateStall } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Mail,
  RotateCcw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiPost(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

const formSchema = z.object({
  name: z.string().min(2, "Stall name must be at least 2 characters."),
  mallName: z.string().min(2, "Mall name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  slug: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type Step = "form" | "otp" | "done";

export default function Register() {
  const { toast } = useToast();
  const createStall = useCreateStall();

  const [step, setStep] = useState<Step>("form");
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [registeredSlug, setRegisteredSlug] = useState<string | null>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", mallName: "", email: "", password: "", slug: "" },
  });

  const sendOtp = useMutation({
    mutationFn: (email: string) => apiPost("/api/vendor/send-otp", { email }),
  });

  const verifyOtp = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      apiPost("/api/vendor/verify-otp", { email, otp }),
  });

  function onFormSubmit(values: FormValues) {
    setPendingValues(values);
    sendOtp.mutate(values.email, {
      onSuccess: () => {
        setStep("otp");
        setOtpCode("");
        toast({ title: "Code sent!", description: `Check ${values.email} for your 6-digit code.` });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Could not send code",
          description: err.message ?? "Please try again.",
        });
      },
    });
  }

  function handleOtpInput(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = otpCode.split("");
    chars[idx] = val;
    const next = chars.join("").slice(0, 6);
    setOtpCode(next);
    if (val && idx < 5) {
      otpInputsRef.current[idx + 1]?.focus();
    }
  }

  function handleOtpKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === "Backspace" && !otpCode[idx] && idx > 0) {
      otpInputsRef.current[idx - 1]?.focus();
    }
  }

  function handleVerify() {
    if (!pendingValues || otpCode.length < 6) return;
    verifyOtp.mutate(
      { email: pendingValues.email, otp: otpCode },
      {
        onSuccess: () => {
          createStall.mutate(
            { data: pendingValues },
            {
              onSuccess: (data) => {
                sessionStorage.setItem(`vendor_auth_${data.slug}`, "true");
                setRegisteredSlug(data.slug);
                setStep("done");
              },
              onError: (err: any) => {
                toast({
                  variant: "destructive",
                  title: "Registration failed",
                  description: err?.message ?? "There was a problem registering your stall.",
                });
              },
            },
          );
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Invalid code",
            description: err.message ?? "The code is incorrect or expired.",
          });
          setOtpCode("");
          otpInputsRef.current[0]?.focus();
        },
      },
    );
  }

  function handleResend() {
    if (!pendingValues) return;
    setOtpCode("");
    sendOtp.mutate(pendingValues.email, {
      onSuccess: () =>
        toast({ title: "New code sent!", description: `Check ${pendingValues.email}.` }),
      onError: (err: any) =>
        toast({ variant: "destructive", title: "Failed to resend", description: err.message }),
    });
  }

  if (step === "done" && registeredSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl">Registration Complete!</CardTitle>
            <CardDescription>Your stall is ready to accept orders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="bg-muted p-6 rounded-lg text-center border border-border">
              <h3 className="font-semibold text-lg mb-2">Your QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Print this and display it at your counter for customers to scan.
              </p>
              <div className="bg-white p-4 inline-block rounded-lg mb-4">
                <img
                  src={`${BASE}/api/stalls/${registeredSlug}/qr-code`}
                  alt="Stall QR Code"
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f4f4f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2352525b'%3EQR Code%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
              <Button asChild variant="outline" className="w-full" data-testid="button-download-qr">
                <a href={`${BASE}/api/stalls/${registeredSlug}/qr-code`} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download QR Code
                </a>
              </Button>
            </div>
            <Button asChild className="w-full" size="lg" data-testid="link-vendor-dashboard">
              <Link href={`/vendor/${registeredSlug}`}>
                Go to Vendor Dashboard <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "otp" && pendingValues) {
    const isBusy = verifyOtp.isPending || createStall.isPending;
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="p-4 border-b border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStep("form"); setOtpCode(""); }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{pendingValues.email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center gap-2" data-testid="otp-input-group">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpInputsRef.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpCode[idx] ?? ""}
                    onChange={(e) => handleOtpInput(e, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    onFocus={(e) => e.target.select()}
                    className="w-11 h-14 text-center text-2xl font-mono font-bold rounded-lg border border-border bg-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    data-testid={`otp-digit-${idx}`}
                  />
                ))}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleVerify}
                disabled={otpCode.length < 6 || isBusy}
                data-testid="button-verify-otp"
              >
                {isBusy ? "Verifying..." : "Verify & Create Stall"}
              </Button>

              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-sm text-muted-foreground">Didn't get the code?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary h-auto py-0 px-1"
                  onClick={handleResend}
                  disabled={sendOtp.isPending}
                  data-testid="button-resend-otp"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Resend
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-4 border-b border-border/40">
        <Button variant="ghost" asChild size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Register your Stall</CardTitle>
            <CardDescription>
              Start notifying customers when their food is ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stall Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Haldiram's" {...field} data-testid="input-stall-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mallName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mall / Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Gaur City Mall" {...field} data-testid="input-mall-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="vendor@example.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormDescription>We'll send a verification code here.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom URL Slug (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. haldirams-pacific" {...field} data-testid="input-slug" />
                      </FormControl>
                      <FormDescription>Leave blank to auto-generate</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={sendOtp.isPending}
                  data-testid="button-submit-register"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sendOtp.isPending ? "Sending code..." : "Send Verification Code"}
                </Button>
              </form>
            </Form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already registered?{" "}
              <Link href="/vendor-login" className="text-primary hover:underline font-medium">
                Log in to your dashboard
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
