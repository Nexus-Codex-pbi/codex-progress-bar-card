# Codex Progress Bar Card — Cert Notes (resubmission wave, Phase 01)

**Version:** 1.0.0.10 (visual.version) · production GUID unchanged (`codexProgressBarCard…`) · API 5.11.0 / pbiviz 7.0.2 (pinned).

One-wave AppSource resubmission carrying the transparency/formatting rework **and** the v2 appearance redesign. Partner Center re-evaluates the whole package (Pitfall 6).

## Transparency wave (Plans 06–08)
- New **Background** card: `ColorPicker` fill + 0–100 `transparency` slider via `hexToRGBString`. Additive.
- fx conditional formatting wired on eligible colour properties.

## Title + per-region text wave (Plan 12)
- Title + per-region text treatment reworked with adaptive text colour.

## v2 Appearance wave (Plan 16)
- Every row's track scales to 120% so the violet target tick sits visibly **in-track** (never at the edge); fill crossing the tick brightens toward white via `accentBarGradient`/`mix`.
- **Zoned colour mode** now reads the shared `band(value,target)` ratio law (≥100% success, ≥90% warning, else danger) against the **existing** Safe/Warning/Danger colour pickers (colours honoured, D-16). The legacy `safeMax`/`warningMax` percentage-of-max NumUpDown thresholds are superseded by this shared law under the v2 default and are now inert — they remain in the format pane (zero removal) but no longer drive the render path (documented bounded deviation). Fixed colour mode is untouched.
- **New optional Quantised (LED) Mode:** +1 additive `capabilities.json` property (`barSettings.quantisedMode`, boolean, default OFF) rendering 24 discrete blocks — a real user choice, not a forced default.
- List-layout chrome: cyan corner-bracket signature, "Segment / Actual-target" header row, faint 0–120% vertical gridlines, "% OF TARGET" axis caption; percentage settles via `motion.ts`. (Grid layout keeps its existing per-row mini-card look; band-tint/target-tick/overflow/quantised still apply to each row's track in both layouts.)

## High-contrast rule
Shared HC rule wired (`src/shared/highContrast.ts`) with a status glyph.

## Pending fixes riding this wave
None outstanding (PENDING-FIXES: nothing pending).
