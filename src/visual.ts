"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { VisualFormattingSettingsModel, alignSelfFor, textAlignFor } from "./settings";
import { toRgba, compositeOver, surfaceTone } from "./shared/colorHelpers";
import { clamp, safeNumber, CODEX_TOKENS } from "./utils";

// v3 appearance engine (frozen, Plan 15) — the KPI-family v2 look.
// `band()` itself is deliberately NOT imported: this visual judges a row with
// zoneBand() below, which honours the exposed thresholds and the Goal/Limit
// meaning (NEXUS cycle-10 §1). The Band type and the shared colour tokens are
// unchanged.
import { Band, Theme, bandColor, targetToken } from "./shared/bandEngine";
import { surfaceTokens, mix, accentBarGradient, TABULAR_NUMS } from "./shared/designTokens";
import { applyBorder } from "./shared/borderSettings";
import { makeCornerBrackets, CardSignatureHandle } from "./shared/cardSignature";
import { applyCardSignature } from "./shared/cardSignatureSettings";
import { settle } from "./shared/motion";
import { applyHighContrast, statusGlyph } from "./shared/highContrast";
import { LicenseGate } from "./shared/licensing";
import { formatModelNumber } from "./shared/numberFormat";

/** Parsed row data for a single progress bar */
interface BarRow {
    category: string;
    currentValue: number;
    maxValue: number;
    currentFormat: string | undefined;
    maxFormat: string | undefined;
    label: string | null;
    sortOrder: number | null;
    selectionId: ISelectionId | null;
    /** The per-instance object overrides (fx / "set for this row" swatches)
     *  belonging to THIS category, captured at parse time from
     *  `categories.objects[i]`. Carried on the row so a later sort or a
     *  skipped row can never re-key a conditional colour by display
     *  position (NEXUS cycle-10 §2). */
    objects: powerbi.DataViewObjects | undefined;
}

// v2 board look (Codex Progress Bar Card v2.dc.html): the track scale runs
// to 120% so the shared violet target token sits IN-track (never at the
// edge), and value past target physically crosses it, brightening as it
// goes. TICK_PCT is the fixed left-offset (as a % of track width) at which
// "100% of target" sits — the SAME position on every row, because each
// row's own value is normalised against its OWN target.
const SCALE = 120;
const TICK_PCT = (100 / SCALE) * 100; // 83.33%
// The widest ratio the 96px value column can show as an exact number. Past
// it the label reads as a BOUND (">999%"), never as an exact figure the data
// never had — see the pctText derivation in renderRow (NEXUS cycle-10 §4).
const PCT_DISPLAY_LIMIT = 999;
const QUANTISED_BLOCKS = 24;
const GRID_TEMPLATE = "90px 1fr 96px";

// Luminance-based theme pick now comes from the shared surfaceTone() helper
// (src/shared/colorHelpers.ts) — same Rec.601 weights and same 0.55
// threshold this file used locally, so opaque surfaces resolve identically.
// The local themeFor() is gone because its `visible=false -> dark` branch
// was the class-1 defect in miniature: it judged ink from a surface the
// viewer never sees (NEXUS cycle-10 §6).

export class Visual implements IVisual {
    private target: HTMLElement;
    private container: HTMLDivElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private events: IVisualEventService;
    private localizationManager: ILocalizationManager;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private isHighContrast: boolean = false;
    private colorPalette: ISandboxExtendedColorPalette;

    // State for the Fixed Colour fx wiring (TRANS-04) — per-row selectionIds
    // AND the per-instance object overrides are both carried on BarRow
    // (BarRow.objects, captured in parseData while the raw category index
    // is still valid), so nothing here keys off a display position.
    private fixedColorHelper: ColorHelper | null = null;
    // fx (TEXT-02) state — Values/percentage label colour
    private valuesColorHelper: ColorHelper | null = null;
    private layoutMode: string = "list";
    private themeBaseHex: string = "#ffffff";

    // v3 card signature — one corner-bracket pair for the whole card
    // (the board tints it with the brand cyan accent, not a per-row band —
    // §4/§2: the target token and the accent token are distinct signals).
    private cornerSignature: CardSignatureHandle | null = null;

    // v3 motion — only re-settles a row's value text when it changes,
    // tracked per category so a full-rebuild render (this.container is
    // cleared and rebuilt every update()) doesn't replay every row.
    private lastPctByCategory: Map<string, string> = new Map();

    private licenseGate: LicenseGate;

    private lastUpdateOptions: VisualUpdateOptions | null = null;


