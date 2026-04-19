import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Store, QrCode, BellRing, Utensils, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">OrderPing</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/register">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                For Vendors
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get Your QR Code
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 -z-10" />
          <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
            <Badge variant="outline" className="mb-6 px-3 py-1 border-primary/30 text-primary bg-primary/5 text-sm">
              No App Download Required
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
              The <span className="text-primary">kitchen display board</span> <br /> for your customers' phones.
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Ditch the clunky pagers. Vendor calls the number, customer's phone buzzes. 
              The fastest way to manage food court orders.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Start Calling Orders <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#demo" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 border-border hover:bg-muted">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 bg-card/30 border-y border-border/40" id="how-it-works">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Three simple steps</h2>
              <p className="text-muted-foreground text-lg">From order placed to food collected.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <Store className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">1. Get your QR Code</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Register your stall in 30 seconds. Print the auto-generated QR code and place it at your counter.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
                  <QrCode className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3">2. Customers Scan</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Customer scans the QR, enters their receipt number, and walks away. No apps, no signups.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6 border border-green-500/20">
                  <BellRing className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">3. Phone Buzzes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you tap "Ready" on your vendor dashboard, their phone instantly flashes green and vibrates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="py-20 md:py-32" id="demo">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12 max-w-6xl mx-auto">
              <div className="flex-1 space-y-6">
                <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                  Never shout an order number again.
                </h2>
                <p className="text-lg text-muted-foreground">
                  Your customers want to sit down, not crowd around the counter waiting for their food. Give them the freedom to relax while you focus on cooking.
                </p>
                <ul className="space-y-4 pt-4">
                  {[
                    "Works instantly on any smartphone",
                    "Bilingual interface (English & Hindi)",
                    "Real-time queue tracking",
                    "Loud chime and vibration alerts"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-lg">
                      <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-1 relative w-full max-w-md">
                {/* Mock phone frame */}
                <div className="relative mx-auto w-[300px] h-[600px] bg-black rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
                  {/* Notch */}
                  <div className="absolute top-0 inset-x-0 h-6 bg-zinc-800 rounded-b-3xl w-40 mx-auto z-20"></div>
                  
                  {/* Screen Content */}
                  <div className="flex-1 bg-card flex flex-col p-6 pt-12">
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/20 text-primary mb-4">
                        <Utensils className="h-6 w-6" />
                      </div>
                      <h3 className="font-bold text-xl">Haldiram's</h3>
                      <p className="text-sm text-muted-foreground">Pacific Mall</p>
                    </div>

                    <Card className="border-primary/50 bg-primary/5 mb-6">
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Your Token</p>
                        <p className="text-5xl font-mono font-bold text-primary">47</p>
                        <div className="mt-4 inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                          Preparing
                        </div>
                      </CardContent>
                    </Card>

                    <div className="bg-muted rounded-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Currently Serving</p>
                      <p className="text-3xl font-mono font-bold text-foreground">42</p>
                      <p className="text-xs text-muted-foreground mt-2">~ 5 orders ahead</p>
                    </div>
                  </div>
                </div>
                
                {/* Decorative background elements */}
                <div className="absolute -inset-4 bg-primary/20 blur-3xl -z-10 rounded-full opacity-50"></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-card">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">OrderPing</span>
          </div>
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} OrderPing. For modern Indian food courts.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
