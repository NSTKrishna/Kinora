/**
 * Seeds the effect presets.
 *
 * Idempotent: re-running it updates the rows in place, so editing a prompt in
 * `src/lib/effects.ts` and re-seeding is the whole workflow. It never deletes,
 * because a job may still point at a preset that has been retired.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  // Imported after dotenv so DATABASE_URL is present when the pool is built.
  const { getDb, closeDb } = await import("../src/db");
  const { presets } = await import("../src/db/schema");
  const { EFFECTS, priceEffect } = await import("../src/lib/effects");

  const db = getDb();

  for (const effect of EFFECTS) {
    const row = {
      slug: effect.slug,
      title: effect.title,
      kind: "effect" as const,
      category: effect.category,
      description: effect.description,
      modelId: effect.modelId,
      promptTemplate: effect.promptTemplate,
      defaultParams: effect.defaultParams,
      inputSlots: effect.inputSlots,
      exampleUrl: effect.exampleUrl,
      coverUrl: null,
      // Display only; the generate route re-prices from the registry.
      credits: priceEffect(effect),
      sort: effect.sort,
    };

    await db.insert(presets).values(row).onConflictDoUpdate({ target: presets.slug, set: row });

    console.log(`  ${effect.slug.padEnd(14)} ${row.credits} credits`);
  }

  console.log(`\nSeeded ${EFFECTS.length} effects.`);
  await closeDb();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
