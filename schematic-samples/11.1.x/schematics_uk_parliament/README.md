# customvis-accelerator-content/schematics_uk_parliament

**parliamentSchematic.zip** A schematic package containing a UK Parliament House of commons svg. Seat keys are mapped to constituencies (the order of generation maps to the leave-remain voting).

The **package** folder contains the raw files added to the zip.

The **data** folder contains the associated data for leave and remain voting by constituencies.

To use, upload the data to a CA instance, open a 'Test Schematic' visualization, and browse or drop the zip (package) onto the visualization. The data's 'constituency' column is mapped to the svg keys. Use this as the 'Regions Locations' slot mapping, and map the 'Leave' column to the 'Regions Location Color' slot.

Additionally, map the 'constituency' colum to the 'Points Locations' slot, and the 'Leave_bool' column to the 'Point Color' slot (and adjust the default point size in the properties - e.g. down to 4).

Views have also been added to the svg, so the visualization can be manipulated by the region layer and view controls.
