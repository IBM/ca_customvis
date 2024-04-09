// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2020
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, CatPalette, Color } from "@businessanalytics/customvis-lib";
// Include the core fusioncharts file from core
import FusionCharts from "fusioncharts/core";

// Include the chart from viz folder
import Pareto2d from "fusioncharts/viz/pareto2d";
// Include FusionTheme
import FusionTheme from "fusioncharts/themes/es/fusioncharts.theme.fusion";

const CATEGORIES = 0, VALUE = 1;            // data column indices

// FusionCharts only allow hex code as color argument
// Convert Color object to Hex code
function colorToHex( color: Color ): string
{
    function decToHex( n: number ): string
    {
        const hex = n.toString( 16 );
        return hex.length === 1 ? "0" + hex : hex;
    }
    const r = color.r;
    const g = color.g;
    const b = color.b;
    return "#" + decToHex( r ) + decToHex( g ) + decToHex( b );
}
// Convert a string (rgb/rgba) to Color
function colorFromString( color: string ): Color
{
    const rgba = color.substring( color.indexOf( "(" ) + 1, color.indexOf( ")" ) )
        .split( "," ).map( e => parseInt( e ) );
    return new Color( rgba[ 0 ], rgba[ 1 ], rgba[ 2 ], rgba.length > 3 ? rgba[ 3 ] : 1 );
}
// Convert string color (rgb/rgba) to Hex
function colorStringToHex( colorString: string ): string
{
    if ( colorString.indexOf( "#" ) >= 0 )
        return colorString;
    return colorToHex( colorFromString( colorString ) );
}

export default class extends RenderBase
{
    private _chart: any;

    protected create( _node: HTMLElement ): HTMLElement
    {
        // Add chart and theme as dependency
        FusionCharts.addDep( Pareto2d );
        FusionCharts.addDep( FusionTheme );

        // create (semi) unique id
        const containerId = `Container_${Math.random()}`;
        const chartId = `FusionCharts_${Math.random()}`;
        _node.setAttribute( "id", containerId );

        // Prevent reporting from rendering chart before _node is created
        if ( document.getElementById( containerId ) )
        {
            this._chart = new FusionCharts( {
                type: "pareto2d",
                id: chartId,
                renderAt: containerId,
                width: "100%",
                height: "100%",
                dataFormat: "json"
            } );
            this._chart.render();
        }
        return _node;
    }

    protected update( _info: UpdateInfo ): void
    {
        // Check if chart has successfully rendered
        if ( !this._chart )
            return;
        // if no data set empty data
        if ( !_info.data || _info.data.rows.length === 0 )
        {
            this._chart.setChartData( {} );
            return;
        }

        const props = _info.props;
        const palette = props.get( "colors" ) as CatPalette;

        const data = _info.data.rows.map( _row =>
            ( {
                label: _row.caption( CATEGORIES ),
                value: _row.value( VALUE ),
                color: colorStringToHex( palette.getFillColor( _row ) )
            } )
        );

        const chartOptions = {
            animation: false,
            showValues: props.get( "values.show" ),
            valueFontColor: colorToHex( props.get( "values.color" ) ),
            bgColor: colorToHex( props.get( "background.color" ) ),
            bgAlpha: ( props.get( "background.color" ) as Color ).a * 100,
            xAxisName: props.get( "xAxis.title" ),
            xAxisNameFontColor: colorToHex( props.get( "xAxis.title.color" ) ),
            labelFontColor: colorToHex( props.get( "xAxis.label.color" ) ),
            yaxisname: props.get( "yAxis.title" ),
            syaxisname: props.get( "syAxis.title" ),
            divLineColor: colorToHex( props.get( "yAxis.grid.color" ) ),
            pYAxisNameFontColor: colorToHex( props.get( "yAxis.title.color" ) ),
            sYAxisNameFontColor: colorToHex( props.get( "yAxis.title.color" ) ),
            yAxisValueFontColor: colorToHex( props.get( "yAxis.label.color" ) ),
            lineColor: colorToHex( props.get( "line.color" ) ),
            anchorBgColor: colorToHex( props.get( "line.color" ) ),
            anchorRadius: props.get( "line.anchor.radius" ),
            lineThickness: props.get( "line.width" ),
            showToolTip: props.get( "tooltip.show" ) ? true : false,
            drawcrossline: props.get( "crossline.show" ) ? true : false,
            crosslinecolor: colorToHex( props.get( "crossline.color" ) ),
            crossLineAlpha: props.get( "crossline.color" ).a * 100,
            canvasTopPadding: props.get( "padding.top" ),
            canvasBottomPadding: props.get( "padding.bottom" ),
            canvasLeftPadding: props.get( "padding.left" ),
            canvasRightPadding: props.get( "padding.right" ),
            theme: "fusion"
        };

        props.setActive( "yAxis.title.color", props.get( "yAxis.title" ) || props.get( "syAxis.title" ) );

        this._chart.setChartData( {
            chart: chartOptions,
            data: data
        } );
    }

    protected updateProperty( _name: string, _value: any ): void
    {
        switch( _name )
        {
            case "values.show":
                this.properties.setActive( "values.color", _value );
                break;
            case "xAxis.title":
                this.properties.setActive( "xAxis.title.color", _value );
                break;
            case "crossline.show":
                this.properties.setActive( "crossline.color", _value );
        }
    }
}
