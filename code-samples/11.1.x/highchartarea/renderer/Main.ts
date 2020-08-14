// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2020
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, Tuple, DataPoint } from "@businessanalytics/customvis-lib";
import Highcharts from "highcharts";

const CATEGORY = 0, SERIES = 1, VALUE = 2;

export default class extends RenderBase
{
    private _chart: any;
    private _rows: DataPoint[];
    private _itemAtPoint: any = null;
    private _showHighchartsTooltip = true;

    protected create( _node: HTMLElement ): void
    {
        this._chart = Highcharts.chart( _node, { title: { text: undefined } } );
    }

    protected update( _info: UpdateInfo ): void
    {
        const data = _info.data;
        // Clear the chart if there's no data
        if ( !data )
        {
            while( this._chart.series.length > 0 )
                this._chart.series[ 0 ].remove( true );
            return;
        }
        this._rows = data.rows;
        const props = _info.props;

        const seriesMapped = data.cols[ SERIES ].mapped;
        const palette = props.get( "colors" );

        const chartData = [];
        // Get the list of categories and series
        const categories = data.cols[ CATEGORY ].tuples.map( ( _tuple: Tuple ) => _tuple.caption );
        const series = seriesMapped ? data.cols[ SERIES ].tuples : [ null ];
        // For each series, create an series object, storing an array of data for that series
        // The data array contains data value for every categories in that series
        series.forEach( _tuple =>
            {
                chartData.push(
                    {
                        name: seriesMapped ? _tuple.caption : data.cols[ VALUE ].caption,
                        color: palette.getColor( _tuple ).toString(),
                        data: new Array( categories.length ).fill( null )
                    }
                );
            } );
        this._rows.forEach( _row =>
            {
                // Fill data in the 2-d array based on index of category (column) and series (row)
                // If series is not mapped, series index is always 0 since there's only one series
                const seriesIndex = seriesMapped ? _row.tuple( SERIES ).index : 0;
                const catIndex = _row.tuple( CATEGORY ).index;
                chartData[ seriesIndex ].data[ catIndex ] = {
                    id: _row.key,
                    y: _row.value( VALUE )
                };
            } );

        // Set options based on properties
        let stacking = props.get( "area.stack" );
        if ( stacking === "none" )
            stacking = undefined;
        this._showHighchartsTooltip = props.get( "tooltip.show" );

        const options: any = {
            chart:
            {
                type: "area",
                backgroundColor: props.get( "background.color" ).toString(),
                zoomType: props.get( "area.zoom" )
            },
            xAxis:
            {
                categories: categories,
                title:
                {
                    text: props.get( "xAxis.title" ),
                    style: { color: props.get( "xAxis.title.color" ).toString() }
                },
                labels: { style: { color: props.get( "xAxis.label.color" ).toString() } },
                lineColor: props.get( "xAxis.line.color" ).toString()
            },
            yAxis:
            {
                reversedStacks: props.get( "area.reverse" ),
                title: {
                    text: props.get( "yAxis.title" ),
                    style: { color: props.get( "yAxis.title.color" ).toString() }
                },
                labels: { style: { color: props.get( "yAxis.label.color" ).toString() } },
                gridLineColor: props.get( "yAxis.grid.color" ).toString()
            },
            plotOptions:
            {
                area:
                {
                    fillOpacity: props.get( "area.fillOpacity" ),
                    stacking: stacking,
                    marker:
                    {
                        enabled: props.get( "area.symbol" ) !== "none",
                        symbol: props.get( "area.symbol" )
                    }
                },
                series:
                {
                    connectNulls: true,
                    point:
                    {
                        events:
                        {
                            // Set itemAtPoint as the current highlighted item for hitTest
                            mouseOver: ( e: any ): void =>
                            {
                                this._itemAtPoint = this._rows.find( _row => _row.key === e.target.id ) || null;
                            },
                            mouseOut: ( ): void =>
                            {
                                this._itemAtPoint = null;
                            }
                        }
                    }
                }
            },
            tooltip:
            {
                enabled: this._showHighchartsTooltip,
                split: props.get( "tooltip.focus" ) === "category"
            },
            legend:
            {
                enabled: props.get( "highchartsLegend.show" ),
                align: props.get( "highchartsLegend.place.horizontal" ),
                verticalAlign: props.get( "highchartsLegend.place.vertical" ),
                layout: props.get( "highchartsLegend.layout" ),
                itemStyle: { color: props.get( "highchartsLegend.text.color" ).toString() }
            },
            series: chartData
        };

        // If container size changes, resize the chart for better responsiveness
        if ( _info.reason.size )
            this._chart.setSize( _info.node.clientWidth, _info.node.clientHeight );

        this._chart.update( options, true, true );
    }

    protected updateProperty( _name: string, _value: any ): void
    {
        switch( _name )
        {
            case "area.stack":
                this.properties.setActive( "area.reverse", _value !== "none" );
                break;
            case "xAxis.title":
                this.properties.setActive( "xAxis.title.color", _value );
                break;
            case "yAxis.title":
                this.properties.setActive( "yAxis.title.color", _value );
                break;
            case "highchartsLegend.show":
                this.properties.setActive( "highchartsLegend.place.horizontal", _value );
                this.properties.setActive( "highchartsLegend.place.vertical", _value );
                this.properties.setActive( "highchartsLegend.layout", _value );
                this.properties.setActive( "highchartsLegend.text.color", _value );
                break;
            case "tooltip.show":
                this.properties.setActive( "tooltip.focus", _value );
        }
    }

    // Return itemAtPoint for VIDA tooltip only if Highcharts tooltip is not shown
    protected hitTest(): DataPoint | null
    {
        return this._showHighchartsTooltip ? null : this._itemAtPoint;
    }
}
