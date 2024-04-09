# FusionCharts Pareto chart code sample

This FusionCharts Pareto chart example is integrated with Customvis library. A more complete explanation on the library and API using can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_summary.html).

For more details on FusionCharts information and options, see the [FusionCharts documentation](https://www.fusioncharts.com/dev/fusioncharts).

## Integrating FusionCharts visualization

This section demonstrates how the FusionCharts Pareto chart can be run and customized via Customvis libary.
With the example of this chart, you can integrate other type of FusionCharts as well since most of the steps are similar. The difference between the pareto chart and other charts lies in data slots, data types and options.

### 1. Define data slots

A slot is the entry point for data that goes into a visualization, defined in `vizdef.xml` file. The concept of a slot can be linked with a column in the data table. There are two types of slots, *categorical* representing tuples and *continuous* for values. Each data point represents *a combination* of categorical slots, with the corresponding values. Data is automatically aggregated and can be manually adjusted in a dashboard or a report.

Take this Pareto chart for example. The *Category* slot represents columns and *Value* slot for column height. If we map *Year* to *Category*, *Worldwide Gross* to *Value*, then data points would be worldwide gross value of each year, e.g: 2011 - $21488.7. 

For more information on data model, refer to [Customvis library documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_data.html).

### 2. Loading and initializing chart

To use FusionCharts library, we will load it include it in our dependencies in `package.json`

```
"dependencies": {
	"fusioncharts": "latest"
}
```

Then on top of [`renderer/Main.ts`](./renderer/Main.ts), we will need to load core FusionCharts file, chart class (`Pareto2d` in our case ) and optional themes for a better appearance.
```typescript
import FusionCharts from "fusioncharts/core";
import Pareto2d from "fusioncharts/viz/pareto2d";
import FusionTheme from "fusioncharts/themes/es/fusioncharts.theme.fusion";
``` 
The library is now ready to be used in `Main.ts`. We will initialize the chart in `create( _node )`, store it in variable `this._chart`. First we need to add dependencies ( pareto class and theme to the FusionCharts core object )
```typescript
FusionCharts.addDep( Pareto2d );
FusionCharts.addDep( FusionTheme );
```
Then chart ID and DOM container ID are generated to avoid duplication when creating multiple charts. Container ID is assigned to `_node`.
```typescript
const containerId = `Container_${Math.random()}`;
const chartId = `FusionCharts_${Math.random()}`;
_node.setAttribute( "id", containerId );
```
Now the chart can be intialized. The constructor object contains plenty of attribute. Not all attributes are used in this example. For a complete list, refer to the [FusionCharts constructor guide](https://www.fusioncharts.com/dev/api/fusioncharts).
```typescript
this._chart = new  FusionCharts( {
	type:  "pareto2d",
	id:  chartId,
	renderAt:  containerId,
	width:  "100%",
	height:  "100%",
	dataFormat:  "json"
} );
this._chart.render();
```
> To render a different FusionCharts, it is needed to import the chart class from `fusioncharts/viz` folder, add dependency and declare the type in constructor.

After creating the chart, it can be updated later in `update`. This function is called each time data, container size or properties changed. For further optimization (e.g. use cache to update the data only when data is changed), we can get the "cause" of `update` function getting called with `_info.reason`.

For more information on creating and updating, refer to the [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_rendering.html).

### 3. Data format

This section explains how to convert the data from Customvis to FusionCharts' data format. The source of data can be retrieved in `update` function with `_info.data.rows`, which returns an array of data points. Data columns are stored in `_info.data.cols` as an array of columns.

The desired format for Pareto chart is an array of data object - corresponding to bars on the chart, each contains `label`, `value` and optionally, `color`. 
```
data: [ 
  { 
    name: 'Winter',
    value: 23260, 
    color: "#0000FF"
  }, 
  { 
    name: 'Summer',
    value: 21830, 
    color: "#FF0000"
  }
]
```
As can be seen from the above example, there are two data point for *Winter* and *Summer*. Each point has a name (that can be displayed via tooltip and/or legend), value along with its color. This color can be retrieved via color palette property.
```typescript
const palette = props.get( "colors" );
```
For each data point (row), we can get the color with `palette.getFillColor( row )` which returns the color corresponding to a data point. 

> There are two types of Customvis color palette: for categorical (CatPalette) and continuous (ContPalette) data. The detailed uses can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_palettes.html).

To create the data array, we can map from `_info.data.rows` - a list of data point from our source directly to a new array of data in FusionCharts format. For each row, create a new object, set the `label` to caption of *Category* column, `value` to value of *Value* column and `color` from the palette.

```ts
const data = _info.data.rows.map( _row  =>
	( {
		label: _row.caption( CATEGORIES ),
		value: _row.value( VALUE ),
		color: palette.getFillColor( _row ).toString()
	} )
);
```
We have successfully converted Customvis to FusionCharts data. After setting chart options, the chart can be rendered.

> For charts with multiple series ( e.g. stacked bar chart ), the `dataset` format is a array of series, each series contains a `data` object similar to the above one. For more details on FusionCharts multiple series, refer to [FusionCharts stacked chart documentation](https://www.fusioncharts.com/dev/chart-guide/standard-charts/stacked-charts).

### 4. Chart options

FusionCharts API comes with a handful of configurable options to customize the chart. This sample does not cover a full list of Pareto chart options but only selected common properties. The complete list can be found in [FusionCharts Pareto chart documentation](https://www.fusioncharts.com/dev/chart-guide/standard-charts/pareto-charts). Different FusionCharts share a subset of options, for instances: background, colors, tooltip, etc while some options are unique to specific types of charts.

Chart options are stored in a JSON object. They can be either hard coded or set via bundle properties. 

Bundle properties are defined in `vizdef.xml` file. There are several types of properties, including `color` for a single color, `palette` for a variety of colors (belong to the same palette), `string`, `number`, `boolean`, `enum` and more. A full list is available in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_properties.html).

A property is defined with type, an unique name, its caption and an optional default value. For example:
```xml
<color name="background.color" caption="Background color" defaultValue="white" />
```
It then can be retrieved in `renderer/Main.ts` with `_info.props` using `get( propertyName )`  function.
```typescript
const chartOptions =
{
  bgColor: colorToHex( _info.props.get( "background.color" ) ),
}
```
In the above example, we assign FusionCharts option `bgColor` with the value of `background.color` bundle property value. 
> For FusionCharts options, all color values must be in the form of HEX code. Several functions were written at the beginning of `renderer/Main.ts` to convert from `Color` object to hex code. 

After all the steps, we have everything required for the chart. Calling `setChartData` with chart options and data will render the visualization.
```typescript
this._chart.setChartData( {
	chart: chartOptions,
	data: data
} );
```