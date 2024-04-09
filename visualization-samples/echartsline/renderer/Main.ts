// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2020
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, DataPoint, Tuple, CatPalette, Color } from "@businessanalytics/customvis-lib";
import { init } from "echarts/echarts.common"; // Loading ECharts library

const CATEGORIES = 0, SERIES = 1, VALUES = 2; // data column indices

export default class extends RenderBase
{
    private _chart;
    private _showEchartsTooltip = false;
    private _rows: DataPoint[] = [];
    private _itemAtPoint: DataPoint | null = null;

    protected create( _node: HTMLElement ): HTMLElement
    {
        // Initialize chart
        this._chart = init( _node );

        // When mouse on point, look for the datapoint and set to this._itemAtPoint
        this._chart.on( "mouseover", { componentType: "markPoint" }, e =>
            {
                this._itemAtPoint = this._rows.find( _row => _row.key === e.data.name ) || null;
            }
        );

        this._chart.on( "mouseout", { componentType: "markPoint" }, () => this._itemAtPoint = null );

        return _node;
    }

    protected update( _info: UpdateInfo ): void
    {
        const data = _info.data;
        // Clear the chart if there's no data
        if ( !data )
        {
            this._chart.clear();
            return;
        }
        const props = _info.props;
        this._rows = data.rows;
        this._showEchartsTooltip = props.get( "tooltip.show" );

        const seriesMapped = data.cols[ SERIES ].mapped;

        const lineData = [];
        // Get the list of categories and series
        const categories = data.cols[ CATEGORIES ].tuples.map( ( _tuple: Tuple ) => _tuple.caption );
        const series = seriesMapped ? data.cols[ SERIES ].tuples.map( _tuple => _tuple.caption ) : [ data.cols[ VALUES ].caption ];
        // For each series, create an ECharts series object, storing an array of data for that series
        // The data array contains data value for every categories in that series
        series.forEach( _tuple =>
            {
                lineData.push(
                    {
                        name: _tuple,
                        type: "line",
                        // Style can be different among different series, but in this case they all have the same line style
                        lineStyle: {
                            width: props.get( "line.width" ),
                            type: props.get( "line.style" )
                        },
                        symbol: props.get( "line.symbol" ),
                        symbolSize: props.get( "line.symbol.size" ),
                        // Initialize the array and fill them with null
                        data: new Array( categories.length ).fill( null )
                    }
                );
            } );
        this._rows.forEach( _row =>
            {
                // Fill data in the 2-d array based on index of category (column) and series (row)
                // If series is not mapped, series index is always 0 since there's only one series
                const seriesIndex = seriesMapped ? series.indexOf( _row.tuple( SERIES ).caption ) : 0;
                const catIndex = categories.indexOf( _row.tuple( CATEGORIES ).caption );
                // Store row key to look up data points for the hitTest
                lineData[ seriesIndex ].data[ catIndex ] = {
                    name: _row.key,
                    value: _row.value( VALUES )
                };
            } );

        // Get color array by mapping each series to its responding color from the palette, if series is not mapped, get the first color of the palette
        const palette = props.get( "color" ) as CatPalette;
        const colors = seriesMapped ? data.cols[ SERIES ].tuples.map( _tuple => palette.getColor( _tuple ).toString() ) : [ palette.getColor( null ).toString() ];

        // Add opacity to tooltip background
        const tooltipBgColor = props.get( "tooltip.background.color" );
        const tooltipBgOpacityColor = new Color( tooltipBgColor.r, tooltipBgColor.g, tooltipBgColor.b, props.get( "tooltip.background.opacity" ) );

        // Set options based on properties
        this._chart.setOption(
            {
                color: colors,
                dataZoom: props.get( "xAxis.zoom" ) ? [ {
                    type: "slider",
                    start: 0,
                    end: 100
                }, {
                    type: "inside",
                    start: 0,
                    end: 100
                } ] : null,
                grid: {
                    left: props.get( "grid.left" ),
                    right: props.get( "grid.right" ),
                    top: props.get( "grid.top" ),
                    bottom: props.get( "grid.bottom" ),
                    containLabel: true
                },
                xAxis: {
                    // x axis data is category names for ticks' values
                    data: categories,
                    name: props.get( "xAxis.title" ),
                    nameLocation: props.get( "xAxis.title.place" ),
                    nameTextStyle: { color: props.get( "xAxis.title.color" ).toString() },
                    nameGap: props.get( "xAxis.title.padding" ),
                    inverse: props.get( "xAxis.inverse" ),
                    position: props.get( "yAxis.inverse" ) ? "top" : "bottom",
                    axisLabel: { color: props.get( "xAxis.label.color" ).toString() },
                    axisLine: { lineStyle: { color: props.get( "xAxis.line.color" ).toString() } }
                },
                yAxis: {
                    inverse: props.get( "yAxis.inverse" ),
                    nameLocation: props.get( "yAxis.title.place" ),
                    nameTextStyle: { color: props.get( "yAxis.title.color" ).toString() },
                    nameGap: props.get( "yAxis.title.padding" ),
                    axisLabel: { color: props.get( "yAxis.label.color" ).toString() },
                    name: props.get( "yAxis.title" ),
                    axisLine: { lineStyle: { color: props.get( "yAxis.line.color" ).toString() } },
                    splitLine: { lineStyle: { color: props.get( "yAxis.grid.color" ).toString() } }
                },
                tooltip: {
                    trigger: "axis",
                    show: this._showEchartsTooltip,
                    backgroundColor: tooltipBgOpacityColor.toString(),
                    textStyle: { color: props.get( "tooltip.text.color" ).toString() }
                },
                legend: {
                    data: series,
                    show: props.get( "echartsLegend.show" ),
                    left: props.get( "echartsLegend.place.horizontal" ),
                    top: props.get( "echartsLegend.place.vertical" ),
                    orient: props.get( "echartsLegend.orient" ),
                    textStyle: { color: props.get( "echartsLegend.text.color" ).toString() }
                },
                series: lineData
            }, true );

        // Resize chart when container is resized
        if ( _info.reason.size )
            this._chart.resize();
    }

    // Enable/disable properties based on other properties' values
    protected updateProperty( _name: string, _value: any ): void
    {
        switch( _name )
        {
            case "echartsLegend.show":
                this.properties.setActive( "echartsLegend.place.horizontal", _value );
                this.properties.setActive( "echartsLegend.place.vertical", _value );
                this.properties.setActive( "echartsLegend.orient", _value );
                this.properties.setActive( "echartsLegend.text.color", _value );
                break;
            case "tooltip.show":
                this.properties.setActive( "tooltip.background.color", _value );
                this.properties.setActive( "tooltip.background.opacity", _value );
                this.properties.setActive( "tooltip.text.color", _value );
                break;
            case "xAxis.title":
                this.properties.setActive( "xAxis.title.place", _value !== "" );
                this.properties.setActive( "xAxis.title.color", _value !== "" );
                this.properties.setActive( "xAxis.title.padding", _value !== "" );
                break;
            case "yAxis.title":
                this.properties.setActive( "yAxis.title.place", _value !== "" );
                this.properties.setActive( "yAxis.title.color", _value !== "" );
                this.properties.setActive( "yAxis.title.padding", _value !== "" );
                break;
            case "line.symbol":
                this.properties.setActive( "line.symbol.size", _value !== "none" );
        }
    }

    // Return data point to show VIDA tooltip. When ECharts tooltip is shown, always return null to hide VIDA tooltip
    protected hitTest(): DataPoint | null
    {
        return this._showEchartsTooltip ? null : this._itemAtPoint;
    }
}
