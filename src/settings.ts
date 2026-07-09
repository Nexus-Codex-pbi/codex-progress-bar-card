"use strict";

import powerbi from "powerbi-visuals-api";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

import { BackgroundSettings } from "../../_shared/formatting/backgroundSettings";
import { TitleSettings } from "../../_shared/formatting/titleSettings";
import { alignSlice, alignSelfFor, textAlignFor, makeFontControl } from "../../_shared/formatting/textFormatting";

const ConstantOrRule = powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;

// TitleSettings + text-formatting helpers now live in _shared/formatting/
// (D-13, D-14). Re-exported so visual.ts can import them from "./settings"
// (stable import path).
export { TitleSettings, alignSlice, alignSelfFor, textAlignFor };

/**
 * Bar Settings Card — controls bar dimensions and layout
 */
class BarSettingsCard extends FormattingSettingsCard {
    barHeight = new formattingSettings.NumUpDown({
        name: "barHeight",
        displayName: "Bar Height",
        description: "Height of the progress bar in pixels",
        value: 12
    });

    barRadius = new formattingSettings.NumUpDown({
        name: "barRadius",
        displayName: "Bar Radius",
        description: "Corner radius of the progress bar",
        value: 6
    });

    trackColor = new formattingSettings.ColorPicker({
        name: "trackColor",
        displayName: "Track Colour",
        description: "Background colour of the bar track",
        value: { value: "#eee9dc" },
        instanceKind: ConstantOrRule
    });

    layout = new formattingSettings.ItemDropdown({
        name: "layout",
        displayName: "Layout",
        description: "Display as vertical list or responsive grid",
        items: [
            { displayName: "List", value: "list" },
            { displayName: "Grid", value: "grid" }
        ],
        value: { displayName: "List", value: "list" }
    });

    rowHeight = new formattingSettings.NumUpDown({
        name: "rowHeight",
        displayName: "Row Height",
        description: "Height of each row in pixels",
        value: 48
    });

    rowBackground = new formattingSettings.ColorPicker({
        name: "rowBackground",
        displayName: "Row Background",
        description: "Background colour for each row (grid mode card background)",
        value: { value: "" },
        instanceKind: ConstantOrRule
    });

    name: string = "barSettings";
    displayName: string = "Bar Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.barHeight,
        this.barRadius,
        this.trackColor,
        this.layout,
        this.rowHeight,
        this.rowBackground
    ];
}

/**
 * Zone Settings Card — controls colour mode and thresholds
 */
class ZoneSettingsCard extends FormattingSettingsCard {
    colorMode = new formattingSettings.ItemDropdown({
        name: "colorMode",
        displayName: "Colour Mode",
        description: "Fixed colour or zoned thresholds",
        items: [
            { displayName: "Fixed", value: "fixed" },
            { displayName: "Zoned", value: "zoned" }
        ],
        value: { displayName: "Zoned", value: "zoned" }
    });

    fixedColor = new formattingSettings.ColorPicker({
        name: "fixedColor",
        displayName: "Fixed Colour",
        description: "Bar colour when using fixed mode",
        value: { value: "#130064" },
        instanceKind: ConstantOrRule
    });

    safeMax = new formattingSettings.NumUpDown({
        name: "safeMax",
        displayName: "Warning → Safe (%)",
        description: "Fill percentage above which bar turns safe (green)",
        value: 60
    });

    warningMax = new formattingSettings.NumUpDown({
        name: "warningMax",
        displayName: "Danger → Warning (%)",
        description: "Fill percentage above which bar turns warning (amber)",
        value: 25
    });

    safeColor = new formattingSettings.ColorPicker({
        name: "safeColor",
        displayName: "Safe Colour",
        description: "Colour for the safe zone",
        value: { value: "#007064" },
        instanceKind: ConstantOrRule
    });

    warningColor = new formattingSettings.ColorPicker({
        name: "warningColor",
        displayName: "Warning Colour",
        description: "Colour for the warning zone",
        value: { value: "#d4920a" },
        instanceKind: ConstantOrRule
    });

    dangerColor = new formattingSettings.ColorPicker({
        name: "dangerColor",
        displayName: "Danger Colour",
        description: "Colour for the danger zone",
        value: { value: "#e60e22" },
        instanceKind: ConstantOrRule
    });

    name: string = "zoneSettings";
    displayName: string = "Zone Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.colorMode,
        this.fixedColor,
        this.safeMax,
        this.warningMax,
        this.safeColor,
        this.warningColor,
        this.dangerColor
    ];
}

/**
 * Value Settings Card — controls value display and formatting
 */
