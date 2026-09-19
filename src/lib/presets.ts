import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { presets, type Preset } from "@/db/schema";
import { priceEffect, type EffectCategory, type InputSlot } from "@/lib/effects";

/** A preset as the client sees it: no template internals it cannot use. */
export type EffectView = {
  slug: string;
  title: string;
  description: string | null;
  category: EffectCategory;
  modelId: string;
  exampleUrl: string | null;
  coverUrl: string | null;
  inputSlots: InputSlot[];
  credits: number;
};

export function serializePreset(preset: Preset): EffectView {
  return {
    slug: preset.slug,
    title: preset.title,
    description: preset.description,
    category: preset.category as EffectCategory,
    modelId: preset.modelId,
    exampleUrl: preset.exampleUrl,
    coverUrl: preset.coverUrl,
    inputSlots: (Array.isArray(preset.inputSlots) ? preset.inputSlots : []) as InputSlot[],
    // Priced from the registry every time, so an edited row cannot advertise a
    // number the generate route would not actually charge.
    credits: priceEffect(preset),
  };
}

export async function getEffects(): Promise<EffectView[]> {
  const rows = await getDb()
    .select()
    .from(presets)
    .where(eq(presets.kind, "effect"))
    .orderBy(asc(presets.sort), asc(presets.title));
  return rows.map(serializePreset);
}

/** The full row — the generate route needs the template, the pages do not. */
export async function getPreset(slug: string): Promise<Preset | null> {
  const [preset] = await getDb()
    .select()
    .from(presets)
    .where(and(eq(presets.slug, slug), eq(presets.kind, "effect")))
    .limit(1);
  return preset ?? null;
}
