"use strict";

import powerbi from "powerbi-visuals-api";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

const ConstantOrRule = powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;

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

    categoryFontSize = new formattingSettings.NumUpDown({
        name: "categoryFontSize",
        displayName: "Category Font Size",
        description: "Font size for category names (0 = use main font size)",
        value: 0
    });

    valuesColor = new formattingSettings.ColorPicker({
        name: "valuesColor",
        displayName: "Values Color",
        description: "Color of the values text (current/max and percentage)",
        value: { value: "#5e5d5a" },
        instanceKind: ConstantOrRule
    });

    valuesFontSize = new formattingSettings.NumUpDown({
        name: "valuesFontSize",
        displayName: "Values Font Size",
        description: "Font size for values text (0 = use main font size)",
        value: 0
    });

    labelColor = new formattingSettings.ColorPicker({
        name: "labelColor",
        displayName: "Label Color",
        description: "Color of the subtitle label text",
        value: { value: "#8a8985" },
        instanceKind: ConstantOrRule
    });

    name: string = "valueSettings";
    displayName: string = "Value Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.showPercentage,
        this.showValues,
        this.valuePrefix,
        this.valueUnit,
        this.fontSize,
        this.categoryColor,
        this.categoryFontSize,
        this.valuesColor,
        this.valuesFontSize,
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
    barSettingsCard = new BarSettingsCard();
    zoneSettingsCard = new ZoneSettingsCard();
    valueSettingsCard = new ValueSettingsCard();
    axisSettingsCard = new AxisSettingsCard();

    cards = [this.barSettingsCard, this.zoneSettingsCard, this.valueSettingsCard, this.axisSettingsCard];
}
