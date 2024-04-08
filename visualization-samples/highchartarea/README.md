# Highcharts area chart code sample

This Highcharts area chart example is integrated with Customvis library. A more complete explanation on the library and API using can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_summary.html).

For more details on Highcharts information and options, see the [Highcharts documentation](https://www.highcharts.com/docs/index).

## Integrating Highcharts visualization

This section demonstrates how the Highcharts area chart can be run and customized via Customvis libary.
With the example of this chart, you can integrate other type of Highcharts as well since most of the steps are similar. The difference between area chart and other charts lies in data slots, data series types and options.

### 1. Define data slots

A slot is the entry point for data that goes into a visualization, defined in `vizdef.xml` file. The concept of a slot can be linked with a column in the data table. There are two types of slots, *categorical* representing tuples and *continuous* for values. Each data point represents *a combination* of categorical slots, with the corresponding values. Data is automatically aggregated and can be manually adjusted in a dashboard or a report.

Take this area chart for example. The *Category* slot represents ticks on x-axis and *Value* slot for area. Additionally, an optional *Series* slot mapping to colors. If we map *Year* to *Category*, *Worldwide Gross* to *Value*, then data points would be worldwide gross value of each year, e.g: 2011 - $21488.7. 

Since *Series* slot is optional, it is not necessary to map this slot for the visualization to work ( which needs to be handled correctly in the code, explained later in this document in the Data converting step ). If we map this slot to *Season*,  each data point would represent worldwide gross value for *each* season of *each* year, e.g: 2011 - Winter - $4880.5. 

For more information on data model, refer to [Customvis library documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_data.html).

### 2. Loading and initializing chart

To use Highcharts library, we will need to load it via their CDN. Include these lines in a config file created at [`static/config.js`](./static/config.js)
```js
define( [], function()
{
	"use strict";
	return {
		packages:[
		{
			name:  'highcharts',
			main:  'highcharts'
		} ],
		paths:
		{
			"highcharts":  "https://code.highcharts.com"
		}
	};
} );
```
Then declare the module in [`external.d.ts`](./external.d.ts)
```js
declare module "highcharts";
```
We also need to link to our config file in [`manifest.xml`](./manifest.xml). 
```xml
<Bundle-Config>static/config</Bundle-Config>
```
Finally, on top of [`renderer/Main.ts`](./renderer/Main.ts), we can load and use the library.
```typescript
import Highcharts from "highcharts";
``` 
The library is now ready to be used in `Main.ts`. We will initialize the chart in `create( _node )`, store it in variable `this._chart`.  The provided argument `_node` is used as the chart container.
```typescript
this._chart = Highcharts.chart( _node, {} );
```
> The second argument is chart option. For initializing chart, we will leave it empty then update it later with `this._chart.update( options )`. If preferred, some default options can be parsed, along with empty data.

After creating the chart, it can be updated later in `update`. This function is called each time data, container size or properties changed. For further optimization (e.g. use cache to update the data only when data is changed), we can get the "cause" of `update` function getting called with `_info.reason`.

For more information on creating and updating, refer to the [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_rendering.html).

### 3. Data format

This section explains how to convert the data from Customvis to Highcharts' data format. The source of data can be retrieved in `update` function with `_info.data.rows`, which returns an array of data points. Data columns are stored in `_info.data.cols` as an array of columns.

The desired Highcharts data format is *an array of series*, where each series contains an object stating series name, an array of data points belonging to that series, and optionally a color string. For example:
```
series: [ 
  { 
    name: 'Winter', 
    color: "#0000FF",
    data: [89.3, 92.1, 94.4, 85.4] 
  }, 
  { 
    name: 'Summer', 
    color: "#FF0000",
    data: [95.8, 89.4, 91.2, 76.9] 
  }
]
```
As can be seen from the above example, there are two series for *Winter* and *Summer*. Each series has a name (that can be displayed via tooltip and/or legend), along with its color. This color can be retrieved via color palette property.
```typescript
const  palette = props.get( "colors" );
```
For each tuple, we can get the color with `palette.getColor( tuple )` which returns the color corresponding to a series. If series is not mapped, `getColor( null )` will return the first color from the palette.

> There are two types of Customvis color palette: for categorical (CatPalette) and continuous (ContPalette) data. The detailed uses can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_palettes.html).

We will create  `chartData` as an array of object, which contains name, series' color and a data array with fixed length (the number of categories). This array will later be used as *series* chart options.