    constructor(options: VisualConstructorOptions) {

        // NO FREE TIER — an unlicensed user gets the whole visual blocked.

        // The check is async, so re-run the last update once it resolves.

        this.licenseGate = new LicenseGate(options.host, () => {

            if (this.lastUpdateOptions) this.update(this.lastUpdateOptions);

        });
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.host = options.host;
        this.events = options.host.eventService;
        this.localizationManager = options.host.createLocalizationManager();
        this.selectionManager = options.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.colorPalette = options.host.colorPalette as ISandboxExtendedColorPalette;

        // Context menu on right-click
        this.target.addEventListener("contextmenu", (e: MouseEvent) => {
            this.selectionManager.showContextMenu({}, { x: e.clientX, y: e.clientY });
            e.preventDefault();
        });

        // Create scrollable container
        this.container = document.createElement("div");
        this.container.className = "progress-bar-card-container";
        this.container.style.position = "relative";
        this.target.appendChild(this.container);

        // Corner-bracket card signature — accent-tinted (not band-tinted;
        // the accent cyan is the card's own identity, distinct from any
        // row's status band), appended last so it paints above everything.
        this.cornerSignature = makeCornerBrackets(this.container, "#00d9ff", {
            variant: "cornerBracket",
            mirror: true,
        });
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        this.lastUpdateOptions = options;

        if (this.licenseGate.blockedThisFrame()) {
            this.target.style.display = "none";
            this.events.renderingFinished(options);
            return;
        }
        this.target.style.display = "";
        try {
            // Refresh high contrast state
            this.isHighContrast = !!this.colorPalette.isHighContrast;

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews?.[0]
            );

            // ─── Dedicated background layer (D-05) ─────────────────────
            // Suite-wide shared Background card (Colour + Transparency,
            // sourced from _shared/formatting/), painted on `this.container`
            // — the outer card-list render root appended directly to
            // options.element — never on the existing per-row
            // `rowEl.style.backgroundColor` (barSettings.rowBackground) or
            // per-bar `track`/`fill` colours (T-06-01: no bleed between the
            // container layer and per-row/per-bar colour layers). Applied
            // unconditionally (before the empty-state early return) so an
            // empty-state render also honours it. Its transparency default
            // is overridden to 100 in settings.ts specifically so an OLD
            // saved report (this property never previously existed) renders
            // alpha 0 — pixel-identical to "nothing painted" (D-06) — while
            // still exposing a real, working Colour + Transparency control.
            // Preserves the existing isHighContrast short-circuit: never
            // applies the new colour/transparency when high contrast is on.
            const background = this.formattingSettings.background;
            const bgHex = background.backgroundColor.value?.value ?? "#ffffff";
            const bgTransparencyPct = background.transparency.value ?? 100;
            this.container.style.backgroundColor = this.isHighContrast
                ? ""
                : toRgba(bgHex, bgTransparencyPct);
            // Visual's own Border card (suite kit).
            applyBorder(this.container, this.formattingSettings.visualBorder, {
                hcActive: this.isHighContrast,
                hcColor: this.colorPalette?.foreground?.value,
                palette: this.host.colorPalette,
                metadataObjects: options.dataViews?.[0]?.metadata?.objects,
            });

            // Theme pick for the v3 token set — judged on the surface a
            // viewer ACTUALLY SEES (NEXUS cycle-10 §6, class 1). The
            // container paints bgHex at bgTransparencyPct; whatever shows
            // through it is the report/theme background the host reports.
            // Composite the two FIRST, then pick the tone: a user-set black
            // background at 100% transparency paints nothing, so it must not
            // drag the ink light (the old ladder trusted a USER-SET hex even
            // at full transparency and chose near-white ink over a white
            // report), and an untouched default still falls through to the
            // palette background exactly as before.
            const paletteBg = this.colorPalette?.background?.value || "#ffffff";
            const visibleSurfaceHex = compositeOver(bgHex, bgTransparencyPct, paletteBg);
            const theme: Theme = surfaceTone(visibleSurfaceHex);
            this.themeBaseHex = visibleSurfaceHex;
            const hc = applyHighContrast(this.colorPalette, { fallbackColor: "#00d9ff" });

            // Corner-bracket re-tint each update (created once in the constructor).
            applyCardSignature(this.cornerSignature, this.formattingSettings.cardSignature, {
                autoHex: "#00d9ff",
                hcActive: hc.active,
                hcColor: hc.color,
                mirror: true,
                glowMix: hc.active ? 0 : (theme === "dark" ? 55 : 0),
                muted: false,
            });

            while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
            // NOTE: the corner-bracket elements are re-appended at the very
            // end of this method (after title/rows/axis/axis-titles-wrap),
            // never here — makeCornerBrackets' own contract is "append
            // last so it paints above everything" (cardSignature.ts), and
            // clearing the container above detaches them from the DOM.

            // ─── Visual Title (iframe-internal, Policy 1180.2.5) ───────
            // Painted on the outer container layer only (T-06-01, matching
            // the Background card scope) — a plain in-flow div ahead of
            // the row list / empty state, so it appears whether or not
            // data is bound.
            this.renderTitle();

            const dataView: DataView = options.dataViews?.[0];
            if (!dataView?.categorical?.categories?.[0]?.values?.length) {
                this.renderEmptyState(hc);
                this.events.renderingFinished(options);
                return;
            }

            const rows = this.parseData(dataView);
            if (rows.length === 0) {
                this.renderEmptyState(hc);
                this.events.renderingFinished(options);
                return;
            }

            // ─── Conditional formatting (fx) wiring — Fixed Colour (TRANS-04) ──
            // The zoneSettings.fixedColor ColorPicker already carried a bare
            // `instanceKind: ConstantOrRule` declaration, but with no
            // `selector`/`altConstantSelector` wired it was inert (Pitfall
            // 5). Wired here: a dataViewWildcard selector (so a rule can
            // match this property's instances/totals) + an
            // altConstantSelector bound to the first row's selectionId (the
            // "set for all" swatch edit path), resolved per-row at render
            // via ColorHelper.getColorForMeasure against each category's own
            // per-instance object overrides (BarRow.objects, bound to the
            // row's identity in parseData) — same pattern already proven on
            // pbiTimeBreakdown's Total Colour.
            const zoneSettingsFx = this.formattingSettings.zoneSettingsCard;
            zoneSettingsFx.fixedColor.selector = dataViewWildcard.createDataViewWildcardSelector(
                dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals
            );
            zoneSettingsFx.fixedColor.altConstantSelector = undefined; // card-level constant persistence: swatch edits apply to ALL instances + round-trip into the pane (first-instance binding persisted a row-0-only override); fx rules stay per-instance via the wildcard selector;
            this.fixedColorHelper = new ColorHelper(
                this.host.colorPalette,
                { objectName: "zoneSettings", propertyName: "fixedColor" },
                zoneSettingsFx.fixedColor.value.value
            );

            // ─── Conditional formatting (fx) wiring — Values/Percentage
            // Label Colour (TEXT-02). Same wildcard-selector +
            // altConstantSelector + ColorHelper.getColorForMeasure pattern
            // as Fixed Colour above, resolved per-row against each
            // category's own per-instance object overrides.
            const valueSettingsFx = this.formattingSettings.valueSettingsCard;
            valueSettingsFx.valuesColor.selector = dataViewWildcard.createDataViewWildcardSelector(
                dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals
            );
            valueSettingsFx.valuesColor.altConstantSelector = undefined; // card-level constant persistence: swatch edits apply to ALL instances + round-trip into the pane (first-instance binding persisted a row-0-only override); fx rules stay per-instance via the wildcard selector;
            this.valuesColorHelper = new ColorHelper(
                this.host.colorPalette,
                { objectName: "valueSettings", propertyName: "valuesColor" },
                valueSettingsFx.valuesColor.value.value
            );

            const barSettings = this.formattingSettings.barSettingsCard;
            const layout = barSettings.layout.value?.value || "list";
            this.layoutMode = layout as string;
            const quantised = !!barSettings.quantisedMode?.value;

            // Set layout class
            this.container.className = layout === "grid"
                ? "progress-bar-card-container layout-grid"
                : "progress-bar-card-container layout-list";

            // Adjust grid columns based on viewport width
            if (layout === "grid") {
                const width = options.viewport.width;
                const userCols = barSettings.gridColumns?.value ?? 0;
                const cols = userCols > 0
                    ? Math.min(6, Math.max(1, Math.round(userCols)))
                    : (width >= 800 ? 3 : width >= 480 ? 2 : 1);
                this.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            } else {
                this.container.style.gridTemplateColumns = "";
            }

            // ─── v2 header row (list layout only): "Segment" / "Actual /
            // target" captions above the row list, matching the board's
            // .prow.phead — the design's own "axis + titles" ask. Skipped
            // in grid layout, which has no equivalent in the design board
            // (each row is already its own mini-card there).
            if (layout === "list") {
                this.container.appendChild(this.renderHeaderRow(theme, hc.active ? hc.color : null));
            }

            // ─── Row list, with a shared position:relative wrapper so the
            // v2 vertical gridlines overlay (list layout only) can sit
            // BEHIND every row's (opaque) track. ─────────────────────────
            const rowsWrap = document.createElement("div");
            rowsWrap.style.position = "relative";
            if (layout === "grid") {
                rowsWrap.style.display = "contents";
            }

            if (layout === "list") {
                rowsWrap.appendChild(this.renderGridlines(theme));
            }

            for (const row of rows) {
                rowsWrap.appendChild(this.renderRow(row, theme, hc, quantised));
            }
            this.container.appendChild(rowsWrap);

            // ─── v2 numeric axis (list layout only): tick labels + "% of
            // target" caption under the row list, aligned to the same
            // 90px/1fr/96px column grid as every row. ───────────────────
            if (layout === "list") {
                this.container.appendChild(this.renderAxisRow(theme));
                this.container.appendChild(this.renderAxisCaption(theme, hc.active ? hc.color : null));
            }

            // Axis titles
            const axisSettings = this.formattingSettings.axisSettingsCard;
            const showAxisTitles = axisSettings.showAxisTitles.value;
            const xAxisTitle = axisSettings.xAxisTitle.value || "";
            const yAxisTitle = axisSettings.yAxisTitle.value || "";

            if (showAxisTitles && (xAxisTitle || yAxisTitle)) {
                const baseFontSize = this.formattingSettings.valueSettingsCard.fontSize.value || 12;
                const axisTitleFontSize = baseFontSize + 2;
                const hcFg = this.isHighContrast ? this.colorPalette.foreground.value : null;
                // Adaptive ink, same law as the category/values text: the
                // #1a1a1a literal stayed dark-on-dark on a dark report
                // (NEXUS cycle-10 §6). High contrast still wins outright.
                const titleColor = hcFg || (theme === "dark" ? surfaceTokens("dark").text : "#1a1a1a");

                // Wrap existing content for Y axis title
                if (yAxisTitle) {
                    const existingChildren = Array.from(this.container.children);
                    const wrapper = document.createElement("div");
                    wrapper.style.display = "flex";
                    wrapper.style.flexDirection = "row";
                    wrapper.style.alignItems = "stretch";
                    wrapper.style.width = "100%";
                    wrapper.style.height = "100%";

                    const yTitleEl = document.createElement("div");
                    yTitleEl.style.display = "flex";
                    yTitleEl.style.alignItems = "center";
                    yTitleEl.style.justifyContent = "center";
                    yTitleEl.style.writingMode = "vertical-rl";
                    yTitleEl.style.transform = "rotate(180deg)";
                    yTitleEl.style.fontSize = axisTitleFontSize + "px";
                    yTitleEl.style.fontWeight = "600";
                    yTitleEl.style.color = titleColor;
                    yTitleEl.style.fontFamily = "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
                    yTitleEl.style.paddingRight = "6px";
                    yTitleEl.textContent = yAxisTitle;
                    wrapper.appendChild(yTitleEl);

                    const innerContainer = document.createElement("div");
                    innerContainer.style.flex = "1";
                    innerContainer.style.minWidth = "0";
                    innerContainer.style.overflow = "auto";
                    for (const child of existingChildren) {
                        innerContainer.appendChild(child);
                    }
                    wrapper.appendChild(innerContainer);
                    this.container.appendChild(wrapper);
                }

                if (xAxisTitle) {
                    const xTitleEl = document.createElement("div");
                    xTitleEl.style.textAlign = "center";
                    xTitleEl.style.fontSize = axisTitleFontSize + "px";
                    xTitleEl.style.fontWeight = "600";
                    xTitleEl.style.color = titleColor;
                    xTitleEl.style.fontFamily = "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
                    xTitleEl.style.paddingTop = "6px";
                    xTitleEl.textContent = xAxisTitle;
                    this.container.appendChild(xTitleEl);
                }
            }

            // Corner-bracket card signature — appended LAST, after title/
            // header/rows/axis/axis-titles-wrap, so it always paints above
            // (cardSignature.ts contract).
            this.cornerSignature?.elements.forEach((el) => this.container.appendChild(el));

            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
    }

