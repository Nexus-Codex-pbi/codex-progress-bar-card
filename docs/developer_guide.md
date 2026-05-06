# Developer Guide – Codex Progress Bar Card

## 1. Architecture
- File structure: `src/visual.ts`, `src/settings.ts`, `style/visual.less`, `capabilities.json`, `pbiviz.json`
- Rendering model: DOM built once in constructor; `update()` mutates only existing elements.

## 2. Capabilities
- Data roles: 
   - category (Grouping)
   - currentValue (Measure)
   - maxValue (Measure)
   - label (Measure)
   - sortOrder (Measure)
- Format pane cards: barSettings, zoneSettings, valueSettings, axisSettings
- supportsHighlight, supportsKeyboardFocus, supportsLandingPage, supportsEmptyDataView, supportsMultiVisualSelection: all true.

## 3. APIs Used
- ISelectionManager — cross-filter + context menu
- ITooltipService — hover tooltips
- ILocalizationManager — string resources
- ISandboxExtendedColorPalette — high-contrast detection (via host.colorPalette)

## 4. Performance
- update() target: < 250ms
- No infinite loops or heavy timers
- DOM minimal — element refs cached on construction

## 5. Accessibility
- ARIA labels on interactive elements (rows are focusable via selection manager)
- High contrast support via `colorPalette.isHighContrast` (foreground/background colours adapt)
- Keyboard focus on tabbable elements (container is focusable and handles Enter/Space for click, Shift+F10 for context menu)

## 6. Security
- No external calls
- No telemetry
- No external scripts or fonts
- No eval() or dynamic code

## 7. Build & Packaging
- powerbi-visuals-tools 7.x
- Node 20
- TypeScript 5.5+
- `npm install && pbiviz package`
- Output: `.pbiviz` < 2.5 MB