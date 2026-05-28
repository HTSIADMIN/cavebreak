"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Pickaxe, Play, Gem, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Pickaxe, title: "Mine outward", body: "Carve the cave to claim space and shape your chokes." },
  { icon: Gem, title: "Grow an economy", body: "Harvest minerals and gas; expand to forward bases." },
  { icon: Swords, title: "Break out", body: "Tech up and fight through the fog to win." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-5 text-center"
      >
        <Badge variant="secondary" className="gap-1.5">
          <Pickaxe className="size-3.5" /> Pre-alpha · single-player slice
        </Badge>
        <h1 className="text-6xl font-semibold tracking-tight">Cavebreak</h1>
        <p className="max-w-md text-balance text-muted-foreground">
          A top-down RTS. Start in a pocket of solid rock, mine outward, grow a settlement, and break
          out of the cave.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/play">
              <Play className="size-4" /> Play (local)
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              toast("Cavebreak", {
                description: "Next 16 · shadcn/ui · radix-ui · Motion · Supabase Realtime (soon)",
              })
            }
          >
            What&apos;s inside
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Press
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘ K</kbd>
          for commands
        </p>
      </motion.div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: "easeOut" }}
          >
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2">
                <f.icon className="size-5 text-primary" />
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
