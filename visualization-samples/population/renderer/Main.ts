// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2019
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, DataPoint, FormatType, DataSet, CatEncoding, Encoding, Properties, Font } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

const SPLIT = 0, CATEGORY = 1, VALUE = 2;            // data column indices

function centerVerticalAxis( _selection: any ): void
{
    // remove the line
    _selection.select( ".domain" ).remove();
    // remove the ticks
    const ticks = _selection.selectAll( ".tick" );
    _selection.attr( "text-anchor", "middle" );
    ticks.select( "line" ).remove();
    ticks.select( "text" ).attr( "x", 0 );
}

function clamp0( _val: number ): number
{
    return Math.max( _val, 0 );
}

function createRemoveCollidedTextFn(): Function
{
    const quadtree = d3.quadtree<DOMRect>()
        .x( ( d ) => d.x )
        .y( ( d ) => d.y );

    const padding = 5;
    let widthRadius = 0;
    let heightRadius = 0;
    let rect: DOMRect;
    let hasCollided = false;

    function visit( _node: d3.QuadtreeLeaf<DOMRect>, _x1, _y1, _x2, _y2 ): boolean
    {
        if ( hasCollided )
            return true;

        if ( _node.data === rect )
            return false;

        // child node
        if ( !_node.length )
            hasCollided = !(
                _node.data.left > rect.right ||
                _node.data.right < rect.left ||
                _node.data.top > rect.bottom ||
                _node.data.bottom < rect.top
            );

        return !( rect.left < _x2 + widthRadius &&
                rect.right > _x1 - widthRadius &&
                rect.top < _y2 + heightRadius &&
                rect.bottom > _y1 - heightRadius );
    }

    return ( _elements: SVGTextElement[] ): void =>
    {
        _elements.forEach( ( e: SVGTextElement ) =>
        {
            let collide = true;
            // Make shallow copy
            rect = { ...e.getBoundingClientRect() } as DOMRect;

            rect.x = rect.x - padding;
            rect.width = rect.width + padding;

            widthRadius = Math.max( widthRadius, rect.width );
            heightRadius = Math.max( heightRadius, rect.height );

            hasCollided = false;
            quadtree.visit( visit );

            if ( !hasCollided )
            {
                quadtree.add( rect );
                collide = false;
            }
            e.style.visibility = collide ? "hidden" : "visible" ;
        } );
    };
}

/**
 * Return the side with decoration
 * Side with highlighted/selected rows will be moved to foreground
 * to avoid borders being "blocked" by the rect on the other side
 * @returns highlighted side class name, or null if no side is highlighted
 */
function highlightSide( _leftRows: DataPoint[], _rightRows: DataPoint[] ): string | null
{
    for ( let i = 0; i < _leftRows.length; ++i )
        if ( _leftRows[ i ].selected || _leftRows[ i ].highlighted )
            return ".left";
    for ( let i = 0; i < _rightRows.length; ++i )
        if ( _rightRows[ i ].selected || _rightRows[ i ].highlighted )
            return ".right";
    return null;
}

/**
 * Apply color properties on axes
 * @param _props
 * @param _selection Axes selection
 */
function applyAxesColor( _props: Properties, _selection: any ): void
{
    const axisLabelColor = _props.get( "axis.label.color" ).toString();
    const axisLineColor = _props.get( "axis.line.color" ).toString();
    _selection.selectAll( "path" ).attr( "stroke", axisLineColor );
    const ticks = _selection.selectAll( ".tick" );
    ticks.selectAll( "line" ).attr( "stroke", axisLineColor );
    ticks.selectAll( "text" ).attr( "fill", axisLabelColor );
}

function applyFont( _selection: any, _font: Font ): void
{
    _selection
        .style( "font-size", _font.size ? _font.size.toString() : null )
        .style( "font-family", _font.family ? _font.family.toString() : null )
        .style( "font-style", _font.style ? _font.style.toString() : null )
        .style( "font-weight", _font.weight ? _font.weight.toString() : null );
}

export default class extends RenderBase
{
    // Create is called during initialization
    protected create( _node: HTMLElement ): Element
    {
        // Create a svg node
        d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .append( "g" )
            .attr( "class", "chartContent" );

        // return the root node so it can be used in `update`.
        return _node;
    }

