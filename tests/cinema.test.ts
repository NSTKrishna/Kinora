import { describe, expect, it } from "vitest";

import {
  CINEMA,
  FRAME_COUNT,
  MAX_REFERENCES,
  RIG_SLOTS,
  cinemaSpecSchema,
  compileFramePrompt,
  compileFrames,
  compileMotion,
  compileMotionPrompt,
  defaultSpec,
  describeRig,
  SCENE_MAX,
  findOption,
  framesModelId,
  furthestStep,
  readDraft,
  stepRank,
  toRunnable,
  CINEMA_STEPS,
  type CinemaSpec,
} from "@/lib/cinema";
import { getModel } from "@/lib/models";

const SCENE = "A lone figure waits at the end of an empty subway platform";

function spec(overrides: Partial<CinemaSpec> = {}): CinemaSpec {
  return cinemaSpecSchema.parse({
    ...defaultSpec(),
    scene: { text: SCENE, referenceUrls: [] },
    ...overrides,
  });
}

/* ------------------------------------------------------------- catalogue */

describe("the catalogue", () => {
  it("has the sizes the director's panel is built around", () => {
    expect(CINEMA.cameras).toHaveLength(5);
    expect(CINEMA.lenses).toHaveLength(6);
    expect(CINEMA.focalLengths).toHaveLength(5);
    expect(CINEMA.apertures).toHaveLength(3);
    expect(CINEMA.motions).toHaveLength(10);
  });

  it("gives every option a fragment, and every rig slot a group", () => {
    for (const [group, options] of Object.entries(CINEMA)) {
      for (const option of options) {
        expect(option.fragment.length, `${group}/${option.id}`).toBeGreaterThan(20);
        expect(option.label, `${group}/${option.id}`).toBeTruthy();
      }
    }
    for (const slot of RIG_SLOTS) {
      expect(CINEMA[slot.group].length, slot.key).toBeGreaterThan(0);
    }
  });

  it("names no manufacturer in a camera or lens option", () => {
    // Kinora ships its own identity: options describe a medium, not a product.
    const brands =
      /\b(arri|alexa|red komodo|sony|canon|nikon|panavision|blackmagic|zeiss|leica|cooke)\b/i;
    for (const option of [...CINEMA.cameras, ...CINEMA.lenses]) {
      expect(`${option.label} ${option.fragment}`, option.id).not.toMatch(brands);
    }
  });
});

/* -------------------------------------------------------------- compiler */

describe("compiling a frame prompt", () => {
  it("starts with the scene and carries every rig fragment", () => {
    const s = spec();
    const prompt = compileFramePrompt(s);

    expect(prompt.startsWith(SCENE)).toBe(true);
    for (const slot of RIG_SLOTS) {
      const option = findOption(slot.group, s.rig[slot.key]);
      expect(prompt, slot.key).toContain(option!.fragment);
    }
  });

  it("is deterministic — the same spec compiles to the same string", () => {
    expect(compileFramePrompt(spec())).toBe(compileFramePrompt(spec()));
  });

  it("changes when any single rig slot changes", () => {
    const base = spec();
    const seen = new Set([compileFramePrompt(base)]);

    for (const slot of RIG_SLOTS) {
      const other = CINEMA[slot.group].find((option) => option.id !== base.rig[slot.key])!;
      const prompt = compileFramePrompt({ ...base, rig: { ...base.rig, [slot.key]: other.id } });
      expect(seen.has(prompt), `${slot.key} did not change the prompt`).toBe(false);
      seen.add(prompt);
    }
  });

  it("closes every clause and never doubles a space", () => {
    const prompt = compileFramePrompt(spec());
    expect(prompt).not.toMatch(/\s{2}/);
    expect(prompt).toMatch(/[.!?]$/);
  });

  it("cannot exceed the model's prompt ceiling for any valid spec", () => {
    // The scene cap is derived from the catalogue, so the longest scene the
    // schema allows plus the wordiest rig still fits.
    const longest = spec({
      scene: { text: "A crowded room. ".repeat(200).slice(0, SCENE_MAX).trim(), referenceUrls: [] },
    });
    const prompt = compileFramePrompt(longest);

    expect(prompt.length).toBeLessThanOrEqual(2000);
    expect(getModel("flux-schnell")!.schema.safeParse({ prompt }).success).toBe(true);

    // And it survives whole: a scene the schema accepted must never come back
    // silently truncated, nor cost the prompt one of its rig fragments.
    expect(prompt).toContain(longest.scene.text);
    for (const slot of RIG_SLOTS) {
      expect(prompt, slot.key).toContain(findOption(slot.group, longest.rig[slot.key])!.fragment);
    }
  });

  it("truncates at a sentence if a caller skips validation", () => {
    // The backstop in the assembler, reached by bypassing the schema the way a
    // future refactor might.
    const prompt = compileFramePrompt({
      ...defaultSpec(),
      scene: { text: "A crowded room. ".repeat(400), referenceUrls: [] },
    });

    expect(prompt.length).toBeLessThanOrEqual(2000);
    expect(prompt).toMatch(/\.$/);
    expect(prompt).not.toMatch(/\w$/);
  });

  it("keeps the derived scene cap ahead of the wordiest rig", () => {
    expect(SCENE_MAX).toBeGreaterThan(400);
    expect(SCENE_MAX).toBeLessThan(2000);
  });
});