    /** Render the shared Visual Title (D-14) as a plain in-flow div ahead
     *  of the row list / empty state. Painted on `this.container` only
     *  (T-06-01 — same layer scope as the Background card, never
     *  conflated with per-row/per-bar colours). No-op (renders nothing)
     *  when Show Title is off or Title Text is empty (D-06). */
    private renderTitle(): void {
        const t = this.formattingSettings.titleSettings;
        if (!t?.showTitle?.value || !t?.titleText?.value) return;

        const titleAlignVal = String((t as any).titleAlign?.value || "left");
        const titleEl = document.createElement("div");
        titleEl.className = "progress-bar-card-title";
        titleEl.textContent = String(t.titleText.value);
        if (t.titleFontFamily?.value) titleEl.style.fontFamily = t.titleFontFamily.value;
        if (t.titleFontSize?.value) titleEl.style.fontSize = `${t.titleFontSize.value}px`;
        titleEl.style.fontWeight = t.titleBold?.value ? "700" : "400";
        titleEl.style.fontStyle = t.titleItalic?.value ? "italic" : "normal";
        titleEl.style.textDecoration = t.titleUnderline?.value ? "underline" : "none";
        titleEl.style.alignSelf = alignSelfFor(titleAlignVal);
        titleEl.style.textAlign = textAlignFor(titleAlignVal);
        if (t.titleColor?.value?.value) {
            // Adaptive default (D-16 sentinel): untouched shared-Title navy
            // swaps to the dark text token on dark surfaces.
            const setTitle = t.titleColor.value.value;
            const adaptiveTitle = setTitle === "#1a1a2e" && surfaceTone(this.themeBaseHex) === "dark"
                ? surfaceTokens("dark").text : setTitle;
            titleEl.style.color = this.isHighContrast ? this.colorPalette.foreground.value : adaptiveTitle;
        }
        titleEl.style.padding = "8px 10px 0";
        // Grid layout mode sets `display:grid` directly on this.container
        // (see barSettings.layout === "grid" in update()) — span all
        // columns so the title renders as its own full-width row instead
        // of being squeezed into a single grid cell alongside the bars.
        // No-op (ignored) when layout is "list" (flex/block, not grid).
        titleEl.style.gridColumn = "1 / -1";
        this.container.appendChild(titleEl);
    }

