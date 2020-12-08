/**
 * Licensed Materials - Property of IBM
 *
 * Copyright IBM Corp. 2019 All Rights Reserved.
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo } from "@businessanalytics/customvis-lib";
import { Ternary, TernaryLayout } from "./Ternary";
import RBush from "rbush"; // see dependency in package.json
import * as d3 from "d3";

const POINTS = 0, TOP = 1, LEFT = 2, RIGHT = 3, SIZE = 5; // data slot indices


// Draw the axis labels and titles.
function drawChartLabels( _chart: d3.Selection<SVGGElement, any, any, any>,
                          _info: UpdateInfo,
                          _layout: TernaryLayout ): void
{
    const ticks = d3.range( 0, 120, 20 );
    const edges = _layout.triangle.edges;

    // Place tick labels (percentages) along the edges.
    _chart.select( ".ticks" )
        .attr( "fill", _info.props.get( "title_color" ).toString() )
        .selectAll( "g" )
        .data( [
            ticks.map( tick => ( { tick, pos: edges[ 0 ].eval( tick / 100 ), rot: -60, anchor: "end" } ) ),
            ticks.map( tick => ( { tick, pos: edges[ 1 ].eval( tick / 100 ), rot:   0, anchor: "start" } ) ),
            ticks.map( tick => ( { tick, pos: edges[ 2 ].eval( tick / 100 ), rot:  60, anchor: "end" } ) ) ] )
        .join( "g" )
        .selectAll( "text" )
        .data( d => d )
        .join( "text" )
            .attr( "transform", d => `translate(${d.pos}) rotate(${d.rot})` )
            .attr( "text-anchor", d => d.anchor )
            .attr( "dx", d => d.anchor === "start" ? 10 : -10 )
            .attr( "dy", "0.3em" )
            .text( d => d.tick );

    // Place axis titles on the center of each edge of the triangle.
    _chart.select( ".labels" )
        .attr( "fill", _info.props.get( "title_color" ).toString() )
        .style( "font", _info.props.get( "title_font" ).toString() )
        .selectAll( "text" )
        .data( [
            { label: _info.data.cols[ RIGHT ].caption, pos: edges[ 0 ].pt2, rot: 0 },
            { label: _info.data.cols[ TOP ].caption, pos: edges[ 1 ].pt2, rot: 60 },
            { label: _info.data.cols[ LEFT ].caption, pos: edges[ 2 ].pt2, rot: -60 } ] )
        .join( "text" )
            .attr( "transform", d => `translate(${d.pos}) rotate(${d.rot})` )
            .attr( "dy", d => d.rot === 0 ? "2em" : "-2em" )
            .attr( "dx", d => d.rot === 0 ? "-2em" : "2em" )
            .attr( "text-anchor", d => d.rot === 0 ? "end" : "start" )
            .text( d => d.label );
}

// Draw a colored triangle with gridlines.
function drawBackgroundTriangle( _chart: d3.Selection<SVGGElement, any, any, any>,
                                 _info: UpdateInfo,
                                 _layout: TernaryLayout ): void
{
    // Draw main triangle.
    _chart.select( ".triangle" ).selectAll( "path" )
        .data( [ _layout.triangle ] )
        .join( _enter => _enter.append( "path" ).attr( "stroke-width", "1px" ) )
            .attr( "d", _triangle => _triangle.toPath() )
            .attr( "fill", _info.props.get( "grid_background" ).toString() )
            .attr( "stroke", _info.props.get( "grid_outline" ).toString() );

    // Draw gridlines.
    const edges = _layout.triangle.edges;
    const grid = d3.range( 1, 10, 1 ).map( i => i / 10 );
    _chart.select( ".grid" ).selectAll( "g" )
        .data( [
            grid.map( tick => [ edges[ 0 ].eval( tick ), edges[ 1 ].eval( 1 - tick ) ] ),
            grid.map( tick => [ edges[ 1 ].eval( tick ), edges[ 2 ].eval( 1 - tick ) ] ),
            grid.map( tick => [ edges[ 2 ].eval( tick ), edges[ 0 ].eval( 1 - tick ) ] ) ] )
        .join( "g" )
            .selectAll( "line" )
            .data( d => d )
            .join( _enter => _enter.append( "line" ).attr( "stroke-width", "1px" ) )
                .attr( "x1", d => d[ 0 ].x )
                .attr( "y1", d => d[ 0 ].y )
                .attr( "x2", d => d[ 1 ].x )
                .attr( "y2", d => d[ 1 ].y )
                .attr( "stroke", _info.props.get( "grid_lines" ).toString() );
}

// Draw the circles (data points) inside the main triangle.
function drawCircles( _chart: d3.Selection<SVGGElement, any, any, any>,
                      _info: UpdateInfo,
                      _layout: TernaryLayout ): void
{
    const palette = _info.props.get( "color" );
    _chart.select( ".data" ).selectAll( "circle" )
        .data( _info.data.rows )
        .join( "circle" )
            .attr( "r", _layout.circleRFn )
            .attr( "cx", _layout.circleXFn )
            .attr( "cy", _layout.circleYFn )
            .attr( "stroke", _d => palette.getOutlineColor( _d ) )
            .attr( "fill", _d => palette.getFillColor( _d ) );
}

// Returns true if the element limits are outside the chart limits.
function outsideChart( _chart: any, _elem: any ): boolean
{
    return _elem.right > _chart.right ||
           _elem.left < _chart.left ||
           _elem.top < _chart.top ||
           _elem.bottom > _chart.bottom;
}

// Uses the RBrush implementation hide overlapping point labels.
function showHidePointLabels( _sel: d3.Selection<SVGTextElement, any, any, any>, _info: UpdateInfo ): void
{
    const tree = new RBush();
    const chartBox = _info.node.getBoundingClientRect();
    _sel.each( function( _, i, n )
    {
        const bbox = n[ i ].getBoundingClientRect();
        const treeItem = { minX: bbox.left, minY: bbox.top, maxX: bbox.right, maxY: bbox.bottom };
        if ( !tree.collides( treeItem ) && !outsideChart( chartBox, bbox ) )
        {
            tree.insert( treeItem );
            n[ i ].setAttribute( "visibility", "visible" );
        }
        else
        {
            n[ i ].setAttribute( "visibility", "hidden" );
        }
    } );
}


// Draw a point label next to each circle.
function drawPointLabels( _chart: d3.Selection<SVGGElement, any, any, any>,
    _info: UpdateInfo,
    _layout: TernaryLayout ): void
{
    const labelPos = _info.props.get( "point_label_placement" );
    const anchor = labelPos.indexOf( "Left" ) !== -1 ? "end" : "start";
    const dy = labelPos.indexOf( "Top" ) !== -1 ? "0em" : "1em";

    _chart.select( ".point-labels" )
    .attr( "fill", _info.props.get( "point_label_color" ).toString() )
    .style( "font", _info.props.get( "point_label_font" ).toString() )
    .selectAll( "text" )
    .data( _info.data.rows )
    // Notice here that new text elements are initially created hidden.
    .join( _enter => _enter.append( "text" ).attr( "visibility", "hidden" ) )
    .attr( "text-anchor", anchor )
    .attr( "dy", dy )
    .attr( "x", _layout.labelXFn )
    .attr( "y", _layout.labelYFn )
    .attr( "opacity", d => _info.data.hasSelections && !d.selected ? 0.4 : 1 )
    .text( d => d.caption( POINTS ) )
    .call( showHidePointLabels, _info );
}

/**
 * The Ternary chart shows a visualization that positions data points inside a triangle.
 * The location of a data point is determined by the weight of the top, left or right
 * value in relation to the total of these three weight components.
 * This example shows:
 * - Enabling or disabling properties based on the value of another property
 * - Changing render behaviour for small size visualizations
 * - Applying highlight and selection styling
 * - Storing text in a resource file for possible translation
 * - Using an external javascript library ('RBush' for label overlapping)
 * - Separating render logic from data handling as a coding pattern
 * - Memory efficient rendering by using accessor functions for calculations
 * - Using UpdateInfo.reason for render optimization
 */
