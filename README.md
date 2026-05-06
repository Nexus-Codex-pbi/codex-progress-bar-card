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
- Fixed Color: Color used when Color Mode is Fixed
- Safe Max: Maximum value for the safe zone (as a percentage of maxValue, 0-100)
- Warning Max: Maximum value for the warning zone (as a percentage of maxValue, 0-100)
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
- Values Color: Text color for the current/max values
- Values Font Size: Font size for the current/max values
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
   - Choose color mode (fixed or zoned) and configure zone thresholds and colors
   - Adjust value display, prefixes, units, fonts, and colors
   - Enable axis titles if desired
5. Interact:
   - Click a bar to cross-filter other visuals by that category
   - Right-click for the context menu
   - Hover to see a tooltip with category, current value, max value, percentage, and label

## Limitations
- The visual expects numeric values for Current Value and Max Value. Non-numeric values are treated as zero.
- If Current Value or Max Value is missing or zero, the bar is not displayed.
- The Label role, if bound, is displayed as text; numeric values are formatted as numbers.
- Sort Order, if bound, must be numeric; non-numeric values are treated as zero (no sorting).
- Each data role accepts only one field.
- The visual uses a data reduction algorithm (top 30,000 rows) which may limit the number of rows displayed.
- In Grid layout, the number of columns is determined by the viewport width and cannot be manually set.
- The visual does not support drill-through or bookmark selection.

## Support
For help or questions, visit https://nexuscodex.nexus/support