describe("compiling a motion prompt", () => {
  it("leads with the camera move", () => {
    const s = spec({ motion: "orbit" });
    expect(compileMotionPrompt(s).startsWith(findOption("motions", "orbit")!.fragment)).toBe(true);
  });

  it("drops what the anchor frame already fixed", () => {
    // Aperture and lighting are baked into the chosen still; repeating them
    // only gives the video model something to argue with.
    const s = spec();
    const prompt = compileMotionPrompt(s);

    expect(prompt).toContain(findOption("cameras", s.rig.camera)!.fragment);
    expect(prompt).toContain(findOption("genres", s.rig.genre)!.fragment);
    expect(prompt).not.toContain(findOption("apertures", s.rig.aperture)!.fragment);
    expect(prompt).not.toContain(findOption("lighting", s.rig.lighting)!.fragment);
  });

  it("gives all ten moves a distinct prompt", () => {
    const prompts = CINEMA.motions.map((motion) =>
      compileMotionPrompt(spec({ motion: motion.id })),
    );
    expect(new Set(prompts).size).toBe(CINEMA.motions.length);
  });
});

/* ----------------------------------------------------------- model calls */

describe("compiling model calls", () => {
  it("renders four widescreen frames on the cheap model with no references", () => {
    const call = compileFrames(spec());

    expect(call.modelId).toBe("flux-schnell");
    expect(call.params.num_images).toBe(FRAME_COUNT);
    expect(call.params.image_size).toBe("landscape_16_9");
    expect(call.credits).toBe(4);
    expect(call.prompt).toBe(compileFramePrompt(spec()));
  });

  it("switches to the multi-reference model when references are attached", () => {
    const urls = ["https://a.test/1.png", "https://a.test/2.png", "https://a.test/3.png"];
    const call = compileFrames(spec({ scene: { text: SCENE, referenceUrls: urls } }));

    expect(call.modelId).toBe(framesModelId(urls.length));
    expect(call.modelId).toBe("nano-banana-edit");
    expect(call.params.image_urls).toEqual(urls);
    expect(call.params.aspect_ratio).toBe("16:9");
    expect(call.params.num_images).toBe(FRAME_COUNT);
    // Priced from the registry, not from a number written down here.
    expect(call.credits).toBe(12 * FRAME_COUNT);
  });

  it("animates the anchor frame at the chosen length", () => {
    const anchor = "https://a.test/anchor.png";
    const call = compileMotion(spec({ duration: 10, motion: "crane-up" }), anchor);

    expect(call.modelId).toBe("ltx-i2v");
    expect(call.params.image_url).toBe(anchor);
    expect(call.params.duration).toBe(10);
    expect(call.params.aspect_ratio).toBe("16:9");
    expect(call.credits).toBe(33);
  });

  it("refuses an anchor that is not a URL", () => {
    expect(() => compileMotion(spec(), "not-a-url")).toThrow();
  });
});

/* ---------------------------------------------------------------- schema */

describe("the spec schema", () => {
  it("rejects an option that is not in the catalogue", () => {
    expect(() => spec({ motion: "teleport" })).toThrow();
    expect(() =>
      cinemaSpecSchema.parse({
        ...defaultSpec(),
        rig: { ...defaultSpec().rig, lens: "kaleidoscope" },
      }),
    ).toThrow();
  });

  it("rejects an unsupported clip length", () => {
    expect(() => spec({ duration: 7 })).toThrow();
  });

  it("caps references at four", () => {
    const urls = Array.from({ length: MAX_REFERENCES + 1 }, (_, i) => `https://a.test/${i}.png`);
    expect(() => spec({ scene: { text: SCENE, referenceUrls: urls } })).toThrow();
  });

  it("wants a scene worth compiling", () => {
    expect(() => spec({ scene: { text: "hi", referenceUrls: [] } })).toThrow();
  });
});

describe("the saved step", () => {
  it("only moves forward", () => {
    // Stepping back to re-read the rig must not throw away the fact that four
    // frames already exist.
    expect(furthestStep("frames", "scene")).toBe("frames");
    expect(furthestStep("scene", "frames")).toBe("frames");
    expect(furthestStep("result", "motion")).toBe("result");
    expect(furthestStep("motion", "result")).toBe("result");
  });

  it("ranks every step in panel order", () => {
    const ranks = CINEMA_STEPS.map((entry) => stepRank(entry.id));
    expect(ranks).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("the draft schema", () => {
  it("opens a sequence whose lens has since been retired", () => {
    const saved = { ...defaultSpec(), rig: { ...defaultSpec().rig, lens: "kaleidoscope" } };
    const draft = readDraft(saved);

    expect(draft.rig.lens).toBe(CINEMA.lenses[0].id);
    expect(draft.rig.camera).toBe(saved.rig.camera);
  });

  it("reads an empty column as a fresh panel", () => {
    expect(readDraft({})).toEqual(defaultSpec());
    expect(readDraft(null)).toEqual(defaultSpec());
  });

  it("is not runnable until there is a scene", () => {
    expect(toRunnable(readDraft({}))).toBeNull();
    expect(toRunnable(readDraft({ scene: { text: SCENE, referenceUrls: [] } }))).not.toBeNull();
  });
});

describe("describeRig", () => {
  it("reads as a slate line", () => {
    expect(describeRig(defaultSpec().rig)).toBe(
      "Large Format Digital · Spherical Prime 14mm · f/1.4",
    );
  });
});