    // Update is called during new data, property change, resizing, etc.
    protected update( _info: UpdateInfo ): void
    {
        const node = _info.node as HTMLElement;
        const rows = _info.data ? _info.data.rows : [];
        const reason = _info.reason;

        const { clientHeight, clientWidth } = node;
        const margin = {
            left: 20, right: 40, top: 10, bottom: 10
        };

        const content = {
            width: clientWidth - margin.left - margin.right,
            height: clientHeight - margin.top - margin.bottom
        };

        // render containers
        const rootSelection = d3.select( node ).select( "svg" ).select( ".chartContent" );
        rootSelection.attr( "transform", `translate(${margin.left}, ${margin.top})` );

        if ( rows.length === 0 )
        {
            rootSelection.selectAll( "*" ).remove();
            return;
        }

        // data
        const cats = _info.data ? _info.data.cols[ CATEGORY ].tuples.map( _t => _t.key ) : [];
        const leftRows = _info.data && _info.data.cols[ SPLIT ].tuples.length > 0 ? DataSet.filterRows( rows, SPLIT, _info.data.cols[ SPLIT ].tuples[ 0 ].key ) : [];
        const rightRows = _info.data && _info.data.cols[ SPLIT ].tuples.length > 1 ? DataSet.filterRows( rows, SPLIT, _info.data.cols[ SPLIT ].tuples[ 1 ].key ) : [];

        const leftMax = _info.data ? Math.max( ...leftRows.map( _r => _r.value( VALUE ) ) ) : 0;
        const rightMax = _info.data ? Math.max( ...rightRows.map( _r => _r.value( VALUE ) ) ) : 0;
        const max = Math.max( leftMax, rightMax, 1 );

        // properties
        const props = _info.props;
        const t = d3.transition().duration( props.get( "transition.duration" ) );
        const palette = props.get( "color" );
        const centerAxis = props.get( "axis.center" );
        const axisLabelFont = props.get( "axis.label.font" ) as Font;
        const axisTitleColor = props.get( "axis.title.color" );
        const axisTitleFont = props.get( "axis.title.font" ) as Font;

        // render the y axis first so we can measure the width (needed if )
        // AXIS
        const xScaleLeft = d3.scaleLinear().range( [ 0, content.width * 0.5 ] ).domain( [ max, 0 ] ).nice();
        const xScaleRight =  d3.scaleLinear().range( [ 0, content.width * 0.5 ] ).domain( [ 0, max ] ).nice();
        const yScale = d3.scaleBand().range( [ 0, content.height ] ).domain( cats ).padding( 0.1 );
        const yAxis = d3.axisLeft( yScale ).tickFormat( ( _, idx ) => _info.data.cols[ CATEGORY ].tuples[ idx ].caption );
        const xAxisLeft = d3.axisBottom( xScaleLeft ).tickFormat( val => _info.data.cols[ VALUE ].format( val.valueOf(), FormatType.label ) );
        const xAxisRight = d3.axisBottom( xScaleRight ).tickFormat( val => _info.data.cols[ VALUE ].format( val.valueOf(), FormatType.label ) );

        const yAxisContent = rootSelection.selectAll( ".axisVertical" )
            .data( _info.data ? [ centerAxis ] : [], ( d: any ) => d )
            .join( "g" )
            .attr( "class", "axis axisVertical" )
            .call( yAxis );

        const bottomLeftAxis = rootSelection
            .selectAll( ".axisBottomLeft" )
            .data( _info.data ? [ 1 ] : [] )
            .join( "g" )
            .attr( "class", "axis axisBottomLeft" )
            .call( xAxisLeft );

        const bottomRightAxis = rootSelection
            .selectAll( ".axisBottomRight" )
            .data( _info.data ? [ 1 ] : [] )
            .join( "g" )
            .attr( "class", "axis axisBottomRight" )
            .call( xAxisRight );

        rootSelection.selectAll( ".axis" ).call( applyFont, axisLabelFont );

        if ( centerAxis )
            yAxisContent.call( centerVerticalAxis );

        const bottomAxisNode = ( bottomLeftAxis.node() as SVGGraphicsElement );
        const yAxisNode = ( yAxisContent.node() as SVGGraphicsElement );

        // Y axis title
        const yAxisTicks = yAxisContent.selectAll( ".tick" ).nodes() as SVGGraphicsElement[];
        const ticksWidth = Math.max( ...yAxisTicks.map( e => e.getBBox().width ) );
        yAxisContent
            .selectAll( ".axisTitle" )
            .data( [ 0 ] )
            .join( "text" )
            .attr( "class", "axisTitle" )
            .attr( "transform", centerAxis ? "" : "rotate(-90)" )
            .attr( "x", centerAxis ? 0 : -yAxisNode.getBBox().height / 2 )
            .attr( "y", centerAxis ? 0 : -ticksWidth - 10 )
            .text( _info.data.cols[ CATEGORY ].caption );

        const yAxisWidth = yAxisNode ? yAxisNode.getBBox().width + ( centerAxis ? 16 : 4 ) : 0;
        const xTitleOffset = ( bottomLeftAxis.select( "path" ).node() as SVGGraphicsElement ).getBBox().width / 2 - 10;

        // X axis title
        const xAxisLabelHeight = ( bottomLeftAxis.select( ".tick " ).node() as SVGGraphicsElement ).getBBox().height;
        bottomLeftAxis
            .selectAll( ".axisTitle" )
            .data( [ 0 ] )
            .join( "text" )
            .attr( "class", "axisTitle" )
            .attr( "x", centerAxis ? xTitleOffset : ( content.width - yAxisWidth ) * 0.5 )
            .attr( "y", xAxisLabelHeight + 15 )
            .text( _info.data.cols[ VALUE ].caption );
        bottomRightAxis
            .selectAll( ".axisTitle" )
            .data( [ 0 ] )
            .join( "text" )
            .attr( "class", "axisTitle" )
            .attr( "x", xTitleOffset )
            .attr( "y", xAxisLabelHeight + 15 )
            .style( "display", centerAxis ? "" : "none" )
            .text( _info.data.cols[ VALUE ].caption );

        rootSelection.selectAll( ".axisTitle" )
            .attr( "fill", axisTitleColor )
            .call( applyFont, axisTitleFont );

        const xAxisHeight = bottomAxisNode ? bottomAxisNode.getBBox().height + 6 : 0;

        // Update scales & axises with new dimensions
        const chartContentSize =
        {
            left: centerAxis ? 0 : yAxisWidth,
            centerX: ( centerAxis ? yAxisWidth * 0.5 : yAxisWidth ) + ( content.width - yAxisWidth ) * 0.5,
            startRightAxis: ( content.width - yAxisWidth ) * 0.5 + yAxisWidth,
            height: content.height - xAxisHeight,
            width: content.width - yAxisWidth
        };

        xScaleRight.range( [ 0, chartContentSize.width * 0.5 ] );
        xScaleLeft.range( [ 0, chartContentSize.width * 0.5 ] );
        yScale.range( [ 0, chartContentSize.height ] );

        bottomLeftAxis.call( xAxisLeft )
            .attr( "transform", `translate(${chartContentSize.left}, ${chartContentSize.height})` );

        bottomRightAxis.call( xAxisRight )
            .attr( "transform", `translate(${chartContentSize.startRightAxis}, ${chartContentSize.height})` );

        yAxisContent
            .call( yAxis )
            .attr( "transform", `translate(${centerAxis ? chartContentSize.centerX : chartContentSize.left}, 0)` );

        if ( centerAxis )
            yAxisContent.call( centerVerticalAxis );


        // CHART AREA WITHOUT AXISES
        rootSelection.selectAll( ".visContent" )
            .data( [ "left", "right" ] )
            .join( "g" )
            .attr( "class", d => `${d} visContent` )
            .attr( "transform", d =>
            {
                let xTransform = chartContentSize.centerX;
                if ( centerAxis )
                    xTransform += ( d === "left" ? -0.5 * yAxisWidth : 0.5 * yAxisWidth );
                return `translate(${xTransform}, 0) scale( ${d === "left" ? -1 : 1}, 1 )`;
            } );

        const updateBars = ( _selection: any, _rows: DataPoint[] ): any =>
        {
            return _selection.selectAll( ".bar" )
                .data( _rows, ( d: DataPoint ) => d.key )
                .join( "rect" )
                .attr( "class", "bar" )
                .attr( "x", xScaleRight.range()[ 0 ] )
                .attr( "y", d => yScale( d.tuple( CATEGORY ).key ) )
                .attr( "height", clamp0( yScale.bandwidth() ) )
                .attr( "stroke-width", d => d.selected || d.highlighted ? 2 : 0 )
                .attr( "fill", d => palette.getFillColor( d ) )
                .attr( "stroke", d => palette.getOutlineColor( d ) );
        };

        // render bars
        const leftSelection = rootSelection.select( ".left" );
        const rightSelection = rootSelection.select( ".right" );

        if ( reason.data || reason.properties || reason.size )
        {
            updateBars( leftSelection, leftRows )
                .transition( t )
                .attr( "width", d => clamp0( xScaleRight( d.value( VALUE ) ) - xScaleRight.range()[ 0 ] ) );
            updateBars( rightSelection, rightRows )
                .transition( t )
                .attr( "width", d => clamp0( xScaleRight( d.value( VALUE ) ) - xScaleRight.range()[ 0 ] ) );
        }
        else
        {
            rootSelection.select( highlightSide( leftRows, rightRows ) ).raise();
            updateBars( leftSelection, leftRows )
                .attr( "width", d => clamp0( xScaleRight( d.value( VALUE ) ) - xScaleRight.range()[ 0 ] ) );
            updateBars( rightSelection, rightRows )
                .attr( "width", d => clamp0( xScaleRight( d.value( VALUE ) ) - xScaleRight.range()[ 0 ] ) );
        }

        // Warning if there's negative values
        if ( reason.data )
        {
            const hasNegative = rows.some( e => e.value( VALUE ) < 0 );
            if ( hasNegative )
                console.warn( "Negative values will not be rendered" );
        }

        applyAxesColor( props, rootSelection.selectAll( ".axis" ) );

        const removeCollidedText = createRemoveCollidedTextFn();
        removeCollidedText( rootSelection.select( ".axisVertical" ).selectAll( "text" ).nodes() );
        removeCollidedText( rootSelection.select( ".axisBottomRight" ).selectAll( "text" ).nodes() );
        removeCollidedText( rootSelection.select( ".axisBottomLeft" ).selectAll( "text" ).nodes().slice().reverse() );
    }

    protected updateLegend( _data: DataSet ): Encoding[]
    {
        // Create default legend information.
        const encodings = super.updateLegend( _data );

        // If legend is categorical, make caption upper case and reverse items.
        // update first encoding
        const encoding = encodings[ 0 ] as CatEncoding;
        encoding.entries.splice( 2 );

        return encodings;
    }
}