export default class TernaryChart extends RenderBase
{
    // Hold a single instance of the factory class for TernaryLayout objects.
    private readonly _ternary: Ternary = new Ternary();

    // Initial setup of the visualization.
    protected create( _node: HTMLElement ): void
    {
        // Setup the ternary layout generator with data accessor functions.
        this._ternary.topValue = ( _d ): number => _d.value( TOP ); // get top value from data point
        this._ternary.leftValue = ( _d ): number => _d.value( LEFT ); // get left value from data point
        this._ternary.rightValue = ( _d ): number => _d.value( RIGHT ); // get right value from data point
        this._ternary.sizeValue = ( _d ): number => _d.value( SIZE ); // get size value from data point

        // Create an svg surface with groups for various elements.
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .style( "position", "absolute" );
        const chart = svg.append( "g" ).attr( "class", "chart" );
        chart.append( "g" ).attr( "class", "triangle" );
        chart.append( "g" ).attr( "class", "grid" );
        chart.append( "g" ).attr( "class", "ticks" )
            .attr( "font-family", "sans-serif" )
            .attr( "font-size", 10 );
        chart.append( "g" ).attr( "class", "labels" );
        chart.append( "g" ).attr( "class", "data" );
        chart.append( "g" ).attr( "class", "point-labels" );
    }

