import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Download, ExternalLink } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Stall name must be at least 2 characters."),
  mallName: z.string().min(2, "Mall name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  slug: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createStall = useCreateStall();
  const [registeredSlug, setRegisteredSlug] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      mallName: "",
      email: "",
      password: "",
      slug: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createStall.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({
            title: "Registration successful!",
            description: "Your stall has been registered.",
          });
          setRegisteredSlug(data.slug);
          // Store auth token equivalent so they can auto-login or access dashboard
          sessionStorage.setItem(`vendor_auth_${data.slug}`, "true");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error?.message || "There was a problem registering your stall.",
          });
        },
      }
    );
  }

  if (registeredSlug) {
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
                {/* Real QR code would be fetched from API, using placeholder for demo */}
                <img 
                  src={`/api/stalls/${registeredSlug}/qr-code`} 
                  alt="Stall QR Code" 
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f4f4f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2352525b'%3EQR Code Preview%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
              <Button asChild variant="outline" className="w-full" data-testid="button-download-qr">
                <a href={`/api/stalls/${registeredSlug}/qr-code`} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF / PNG
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <Input placeholder="e.g. Pacific Mall" {...field} data-testid="input-mall-name" />
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
                  disabled={createStall.isPending}
                  data-testid="button-submit-register"
                >
                  {createStall.isPending ? "Registering..." : "Register Stall"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
