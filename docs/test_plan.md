# Test Plan – Codex Progress Bar Card

## 1. Functional Tests
- [ ] Visual loads without errors
- [ ] Visual renders with sample data
- [ ] Visual handles empty data gracefully
- [ ] All format pane options apply correctly
- [ ] Selection / cross-filter works (if applicable)
- [ ] Tooltips appear on hover

## 2. Performance Tests
- [ ] update() completes < 250ms
- [ ] No memory leaks
- [ ] Bundle size < 2.5 MB

## 3. Accessibility Tests
- [ ] Keyboard navigation works
- [ ] High contrast mode supported
- [ ] ARIA labels present
- [ ] No flashing content

## 4. Security Tests
- [ ] No external network calls
- [ ] No telemetry
- [ ] No external scripts or fonts
- [ ] No DOM escape or eval

## 5. Packaging Tests
- [ ] pbiviz builds successfully
- [ ] Bundle size < 2.5 MB
- [ ] capabilities.json valid

## 6. Sample PBIX Verification
- [ ] Demonstrates all features
- [ ] Demonstrates formatting options
- [ ] Demonstrates interactions

## 7. Background Transparency (TRANS-01, Phase 1 Plan 06)
- [ ] Format pane → Background card: set a non-white colour, drag Transparency 0 → 50 → 100 over a NON-WHITE report canvas
- [ ] Transparency 0%: outer container renders fully opaque
- [ ] Transparency 50%: outer container blends visibly with the canvas behind it, no opaque halo/box around the visual edges
- [ ] Transparency 100%: canvas shows through cleanly, rows/bars/labels remain legible
- [ ] Confirm the container transparency does NOT bleed into or override the existing per-row Row Background (Bar Settings card) or per-bar Track Colour — set a distinct Row Background colour and verify it still renders on top of the transparent container
- [ ] High contrast mode: container renders with no custom colour/transparency applied (short-circuit preserved) — system background used instead
- [ ] An old saved .pbix (pre-upgrade, Background properties absent) renders fully transparent/unchanged from its pre-upgrade appearance (container never painted a background before this plan) — no regression

## 8. Conditional Formatting / fx (TRANS-04, Phase 1 Plan 06)
- [ ] Set Zone Settings → Colour Mode to "Fixed"
- [ ] Fixed Colour swatch (Zone Settings card) shows a working fx button in the format pane
- [ ] Bind a measure, open the fx rule editor, set a rule (e.g. gradient by value)
- [ ] Each row's bar fill colour changes according to the rule as that row's bound measure value changes
- [ ] Removing the rule reverts all rows to the static Fixed Colour swatch setting
- [ ] Switching Colour Mode back to "Zoned" leaves the Safe/Warning/Danger threshold colours unaffected by the fx rule