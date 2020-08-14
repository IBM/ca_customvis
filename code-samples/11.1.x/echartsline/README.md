# ECharts line chart code sample

This ECharts line chart example is integrated with Customvis library. A more complete explanation on the library and API using can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_summary.html).

For more details on ECharts information and options, see the [ECharts documentation](https://echarts.apache.org/en/api.html#echarts).

## Integrating ECharts visualization

This section demonstrates how the ECharts line chart can be run and customized via Customvis libary.
With the example of this chart, you can integrate other type of ECharts as well since most of the steps are similar. The difference between line chart and other ECharts charts lies in data slots, data series types and options.

### 1. Define data slots

A slot is the entry point for data that goes into a visualization, defined in `vizdef.xml` file. The concept of a slot can be linked with a column in the data table. There are two types of slots, *categorical* representing tuples and *continuous* for values. Each data point represents *a combination* of categorical slots, with the corresponding values. Data is automatically aggregated and can be manually adjusted in a dashboard or a report.

Take this line chart for example. The *Category* slot represents categories on x-axis and *Value* slot for height of point on y-axis. Additionally, an optional *Series* slot mapping to colors. If we map *Year* to *Category*, *Worldwide Gross* to *Value*, then data points would be worldwide gross value of each year, e.g: 2011 - $21488.7. 

Since *Series* slot is optional, it is not necessary to map this slot for the visualization to work ( which needs to be handled correctly in the code, explained later in this document in the Data converting step ). If we map this slot to *Season*,  each data point would represent worldwide gross value for *each* season of *each* year, e.g: 2011 - Winter - $4880.5. 

For more information on data model, refer to [Customvis library documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_data.html).

### 2. Loading and initializing chart

In order to use ECharts libraries, we need to include it in the `package.json` under `dependencies`. After installing the library, the package will show up in `node_modules/`.
```
{
  "dependencies": {
    "echarts": "^4.6.0",
    ...
  },
  ...
}
```
On top of [`renderer/Main.ts`](./renderer/Main.ts), the library needs to be loaded.
```typescript
import { init } from  "echarts/echarts.common";
``` 
For the ECharts to work, we only need the  `init` function that create the chart and return its instance. We will initialize the chart in `create( _node )`, store it in variable `this._chart`.  The provided argument `_node` is used as the chart container.
```typescript
this._chart = init( _node );
```
After creating the chart, it can be updated later in `update`. This function is called each time data, container size or properties changed. For further optimization (e.g. use cache to update the data only when data is changed), we can get the "cause" of `update` function getting called with `_info.reason`.

For more information on creating and updating, refer to the [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_rendering.html).

### 3. Data format

This section explains how to convert the data from Customvis to ECharts' data format. The source of data can be retrieved in `update` function with `_info.data.rows`, which returns an array of data points. Data columns are stored in `_info.data.cols` as an array of columns.

The desired ECharts data format is *an array of series*, where each series contains an object stating type, series name and an array of data points belonging to that series, for example:
```
series: [ 
  { 
    type: 'line', 
    name: 'Winter', 
    lineStyle: {
		width: 2
	}
    data: [89.3, 92.1, 94.4, 85.4] 
  }, 
  { 
    type: 'line', 
    name: 'Summer', 
    lineStyle: {
		width: 5
	}, 
    data: [95.8, 89.4, 91.2, 76.9] 
  }
]
```
As can be seen from the above example, there are two series for *Winter* and *Summer*. Each series has chart type of *line* with different configurable options. To render other type of charts, simply replace value of *type* with another chart name, e.g. *bar*. It is also possible to combine different kinds of chart type on the same visualization, to create a combo chart.

> Since ECharts 4, it is possible to use dataset object - a 2-D array holding data with header row and column. The converting step is identical to implementing Google Charts in Customvis. See the Google Charts example for references. For more detailed on dataset, see the [ECharts documentation](https://echarts.apache.org/en/tutorial.html#Dataset).

We will have to create the `lineData` object, with chart type, style and a data array with fixed length (the number of categories). This object will later be used as *series* chart options.

First we need to get the list of categories and series. If the series slot is not mapped, we'll have only one series, named by caption of *value* slot.

```typescript
const  categories = data.cols[ CATEGORIES ].tuples.map( _tuple =>  _tuple.caption );
const  series = seriesMapped ? data.cols[ SERIES ].tuples.map( _tuple  =>  _tuple.caption ) : [ data.cols[ VALUE ].caption ];
```
Then for each series tuples, create a `series` object, set its name, chart type, styles and an empty array as data "holder".
```typescript
const  lineData = [];
series.forEach( _tuple  =>
	{ 
	  lineData.push( {
	    name:  _tuple,
	    type:  "line",
		lineStyle: {
			...
		},
		data: new Array( categories.length ).fill( null )
	  } );
	} 
);
```
Now we can fill our data points in those empty `data` array. It is important to know **where** the data should be. This place can be found via index of the data point's category and series values in the categories and series array. For each data point, we will store its value and ID - used later for link the rendered visualization with the data behind.
```typescript
rows.forEach( _row => {
	const  seriesIndex = seriesMapped ? series.indexOf( _row.tuple( SERIES ).caption ) : 0;
	const  catIndex = categories.indexOf( _row.tuple( CATEGORIES ).caption );
	lineData[ seriesIndex ].data[ catIndex ] = {
		name:  _row.key,
		value:  _row.value( VALUE )
	};
} );
```
Our `lineData` object is now ready to be used in options to update data and render the chart.

### 4. Chart options

ECharts API comes with a handful of configurable options to customize the chart. This sample does not cover a full list of line chart options but only selected common properties. A full list of options for line chart can be found in [ECharts documentation](https://echarts.apache.org/en/option.html). Different ECharts share a subset of options, for instances: background, colors, tooltip, legend, etc while some options are unique to specific types of charts.

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
    axisLabel: { 
	  color:  props.get( "xAxis.label.color" ).toString() 
	}
  },
  ...,
  series: lineData
}
```
In the above example, we assign ECharts option `xAxis.axisLabel.color` with the value of `xAxis.label.color` bundle property value. 
> All color and palette properties return a Color object which needs to be converted to string to be used in options.

The `lineData` object created in the previous section is used as chart series data. Setting the chart options including the data will render the visualization.

```typescript
this._chart.setOption( options );
```

#### Color palette

A color palette is often used for charts with different series. The desired format for ECharts color options is an array of strings representing colors. In order to get this array from our color palette in property, we need to get the list of tuples from series slot, then obtain the corresponding color for each tuple.
```typescript
const palette = props.get( "color" ) as  CatPalette;
const colors = seriesMapped ? data.cols[ SERIES ].tuples.map( _tuple  =>  palette.getColor( _tuple ).toString() ) : [ palette.getColor( null ).toString() ];
```
The above code first get the palette ( named `colors` in `vizdef.xml` file ) from bundle property. Then for each of the tuples in series slot, retrieve the color with `getColor( tuple )` function.  In case series is not mapped, the array only contains the first color from the palette.
> There are two types of Customvis color palette: for categorical (CatPalette) and continuous (ContPalette) data. The detailed uses can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_palettes.html).

### 5. Custom hit testing

Hit testing is the process of returning a data point based on a screen coordinate, needed for showing VIDA tooltips. For visualization that bind data using D3 model, the hit test is already implemented. With the external charts, we'll have to override the `hitTest` function. 

In our converting data step, we already stored data points (row) key to the `name` property. From this key, we can find its corresponding row by looking up in the rows object.

In `create` function, we bind these two event handlers on the chart object. When a point is hovered, find the row having key as the data object's `name` then set it to `this._itemAtPoint`. When mouse out, setting it to *null*.

```typescript
this._chart.on( "mouseover", { componentType:  "markPoint" }, e  => {
  this._itemAtPoint = this._rows.find( _row => _row.key === e.data.name ) || null;
} );
this._chart.on( "mouseout", { componentType:  "markPoint" }, () =>  this._itemAtPoint = null );
```

Then in `hitTest` function, simply return `this._itemAtPoint`. In this case, only when ECharts tooltip is not shown, we would not want to have two different types of tooltips on the same screen.

```typescript
protected  hitTest(): DataPoint | null
{
	return  this._showEchartsTooltip ? null : this._itemAtPoint;
}
```