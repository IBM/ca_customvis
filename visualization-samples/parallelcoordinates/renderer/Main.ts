// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2019
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, DataPoint, DataSet, Font, FormatType, Slot, Properties } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";
const COORDINATES = 0, VALUE = 1, COLOR = 2;            // data column indices

/**
 * Create function to return fill color for a line (group of DataPoints)
 * @param _colorCol Color slot
 * @param _props
 */
function createGetFillColorFn( _colorCol: Slot, _props: Properties ): Function
{
    const palette = _props.get( "line.colors" );
    if ( _colorCol.mapped )
    {
        return ( _dataPoints: DataPoint[] ): string =>
        {
            for ( let i = 0; i < _dataPoints.length; ++i )
            {
                const dataPoint = _dataPoints[ i ];
                if ( dataPoint )
                    return palette.getFillColor( dataPoint );
            }
            return palette.getFillColor( null );
        };
    }
    else
    {
        const defaultColor = palette.getFillColor( null );
        return ( _d ): string => defaultColor;
    }
}

/**
 * Remove collided text by setting visibility
 * @param _elements Array of Text elements
 */
function removeCollidedText( _elements: d3.Selection<SVGElement, any, any, any> ): void
{
    const quadtree = d3.quadtree<DOMRect>()
        .x( ( d ) => d.x )
        .y( ( d ) => d.y );

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
            hasCollided = !( rect.right < _node.data.left || rect.left > _node.data.right || rect.bottom < _node.data.top || rect.top > _node.data.bottom );

        return !( rect.left < _x2 + widthRadius &&
                rect.right > _x1 - widthRadius &&
                rect.top < _y2 + heightRadius &&
                rect.bottom > _y1 - heightRadius );
    }

    _elements.nodes().forEach( ( _element ) =>
    {
        let collide = true;
        rect = _element.getBoundingClientRect() as DOMRect;

        widthRadius = Math.max( widthRadius, rect.width );
        heightRadius = Math.max( heightRadius, rect.height );

        hasCollided = false;
        quadtree.visit( visit );

        if ( !hasCollided )
        {
            quadtree.add( rect );
            collide = false;
        }
        _element.style.visibility = collide ? "hidden" : "visible";
    } );
}

