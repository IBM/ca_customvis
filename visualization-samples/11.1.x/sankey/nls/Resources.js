define(
{
    "root":
    {
        // slots
        "slot.from":                    "From",
        "slot.to":                      "To",
        "slot.weight":                  "Weight",

        // properties

        "group.general":                "General",

        "group.links" :                 "Links",
        "links.fillType" :              "Fill type",
        "linkFillType.gradient":        "Gradient",
        "linkFillType.from":            "From",
        "linkFillType.to":              "To",
        "linkFillType.solid":           "Fill solid",
        "link.color":                   "Link color",

        "group.palettes":               "Palettes",
        "color":                        "Color",
        "node.level-color":             "Level-based coloring",

        "label.color" :                 "Color",

        "group.nodes" :                 "Nodes",
        "label.font" :                  "Font",
        "nodes.alignment":              "Node alignment",
        "nodes.alignment.desc":         "Node layout alignment.",
        "alignment.justify":            "Justify",
        "alignment.left":               "Left",
        "alignment.right":              "Right",
        "alignment.center":             "Center",

        "node.width":                   "Node width",
        "node.width.desc":              "Width of a node.",
        "node.padding":                 "Padding",
        "node.padding.desc":            "Separation between nodes at each column.",
        "node.border.width":            "Border width",
        "node.border.width.desc":       "Define the width of a node's border.",
        "node.border.color":            "Border color",
        "node.border.color.desc":       "Color of node's border",

        "labels.hideUnused":            "Suppress unused",
        "labels.hideUnused.desc":       "Suppress nodes that are not related to any link values (i.e. no value).",

        "labels.show":                  "Show labels",
        "label.yAlign":                 "Vertical alignment",
        "label.yAlign.default":         "Default",
        "label.yAlign.top":             "Top",
        "label.yAlign.bottom":          "Bottom",

        "labels.wrapping":              "Label wrapping",
        "labels.wrapping.desc":         "Attempt to wrap long labels if too wide (within a fraction of the gap width between nodes).",
        "labels.hideCollided":          "Hide colliding labels",
        "labels.hideCollided.desc":     "Attempt to hide labels that are colliding with other labels (and nodes - optional).",
        "group.collision":              "Collision",
        "labels.hideCollided.includeNodes": "Include nodes",
        "labels.hideCollided.includeNodes.desc": "Also hide labels that are colliding with nodes.",

        "group.advance" :               "Sankey advanced settings",

        "advance.considerNegatives" :    "Consider negative weights",
        "advance.considerNegatives.desc" : "Sankey works with positive flow weights only. To attempt to include negative weights as reversed flow directions for Sankey generator. Negating flows may end up with multiple flow values for source/target pairs, and the rendering could still include only 1 single flow weight for rendering, and the renderer DO NOT/CANNOT aggregate weights. Sankey DOES NOT support circular linking of nodes.",
    }

    // TODO: other languages
} );