    // Enable or disable properties based on other property values.
    protected updateProperty( _name: string, _value: any ): void
    {
        switch ( _name )
        {
            case "labels_visible":
                this.properties.setActive( "point_label_font", _value );
                this.properties.setActive( "point_label_color", _value );
                this.properties.setActive( "point_label_placement", _value );
                break;
        }
    }

    // Process data, size, property, selection and highlight updates.
    protected update( _info: UpdateInfo ): void
    {
        const props = _info.props;
        const svg = d3.select( _info.node ).select( "svg" );
        const chart = svg.select<SVGGElement>( ".chart" );

        // Apply chart properties to the ternary instance. If the size slot is mapped,
        // use a linear scale to determine point size. Otherwise, set a fixed point size.
        if ( _info.data && _info.data.cols[ SIZE ].mapped )
            this._ternary.pointSize = d3.scaleLinear()
                .domain( _info.data.cols[ SIZE ].domain.asArray() )
                .range( [ props.get( "min_point_size" ), props.get( "max_point_size" ) ] );
        else // use a fixed point size of SIZE is not mapped
            this._ternary.pointSize = props.get( "point_size" );
        this._ternary.width = _info.node.clientWidth;
        this._ternary.height = _info.node.clientHeight;
        this._ternary.labelPlacement = _info.props.get( "point_label_placement" );

        // Create a layout object that holds everything we need for rendering.
        const layout = this._ternary.createLayout();

        // Set chart origin on the center of the main triangle.
        chart.attr( "transform", `translate(${layout.center.toString()})` );

        // Apply the background color to the chart.
        svg.style( "background-color", props.get( "background_color" ) );

        // Draw main triangle with gridlines (only if size or properties changed).
        if ( _info.reason.size || _info.reason.properties )
            drawBackgroundTriangle( chart, _info, layout );

        if ( _info.data )
        {
            // Draw axis labels and titles if visualization is large enough.
            if ( _info.node.clientWidth > 200 && _info.node.clientHeight > 200 )
            {
                drawChartLabels( chart, _info, layout );
            }
            else // remove labels and titles if visualization too small
            {
                chart.selectAll( ".labels>*" ).remove();
                chart.selectAll( ".ticks>*" ).remove();
            }

            // Draw data points (circles).
            drawCircles( chart, _info, layout );

            // Draw point labels.
            if ( props.get( "labels_visible" ) )
                drawPointLabels( chart, _info, layout );
            else // labels not visible, remove them
                chart.selectAll( ".point-labels>*" ).remove();
        }
        else // no data, remove all labels and circles
        {
            chart.selectAll( ".labels>*" ).remove();
            chart.selectAll( ".data>*" ).remove();
            chart.selectAll( ".ticks>*" ).remove();
            chart.selectAll( ".point-labels>*" ).remove();
        }
    }
}
