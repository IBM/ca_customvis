
# Google bar chart code sample

This Google bar chart example is integrated with Customvis library. A more complete explanation on the library and API using can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_summary.html).

For more details on Google chart information and options, see the [Google documentation](https://developers.google.com/chart/interactive/docs/gallery/barchart).

## Integrating Google charts

This section demonstrates how the Google bar chart can be run and customized via Customvis libary.
With the example of bar chart, you can integrate other type of Google charts as well since most of the steps are similar. The difference between bar chart and other Google charts lies in data slots, library used, data format, and options.

### 1. Define data slots

A slot is the entry point for data that goes into a visualization, defined in `vizdef.xml` file. The concept of a slot can be linked with a column in the data table. There are two types of slots, *categorical* representing tuples and *continuous* for values. Each data point represents *a combination* of categorical slots, with the corresponding values. Data is automatically aggregated and can be manually adjusted in a dashboard or a report.

Take this bar chart for example. The *Category* slot represents bars on y-axis and *Value* slot for length of the bar on x-axis. Additionally, an optional *Series* slot mapping to colors. If we map *Year* to *Category*, *Worldwide Gross* to *Value*, then data points would be worldwide gross value of each year, e.g: 2011 - $21488.7. 

Since *Series* slot is optional, it is not necessary to map this slot for the visualization to work ( which needs to be handled correctly in the code, explained later in this document in the Data converting step ). If we map this slot to *Season*,  each data point would represent worldwide gross value for *each* season of *each* year, e.g: 2011 - Winter - $4880.5. 

For more information on data model, refer to [Customvis library documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_data.html).

### 2. Loading and initializing chart

Google charts are loaded via Google package API and its included chart class. The instruction can be found in [Google chart documentation]([https://developers.google.com/chart/interactive/docs/gallery/barchart#loading](https://developers.google.com/chart/interactive/docs/gallery/barchart#loading)). 

On top of [`renderer/Main.ts`](./renderer/Main.ts), the library needs to be loaded in order to use Google chart features. 
```typescript
import "https://www.gstatic.com/charts/loader.js";
google.charts.load( "current", { packages: [ "corechart" ] } ); 
```
After loading the library, the chart will be initialized in `create( _node )` function. In this way, it only needs to be created once then we can update it later based on the data or options. For Google bar chart, the class `BarChart` is used. The provided argument, `_node` will be the chart container.
> Every use of google functions (chart creating/updating, converting data to DataTable) needs to placed inside `google.charts.setOnLoadCallback` to ensure they are executed after Google visualization API is loaded
```typescript
google.charts.setOnLoadCallback( () => this._chart = new google.visualization.BarChart( _node ) );
```
For other types of charts, simply find their corresponding library ( `corechart` for most of the cases ) and chart class then replace them in the code.

After intializing the chart, it can be updated in `update( _info: UpdateInfo )` function. This function is called each time data, container size or properties changed. For further optimization (e.g. use cache to update the data only when data is changed), we can get "cause" of `update` function getting called with `_info.reason`.

For more information on creating and updating, refer to the [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_rendering.html).

### 3. Data format

After initializing the chart, data will be converted to Google's data table to draw the chart. This section explains how to convert the data from Customvis to Google DataTable. This can be done with `google.visualization.arrayToDataTable( data )`, but `data` needs to be in the correct format. 

The source of data can be retrieved in `update` function with `_info.data.rows`, which returns an array of data points. Data columns are stored in `_info.data.cols` as an array of columns.

The desired Google data format is a 2-D array, similar to a table. The first row consists of headers, first column is category names and the remaining cells are data entries. The complexity of this array and the code is based on whether `series` slot is mapped.

More detailed information of the data format can be found in [Google chart documentation](https://developers.google.com/chart/interactive/docs/gallery/barchart#data-format).

> While most of the Google charts use the same format, there are some exception with a few differences. See the Google Histogram chart for an example. 

#### No series 
If series is not mapped, which means only two columns exist: category and value. A movies revenue data set will be used as an example, where *Year* is mapped to Category and *Worldwide Gross* as Value. 

Firstly we need to append the first (1-D) array as header.
```typescript
const chartData = [];
chartData.push( [ data.cols[ CATEGORY ].caption, data.cols[ VALUE ].caption ] );
```
After this step, our `chartData` object would look like this
<pre>
[
    <b>[ "Year", "Worldwide ]</b>
]
</pre>

Then, for each data points of our data source ( `_info.data.rows` ), simply append an array consisting category caption and value to `chartData`
```typescript
data.rows.forEach( _row => {
    chartData.push( [ _row.tuple( CATEGORY ).caption, _row.value( VALUE ) ] );
} );
```
Our final chartData is now ready to be converted to Google data table
<pre>
[
    [ "Year", "Worldwide Gross" ],
    <b>[ "2007", 16547.9 ],
    [ "2008", 18722.6 ],
    [ "2009", 22756.5 ],
    [ "2010", 21265.9 ],
    [ "2011", 21488.7 ]</b>
]
</pre>

#### Series is mapped

In case series is mapped, our data table is extended with more columns, each column is corresponded to a series' value. Take the above example of Hollywood Movies data, with an addition of *Season* being mapped to series. Unlike the previous example, now the 2-D array needs to be initialized then we will fill the data in later.

First we need to get the list of categories and series - corresponding to rows and columns of data table.

```typescript
const  categories = data.cols[ CATEGORY ].tuples.map( e  =>  e.caption ); 
const  series = data.cols[ SERIES ].tuples.map( e  =>  e.caption );

// categories is [ "2007", "2008", "2009" ,"2010", "2011" ]
// series is [ "Winter", "Spring", "Summer", "Fall" ]
```
Now we can initialize the array. The first row will always be column headers.
```typescript
const chartData = [];
chartData.push( [ data.cols[ CATEGORY ].caption ].concat( series ) );
```
Result:
<pre>
[
	<b>[ "Year", "Winter", "Spring", "Summer", "Fall" ]</b>
]
</pre>

Then for each category, we create an array where the first element is category name and the remaining are (empty) values for every series. The length of this array would be `series.length + 1`. We will fill the empty values with *null* then append this array to `chartData`.
```typescript
categories.forEach( _category  => {
	const  catArray = new  Array( series.length + 1 ).fill( null );
	catArray[ 0 ] = _category;
	chartData.push( catArray );
} );
```
After initializing, the `chartData` now has all the place needed to fill data in.
<pre>
[
	[ "Year", "Winter", "Spring", "Summer", "Fall" ],
	<b>[ "2007", null, null, null, null ],
	[ "2008", null, null, null, null ],
	[ "2009", null, null, null, null ],
	[ "2010", null, null, null, null ],
	[ "2011", null, null, null, null ]</b>
]
</pre>
Finally we can fill in the data. For each data point, it is important to find **where** the value should be in the 2-D array. The "coordinate" can be found via index of the data point's category and series values in the categories and series array, increased by 1 since the first column and row are for headers.
```typescript
data.rows.forEach( _row  => {
	chartData[ categories.indexOf( _row.tuple( CATEGORY ).caption ) + 1 ][ series.indexOf( _row.tuple( SERIES ).caption ) + 1 ] = _row.value( VALUE );
} );
```
Now the `chartData` is ready to be parsed.
<pre>
[
	[ "Year", "Winter", "Spring", "Summer", "Fall" ],
	[ "2007", <b>3237.3, 4792.2, 4074.3, 4444.1</b> ],
	[ "2008", <b>6346.3, 4685.6, 3903, 3787.7</b> ],
	[ "2009", <b>4599.6, 5285.1, 5349.9, 7521.9</b> ],
	[ "2010", <b>4192.6, 5929.4, 4470.2, 6673.7</b> ],
	[ "2011", <b>4880.5, 5560.8, 4031.9, 7015.5</b> ]
]
</pre>

> In the code, instead of *null*, the initial `chartData` was filled with 0, since Google Bar can not handle null value properly in some scenarios.

### 4. Chart options

Google chart API comes with a handful of configurable options to customize the chart. This sample does not cover a full list of Google bar chart options but only selected common properties. A full list of options for bar chart can be found in [Google bar chart documentation](https://developers.google.com/chart/interactive/docs/gallery/barchart#configuration-options). Different Google charts share a subset of options, for instances: background, colors, animation, legend, etc while some options are unique to specific types of charts.

Google chart options are stored in a JSON object. They can be either hard coded or set via bundle properties. 

Bundle properties are defined in `vizdef.xml` file. There are several types of properties, including `color` for a single color, `palette` for a variety of colors (belong to the same palette), `string`, `number`, `boolean`, `enum` and more. A full list is available in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_properties.html).

A property is defined with type, an unique name, its caption and an optional default value. For example:
```xml
<color name="background.color" caption="Background color" defaultValue="white" />
```
It then can be retrieved in `renderer/Main.ts` with `_info.props` using `get( propertyName )`  function.
```typescript
const props = _info.props;
const options =
{
  backgroundColor: {
    fill: props.get( "background.color" ).toString()
  },
  ...
}
```
In the above example, we assign Google option `backgroundColor.fill` with the value of `background.color` bundle property value.
> All color and palette properties return a Color object which needs to be converted to string to be used in options.

#### Color palette

A color palette is often used for charts with different series. The desired format for Google chart color options is an array of strings representing colors. In order to get this array from our color palette in property, we need to get the list of tuples from series slot, then obtain the corresponding color for each tuple. 
```typescript
const palette = props.get( "colors" ) as CatPalette;
const colors = data.cols[ SERIES ].tuples.map( _t  =>  palette.getColor( _t ).toString() );
```
The above code first get the palette ( named `colors` in `vizdef.xml` file ) from bundle property. Then for each of the tuples in series slot, retrieve the color with `getColor( tuple )` function.
> There are two types of Customvis color palette: for categorical (CatPalette) and continuous (ContPalette) data. The detailed uses can be found in [Customvis documentation](https://www.ibm.com/support/knowledgecenter/en/SSEP7J_11.1.0/com.ibm.swg.ba.cognos.dg_custom_vis.doc/ca_customviz_lib_palettes.html).

--- 

After setting the options and converting data, the chart can be drawn.
```typescript
google.charts.setOnLoadCallback(
  () =>  this._chart.draw( google.visualization.arrayToDataTable( chartData ), options )
 );
```
