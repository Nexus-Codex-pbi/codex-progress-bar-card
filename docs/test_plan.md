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

## 9. Visual Title (TITLE-01)
- [ ] Title card appears in the format pane ("Visual Title") with Show Title (off by default), Title Text, Font, Alignment, Font Color
- [ ] Show Title off (default) renders no title text and reserves no extra vertical space — old saved report (no title properties set) is pixel-identical to pre-upgrade (D-06)
- [ ] Show Title on + Title Text set renders the title as an in-flow div above the row list, painted on the outer container layer only (never conflated with Row Background or Track Colour, T-06-01)
- [ ] Title renders correctly in BOTH List layout and Grid layout — in Grid layout the title spans the full width as its own row, never squeezed into a single grid cell
- [ ] Title Font (family/size/bold/italic/underline) and Alignment (left/center/right) apply correctly
- [ ] Title Font Color applies; high contrast mode overrides to the theme foreground colour
- [ ] Title also renders correctly on the empty-state (no data bound) view

## 10. Per-Surface Text Treatment (TEXT-01)
- [ ] Category label: new Font control (Family/Bold/Italic/Underline, reusing existing Category Font Size incl. its "0 = use main font size" convention) applies; Bold off (default) renders the pre-existing CSS-hardcoded font-weight 600
- [ ] Values/percentage text: new Font control (Family/Bold/Italic/Underline, reusing existing Values Font Size incl. its "0 = use main font size" convention) applies; Bold off (default) renders the pre-existing unset/normal weight
- [ ] Optional label (subtitle) text: brand-new dedicated Font+Color card (Family/Size/Bold/Italic/Underline) — Font Size "0 = use the pre-existing derived size" (Values Font Size − 2, clamped to 9px minimum) preserves prior behaviour at default; overriding it decouples the subtitle size from the values size (documented behaviour change)
- [ ] All three surfaces render correctly in both List and Grid layouts

## 11. Text-Colour fx (TEXT-02)
- [ ] fx button appears next to Values Color swatch in the format pane (Value Settings card)
- [ ] Binding a measure to a conditional formatting rule on Values Color changes the values/percentage text colour per row
- [ ] Rows without a rule fall back to the static Values Color swatch value
- [ ] Fixed Colour fx (pre-existing from TRANS-04, bar FILL colour) continues to work unchanged, distinct from the new values-text-colour fx

## 12. Render-Nothing Defaults (D-06)
- [ ] Old saved report with none of the new title/font/alignment properties set renders pixel-identical to pre-upgrade: no title, category label at weight 600, values/label text at normal weight, subtitle at the derived Values Font Size − 2 size, all at prior default colours