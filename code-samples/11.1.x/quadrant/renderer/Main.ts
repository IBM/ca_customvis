/**
 * Licensed Materials - Property of IBM
 *
 * Copyright IBM Corp. 2019 All Rights Reserved.
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo, DataPoint, FormatType } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

const CATEGORIES = 0, XVALUES = 1, YVALUES = 2, SIZE = 3;

/**
 * This example extends the 'scatter' sample and shows how you can draw axis titles,
 * grid lines and show different coloured background regions and text labels. It
 * also illustrates how you can use transitions to show an animated effect in your
 * visualization when data changes.
 */


/**
 * Create a symmetric domain around a point
 * @param _originalDomain domain from data
 * @param _midPoint the domain point where the symmetry happens
 * @param _expandFactor additional (nice) scaling
 */
function calculateDomainAroundPoint( _originalDomain: number[], _midPoint: number, _expandFactor = 0.1 ): number[]
{
    const domainCenter = ( _originalDomain[ 1 ] - _originalDomain[ 0 ] )  * 0.5 + _originalDomain[ 0 ];
    const domain = _originalDomain.slice();
    if ( _midPoint <= domainCenter )
        domain[ 0 ] = _midPoint - ( _originalDomain[ 1 ] - _midPoint );
    if ( _midPoint > domainCenter )
        domain[ 1 ] = ( _midPoint - _originalDomain[ 0 ] ) + _midPoint;
    const range = domain[ 1 ] - domain[ 0 ];
    domain[ 0 ] = domain[ 0 ] - range * _expandFactor;
    domain[ 1 ] = domain[ 1 ] + range * _expandFactor;
    return domain;
}

/**
 * Sets the translation of each element in a selection according to the
 * element data and a provided x scale and y scale. This function is used
 * to position individual circles and set the base coordinate of labels.
 * @param _sel Element selection.
 * @param _xScale X scale, used to calculate x-position from data value.
 * @param _yScale Y scale, used to calculate y-position from data value.
 */
function placeElement( _sel, _xScale, _yScale ): any
{
    return _sel.attr( "transform", row => `translate(${_xScale( row.value( XVALUES ) )},${_yScale( row.value( YVALUES ) )})` );
}

/**
 * Positions a label relative to its base location (the origin of the
 * corresponding circle). The label is offset 85% of the circle size.
 * @param _sel Element selection.
 * @param _xScale X scale, used to calculate x-position from data value.
 * @param _yScale Y scale, used to calculate y-position from data value.
 * @param _sizeScale Size scale, used to calculate offset from data value.
 */
function placeLabel( _sel, _xScale, _yScale, _sizeScale ): any
{
    const factor = 0.85;
    return placeElement( _sel, _xScale, _yScale )
        .attr( "x", row => _sizeScale( row.value( SIZE ) ) * factor )
        .attr( "y", row => _sizeScale( row.value( SIZE ) ) * -factor );
}


export default class Quadrant extends RenderBase
{
    private readonly _elementClipPathId = "_elementClipPathId_" + Math.random().toString( 36 ).substring( 7 );

    // Create is called during initialization
    protected create( _node: HTMLElement ): Element
    {
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .style( "position", "absolute" );

        // Create groups for axes and elements.
        const chart = svg.append( "g" ).attr( "class", "chart" );

        // Create clip path.
        const defs = chart.append( "defs" );
        defs.append( "clipPath" ).attr( "id", this._elementClipPathId ).append( "rect" );

        // Background elements.
        chart.append( "g" )
            .attr( "class", "backgroundFill data" )
            .attr( "clip-path", `url(#${this._elementClipPathId})` );

        // Gridlines.
        chart.append( "g" )
            .attr( "class", "gridlines data" )
            .attr( "stroke", "rgba( 0,0,0,0.08 )" )
            .attr( "stroke-width", "1" )
            .attr( "shape-rendering", "crispEdges" )
            .attr( "clip-path", `url(#${this._elementClipPathId})` );

        // Labels for quadrants.
        chart.append( "g" )
            .attr( "class", "quadLabels data" );

        // Axes and axis titles.
        chart.append( "g" ).attr( "class", "xaxis data" );
        chart.append( "g" ).attr( "class", "yaxis data" );
        chart.append( "g" ).attr( "class", "axisTitles data" );

        // Bubbles and labels.
        chart.append( "g" ).attr( "class", "elem data" )
            .attr( "clip-path", `url(#${this._elementClipPathId})` );
        chart.append( "g" ).attr( "class", "labels data" )
            .attr( "clip-path", `url(#${this._elementClipPathId})` );

        // Show text when there is no data.
        chart.append( "g" ).attr( "class", "nodata" );

        return _node;
    }

