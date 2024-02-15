// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

define( {
    // Slot captions
    "slot_probability.caption"                                    : "Probability",
    "slot_impact.caption"                                         : "Impact",
    "slot_riskId.caption"                                         : "Risk ID",

    //
    // Property groups
    //

    // The two main groups
    "group_visualization.caption"                           : "Visualization",
    "group_text.caption"                                    : "Text",

    // Tile colors
    "group_tileColors.caption"                              : "Tile colors",
    "prop_color.low.caption"                                : "Low",
    "prop_color.medium.caption"                             : "Medium",
    "prop_color.high.caption"                               : "High",
    "prop_color.veryHigh.caption"                           : "Very High",

    // Visualization groups
    "group_general.caption"                                 : "General",
    "group_axes.caption"                                    : "Axes",
    "group_bottom.caption"                                  : "Bottom Axis",
    "group_left.caption"                                    : "Left Axis",
    "group_chart.caption"                                   : "Chart",
    "group_visualization.padding.caption"                   : "Padding",
    "group_visualization.padding.description"               : "The padding added to the chart.",

    // Text groups
    "group_axis.label.caption"                              : "Axis labels",
    "group_axis.value.caption"                              : "Axis values",
    "group_value.label.caption"                             : "Value labels",

    //
    // Properties
    //

    // dot separated properties
    "prop_contrast.label.color.caption"                     : "Contrast label color",
    "prop_contrast.label.color.description"                 : "Adjusts the label color to contrast with the background.",

    "prop_valueLabels.color.caption"                        : "Value label color",
    "prop_valueLabels.color.description"                    : "The color that is applied to the value labels.",
    "prop_valueLabels.font.caption"                         : "Value label font",
    "prop_valueLabels.font.description"                     : "The font that is applied to the value labels.",

    "prop_visualization.padding.left.caption"               : "Left padding",
    "prop_visualization.padding.left.description"           : "The padding added to the left of the chart.",
    "prop_visualization.padding.right.caption"              : "Right padding",
    "prop_visualization.padding.right.description"          : "The padding added to the right of the chart.",
    "prop_visualization.padding.top.caption"                : "Top padding",
    "prop_visualization.padding.top.description"            : "The padding added to the top of the chart.",
    "prop_visualization.padding.bottom.caption"             : "Bottom padding",
    "prop_visualization.padding.bottom.description"         : "The padding added to the bottom of the chart.",

    //
    // Enumerations (properties)
    //

    // Layout Mode enum
    "enum_layoutMode_automatic.caption"                     : "Automatic",
    "enum_layoutMode_horizontal.caption"                    : "Horizontal",
    "enum_layoutMode_vertical.caption"                      : "Vertical",
    "enum_layoutMode_both.caption"                          : "Horizontal and vertical",
    "enum_layoutMode_angled.caption"                        : "Angled",
    "enum_layoutMode_any.caption"                           : "Free",
    "enum_layoutMode_rotate.caption"                        : "Rotate",
    "enum_layoutMode_stagger.caption"                       : "Stagger",

    "prop_bottom.title.caption"                         : "Bottom axis title",
    "prop_bottom.title.description"                     : "The title of the bottom axis.",
    "prop_bottom.title.color.caption"                   : "Bottom axis title color",
    "prop_bottom.title.color.description"               : "The color of the bottom axis title.",
    "prop_bottom.title.font.caption"                    : "Bottom axis title font",
    "prop_bottom.title.font.description"                : "The font that is applied to the bottom axis title.",
    "prop_bottom.title.visible.caption"                 : "Show bottom axis title",
    "prop_bottom.title.visible.description"             : "Shows the bottom axis title.",
    "prop_bottom.ticks.labels.color.caption"            : "Bottom axis label color",
    "prop_bottom.ticks.labels.color.description"        : "The color of the bottom axis label.",
    "prop_bottom.ticks.labels.font.caption"             : "Bottom axis label font",
    "prop_bottom.ticks.labels.font.description"         : "The font that is applied to the bottom axis labels.",
    "prop_bottom.ticks.labels.visible.caption"          : "Show bottom axis labels",
    "prop_bottom.ticks.labels.visible.description"      : "Shows the bottom axis labels.",
    "prop_bottom.ticks.labels.layoutMode.caption"       : "Bottom axis label orientation",
    "prop_bottom.ticks.labels.layoutMode.description"   : "Configures the layout mode for the bottom axis labels.",
    "prop_bottom.ticks.labels.rotateAngle.caption"      : "Rotate angle",
    "prop_bottom.ticks.labels.rotateAngle.description"  : "Axis label rotation angle 0-180",
    "prop_bottom.line.visible.caption"                  : "Show bottom axis line",
    "prop_bottom.line.visible.description"              : "Shows the bottom axis line.",
    "prop_bottom.line.color.caption"                    : "Bottom axis line color",
    "prop_bottom.line.color.description"                : "The color of the bottom axis line.",
    "prop_bottom.ticks.visible.caption"                 : "Show bottom axis ticks",
    "prop_bottom.ticks.visible.description"             : "Shows the bottom axis ticks.",
    "prop_bottom.ticks.color.caption"                   : "Bottom axis tick color",
    "prop_bottom.ticks.color.description"               : "The color of the bottom axis ticks.",
    "prop_left.title.caption"                          : "Left axis title",
    "prop_left.title.description"                      : "The title of the left axis.",
    "prop_left.title.color.caption"                    : "Left axis title color",
    "prop_left.title.color.description"                : "The color of the left axis title.",
    "prop_left.title.font.caption"                     : "Left axis title font",
    "prop_left.title.font.description"                 : "The font that is applied to the left axis title.",
    "prop_left.title.visible.caption"                  : "Show left axis title",
    "prop_left.title.visible.description"              : "Shows the left axis title.",
    "prop_left.ticks.labels.color.caption"             : "Left axis label color",
    "prop_left.ticks.labels.color.description"         : "The color of the left axis label.",
    "prop_left.ticks.labels.font.caption"              : "Left axis label font",
    "prop_left.ticks.labels.font.description"          : "The font that is applied to the left axis labels.",
    "prop_left.ticks.labels.visible.caption"           : "Show left axis labels",
    "prop_left.ticks.labels.visible.description"       : "Shows the left axis labels.",
    "prop_left.line.visible.caption"                   : "Show left axis line",
    "prop_left.line.visible.description"               : "Shows the left axis line.",
    "prop_left.line.color.caption"                     : "Left axis line color",
    "prop_left.line.color.description"                 : "The color of the left axis line.",
    "prop_left.ticks.visible.caption"                  : "Show left axis ticks",
    "prop_left.ticks.visible.description"              : "Shows the left axis ticks.",
    "prop_left.ticks.color.caption"                    : "Left axis tick color",
    "prop_left.ticks.color.description"                : "The color of the left axis ticks.",
} );
