import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useVerifyStallPassword, useGetStallBySlug } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, LogIn, Store } from "lucide-react";

const schema = z.object({
  slug: z.string().min(1, "Stall slug is required"),
  password: z.string().min(1, "Password is required"),
});

export default function VendorLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const verifyPassword = useVerifyStallPassword();
  const [slugToFetch, setSlugToFetch] = useState("");

  const stall = useGetStallBySlug(slugToFetch, {
    query: { enabled: !!slugToFetch, queryKey: ["stalls", slugToFetch] },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { slug: "", password: "" },
  });

  const watchedSlug = form.watch("slug");

  function onSlugBlur() {
    const val = form.getValues("slug").trim().toLowerCase();
    if (val) setSlugToFetch(val);
  }

  function onSubmit(values: z.infer<typeof schema>) {
    const slug = values.slug.trim().toLowerCase();
    verifyPassword.mutate(
      { slug, data: { password: values.password } },
      {
        onSuccess: () => {
          sessionStorage.setItem(`vendor_auth_${slug}`, "true");
          setLocation(`/vendor/${slug}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Invalid credentials",
            description: "Check your stall name and password and try again.",
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
            Back to Home
          </Link>
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Vendor Login</CardTitle>
            </div>
            <CardDescription>
              {stall.data
                ? `${stall.data.name} — ${stall.data.mallName}`
                : "Enter your stall details to access your dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stall Name / Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. haldirams"
                          {...field}
                          onBlur={onSlugBlur}
                          onChange={(e) => {
                            field.onChange(e);
                          }}
                          data-testid="input-login-slug"
                        />
                      </FormControl>
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
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-login-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={verifyPassword.isPending}
                  data-testid="button-vendor-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {verifyPassword.isPending ? "Logging in..." : "Log In to Dashboard"}
                </Button>
              </form>
            </Form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              New vendor?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Register your stall
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