    /** v2 header row (list layout): "Segment" / "Actual / target" captions,
     *  aligned to the same 90px/1fr/96px grid as every row (board's
     *  .prow.phead). Text colour follows the muted token, HC-routed. */
    private renderHeaderRow(theme: Theme, hcColor: string | null): HTMLElement {
        const row = document.createElement("div");
        row.className = "pbc-phead";
        row.style.display = "grid";
        row.style.gridTemplateColumns = GRID_TEMPLATE;
        row.style.gap = "14px";
        row.style.alignItems = "end";
        row.style.marginBottom = "10px";

        const muted = hcColor || surfaceTokens(theme).muted;

        const segLabel = document.createElement("span");
        segLabel.textContent = "Segment";
        segLabel.style.fontSize = "10px";
        segLabel.style.fontWeight = "700";
        segLabel.style.letterSpacing = "0.12em";
        segLabel.style.textTransform = "uppercase";
        segLabel.style.color = muted;
        segLabel.style.opacity = "0.85";
        segLabel.style.textAlign = "right";
        row.appendChild(segLabel);

        row.appendChild(document.createElement("span"));

        const valLabel = document.createElement("span");
        valLabel.textContent = "Actual / target";
        valLabel.style.fontSize = "10px";
        valLabel.style.fontWeight = "700";
        valLabel.style.letterSpacing = "0.12em";
        valLabel.style.textTransform = "uppercase";
        valLabel.style.color = muted;
        valLabel.style.opacity = "0.85";
        valLabel.style.textAlign = "right";
        valLabel.style.paddingRight = "10px";
        valLabel.style.boxSizing = "border-box";
        row.appendChild(valLabel);

        return row;
    }

    /** v2 vertical gridlines (list layout): faint lines at each 20%-of-
     *  target tick, spanning the row list's track column only. Appended
     *  BEHIND the row elements so each row's own (opaque) track paints
     *  over the segment where a bar sits — the gridline only reads in the
     *  gaps, matching the board. */
    private renderGridlines(theme: Theme): HTMLElement {
        const overlay = document.createElement("div");
        overlay.style.position = "absolute";
        overlay.style.left = "104px"; // 90px label col + 14px gap
        overlay.style.right = "110px"; // 96px value col + 14px gap
        overlay.style.top = "0";
        overlay.style.bottom = "0";
        overlay.style.pointerEvents = "none";

        const border = surfaceTokens(theme).border;
        for (let v = 0; v <= SCALE; v += 20) {
            const line = document.createElement("div");
            line.style.position = "absolute";
            line.style.top = "0";
            line.style.bottom = "0";
            line.style.left = `${(v / SCALE) * 100}%`;
            line.style.width = "1px";
            line.style.background = border;
            line.style.opacity = "0.7";
            overlay.appendChild(line);
        }
        return overlay;
    }

    /** v2 numeric axis row (list layout): tick labels 0/20/40/.../120,
     *  aligned to the same column grid as the gridlines above. */
    private renderAxisRow(theme: Theme): HTMLElement {
        const row = document.createElement("div");
        row.style.position = "relative";
        row.style.margin = "8px 110px 0 104px";
        row.style.height = "16px";

        const muted = surfaceTokens(theme).muted;
        for (let v = 0; v <= SCALE; v += 20) {
            const label = document.createElement("span");
            label.textContent = String(v);
            label.style.position = "absolute";
            label.style.left = `${(v / SCALE) * 100}%`;
            label.style.transform = "translateX(-50%)";
            label.style.fontSize = "10.5px";
            label.style.fontWeight = "600";
            label.style.color = muted;
            label.style.fontFeatureSettings = TABULAR_NUMS;
            row.appendChild(label);
        }
        return row;
    }

    /** v2 axis caption ("% of target"), HC-routed. */
    private renderAxisCaption(theme: Theme, hcColor: string | null): HTMLElement {
        const cap = document.createElement("div");
        cap.textContent = "% OF TARGET";
        cap.style.textAlign = "center";
        cap.style.margin = "2px 110px 0 104px";
        cap.style.fontSize = "10.5px";
        cap.style.fontWeight = "700";
        cap.style.letterSpacing = "0.1em";
        cap.style.color = hcColor || surfaceTokens(theme).muted;
        return cap;
    }

    /** Parse the categorical dataView into typed row objects */
    private parseData(dataView: DataView): BarRow[] {
        const categorical = dataView.categorical;
        const catColumn = categorical.categories[0];
        const categories = catColumn.values;
        const valueColumns = categorical.values || [];

        // Find column indices by role
        let currentValueCol: powerbi.DataViewValueColumn | null = null;
        let maxValueCol: powerbi.DataViewValueColumn | null = null;
        let labelCol: powerbi.DataViewValueColumn | null = null;
        let sortOrderCol: powerbi.DataViewValueColumn | null = null;

        for (const col of valueColumns) {
            const roles = col.source.roles;
            if (roles["currentValue"]) currentValueCol = col;
            if (roles["maxValue"]) maxValueCol = col;
            if (roles["label"]) labelCol = col;
            if (roles["sortOrder"]) sortOrderCol = col;
        }

        if (!currentValueCol || !maxValueCol) {
            return [];
        }

        const rows: BarRow[] = [];
        for (let i = 0; i < categories.length; i++) {
            const current = safeNumber(currentValueCol.values[i]);
            const max = safeNumber(maxValueCol.values[i]);

            // A non-positive maximum has no meaningful ratio. It used to be
            // accepted: 50/-100 rendered "0%" in the SUCCESS colour and
            // -50/-100 rendered "50%" in the success colour, because the
            // shared band() reads a non-positive target as "met". This visual
            // has no negative-domain design — inventing one is a product
            // decision, not a render fix — so the row is rejected exactly as
            // a zero maximum already was (NEXUS cycle-10 §4).
            if (current === null || max === null || !(max > 0)) continue;

            const labelValue = labelCol ? labelCol.values[i] : null;
            const sortValue = sortOrderCol ? safeNumber(sortOrderCol.values[i]) : null;

            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(catColumn, i)
                .createSelectionId();

            rows.push({
                category: String(categories[i] ?? ""),
                currentValue: current,
                maxValue: max,
                currentFormat: currentValueCol.source.format,
                maxFormat: maxValueCol.source.format,
                label: labelValue != null ? String(labelValue) : null,
                // NB: no `percentage` field. It used to hold
                // clamp((current/max)*100, 0, 100) and was read by nothing —
                // the row's percentage TEXT is derived truthfully at render
                // time (§4) and the bar's geometry clamps separately. Leaving
                // a pre-clamped 0-100 number on the row invited a future
                // reader to render the lie again, so the field is gone
                // rather than merely unclamped.
                sortOrder: sortValue,
                selectionId,
                // Bind the per-instance overrides to the row's own identity
                // HERE, while `i` still indexes the raw category column —
                // after the sort below (or after a skipped row) the render
                // position no longer matches this index (§2).
                objects: catColumn.objects?.[i]
            });
        }

        // Sort by sortOrder ascending if any row has a sort order value
        const hasSortOrder = rows.some(r => r.sortOrder !== null);
        if (hasSortOrder) {
            rows.sort((a, b) => {
                const aVal = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
                const bVal = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
                return aVal - bVal;
            });
        }

        return rows;
    }

