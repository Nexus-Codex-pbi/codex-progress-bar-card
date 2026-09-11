# Codex Progress Bar Card

## Overview
A card that displays one or more progress bars, each showing a current value against a maximum value. Ideal for tracking metrics like utilization, completion, or resource usage.

## Features
- Displays horizontal progress bars with a fill indicating the percentage of current value relative to max value
- Supports list (vertical stack) or grid layout (auto-wrapping based on container width)
- Configurable bar height, radius, track color, and row height
- Optional row background color
- Zone-based coloring: fixed color or three zones (safe, warning, danger) with configurable thresholds and colors
- Value display options: show/hide percentage, show/hide raw values, value prefix, value unit
- Label for each bar (optional subtitle)
- Category text color and font size
- Values text color and font size
- Label text color
- Axis titles for X and Y (when enabled)
- Tooltips showing category, current value, max value, percentage, and label
- Click to cross-filter other visuals by category
- Right-click context menu for cross-filtering and other interactions
- High contrast mode support
- Supports keyboard focus and screen readers
- Responsive layout: grid columns adjust based on viewport width

## Data Roles
| Role | Display Name | Kind | Required? | Data Type | Description |
|------|--------------|------|-----------|-----------|-------------|
| category | Category | Grouping | No (max 1) | Text or Grouping | Row label (e.g. VehicleID or Beat) |
| currentValue | Current Value | Measure | Yes (max 1) | Numeric | Actual value (e.g. 156 kg) |
| maxValue | Max Value | Measure | Yes (max 1) | Numeric | Limit value (e.g. 200 kg) |
| label | Label | Measure | No (max 1) | Text | Optional subtitle (e.g. driver name) |
| sortOrder | Sort Order | Measure | No (max 1) | Numeric | Optional numeric sort order (ascending) |

Note: Current Value and Max Value are required for meaningful display. Each role can accept only one field.
Without Category, the visual renders the single aggregated Current Value / Max Value pair.

## Formatting Options
The visual provides the following format pane cards:

### Bar Settings
- Bar Height: Height of the progress bar fill in pixels
- Bar Radius: Radius of the bar corners in pixels
- Track Color: Background color of the progress bar track
- Layout: List (vertical stack) or Grid (auto-wrapping columns)
- Row Height: Height of each row in pixels
- Row Background: Background color of each row (optional)

### Zone Settings
- Color Mode: Fixed (single color) or Zoned (three zones: safe, warning, danger)
- Max Value is: Goal (higher is better — at or above the Upper Threshold is safe) or
  Limit (Max is a ceiling — at or above the Upper Threshold is danger). Default Goal
- Fixed Color: Color used when Color Mode is Fixed
- Upper Threshold: Percentage of Max at or above which a Goal is met (safe) or a
  Limit is breached (danger). Default 100
- Lower Threshold: Percentage of Max at or above which the bar enters the warning
  band. Default 90

> Migration note. Before this release the two thresholds were shown in the format
> pane but were not read by the renderer: the pane offered 60 and 25 while every row
> was judged at 90 and 100, so editing them changed nothing. They are read again, and
> their defaults now state the law that has been shipping (100 and 90). A report that
> never moved a threshold renders exactly as before; a report that did move one now
> gets the colours it asked for. The previous labels were "Warning → Safe (%)" and
> "Danger → Warning (%)"; the underlying property names (`safeMax`, `warningMax`) are
> unchanged, so saved reports keep loading.
- Safe Color: Fill color for the safe zone
- Warning Color: Fill color for the warning zone
- Danger Color: Fill color for the danger zone

### Value Settings
- Show Percentage: Toggle visibility of the percentage label
- Show Values: Toggle visibility of the raw values (current/max)
- Value Prefix: Text to prefix before values (e.g. "$")
- Value Unit: Text to append after values (e.g. "kg", "mb")
- Font Size: Base font size for text in pixels
- Category Color: Text color for the category label
- Category Font Size: Font size for the category label
- Values Color: Text color for both percentage and current/max values when explicitly set
- Values Font Size: Font size for both percentage and current/max values; Values font styles apply to both
- Model number formats: Current Value and Max Value each retain their own model precision and units, including in tooltips
- Label Color: Text color for the optional label/subtitle

### Axis Settings
- Show Axis Titles: Toggle visibility of axis titles
- X Axis Title: Title for the X-axis
- Y Axis Title: Title for the Y-axis

## How to Use
1. Import the `.pbiviz` file into Power BI Desktop (from the Visuals pane -> ... -> Import from file).
2. Locate the visual in the Visualizations pane and add it to the report canvas.
3. Bind data to the data roles:
   - Category: Optional row label (text or grouping field)
   - Current Value: Required numeric measure for the actual value
   - Max Value: Required numeric measure for the limit value
   - Label: Optional numeric or text measure for a subtitle (displayed as text)
   - Sort Order: Optional numeric measure to control row order (ascending)
4. Use the format pane to adjust appearance:
   - Set bar dimensions, track color, layout, and row height
   - Choose color mode (fixed or zoned), state whether Max Value is a Goal or a
     Limit, and configure zone thresholds and colors
   - Adjust value display, prefixes, units, fonts, and colors
   - Enable axis titles if desired
5. Interact:
   - Click a bar to cross-filter other visuals by that category
   - Right-click for the context menu
   - Hover to see a tooltip with category, current value, max value, percentage, and label

## Limitations
- The visual expects numeric values for Current Value and Max Value. Missing or invalid pairs are skipped.
- Zero current is displayed. Non-positive maxima are skipped; negative current retains its sign while bar geometry is bounded at zero.
- The Label role, if bound, is displayed as text.
- Sort Order, if bound, must be numeric; missing sort values follow finite sort values.
- Each data role accepts only one field.
- The visual uses a data reduction algorithm (top 30,000 rows) which may limit the number of rows displayed.
- In Grid layout, Columns can be pinned from 1 to 6; 0 chooses columns from usable row width. Narrow rows stack, and LED gaps shrink to keep blocks visible.
- The visual does not support drill-through or bookmark selection.

## Support
For help or questions, visit https://nexuscodex.nexus/support
