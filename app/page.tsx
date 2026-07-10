"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Scale, FileText, Wrench } from "lucide-react";

interface ToolCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  cta: string;
  available: boolean;
}

const tools: ToolCard[] = [
  {
    title: "Property Comparison",
    description:
      "Compare up to 3 properties side-by-side with AI-powered insights on price, schools, taxes, big-ticket repairs, and more. Export to CSV.",
    href: "/compare",
    icon: Scale,
    cta: "Compare Now",
    available: true,
  },
  {
    title: "CMA Report",
    description:
      "Generate a Comparative Market Analysis for any US property. Get AI-driven valuation estimates, recent comps, and a printable PDF report.",
    href: "/cma",
    icon: FileText,
    cta: "Run CMA",
    available: true,
  },
  {
    title: "Renovation ROI",
    description:
      "Estimate return on investment for common home renovations. See which upgrades add the most value before you spend.",
    href: "#",
    icon: Wrench,
    cta: "Coming Soon",
    available: false,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/domuzz_logo.svg"
              alt="Domuzz"
              width={180}
              height={41}
              priority
              className="h-auto w-auto sm:w-[320px]"
            />
          </div>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Free real estate tools for smarter home buying or selling decisions. No sign-up, no paywall — just honest data.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/compare">
                <Scale className="h-4 w-4 mr-2" />
                Compare Properties
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/cma">
                <FileText className="h-4 w-4 mr-2" />
                Run a Free CMA Report
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-16 sm:pb-24">
        <div className="text-center mb-10">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Our Free Tools</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Built to help you make confident real estate decisions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.title}
                className={`relative flex flex-col transition-shadow hover:shadow-md ${
                  !tool.available ? "opacity-60" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base sm:text-lg">{tool.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  {tool.available ? (
                    <Button asChild variant="secondary" className="w-full">
                      <Link href={tool.href}>
                        {tool.cta}
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled variant="secondary" className="w-full">
                      {tool.cta}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-[11px] sm:text-xs text-muted-foreground px-4 max-w-2xl mx-auto">
          Data sourced from publicly available real estate listings. For informational purposes only — not affiliated with any listing provider. Verify all details with a licensed agent before making decisions.
        </p>
      </footer>
    </main>
  );
}