    /**
     * zoneBand(current, max, zoneSettings): the Zoned colour law.
     *
     * Replaces the shared `band(value, target)` call for this visual, which
     * hard-coded both the boundaries (90 / 100) and the direction, leaving
     * the exposed "Upper/Lower Threshold (%)" controls inert (NEXUS cycle-10
     * §1). Here the thresholds ARE the boundaries and `maxValueMeaning`
     * states the direction:
     *
     *   Goal  (default) — higher is better. >= upper -> success,
     *                     >= lower -> warning, else danger.
     *   Limit           — Max is a ceiling. >= upper -> danger,
     *                     >= lower -> warning, else success.
     *
     * The two modes are exact mirrors of one another over the same two
     * numbers. With the shipped defaults (upper 100, lower 90) Goal is the
     * law this visual already renders, so an untouched report is unchanged;
     * Limit is what a rated-capacity story needs, so 224/200 reads danger
     * instead of the success colour.
     *
     * A row only reaches this method with a finite current and a max > 0
     * (parseData rejects the rest, §4), so there is no non-positive-target
     * special case to make here. Non-finite threshold input falls back to
     * the shipped defaults rather than poisoning the comparison.
     */
    private zoneBand(
        current: number,
        max: number,
        zoneSettings: VisualFormattingSettingsModel["zoneSettingsCard"]
    ): Band {
        const threshold = (raw: number | undefined, fallback: number): number =>
            Number.isFinite(raw) ? (raw as number) : fallback;
        const upper = threshold(zoneSettings.safeMax.value, 100);
        const lower = threshold(zoneSettings.warningMax.value, 90);
        const percent = (current / max) * 100;
        if ((zoneSettings.maxValueMeaning.value?.value || "goal") === "limit") {
            if (percent >= upper) return "danger";
            if (percent >= lower) return "warning";
            return "success";
        }
        if (percent >= upper) return "success";
        if (percent >= lower) return "warning";
        return "danger";
    }

