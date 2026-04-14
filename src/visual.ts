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

import { VisualFormattingSettingsModel } from "./settings";
import { clamp, safeNumber, RAA_TOKENS } from "./utils";

/** Parsed row data for a single progress bar */
interface BarRow {
    category: string;
    currentValue: number;
    maxValue: number;
    label: string | null;
    percentage: number;
    sortOrder: number | null;
    selectionId: ISelectionId | null;
}

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

    constructor(options: VisualConstructorOptions) {
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
        this.target.appendChild(this.container);
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            // Refresh high contrast state
            this.isHighContrast = !!this.colorPalette.isHighContrast;

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews?.[0]
            );

            while (this.container.firstChild) this.container.removeChild(this.container.firstChild);

            const dataView: DataView = options.dataViews?.[0];
            if (!dataView?.categorical?.categories?.[0]?.values?.length) {
                this.renderEmptyState();
                this.events.renderingFinished(options);
                return;
            }

            const rows = this.parseData(dataView);
            if (rows.length === 0) {
                this.renderEmptyState();
                this.events.renderingFinished(options);
                return;
            }

            const barSettings = this.formattingSettings.barSettingsCard;
            const layout = barSettings.layout.value?.value || "list";

            // Set layout class
            this.container.className = layout === "grid"
                ? "progress-bar-card-container layout-grid"
                : "progress-bar-card-container layout-list";

            // Adjust grid columns based on viewport width
            if (layout === "grid") {
                const width = options.viewport.width;
                const cols = width >= 800 ? 3 : width >= 480 ? 2 : 1;
                this.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            } else {
                this.container.style.gridTemplateColumns = "";
            }

            for (const row of rows) {
                this.renderRow(row);
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
                const titleColor = hcFg || "#1a1a1a";

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

            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
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

            if (current === null || max === null || max === 0) continue;

            const percentage = clamp((current / max) * 100, 0, 100);
            const labelValue = labelCol ? labelCol.values[i] : null;
            const sortValue = sortOrderCol ? safeNumber(sortOrderCol.values[i]) : null;

            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(catColumn, i)
                .createSelectionId();

            rows.push({
                category: String(categories[i] ?? ""),
                currentValue: current,
                maxValue: max,
                label: labelValue != null ? String(labelValue) : null,
                percentage,
                sortOrder: sortValue,
                selectionId
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

    /** Render a single progress bar row */
    private renderRow(row: BarRow): void {
        const barSettings = this.formattingSettings.barSettingsCard;
        const zoneSettings = this.formattingSettings.zoneSettingsCard;
        const valueSettings = this.formattingSettings.valueSettingsCard;

        const barHeight = barSettings.barHeight.value ?? 12;
        const barRadius = barSettings.barRadius.value ?? 6;
        const rowHeight = barSettings.rowHeight.value ?? 48;
        const fontSize = valueSettings.fontSize.value ?? 12;

        // High contrast overrides
        const hcFg = this.isHighContrast ? this.colorPalette.foreground.value : null;
        const hcBg = this.isHighContrast ? this.colorPalette.background.value : null;

        const trackColor = this.isHighContrast ? hcBg : (barSettings.trackColor.value?.value || "#eee9dc");
        const rowBg = this.isHighContrast ? hcBg : (barSettings.rowBackground.value?.value || "");

        // Text settings
        const categoryColor = this.isHighContrast ? hcFg : (valueSettings.categoryColor.value?.value || "#1a1a1a");
        const catFontSize = valueSettings.categoryFontSize.value > 0
            ? valueSettings.categoryFontSize.value : fontSize;
        const valuesColor = this.isHighContrast ? hcFg : (valueSettings.valuesColor.value?.value || "#5e5d5a");
        const valFontSize = valueSettings.valuesFontSize.value > 0
            ? valueSettings.valuesFontSize.value : fontSize;
        const labelColor = this.isHighContrast ? hcFg : (valueSettings.labelColor.value?.value || "#8a8985");

        // Determine bar fill colour
        const fillColor = this.isHighContrast ? hcFg : this.getBarColor(row.percentage);

        // Row container
        const rowEl = document.createElement("div");
        rowEl.className = "progress-row";
        rowEl.style.minHeight = `${rowHeight}px`;
        rowEl.style.fontSize = `${fontSize}px`;
        if (rowBg && rowBg.length > 0) {
            rowEl.style.backgroundColor = rowBg;
            rowEl.style.padding = "6px 10px";
            rowEl.style.borderRadius = "6px";
        }

        // Header line: category + values
        const header = document.createElement("div");
        header.className = "progress-row-header";

        const categoryEl = document.createElement("span");
        categoryEl.className = "progress-category";
        categoryEl.textContent = row.category;
        categoryEl.style.color = categoryColor;
        categoryEl.style.fontSize = `${catFontSize}px`;
        header.appendChild(categoryEl);

        const valuesEl = document.createElement("span");
        valuesEl.className = "progress-values";
        valuesEl.style.color = valuesColor;
        valuesEl.style.fontSize = `${valFontSize}px`;

        const parts: string[] = [];
        const prefix = valueSettings.valuePrefix.value || "";
        const unit = valueSettings.valueUnit.value || "";

        if (valueSettings.showValues.value) {
            const unitSuffix = unit ? ` ${unit}` : "";
            parts.push(`${prefix}${this.formatNum(row.currentValue)} / ${prefix}${this.formatNum(row.maxValue)}${unitSuffix}`);
        }
        if (valueSettings.showPercentage.value) {
            parts.push(`${Math.round(row.percentage)}%`);
        }

        valuesEl.textContent = parts.join("  ");
        header.appendChild(valuesEl);
        rowEl.appendChild(header);

        // Optional label subtitle
        if (row.label) {
            const labelEl = document.createElement("div");
            labelEl.className = "progress-label";
            labelEl.textContent = row.label;
            labelEl.style.fontSize = `${Math.max((valFontSize || fontSize) - 2, 9)}px`;
            labelEl.style.color = labelColor;
            rowEl.appendChild(labelEl);
        }

        // Track bar
        const track = document.createElement("div");
        track.className = "progress-track";
        track.style.height = `${barHeight}px`;
        track.style.borderRadius = `${barRadius}px`;
        track.style.backgroundColor = trackColor;

        // Fill bar
        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${row.percentage}%`;
        fill.style.height = `${barHeight}px`;
        fill.style.borderRadius = `${barRadius}px`;
        fill.style.backgroundColor = fillColor;

        track.appendChild(fill);
        rowEl.appendChild(track);

        // Tooltip on hover
        rowEl.style.cursor = "pointer";
        rowEl.addEventListener("mousemove", (e: MouseEvent) => {
            const tooltipItems: VisualTooltipDataItem[] = [
                { displayName: "Category", value: row.category },
                { displayName: "Current", value: this.formatNum(row.currentValue) },
                { displayName: "Max", value: this.formatNum(row.maxValue) },
                { displayName: "Progress", value: Math.round(row.percentage) + "%" }
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

        this.container.appendChild(rowEl);
    }

    /** Get bar colour based on zone settings and percentage */
    private getBarColor(percentage: number): string {
        const zoneSettings = this.formattingSettings.zoneSettingsCard;
        const colorMode = zoneSettings.colorMode.value?.value || "zoned";

        if (colorMode === "fixed") {
            return zoneSettings.fixedColor.value?.value || RAA_TOKENS.primary;
        }

        // Zoned mode — low fill = danger, high fill = safe
        const dangerMax = zoneSettings.warningMax.value ?? 25;
        const warningMax = zoneSettings.safeMax.value ?? 60;
        const safeColor = zoneSettings.safeColor.value?.value || RAA_TOKENS.success;
        const warningColor = zoneSettings.warningColor.value?.value || RAA_TOKENS.warning;
        const dangerColor = zoneSettings.dangerColor.value?.value || RAA_TOKENS.danger;

        if (percentage < dangerMax) return dangerColor;
        if (percentage < warningMax) return warningColor;
        return safeColor;
    }

    /** Format a number for display (no decimals if whole, 1 decimal otherwise) */
    private formatNum(value: number): string {
        return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }

    /** Render empty state placeholder */
    private renderEmptyState(): void {
        this.container.className = "progress-bar-card-container";
        const empty = document.createElement("div");
        empty.className = "progress-empty";

        const iconEl = document.createElement("div");
        iconEl.className = "progress-empty-icon";
        iconEl.textContent = "\u2630";
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
    }

    public destroy(): void {
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
