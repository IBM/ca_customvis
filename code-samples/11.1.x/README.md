# customvis-samples

## Summary
This repo holds code samples for developers of custom visualizations. The code samples found here have the purpose of illustrating certain aspects of the customvis library and tools.

This means that the main focus of each sample is not completeness of the visualization, showing how certain things work. Each sample is fully documented and tested and can be made publicly available.

## Running a sample
You can run any sample locally by running `customvis start` inside the folder that contains the sample. After that, you can use the 'Preview Vis' in IBM Cognos Analytics Dashboard or Reporting to insert the custom visualization in your dashboard or report.

Alternatively, you can package a sample with `customvis pack` and upload it to Cognos Analytics.

## Contents

### Weather
- Render a single, non-optional, formatted data value.
- Show how to include static images.
- Make a sizeable visualization using svg viewBox.
- Use of color, number and boolean properties.
 
### Ternary
- Render elements on a position in an equilateral triangle.
- Enable or disable properties based on the value of another property.
- Change render behaviour for small size visualizations.
- Apply highlight and selection styling.
- Store text in a resource file for possible translation.
- Use an external javascript library ('RBush' for label overlapping).
- Separate render logic from data handling as a coding pattern.
- Memory efficient rendering with accessor functions for calculations.
- Use UpdateInfo.reason for render optimization.

### Scatter
- Render a simple scatter plot chart.
- Provide UI-language aware text.
- Use various types of properties in the visualization.
- Update property status based on the value of another property.
- Customize the legend.
- Use an optional slot.

### Overlay bar
- Render a simple bar chart with overlaid bars.
- Embed a static image in a visualization.
- Highlight and selection decorations.
- Make modifications to palette colors.

### Quadrant
- Render a more advanced scatter visualization.
- Use animation in charts.
- Render axis titles.
- Highlight and selection decorations (raise elements).
- Use custom data domains for the x-axis and y-axis.

### Sankey
- Use a third party library for calculations.
- Highlight and selection decorations by color and font.
- Implement custom hit testing for tooltips, highlights and selections.

## More Information
For more information, please visit the [Knowledge Center](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.ig_smples.doc/c_sample_customvis.html).