    /** Render a single progress bar row — v2 board look: 90px label /
     *  1fr track (120%-scaled, violet target-in-track tick, brightening
     *  overflow, optional quantised LED blocks) / 96px band-tinted value
     *  + muted actual/target sub-value. */
    private renderRow(
        row: BarRow,
        theme: Theme,
        hc: ReturnType<typeof applyHighContrast>,
        quantised: boolean
    ): HTMLElement {
        const barSettings = this.formattingSettings.barSettingsCard;
        const zoneSettings = this.formattingSettings.zoneSettingsCard;
        const valueSettings = this.formattingSettings.valueSettingsCard;

        const barHeight = barSettings.barHeight.value ?? 12;
        const barRadius = barSettings.barRadius.value ?? 6;
        const rowHeight = barSettings.rowHeight.value ?? 48;
        const fontSize = valueSettings.fontSize.value ?? 12;

        // High contrast overrides (pre-existing convention, unchanged)
        const hcFg = this.isHighContrast ? this.colorPalette.foreground.value : null;
        const hcBg = this.isHighContrast ? this.colorPalette.background.value : null;

        // trackColor/rowBackground semantics are NOT disturbed by the v2
        // look (established constraint) — same resolution as before.
        const trackColor = this.isHighContrast ? hcBg : (barSettings.trackColor.value?.value || "#eee9dc");
        const rowBg = this.isHighContrast ? hcBg : (barSettings.rowBackground.value?.value || "");

        // The surface this row's TEXT actually sits on: an explicit row
        // background wins; grid mini-cards have their own panel (themed
        // dark below, CSS #faf9f6 on light); list rows are transparent
        // over the outer surface. Adaptive defaults key on THIS, not the
        // outer theme (Neil 2026-07-12: grid panels stayed light on a
        // dark visual, so theme-keyed text vanished).
        const gridPanelHex = theme === "dark" ? surfaceTokens("dark").card : "#faf9f6";
        const rowSurfaceHex = (rowBg && rowBg.length > 0) ? rowBg
            : (this.layoutMode === "grid" ? gridPanelHex : this.themeBaseHex);
        const rowTheme: Theme = surfaceTone(rowSurfaceHex);

        // Text settings (adaptive on untouched defaults, per row surface)
        const setCategoryColor = valueSettings.categoryColor.value?.value || "#1a1a1a";
        const adaptiveCategoryDefault = setCategoryColor === "#1a1a1a" && rowTheme === "dark"
            ? surfaceTokens("dark").text : setCategoryColor;
        const categoryColor = this.isHighContrast ? hcFg : adaptiveCategoryDefault;
        const catFontSize = valueSettings.categoryFontSize.value > 0
            ? valueSettings.categoryFontSize.value : fontSize;

        const instanceObjects = row.objects;
        const setValuesColor = valueSettings.valuesColor.value?.value || "#5e5d5a";
        const adaptiveValuesDefault = setValuesColor === "#5e5d5a" && rowTheme === "dark"
            ? surfaceTokens("dark").text : setValuesColor;
        // ColorHelper.getColorForMeasure falls back to its own constructed
        // default (the card's swatch value) whenever the row carries no
        // override, so `?? adaptiveValuesDefault` could never fire and the
        // adaptive default above was dead code — the raw actual/target pair
        // stayed #5e5d5a on a dark report while the category text adapted
        // (NEXUS cycle-10 §6). Consult the helper only when THIS row really
        // has a per-instance / fx override.
        const hasValuesOverride = !!instanceObjects?.["valueSettings"]?.["valuesColor"];
        const resolvedValuesColor = (hasValuesOverride
            ? this.valuesColorHelper?.getColorForMeasure(instanceObjects, "valuesColor")
            : null) ?? adaptiveValuesDefault;
        const subValueColor = this.isHighContrast ? hcFg : resolvedValuesColor;
        const valFontSize = valueSettings.valuesFontSize.value > 0
            ? valueSettings.valuesFontSize.value : fontSize;
        const setLabelColor = valueSettings.labelColor.value?.value || "#8a8985";
        const adaptiveLabelDefault = setLabelColor === "#8a8985" && rowTheme === "dark"
            ? surfaceTokens("dark").muted : setLabelColor;
        const labelColor = this.isHighContrast ? hcFg : adaptiveLabelDefault;
        const lblFontSize = valueSettings.labelFontSize.value > 0
            ? valueSettings.labelFontSize.value
            : Math.max((valFontSize || fontSize) - 2, 9);

        const weightFor = (bold: boolean | undefined, restWeight: string): string => bold ? "700" : restWeight;

        const categoryFontFamily = valueSettings.categoryFontFamily.value || "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
        const categoryWeight = weightFor(valueSettings.categoryBold.value, "600");
        const categoryStyle = valueSettings.categoryItalic.value ? "italic" : "normal";
        const categoryDecoration = valueSettings.categoryUnderline.value ? "underline" : "none";

        const valuesFontFamily = valueSettings.valuesFontFamily.value || "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
        const valuesWeight = weightFor(valueSettings.valuesBold.value, "400");
        const valuesStyle = valueSettings.valuesItalic.value ? "italic" : "normal";
        const valuesDecoration = valueSettings.valuesUnderline.value ? "underline" : "none";

        const labelFontFamily = valueSettings.labelFontFamily.value || "Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
        const labelWeight = weightFor(valueSettings.labelBold.value, "400");
        const labelStyle = valueSettings.labelItalic.value ? "italic" : "normal";
        const labelDecoration = valueSettings.labelUnderline.value ? "underline" : "none";

        // ─── v3 band engine: ONE colour token for the fill/tick/value ──
        // "Fixed" colour mode keeps its own literal override untouched
        // (existing TRANS-04 fx wiring, unchanged semantics — no band
        // applies). "Zoned" mode resolves its fill/value colour against the
        // EXISTING safeColor/warningColor/dangerColor pickers so a user's
        // custom colours still resolve (D-16).
        //
        // The v2 look replaced the exposed safeMax/warningMax thresholds
        // with the shared band(value,target) ratio law and left the controls
        // editable but INERT: the pane offered 60 and 25 while every row was
        // judged at 90 and 100, so editing them changed nothing (NEXUS
        // cycle-10 §1). They are read again here, through zoneBand() below.
        // Their DEFAULTS now state the law that has actually been shipping —
        // 100 and 90 — so an untouched report is pixel-identical and only a
        // report that really moved a threshold changes.
        //
        // shared band() is no longer the call for this visual because it
        // hard-codes both the boundaries AND the direction, and a progress
        // bar's Max is not always a goal: the capacity sample's 224/200
        // "Over capacity — investigate" row was painted the success colour
        // by the goal-attainment law. maxValueMeaning states which it is;
        // Limit mirrors the same two thresholds. bandEngine.ts itself is
        // shared and frozen — it is not edited, only bypassed for the
        // threshold-aware path.
        const colorMode = zoneSettings.colorMode.value?.value || "zoned";
        let rowBand: Band | null = null;
        let signalHex: string;
        if (colorMode === "fixed") {
            const fixedColorDefault = zoneSettings.fixedColor.value?.value || CODEX_TOKENS.primary;
            signalHex = this.fixedColorHelper?.getColorForMeasure(instanceObjects, "fixedColor") ?? fixedColorDefault;
        } else {
            rowBand = this.zoneBand(row.currentValue, row.maxValue, zoneSettings);
            const colorFor: Record<Band, { value?: { value?: string } }> = {
                success: zoneSettings.safeColor,
                warning: zoneSettings.warningColor,
                danger: zoneSettings.dangerColor,
            };
            const fallback: Record<Band, string> = {
                success: CODEX_TOKENS.success, warning: CODEX_TOKENS.warning, danger: CODEX_TOKENS.danger,
            };
            signalHex = colorFor[rowBand].value?.value || fallback[rowBand];
        }
        const glowMix = hc.active ? 0 : (theme === "dark" ? 50 : 0);

        // ─── 120%-scale target-in-track geometry ───────────────────────
        const rawPct = (row.currentValue / row.maxValue) * 100;
        const hasOver = rawPct > 100;
        // Clamp the GEOMETRY at both ends: a negative reading used to produce
        // a negative CSS width, which the browser rejects outright, leaving
        // the fill with no width declaration at all (§4). 0% is the honest
        // bar for a reading below the track's origin; the label carries the
        // real number.
        const wBase = (clamp(rawPct, 0, 100) / SCALE) * 100;
        const wOver = hasOver ? ((Math.min(rawPct, SCALE) - 100) / SCALE) * 100 : 0;

        // Row container: label / track / value, 90px/1fr/96px grid
        // (board's .prow), plus the optional subtitle label below.
        const rowEl = document.createElement("div");
        rowEl.className = "progress-row";
        rowEl.style.display = "flex";
        rowEl.style.flexDirection = "column";
        rowEl.style.gap = "3px";
        rowEl.style.minHeight = `${rowHeight}px`;
        rowEl.style.fontSize = `${fontSize}px`;
        if (rowBg && rowBg.length > 0) {
            rowEl.style.backgroundColor = rowBg;
        } else if (this.layoutMode === "grid" && theme === "dark") {
            // Grid mini-card panel takes the dark card token (CSS default
            // #faf9f6 stays for light — pixel-identical shipped look).
            rowEl.style.backgroundColor = surfaceTokens("dark").card;
            rowEl.style.padding = "6px 10px";
            rowEl.style.borderRadius = "6px";
        }

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = GRID_TEMPLATE;
        grid.style.gap = "14px";
        grid.style.alignItems = "center";

        // Category label (right-aligned, matching the board's .plab)
        const categoryEl = document.createElement("span");
        categoryEl.className = "progress-category";
        categoryEl.textContent = row.category;
        categoryEl.style.color = categoryColor;
        categoryEl.style.fontSize = `${catFontSize}px`;
        categoryEl.style.fontFamily = categoryFontFamily;
        categoryEl.style.fontWeight = categoryWeight;
        categoryEl.style.fontStyle = categoryStyle;
        categoryEl.style.textDecoration = categoryDecoration;
        categoryEl.style.textAlign = "right";
        categoryEl.style.whiteSpace = "nowrap";
        categoryEl.style.overflow = "hidden";
        categoryEl.style.textOverflow = "ellipsis";
        grid.appendChild(categoryEl);

        // Track: fill/blocks + overflow highlight + violet target tick
        const track = document.createElement("div");
        track.className = "progress-track";
        track.style.position = "relative";
        track.style.height = `${barHeight}px`;
        track.style.borderRadius = `${barRadius}px`;
        track.style.background = quantised ? "none" : trackColor;
        if (hc.active) {
            track.style.border = `${hc.borderWidth}px solid ${hc.color}`;
        }

        if (quantised) {
            const blocksEl = document.createElement("div");
            blocksEl.style.position = "absolute";
            blocksEl.style.left = "0";
            blocksEl.style.right = "0";
            blocksEl.style.top = "0";
            blocksEl.style.bottom = "0";
            blocksEl.style.display = "flex";
            blocksEl.style.gap = "3px";
            for (let i = 0; i < QUANTISED_BLOCKS; i++) {
                const pos = ((i + 0.5) / QUANTISED_BLOCKS) * SCALE;
                const on = pos <= rawPct;
                const over = on && pos > 100;
                const block = document.createElement("span");
                block.style.flex = "1";
                block.style.borderRadius = "2px";
                if (!on) {
                    block.style.background = hc.active ? "transparent" : trackColor;
                    block.style.border = hc.active ? `1px solid ${hc.color}` : "none";
                } else if (hc.active) {
                    block.style.background = hc.color;
                } else if (over) {
                    block.style.background = mix(signalHex, "#ffffff", 0.45);
                    block.style.boxShadow = glowMix > 0
                        ? `0 0 8px color-mix(in srgb, ${signalHex} 70%, transparent)` : "none";
                } else {
                    block.style.background = signalHex;
                    block.style.boxShadow = glowMix > 0
                        ? `0 0 5px color-mix(in srgb, ${signalHex} ${glowMix}%, transparent)` : "none";
                }
                blocksEl.appendChild(block);
            }
            track.appendChild(blocksEl);
        } else {
            const fill = document.createElement("div");
            fill.className = "progress-fill";
            fill.style.position = "absolute";
            fill.style.left = "0";
            fill.style.top = "0";
            fill.style.bottom = "0";
            fill.style.width = `${wBase}%`;
            fill.style.borderRadius = `${barRadius}px`;
            fill.style.minWidth = wBase > 0 ? "2px" : "0";
            if (hc.active) {
                fill.style.background = hc.color;
            } else {
                fill.style.background = accentBarGradient(signalHex);
                fill.style.boxShadow = glowMix > 0
                    ? `0 0 8px color-mix(in srgb, ${signalHex} ${glowMix}%, transparent)` : "none";
            }
            track.appendChild(fill);

            if (hasOver) {
                const over = document.createElement("div");
                over.style.position = "absolute";
                over.style.left = `${TICK_PCT}%`;
                over.style.top = "0";
                over.style.bottom = "0";
                over.style.width = `${wOver}%`;
                over.style.borderRadius = `0 ${barRadius}px ${barRadius}px 0`;
                if (hc.active) {
                    over.style.background = hc.color;
                } else {
                    over.style.background = `linear-gradient(180deg, #ffffff, ${mix(signalHex, "#ffffff", 0.4)} 60%, ${signalHex})`;
                    over.style.boxShadow = `0 0 12px color-mix(in srgb, ${signalHex} 75%, transparent)`;
                }
                track.appendChild(over);
            }
        }

        // Violet target tick — NEVER a band colour (bandEngine.ts contract).
        const tick = document.createElement("div");
        tick.style.position = "absolute";
        tick.style.left = `${TICK_PCT}%`;
        tick.style.top = "-5px";
        tick.style.bottom = "-5px";
        tick.style.width = "3px";
        tick.style.borderRadius = "2px";
        tick.style.background = hc.active ? hc.color : targetToken(theme);
        if (!hc.active && glowMix > 0) {
            tick.style.boxShadow = `0 0 6px color-mix(in srgb, ${targetToken(theme)} ${glowMix}%, transparent)`;
        }
        track.appendChild(tick);
        grid.appendChild(track);

        // Value wrap: band-tinted percentage + muted actual/target sub-value
        const valueWrap = document.createElement("div");
        valueWrap.style.textAlign = "right";
        // Breathing room against the row's right edge — visible whenever a
        // row background makes the edge a hard line (Neil 2026-07-13).
        valueWrap.style.paddingRight = "10px";
        valueWrap.style.boxSizing = "border-box";

        // Bounded geometry, truthful text (NEXUS cycle-10 §4). The track only
        // draws to the 120% scale, but the label must not assert a figure the
        // data never had: 1250/100 read exactly "999%" — in the tooltip too —
        // and -25/100 read "0%" beside a -25 reading. Out-of-range ratios now
        // read as a bound; a negative ratio keeps its sign.
        const roundedPct = Math.round(rawPct);
        const pctText = roundedPct > PCT_DISPLAY_LIMIT
            ? `>${PCT_DISPLAY_LIMIT}%`
            : roundedPct < -PCT_DISPLAY_LIMIT
                ? `<-${PCT_DISPLAY_LIMIT}%`
                : `${roundedPct}%`;
        if (valueSettings.showPercentage.value) {
            const pv = document.createElement("div");
            pv.style.fontSize = `${valFontSize}px`;
            pv.style.fontFamily = valuesFontFamily;
            pv.style.fontWeight = valuesWeight;
            pv.style.fontStyle = valuesStyle;
            pv.style.textDecoration = valuesDecoration;
            pv.style.fontFeatureSettings = TABULAR_NUMS;
            pv.style.lineHeight = "1.2";
            const hasExplicitValuesColor = hasValuesOverride
                || !!this.lastUpdateOptions?.dataViews?.[0]?.metadata?.objects?.valueSettings?.valuesColor;
            pv.style.color = hc.active ? hc.color : hasExplicitValuesColor ? resolvedValuesColor : signalHex;
            const glyph = hc.active && rowBand ? `${statusGlyph(rowBand)} ` : "";
            pv.textContent = glyph + pctText;
            valueWrap.appendChild(pv);

            // v3 motion: settle the percentage once when its displayed
            // text changes for this category (skipped under
            // prefers-reduced-motion — see motion.ts).
            const lastPct = this.lastPctByCategory.get(row.category);
            if (lastPct !== pctText) {
                settle(pv, [
                    { opacity: 0.35, transform: "translateY(2px)" },
                    { opacity: 1, transform: "translateY(0)" },
                ], { duration: 200 });
                this.lastPctByCategory.set(row.category, pctText);
            }
        }

        if (valueSettings.showValues.value) {
            const unit = valueSettings.valueUnit.value || "";
            const unitSuffix = unit ? ` ${unit}` : "";
            const sub = document.createElement("div");
            sub.style.fontSize = `${valFontSize}px`;
            sub.style.fontFamily = valuesFontFamily;
            sub.style.fontWeight = valuesWeight;
            sub.style.fontStyle = valuesStyle;
            sub.style.textDecoration = valuesDecoration;
            sub.style.color = subValueColor;
            sub.style.fontFeatureSettings = TABULAR_NUMS;
            sub.textContent = `${this.formatReading(row.currentValue, row.currentFormat)} / ${this.formatReading(row.maxValue, row.maxFormat)}${unitSuffix}`;
            valueWrap.appendChild(sub);
        }
        grid.appendChild(valueWrap);

        rowEl.appendChild(grid);

        // Optional label subtitle (pre-existing "label" data role — not
        // part of the v2 board grammar, kept unchanged below the row so a
        // saved report bound to it still shows the text/colour/font).
        if (row.label) {
            const labelEl = document.createElement("div");
            labelEl.className = "progress-label";
            labelEl.textContent = row.label;
            labelEl.style.fontSize = `${lblFontSize}px`;
            labelEl.style.color = labelColor;
            labelEl.style.fontFamily = labelFontFamily;
            labelEl.style.fontWeight = labelWeight;
            labelEl.style.fontStyle = labelStyle;
            labelEl.style.textDecoration = labelDecoration;
            rowEl.appendChild(labelEl);
        }

        // Tooltip on hover
        rowEl.style.cursor = "pointer";
        rowEl.addEventListener("mousemove", (e: MouseEvent) => {
            const tooltipItems: VisualTooltipDataItem[] = [
                { displayName: "Category", value: row.category },
                { displayName: "Current", value: this.formatReading(row.currentValue, row.currentFormat, true) },
                { displayName: "Max", value: this.formatReading(row.maxValue, row.maxFormat, true) },
                { displayName: "Progress", value: pctText }
            ];
            if (row.label) {
                tooltipItems.push({ displayName: "Label", value: row.label });
            }
            this.tooltipService.show({
                coordinates: [e.clientX, e.clientY],
                isTouchEvent: false,
                dataItems: tooltipItems,
                identities: row.selectionId ? [row.selectionId] : []
            });
        });
        rowEl.addEventListener("mouseleave", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        });

