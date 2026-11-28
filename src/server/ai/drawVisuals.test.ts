import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleVisuals } from "@/content/visuals/samples";

const calls: { content: string }[] = [];
let replies: { pictures: { key: string; scene: string | null }[] }[] = [];
vi.mock("./client", () => ({
  generateStructured: vi.fn(async (opts: { messages: { content: string }[] }) => {
    calls.push({ content: opts.messages[0]!.content });
    return replies.shift();
  }),
}));

const { drawVisuals } = await import("./drawVisuals");

const good = JSON.stringify(sampleVisuals[0]!.scene);
const bad = JSON.stringify({ ...sampleVisuals[0]!.scene, size: [900, 900] });
const item = (key: string) => ({ key, kind: "question" as const, prompt: `Prompt ${key}`, options: [], answer: "36°", explanation: "Because." });
const input = { audience: "parent" as const, trackName: "Physics: Light", level: "Class 10", items: [item("Q1"), item("Q2"), item("Q3")] };

beforeEach(() => {
  calls.length = 0;
});

describe("drawVisuals (AI §8)", () => {
  it("keeps checked scenes, asks again once for the failing ones only, and leaves the rest without a picture", async () => {
    replies = [
      { pictures: [{ key: "Q1", scene: good }, { key: "Q2", scene: bad }, { key: "Q3", scene: null }] },
      { pictures: [{ key: "Q2", scene: good }] },
    ];
    const out = await drawVisuals(input);
    expect(out.get("Q1")).toEqual(sampleVisuals[0]!.scene);
    expect(out.get("Q2")).toEqual(sampleVisuals[0]!.scene);
    expect(out.get("Q3")).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.content).toContain('key="Q2"');
    expect(calls[1]!.content).not.toContain('key="Q1"');
    expect(calls[1]!.content).toContain("size must be 200–600 wide");
  });

  it("gives no picture when the retry still fails, and ignores unknown keys", async () => {
    replies = [{ pictures: [{ key: "Q1", scene: "{not json" }, { key: "Q9", scene: good }] }, { pictures: [{ key: "Q1", scene: bad }] }];
    const out = await drawVisuals(input);
    expect([...out.values()]).toEqual([null, null, null]);
    expect(out.has("Q9")).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("makes one call when every scene passes", async () => {
    replies = [{ pictures: [{ key: "Q1", scene: null }, { key: "Q2", scene: good }, { key: "Q3", scene: null }] }];
    await drawVisuals(input);
    expect(calls).toHaveLength(1);
  });
});