    // Update is called during new data, property change, resizing, etc.
    protected update( _info: UpdateInfo ): void
    {
        // Get data, properties and svg node.
        const data = _info.data;
        const props = _info.props;
        const svg = d3.select( _info.node ).select( "svg" );

        // If there is no data, remove all axes and elements.
        if ( !data )
        {
            svg.selectAll( ".data>*" ).remove(); // remove children of '.data' elements
            // show text with 'No data'
            svg.select( ".nodata" ).selectAll( "text" )
                .data( [ { value: "No data" } ] )
                .join( "text" )
                    .text( d => d.value )
                    .attr( "x", _info.node.clientWidth * 0.5 )
                    .attr( "y", _info.node.clientHeight * 0.5 )
                    .attr( "text-anchor", "middle" );
            return;
        }
        else
        {
            svg.selectAll( ".nodata>*" ).remove(); // remove children of '.nodata'
        }

        const chart = svg.select( ".chart" );

        // Place axis titles. The exact position is determined later on.
        const titles = chart.select( ".axisTitles" )
            .style( "font", props.get( "axisTitleFont" ).toString() )
            .selectAll<SVGTextElement, any>( "text" )
            .data( [
                { caption: data.cols[ YVALUES ].caption, axis: "y" },
                { caption: data.cols[ XVALUES ].caption, axis: "x" }
            ] )
            .join( "text" )
                .attr( "transform", d => d.axis === "y" ? "rotate(-90)" : "rotate(0)" )
                .attr( "dy", d => d.axis === "x" ? "1.2em" : "-0.6em" )
                .text( d => d.caption )
                .style( "text-anchor", "middle" );

        const margin = 20; // use a 20-pixel margin
        const titleHeight = titles.nodes()[ 1 ].getBoundingClientRect().height;

        const midX = props.get( "mid-x" );
        const midY = props.get( "mid-y" );

        // Calculate a y-axis.
        const yHeight = _info.node.clientHeight - 2 * margin - titleHeight;
        const yDomain = calculateDomainAroundPoint( data.cols[ YVALUES ].domain.asArray(), midY, 0.05 );
        const yScale = d3.scaleLinear().range( [ yHeight, 0 ] ).domain( yDomain ).nice();
        const yAxisFn = d3.axisLeft( yScale )
            .tickValues( yScale.domain() ) // use .tickValues to only show first & last tick
            .tickFormat( val => data.cols[ YVALUES ].format( val.valueOf(), FormatType.label ) );
        const yAxis = chart.select( ".yaxis" ).call( yAxisFn );

        // Calculate an x-axis.
        const xWidth = _info.node.clientWidth - 2 * margin - titleHeight;
        const xDomain = calculateDomainAroundPoint( data.cols[ XVALUES ].domain.asArray(), midX, 0.05 );
        const xScale = d3.scaleLinear().range( [ 0, xWidth ] ).domain( xDomain ).nice();
        const xAxisFn = d3.axisBottom( xScale ) // use .tickValues to only show first & last tick
            .tickValues( xScale.domain() )
            .tickFormat( val => data.cols[ XVALUES ].format( val.valueOf(), FormatType.label ) );
        const xAxis = chart.select( ".xaxis" ).call( xAxisFn );

        // Create a transition with a "transition-duration" length.
        const transition = d3.transition().duration( props.get( "transition-duration" ) );

        // Set the origin of the axis to the middle.
        yAxis.attr( "transform", `translate(${xScale( midX )},0)` );
        xAxis.attr( "transform", `translate(0,${yScale( midY )})` );

        // Position the axis titles.
        titles.attr( "x", _d => _d.axis === "x" ? xWidth / 2 : -yHeight / 2 );
        titles.attr( "y", _d => _d.axis === "x" ? yHeight + 5 : -5 );

        // Position the entire chart.
        chart.attr( "transform", `translate(${margin + titleHeight},${margin})` );

        // Fill the two dark areas.
        chart.select( ".backgroundFill" ).selectAll( "rect" )
            .data( [
                { xStart: xScale.domain()[ 0 ], yStart: yScale.domain()[ 1 ], xEnd: props.get( "mid-x" ), yEnd: props.get( "mid-y" ) },
                { xStart: props.get( "mid-x" ), yStart: props.get( "mid-y" ), xEnd: xScale.domain()[ 1 ], yEnd: yScale.domain()[ 0 ] }
            ] )
            .join( "rect" )
                .attr( "x", d => xScale( d.xStart ) )
                .attr( "y", d => yScale( d.yStart ) )
                .attr( "width", d => xScale( d.xEnd ) - xScale( d.xStart ) )
                .attr( "height", d => yScale( d.yEnd ) - yScale( d.yStart ) )
                .attr( "fill", props.get( "quad-dark-color" ).toString() );

        // Draw gridlines.
        const gridlines = chart.select( ".gridlines" );
        const yTicks = yScale.ticks( 10 );
        gridlines.selectAll( "line.horizontalGrid" )
            .data( yTicks )
            .join( "line" )
                .attr( "class", "horizontalGrid" )
                .attr( "y1", yScale )
                .attr( "y2", yScale )
                .attr( "x1", 0 )
                .attr( "x2", xWidth );

        const xTicks = xScale.ticks( 10 );
        gridlines.selectAll( "line.verticalGrid" )
            .data( xTicks )
            .join( "line" )
                .attr( "class", "verticalGrid" )
                .attr( "y1", yHeight )
                .attr( "y2", 0 )
                .attr( "x1", xScale )
                .attr( "x2", xScale );

        // Draw quad labels (I, II, III, IV).
        chart.select( ".quadLabels" ).selectAll( "text" )
            .data( [
                { x: 0,      y: yHeight, label: props.get( "left-bottom-caption" )  },
                { x: xWidth, y: yHeight, label: props.get( "right-bottom-caption" ) },
                { x: 0,      y: 0,       label: props.get( "left-top-caption" )     },
                { x: xWidth, y: 0,       label: props.get( "right-top-caption" )    }
            ] )
            .join( "text" )
                .attr( "x", d => d.x )
                .attr( "y", d => d.y )
                .text( d => d.label )
                .attr( "text-anchor", _d => _d.x === 0 ? "start" : "end" )
                .attr( "dominant-baseline", "central" )
                .attr( "dx", _d => _d.x === 0 ? "1em" : "-1em" )
                .attr( "dy", _d => _d.y === 0 ? "1em" : "-1em" )
                .style( "font", props.get( "quadFont" ).toString() );

        // Update clip path.
        chart.select( `#${this._elementClipPathId}` ).select( "rect" )
            .attr( "x", 0 )
            .attr( "y", 0 )
            .attr( "width", xWidth )
            .attr( "height", yHeight );

        // Get the size domain from the data and the range from the properties.
        const sizeDomain = data.cols[ SIZE ].domain.asArray();
        const sizeRange = [ props.get( "min-bubble-size" ), props.get( "max-bubble-size" ) ];
        const sizeScale = d3.scaleLinear().range( sizeRange ).domain( sizeDomain );

        // For every row in the data, create and position a circle element.
        const palette = props.get( "color" );
        svg.select( ".elem" )
            .selectAll( "g" )
            // Notice that when setting the data, we provide a 'key' function that
            // ensures us that the correct data element is being transitioned whenever
            // the data gets updated.
            .data( data.rows, ( row: DataPoint ) => row.key )
            .join( enter => enter.append( "g" )
                .call( placeElement, xScale, yScale ) // set initial location
                .call( g => g.append( "circle" ) // create initial circle
                    .attr( "stroke-width", 2 )
                    .attr( "fill-opacity", "0.75" ) ) )
            .each( function( point )
            {
                // Raise element to front when selected or highlighted.
                if ( point.selected || point.highlighted )
                    d3.select( this ).raise();
            } )
            .call( g =>
            {
                g.select( "circle" ) // update existing circle with color and radius
                    .attr( "fill", row => palette.getFillColor( row ) )
                    .attr( "stroke", row => palette.getOutlineColor( row ) )
                    .transition( transition ) // transition the circle radius
                    .attr( "r", row => sizeScale( row.value( SIZE ) ) );
            } )
            .transition( transition ) // transition the circle location
            .call( placeElement, xScale, yScale );

        // Draw the labels for the bubbles.
        svg.select( ".labels" ).selectAll( "text" )
            .data( props.get( "labels.visible" ) ? data.rows : [], ( row: DataPoint ) => row.key  )
            .join( enter => enter.append( "text" ).call( placeLabel, xScale, yScale, sizeScale ) )
                .attr( "text-anchor", "start" )
                .attr( "fill-opacity", d => d.selected || d.highlighted ? 1 : 0.6 )
                .style( "font", props.get( "labelFont" ).toString() )
                .text( d => d.caption( CATEGORIES ) )
                    .style( "font-weight", d => d.selected || d.highlighted ? "bolder" : null )
                    .transition( transition ) // transition the label location
                    .call( placeLabel, xScale, yScale, sizeScale );
    }
}