        // Cross-filtering on click
        rowEl.addEventListener("click", (e: MouseEvent) => {
            if (row.selectionId) {
                this.selectionManager.select(row.selectionId, e.ctrlKey || e.metaKey);
            }
            e.stopPropagation();
        });

        return rowEl;
    }

    private formatReading(value: number, format: string | undefined, includeUnit = false): string {
        const settings = this.formattingSettings.valueSettingsCard;
        const prefix = settings.valuePrefix.value || "";
        let text = formatModelNumber(value, format, this.host.locale);
        // A model currency symbol and the same explicit prefix are one unit.
        const unsigned = text.startsWith("-") ? text.slice(1) : text;
        if (prefix && !unsigned.startsWith(prefix)) {
            text = text.startsWith("-") ? `-${prefix}${unsigned}` : `${prefix}${text}`;
        }
        const unit = includeUnit ? settings.valueUnit.value : "";
        return unit ? `${text} ${unit}` : text;
    }

    /** Render empty state placeholder */
    private renderEmptyState(hc: ReturnType<typeof applyHighContrast>): void {
        this.container.className = "progress-bar-card-container";
        const empty = document.createElement("div");
        empty.className = "progress-empty";

        const iconEl = document.createElement("div");
        iconEl.className = "progress-empty-icon";
        iconEl.textContent = "☰";
        empty.appendChild(iconEl);

        const textEl = document.createElement("div");
        textEl.className = "progress-empty-text";
        textEl.appendChild(document.createTextNode(this.localizationManager.getDisplayName("Visual_EmptyState_Prefix")));
        const b1 = document.createElement("strong");
        b1.textContent = this.localizationManager.getDisplayName("Visual_Field_Category");
        textEl.appendChild(b1);
        textEl.appendChild(document.createTextNode(", "));
        const b2 = document.createElement("strong");
        b2.textContent = this.localizationManager.getDisplayName("Visual_Field_CurrentValue");
        textEl.appendChild(b2);
        textEl.appendChild(document.createTextNode(", " + this.localizationManager.getDisplayName("Visual_EmptyState_And") + " "));
        const b3 = document.createElement("strong");
        b3.textContent = this.localizationManager.getDisplayName("Visual_Field_MaxValue");
        textEl.appendChild(b3);
        textEl.appendChild(document.createTextNode(" " + this.localizationManager.getDisplayName("Visual_EmptyState_Suffix")));
        empty.appendChild(textEl);

        if (this.isHighContrast) {
            iconEl.style.color = this.colorPalette.foreground.value;
            textEl.style.color = this.colorPalette.foreground.value;
        }

        this.container.appendChild(empty);
        // The empty state re-applies the signature AFTER update()'s own
        // high-contrast-aware call (~:221), so omitting hcActive/hcColor here
        // silently overwrote the resolved foreground with the muted brand
        // violet: measured rgb(143, 138, 184) at opacity 0.4 on a black
        // high-contrast page, while the populated card correctly painted
        // rgb(255, 255, 255). Route the same palette the rest of the empty
        // state already uses (iconEl/textEl above) — the resolver's own
        // "high contrast outranks muted" branch (cardSignatureSettings.ts)
        // cannot fire unless hcActive reaches it. glowMix 0 keeps high
        // contrast glow-free exactly as update() does.
        applyCardSignature(this.cornerSignature, this.formattingSettings?.cardSignature, {
            autoHex: "#00d9ff",
            hcActive: hc.active,
            hcColor: hc.color,
            mirror: true,
            glowMix: 0,
            muted: true,
        });
        this.cornerSignature?.elements.forEach((el) => this.container.appendChild(el));
    }

    public destroy(): void {
        // Drop the in-flight licence check FIRST: its redraw callback replays
        // update() against a torn-down target otherwise (NEXUS lifecycle finding).
        this.licenseGate.dispose();
        this.cornerSignature?.destroy();
        this.cornerSignature = null;
        while (this.container && this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.container = null;
        this.target = null;
    }

    /**
     * Returns properties pane formatting model content hierarchies,
     * properties and latest formatting values.
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