function applyFont( _selection: d3.Selection<SVGElement, any, any, any>, _font: Font | null ): void
{
    _selection
        .style( "font-size", _font && _font.size ? _font.size.toString() : null )
        .style( "font-family", _font && _font.family ? _font.family.toString() : null )
        .style( "font-style", _font && _font.style ? _font.style.toString() : null )
        .style( "font-weight", _font && _font.weight ? _font.weight.toString() : null );
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

        if ( !_info.data )
        {
            d3.select( ".chartContent" ).selectAll( "*" ).remove();
            return;
        }

        const hasSelection = _info.data.hasSelections;
        const cols = _info.data.cols;
        const rows = _info.data.rows;

        // data
        const coordinateGroupKeys: string[] = _info.data ? cols[ COORDINATES ].tuples.map( _s => _s.key ) : [];
        const data = new Map<string, DataPoint[]>();
        const dataKeys = [];
        for ( let i = 0; i < rows.length; ++i )
        {
            const row = rows[ i ];
            const catKey = row.tuple( COLOR ) ? row.tuple( COLOR ).key : "";
            let arr;
            if ( !data.has( catKey ) )
            {
                arr = new Array( coordinateGroupKeys.length ).fill( null );
                data.set( catKey, arr );
                dataKeys.push( catKey );
            }
            else
                arr = data.get( catKey );

            // define at what place it should be put
            const coordinateKey = row.tuple( COORDINATES ).key;
            const idx = coordinateGroupKeys.findIndex( ( _k ) => _k === coordinateKey );
            arr[ idx ] = row;
        }

        // props
        const props = _info.props;
        const lineWidth = props.get( "line.width" );
        const td = props.get( "transition.duration" );
        const transition = d3.transition().duration( td );

        // line color function
        const getFillColor = createGetFillColorFn( cols[ COLOR ], props );

        // measurements
        const { clientHeight, clientWidth } = node;
        const margin = { left: 10, right: 10, top: 10, bottom: 10 };

        const content = {
            width: clientWidth - margin.left - margin.right,
            height: clientHeight - margin.top - margin.bottom
        };

        // render containers
        const rootSelection = d3.select( node ).select( "svg" ).select( ".chartContent" );
        rootSelection.attr( "transform", `translate(${margin.left}, ${margin.top})` );

        const axes = coordinateGroupKeys.map( ( _key: string, _idx: number ) =>
        {
            const r = DataSet.filterRows( rows , COORDINATES, _key );
            const values = r.map( _r => _r.value( VALUE ) );
            const domain = [ Math.min( ...values ), Math.max( ...values )  ];
            const range = [ content.height, 0 ];
            const scale = d3.scaleLinear().domain( domain ).range( range ).nice();
            const position = { x: ( content.width / ( coordinateGroupKeys.length - 1 ) ) * _idx, y: 0 };
            let axis: d3.Axis<any>;

            if ( _idx === 0 )
                axis = d3.axisLeft( scale );
            else
                axis = d3.axisRight( scale );

            axis.tickFormat( val => cols[ VALUE ].format( val.valueOf(), FormatType.label ) );

            return {
                key: _key,
                position,
                scale,
                axis,
                rows: r,
                label: cols[ COORDINATES ].tuples[ _idx ].caption
            };
        } );

        // draw axes
        const axisSelection = rootSelection.selectAll( ".axis" );
        axisSelection.data( axes, ( _axis: any ) => _axis.key )
            .join( enter =>
            {
                const g = enter.append( "g" )
                    .attr( "transform", ( d ) => `translate(${d.position.x}, ${d.position.y})` );

                g.append( "text" )
                    .attr( "class", "axisTitle" )
                    .text( d => d.label )
                    .attr( "dy", "-1.5em" )
                    .attr( "fill", "currentColor" );
                return g;
            } )
            .attr( "class", ( _, _i ) => `${ _i === axes.length - 1 ? "last" : _i === 0 ? "first" : ""  } axis` )
            .attr( "text-anchor", ( _, i )  => i === 0 ? "end" : "start" )
            .each( function( d )
            {
                const s = d3.select( this );
                s.call( d.axis );
            } );
        this._applyAxisProperties( rootSelection.selectAll( ".axis" ), props );

        // calculate the "draw" area after all axis are drawed
        const lastAxis = ( rootSelection.select( ".axis.last" ).node() as SVGGraphicsElement );
        const axisTitle = ( rootSelection.select( ".axis .axisTitle" ).node() as SVGGraphicsElement );
        const firstAxis = ( rootSelection.select( ".axis.first" ).node() as SVGGraphicsElement );
        const widthOfLastAxis = lastAxis ? lastAxis.getBBox().width : 0;
        const widthOfFirstAxis = firstAxis ? firstAxis.getBBox().width : 0;
        const heightOfLabels = props.get( "axis.title.visible" ) && axisTitle ? axisTitle.getBBox().height + 10 : 0;
        const chartArea = {
            top: heightOfLabels,
            left: widthOfFirstAxis,
            height: Math.max( content.height - heightOfLabels, 0 ),
            width: Math.max( content.width - widthOfLastAxis - widthOfFirstAxis, 0 )
        };

        // update position of axes
        axes.forEach( ( _axis: any, _idx: number ) =>
        {
            _axis.scale.range( [ chartArea.height, 0 ] );
            _axis.position = { x: ( chartArea.width / ( axes.length - 1 ) ) * _idx + chartArea.left, y: chartArea.top };
        } );

        // update axes position so it renders in chartArea
        rootSelection.selectAll( ".axis" )
            .transition( transition )
            .attr( "transform", ( d: any ) => `translate(${d.position.x}, ${d.position.y})` )
            .each( function( d: any )
            {
                d3.select( this ).call( d.axis );
            } );

        const line = d3.line<DataPoint>()
            .x( ( _, idx ) => axes[ idx ].position.x )
            .y( ( d, idx ) => axes[ idx ].scale( d.value( VALUE ) ) ).defined( d => !!d );
        const palette = props.get( "line.colors" );

        // create groups
        const dataValues = dataKeys.map( e => data.get( e ) );
        rootSelection.selectAll( ".linesGroup" )
            .data( _info.data ? [ 1 ] : [] )
            .join( "g" )
            .attr( "class", "linesGroup" )
            .attr( "transform", `translate(0, ${ axes[ 0 ].position.y })` )
            .each( function()
            {
                const container = d3.select( this );
                container.selectAll( ".line" )
                    .data( dataValues ) // bind the keys
                    .join( "path" )
                    .attr( "fill", "none" )
                    .attr( "class", "line" )
                    .attr( "stroke-width", ds => ds.some( d => d && ( d.selected || d.highlighted ) ) ? lineWidth + 1 : lineWidth )
                    .attr( "stroke-opacity", ds => ds.some( d => d && ( d.selected || d.highlighted ) ) || !hasSelection ? 0.8 : 0.15 )
                    .attr( "stroke", ds => getFillColor( ds ) )
                    .transition( transition )
                    .attr( "d", line );
            } );

        // Draw markers
        const markerRadius = props.get( "marker.radius" );
        rootSelection.select( ".linesGroup" )
            .selectAll( ".points" )
            .data( dataValues )
            .join( "g" )
            .attr( "class", "points" )
            .each( function( ds )
                {
                    const container = d3.select( this );
                    container.selectAll( ".point" )
                        .data( ds )
                        .join( "circle" )
                        .attr( "class", "point" )
                        .transition( transition )
                        .attr( "cx", ( _d, _i ) => axes[ _i ].position.x )
                        .attr( "cy", ( _d, _i ) => _d ? axes[ _i ].scale( _d.value( VALUE ) ) : 0 )
                        .attr( "r", ( _d ) => _d ? ( _d.selected || _d.highlighted ? markerRadius + 1 : markerRadius ) : 0 )
                        .style( "fill", ( d ) => palette.getFillColor( d ) );
                } );
        d3.selectAll( ".points" ).attr( "display", props.get( "marker.show" ) ? null : "none" );

        removeCollidedText( rootSelection.selectAll( "text" ) );
    }

    private _applyAxisProperties( _selector: d3.Selection<SVGElement, any, any, any>,  _props: Properties ): void
    {
        //SVGGraphicsElement
        _selector.selectAll( ".tick text" )
            .style( "display", _props.get( "axis.ticks.labels.visible" ) ? null : "none" )
            .attr( "fill", _props.get( "axis.ticks.labels.color" ) )
            .call( applyFont, _props.get( "axis.ticks.labels.font" ) );

        _selector.selectAll( ".tick line" )
            .style( "display", _props.get( "axis.ticks.visible" ) ? null : "none" )
            .attr( "stroke", _props.get( "axis.ticks.color" ) );

        _selector.selectAll( "path.domain" )
            /*.style( "display", _props.get( "" ) ? null : "hidden" )*/
            .attr( "stroke", _props.get( "axis.line.color" ) );

        _selector.selectAll( "text.axisTitle" )
            .style( "display", _props.get( "axis.title.visible" ) ? null : "none" )
            .attr( "fill", _props.get( "axis.title.color" ) )
            .call( applyFont, _props.get( "axis.title.font" ) );
    }

    protected updateProperty( _name: string, _value: any ): void
    {
      switch( _name )
      {
        case "marker.show":
            this.properties.setActive( "marker.radius", _value );
            break;
      }
    }

    public getItemsAtPoint( _vizCoord: any ): any[]
    {
        // Validate that the incoming vizCoord is a point with an x and y.
        if ( !_vizCoord || !Object.prototype.hasOwnProperty.call( _vizCoord, "x" ) || !Object.prototype.hasOwnProperty.call( _vizCoord, "y" ) )
            return null; // unrecognized vizCoord

        // Cast to IRSPoint to use get x and y properties. Viewport is already an IRSPoint.
        const elem = document.elementFromPoint( _vizCoord.x, _vizCoord.y );
        // const data = this.hitTest( elem, coord, _viewport as Point );
        const datum = d3.select( elem ).datum() || [] as DataPoint[];
        if ( Array.isArray( datum ) )
            return datum.filter( d => d && d.source ).map( d => d.source );
        if ( datum instanceof DataPoint )
            return [ datum.source ];

        return null;
    }
}