class ValueSettingsCard extends FormattingSettingsCard {
    showPercentage = new formattingSettings.ToggleSwitch({
        name: "showPercentage",
        displayName: "Show Percentage",
        description: "Display percentage text on the bar",
        value: true
    });

    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Show Values",
        description: "Display current / max values",
        value: true
    });

    valuePrefix = new formattingSettings.TextInput({
        name: "valuePrefix",
        displayName: "Value Prefix",
        description: "Prefix prepended to values (e.g. $)",
        value: "",
        placeholder: "$"
    });

    valueUnit = new formattingSettings.TextInput({
        name: "valueUnit",
        displayName: "Value Unit",
        description: "Unit label appended to values (e.g. kg)",
        value: "kg",
        placeholder: "kg"
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font Size",
        description: "Font size for all text",
        value: 12
    });

    categoryColor = new formattingSettings.ColorPicker({
        name: "categoryColor",
        displayName: "Category Color",
        description: "Color of the category name text",
        value: { value: "#1a1a1a" },
        instanceKind: ConstantOrRule
    });

    // Category label text — FontControl composite reuses the existing
    // "categoryFontSize" property name (D-06/D-07: additive-only, no
    // schema rename; the "0 = use main font size" convention on
    // categoryFontSize is preserved unchanged in visual.ts) alongside NEW
    // sibling properties (family/bold/italic/underline). Bold defaults
    // true to match the pre-existing CSS-hardcoded font-weight:600 on
    // .progress-category (render-nothing-default parity — weightFor idiom
    // in visual.ts).
    private categoryFontBundle = makeFontControl("category", { fontSize: 0, bold: true });
    categoryFontFamily = this.categoryFontBundle.fontFamily;
    categoryFontSize = this.categoryFontBundle.fontSize;
    categoryBold = this.categoryFontBundle.bold;
    categoryItalic = this.categoryFontBundle.italic;
    categoryUnderline = this.categoryFontBundle.underline;
    categoryFont = this.categoryFontBundle.control;

    valuesColor = new formattingSettings.ColorPicker({
        name: "valuesColor",
        displayName: "Values Color",
        description: "Color of the values text (current/max and percentage)",
        value: { value: "#5e5d5a" },
        instanceKind: ConstantOrRule
    });

    // Values text (current/max + percentage) — reuses "valuesFontSize"
    // ("0 = use main font size" convention preserved); Bold defaults false
    // (off-state renders the pre-existing unset/normal font-weight — no
    // font-weight was ever hardcoded on .progress-values).
    private valuesFontBundle = makeFontControl("values", { fontSize: 0, bold: false });
    valuesFontFamily = this.valuesFontBundle.fontFamily;
    valuesFontSize = this.valuesFontBundle.fontSize;
    valuesBold = this.valuesFontBundle.bold;
    valuesItalic = this.valuesFontBundle.italic;
    valuesUnderline = this.valuesFontBundle.underline;
    valuesFont = this.valuesFontBundle.control;

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label Color",
        description: "Color of the subtitle label text",
        value: { value: "#8a8985" },
        instanceKind: ConstantOrRule
    });

    // Optional subtitle "label" text — brand-new dedicated font composite
    // (this surface had NO independent size/family/style controls before;
    // it derived its size from valuesFontSize - 2, clamped to a 9px
    // minimum). "0 = use the pre-existing derived size" preserves that
    // exact prior behaviour at default; Bold defaults false (no
    // font-weight was ever hardcoded on .progress-label).
    private labelFontBundle = makeFontControl("label", { fontSize: 0, bold: false });
    labelFontFamily = this.labelFontBundle.fontFamily;
    labelFontSize = this.labelFontBundle.fontSize;
    labelBold = this.labelFontBundle.bold;
    labelItalic = this.labelFontBundle.italic;
    labelUnderline = this.labelFontBundle.underline;
    labelFont = this.labelFontBundle.control;

    name: string = "valueSettings";
    displayName: string = "Value Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.showPercentage,
        this.showValues,
        this.valuePrefix,
        this.valueUnit,
        this.fontSize,
        this.categoryFont,
        this.categoryColor,
        this.valuesFont,
        this.valuesColor,
        this.labelFont,
        this.labelColor
    ];
}

/**
 * Axis Titles Card
 */
class AxisSettingsCard extends FormattingSettingsCard {
    showAxisTitles = new formattingSettings.ToggleSwitch({
        name: "showAxisTitles",
        displayName: "Show Axis Titles",
        description: "Display titles below X axis (values) and beside Y axis (categories)",
        value: false
    });

    xAxisTitle = new formattingSettings.TextInput({
        name: "xAxisTitle",
        displayName: "X Axis Title",
        placeholder: "X axis title",
        value: ""
    });

    yAxisTitle = new formattingSettings.TextInput({
        name: "yAxisTitle",
        displayName: "Y Axis Title",
        placeholder: "Y axis title",
        value: ""
    });

    name: string = "axisSettings";
    displayName: string = "Axis Titles";
    slices: Array<FormattingSettingsSlice> = [
        this.showAxisTitles,
        this.xAxisTitle,
        this.yAxisTitle
    ];
}

/**
 * Visual Formatting Settings Model
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    titleSettings = new TitleSettings();
    barSettingsCard = new BarSettingsCard();
    zoneSettingsCard = new ZoneSettingsCard();
    valueSettingsCard = new ValueSettingsCard();
    axisSettingsCard = new AxisSettingsCard();
    background = new BackgroundSettings();

    constructor() {
        super();
        // D-06 default-preservation override (per-visual instance only —
        // _shared/formatting/backgroundSettings.ts itself is untouched,
        // D-11): pbiProgressBarCard's PRE-EXISTING default was "no
        // background ever painted" — confirmed via direct inspection of
        // src/visual.ts's update()/renderRow(): `this.container` (the
        // outer card-list render root appended to options.element) never
        // has a background-color set anywhere; only per-row
        // (barSettings.rowBackground) and per-bar (barSettings.trackColor)
        // colours are painted, and neither is the container/canvas layer.
        // The frozen shared Background card's own default (opaque white,
        // transparency 0) would regress every old saved report that never
        // touched this brand-new property to a suddenly-opaque white
        // container. Overriding the TRANSPARENCY default to 100 makes
        // toRgba(...) resolve to alpha 0 regardless of colour — pixel-
        // identical to "nothing painted" — while still exposing a real,
        // working Colour + Transparency control on the container layer
        // only (T-06-01: never conflated with rowBackground/trackColor).
        this.background.transparency.value = 100;
    }

    cards = [this.titleSettings, this.barSettingsCard, this.zoneSettingsCard, this.valueSettingsCard, this.axisSettingsCard, this.background];
}
