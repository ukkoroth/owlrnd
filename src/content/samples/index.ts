import type { SampleTrack } from "@/domain/sampleBank";
import { solarSystem } from "./solarSystem";

/** Sample tracks a learner can add in one tap (owner, 2026-11-18). One for now. */
export const SAMPLE_TRACKS: Record<string, SampleTrack> = { [solarSystem.key]: solarSystem };
export const DEFAULT_SAMPLE = solarSystem.key;

export const sampleTrack = (key: string | null | undefined): SampleTrack | null => (key ? (SAMPLE_TRACKS[key] ?? null) : null);