First we need to get the list of categories and series. If the series slot is not mapped, we'll have only one series and fill the array with *null*. The series name will be set later with caption of *Value* slot.

```typescript
const  categories = data.cols[ CATEGORIES ].tuples.map( _tuple =>  _tuple.caption );
const  series = seriesMapped ? data.cols[ SERIES ].tuples : [ null ];
```
Then for each series tuples, create a `series` object, set its name, color and an empty array as data "holder". 
```typescript
const  chartData = [];
series.forEach( _tuple  =>
	{
		chartData.push(
			{
				name:  seriesMapped ? _tuple.caption : data.cols[ VALUE ].caption,
				color:  palette.getColor( _tuple ).toString(),
				data:  new  Array( categories.length ).fill( null )
			}
		);
	} );
```
Now we can fill our data points in those empty `data` array. It is important to know **where** the data should be. This place can be found via index of the data point's category and series. For each data point, we will store its value (in *y* attribute) and ID - used later for link the rendered visualization with the data behind.
```typescript
rows.forEach( _row => {
	const  seriesIndex = seriesMapped ? _row.tuple( SERIES ).index : 0;
	const  catIndex = _row.tuple( CATEGORY ).index;
	chartData[ seriesIndex ].data[ catIndex ] = {
		id: _row.key,
		y: _row.value( VALUE )
	};
} );
```
Our `chartData` object is now ready to be used in options to update data and render the chart.

### 4. Chart options

Highcharts API comes with a handful of configurable options to customize the chart. This sample does not cover a full list of area chart options but only selected common properties. A full list of options for area chart can be found in [Highcharts documentation](https://api.highcharts.com/highcharts/). Different Highcharts share a subset of options, for instances: background, colors, tooltip, legend, etc while some options are unique to specific types of charts.

The type of chart is indicated at `chart.type` option (`area` in this case). For other types of chart, simply replace it chart name and set its corresponding options.

Chart options are stored in a JSON object. They can be either hard coded or set via bundle properties. 

Bundle properties are defined in `vizdef.xml` file. There are several types of properties, including `color` for a single color, `palette` for a variety of colors (belong to the same palette), `string`, `number`, `boolean`, `enum` and more. A full list is available in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_properties.html).
A property is defined with type, an unique name, its caption and an optional default value. For example:

```xml
<color name="xAxis.label.color" caption="Label color"  defaultValue="black"/>
```
It then can be retrieved in `renderer/Main.ts` with `_info.props` using `get( propertyName )`  function.
```typescript
const props = _info.props;
const options =
{
  xAxis: {
	  labels: { 
		  style: { 
			  color:  props.get( "xAxis.label.color" ).toString() 
		  } 
	  }
  },
  ...,
  series: chartData
}
```
In the above example, we assign Highcharts option `xAxis.labels.style.color` with the value of `xAxis.label.color` bundle property value. 
> All color and palette properties return a Color object needs to be converted to string to be used in options.

The `chartData` object created in the previous section is used as chart series data. Setting the chart options including the data will render the visualization.

```typescript
this._chart.update( options, true, true );
```

### 5. Custom hit testing

Hit testing is the process of returning a data point based on a screen coordinate, needed for showing VIDA tooltips. For visualization that bind data using D3 model, the hit test is already implemented. With the external charts, we'll have to override the `hitTest` function. 

In our converting data step, we already stored data points (row) key to the `id` property. From this key, we can find its corresponding row by looking up in the rows object.

While setting chart options, we override two event: mouse over and mouse out of a data point. When a point is hovered, find the row having key as the data object's `id` then set it to `this._itemAtPoint`. When mouse out, setting it to *null*. They are set in `plotOptions.series.point.events` options of the chart.

```typescript
plotOptions: {
    series: {
        point: {
            events: {
                mouseOver: ( e: any ): void => {
                    this._itemAtPoint = this._rows.find( _row => _row.key === e.target.id ) || null;
                },
                mouseOut: ( ): void => {
                    this._itemAtPoint = null;
                }
            }
        }
    }
}
```

Then in `hitTest` function, simply return `this._itemAtPoint`. In this case, only when Highcharts tooltip is not shown, we would not want to have two different types of tooltips on the same screen.

```typescript
protected  hitTest(): DataPoint | null
{
	return  this._showHighchartsTooltip ? null : this._itemAtPoint;
}
```