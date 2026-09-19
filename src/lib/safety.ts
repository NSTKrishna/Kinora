/**
 * A deliberately small pre-check that runs before we spend anything.
 *
 * This is not content moderation — the provider does that, and its verdict maps
 * to the job's `nsfw` status. This only catches the obvious cases early so a
 * clearly disallowed prompt never reaches a paid API or charges a user.
 */

const BLOCKED = [
  // Sexual content involving minors — never, under any phrasing.
  /\b(child|minor|underage|teen|preteen|toddler|infant)\b[^.]{0,40}\b(nude|naked|nsfw|sexual|porn|erotic)\b/i,
  /\b(nude|naked|nsfw|sexual|porn|erotic)\b[^.]{0,40}\b(child|minor|underage|teen|preteen|toddler)\b/i,
  // Sexual imagery of a named real person.
  /\b(nude|naked|topless|porn)\b[^.]{0,30}\b(celebrity|politician|actress|actor)\b/i,
  // Graphic gore.
  /\b(beheading|dismember(ed|ment)|mutilat(e|ed|ion))\b/i,
];

export type SafetyVerdict = { ok: true } | { ok: false; reason: string };

export function checkPrompt(prompt: string): SafetyVerdict {
  for (const pattern of BLOCKED) {
    if (pattern.test(prompt)) {
      return {
        ok: false,
        reason: "That prompt is outside what Kinora will generate. Nothing was charged.",
      };
    }
  }
  return { ok: true };
}
