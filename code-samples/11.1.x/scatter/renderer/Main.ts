/**
 * Licensed Materials - Property of IBM
 * 
 * Copyright IBM Corp. 2019 All Rights Reserved.
 * 
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo } from "@businessanalytics/customvis-lib";
import { Encoding, DataSet } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

const CAT = 0, XPOS = 1, YPOS = 2, COLOR = 3; // slot indices

/**
 * Shows a simple scatter visualization.
 */
export default class extends RenderBase
{
    protected create( _node: HTMLElement ): Element
    {
        // Create an svg canvas that sizes to its parent.
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        // Create groups for axes and elements.
        const chart = svg.append( "g" ).attr( "class", "chart" );
        chart.append( "g" ).attr( "class", "xaxis data" );
        chart.append( "g" ).attr( "class", "yaxis data" );
        chart.append( "g" ).attr( "class", "elem data" );

        // Return the svg node as the visualization root node.
        return svg.node();
    }

    protected updateLegend( _data: DataSet ): Encoding[]
    {
        // Call base class implementation to setup initial encodings.
        const encodings = super.updateLegend( _data );
        const hasColor = _data.cols[ COLOR ].mapped;
    
        // Filter encodings: if color slot is mapped, skip categorical legend.
        return encodings.filter( _encoding =>
        {
            if ( hasColor && _encoding.type === "cat" )
                return false;
            return true;
        } );
    }

    protected updateProperty( _name: string, _value: any )
    {
        switch( _name )
        {
            case "pointShape":
                this.meta.legendShape = _value;
                break;

            case "showBackground":
                // Active state for 'background' depends on `showBackground`.
                this.properties.setActive( "background", _value );
                break;
        }
    }

    protected update( _info: UpdateInfo ): void
    {
        // Get data, properties and svg node.
        const data = _info.data;
        const props = _info.props;
        const svg = d3.select( _info.node );

        // If there is no data, remove all axes and elements.
        if ( !data )
        {
            svg.selectAll( ".data>*" ).remove(); // remove children of '.data' elements
            return;
        }

        const margin = 20; // use a 20-pixel margin
        const xHeight = 20; // assume an x-axis height of 20px.

        // Set the background image.
        let urlImage = null;
        if ( props.get( "showBackground" ) )
        {
            const image = props.get( "background" );
            if ( image !== "" )
                urlImage = `url(${image})`;
        }
        _info.node.parentElement.style.backgroundImage = urlImage;

        // Create the y-axis.
        const yHeight = _info.node.clientHeight - 2 * margin - xHeight;
        const yDomain = data.cols[ YPOS ].domain.asArray(); // [min, max]
        const yMax = props.get( "ymax" );
        if ( yMax !== null )
            yDomain[ 1 ] = yMax;
        const yScale = d3.scaleLinear().range( [ yHeight, 0 ] ).domain( yDomain );
        if ( yMax === null )
            yScale.nice(); // apply nice scale only if scale is automatic.
        const yAxis = svg.select<SVGGElement>( ".yaxis" ).call( d3.axisLeft( yScale ) );
        const yWidth = yAxis.node().getBBox().width;

        // Create the x-axis and position at bottom of y-axis.
        const xWidth = _info.node.clientWidth - yWidth - 2 * margin;
        const xDomain = data.cols[ XPOS ].domain.asArray(); // [min, max]
        const xMax = props.get( "xmax" );
        if ( xMax !== null )
            xDomain[ 1 ] = xMax;
        const xScale = d3.scaleLinear().range( [ 0, xWidth ] ).domain( xDomain );
        if ( xMax === null )
            xScale.nice(); // apply nice scale only if scale is automatic.
        const xAxis = svg.select<SVGGElement>( ".xaxis" ).call( d3.axisBottom( xScale ) );
        xAxis.attr( "transform", `translate(0,${yHeight})` );

        // Position the chart (axes and elements).
        svg.select( ".chart" ).attr( "transform", `translate(${yWidth+margin},${margin})` );

        // Determine color palette and shape from the properties.
        const hasColor = data.cols[ COLOR ].mapped;
        const palette = props.get( hasColor ? "color_cont" : "color_cat" );
        const shape = d3.symbol().size( 256 );
        if ( props.get( "pointShape" ) === "square" )
            shape.type( d3.symbolSquare );
        else
            shape.type( d3.symbolCircle );

        // For every row in the data, create and position a circle element.
        svg.select( ".elem" )
            .selectAll( "path" )
            .data( data.rows, ( row: any ) => row.key )
            .join( "path" )
                .attr( "d", shape )
                .attr( "transform", row => `translate(${xScale(row.value(XPOS))},${yScale(row.value(YPOS))})` )
                .attr( "stroke-width", 3 )
                .attr( "stroke", row => palette.getOutlineColor( row ) )
                .attr( "fill", row => palette.getFillColor( row ) );
    }
}
