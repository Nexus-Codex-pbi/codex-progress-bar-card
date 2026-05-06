# User Guide – Codex Progress Bar Card

## Overview
Horizontal progress bars with zoned colour coding for utilisation tracking. Displays multiple rows, each showing a current value against a maximum value with colour-coded zones (safe, warning, danger).

## 1. Adding the Visual
1. Import the `.pbiviz` file into Power BI Desktop
2. Locate the visual in the Visualizations pane
3. Drag it onto the report canvas

## 2. Data Binding
- **Category** (Required): Row label (e.g. VehicleID or Beat). Each unique value creates a row.
- **Current Value** (Required): Actual value (e.g. 156 kg).
- **Max Value** (Required): Limit value (e.g. 200 kg).
- **Label** (Optional): Optional subtitle (e.g. driver name).
- **Sort Order** (Optional): Optional numeric sort order (ascending).

## 3. Formatting Options
**Bar Settings**
- Bar Height: Height of the progress bar (px).
- Bar Radius: Corner radius of the progress bar (px).
- Track Color: Colour of the background track.
- Layout: List (vertical stack) or Grid (multiple columns).
- Row Height: Total height of each row (px).
- Row Background: Background colour of each row.

**Zone Settings**
- Color Mode: Fixed (single colour) or Zoned (three colours based on thresholds).
- Fixed Color: Colour used when Color Mode is Fixed.
- Safe Max: Maximum value for the safe zone (e.g., 80% of max).
- Warning Max: Maximum value for the warning zone (e.g., 95% of max).
- Safe Color: Colour for the safe zone (e.g., green).
- Warning Color: Colour for the warning zone (e.g., amber).
- Danger Color: Colour for the danger zone (e.g., red).

**Value Settings**
- Show Percentage: Toggle display of the percentage value.
- Show Values: Toggle display of the raw values (current/max).
- Value Prefix: Prefix for values (e.g., '$').
- Value Unit: Unit for values (e.g., 'kg', '%').
- Font Size: Size of the value text.
- Category Color: Colour of the category label.
- Category Font Size: Size of the category label text.
- Values Color: Colour of the values text.
- Values Font Size: Size of the values text.
- Label Color: Colour of the optional label subtitle.

**Axis Settings**
- Show Axis Titles: Toggle visibility of axis titles.
- X Axis Title: Title for the value axis.
- Y Axis Title: Title for the category axis.

## 4. Features
- Displays multiple horizontal progress bars, one per category.
- Each bar shows current value as a fill within a track.
- Colour-coded zones (safe/warning/danger) based on thresholds.
- Optional display of values and percentage.
- Optional label subtitle per row.
- Tooltips on hover showing category, current value, max value, and percentage.
- Click a row to cross-filter other visuals by that category (if Category bound).
- Right-click for context menu.
- Supports high contrast mode and keyboard navigation.
- Configurable layout (list or grid) with responsive column count.
- Sorting by Sort Order field (ascending).

## 5. Limitations
- Only the first 30,000 rows are processed (data reduction limit).
- Requires Current Value and Max Value to be numeric; non-numeric rows are skipped.
- If Max Value is zero or missing, the bar shows as empty.
- Zone thresholds (Safe Max, Warning Max) must be numeric and less than Max Value; otherwise, they are ignored.
- The visual does not support drill-through or hierarchical categories.
- Sort Order must be numeric; non-numeric values are placed at the end.

## 6. Support
For help or questions, visit https://nexuscodex.nexus/support