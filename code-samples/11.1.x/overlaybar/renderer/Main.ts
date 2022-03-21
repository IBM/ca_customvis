/**
 * Licensed Materials - Property of IBM
 *
 * Copyright IBM Corp. 2019 All Rights Reserved.
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo, CatPalette, DataSet, DataPoint, Color } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

const CATEGORIES = 0, BASE = 1, OVERLAY1 = 2, OVERLAY2 = 3, SERIES = 4; // data column indices
const margin = { left: 5, top: 5, right: 5, bottom: 5 }; // chart margins

export default class extends RenderBase
{
    // Create is called during initialization
    protected create( _node: HTMLElement ): Element
    {
        // Ensure a repeating background image.
        _node.style.backgroundRepeat = "repeat";

        // Create an svg node and return it so it can be used in `update`.
        return d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .style( "position", "absolute" )
            .node();
    }

    // Update is called during new data, property change, resizing, etc.
    protected update( _info: UpdateInfo ): void
    {
        const logo = this.toUrl( "../static/bee.svg" ); // resolved url of our static image
        const svg = _info.node; // the svg node that was created in the `create` method
        const rows = _info.data ? _info.data.rows : [];
        const cats = _info.data ? _info.data.cols[ CATEGORIES ].tuples.map( _t => _t.key ) : [];
        const colors = _info.data ? _info.data.cols[ SERIES ].tuples.map( _t => _t.key ) : [];
        let maxValue = 0;
        if ( _info.data )
        {
            maxValue = Math.max( Math.max( _info.data.cols[ BASE ].domain.max, _info.data.cols[ OVERLAY1 ].domain.max ), _info.data.cols[ OVERLAY2 ].domain.max );
        }
        const hasColors = colors.length > 0;

        const valScale = d3.scaleLinear().range( [ margin.left, svg.clientWidth - margin.right ] ).domain( [ 0, maxValue ] );
        const catScale = d3.scaleBand().range( [ margin.top, svg.clientHeight - margin.bottom ] ).domain( cats ).padding( 0.1 );
        const colorScale = d3.scaleBand().range( [ 0, catScale.bandwidth() ] ).domain( colors ).paddingInner( 0.1 );
        const palette = _info.props.get( "colors" ) as CatPalette;

        // Set or clear the background image on the parent node.
        d3.select( svg.parentNode )
            .style( "background-image", _info.props.get( "image" ) ? `url(${logo})` : null )
            .style( "background-size", _info.props.get( "imageSize" ) );

        const getColor = function( _row: DataPoint, _alpha: number ): string
        {
            const tuple = _row.tuple( palette.slot );
            const color = palette.getColor( tuple );
            return Color.fromObject( { ...color, a: _alpha } ).toString();
        };

        // Data binding uses the DataSet.filterRows function to create a subset of the
        // rows, filtered by category.
        const elements = d3.select( svg )
            .selectAll( ".group" ) // create a 'group' for each category
            .data( cats , ( key: string ) => key )
            .join( enter => enter.append( "g" ).attr( "class", "group" ) )
                .attr( "transform", cat => `translate(0,${catScale( cat )})` )
                .selectAll( ".elem" ) // create an 'elem' for each color in each group
                .data( cat => DataSet.filterRows( rows, CATEGORIES, cat ), ( d: DataPoint ) => d.key )
                .join( enter => enter.append( "g" ).attr( "class", "elem" )
                    .call( g => g.append( "rect" ) // base bar value
                        .attr( "class", "r1" )
                        .attr( "stroke-width", 2 ) )
                    .call( g => g.append( "rect" ) // first overlay value
                        .attr( "class", "r2" )
                        .attr( "stroke-width", 2 ) )
                    .call( g => g.append( "rect" ) // second overlay value
                        .attr( "class", "r3" )
                        .attr( "stroke-width", 2 ) )
                    .call( g => g.append( "text" ) // text label (category)
                        .attr( "alignment-baseline", "middle" )
                        .attr( "font-size", "12px" ) ) );

        elements.select( ".r1" ) // create / update all rectangles (bars)
            .attr( "x", valScale( 0 ) )
            .attr( "y", row => hasColors ? colorScale( row.tuple( SERIES ).key ) : 0 )
            .attr( "width", row => valScale( row.value( BASE ) ) - valScale( 0 ) )
            .attr( "height", hasColors ? colorScale.bandwidth() : catScale.bandwidth() )
            .attr( "fill", row => getColor( row, 0.2 ) )
            .attr( "stroke", row => palette.getOutlineColor( row ) );

        elements.select( ".r2" ) // create / update all rectangles (bars)
            .attr( "x", valScale( 0 ) )
            .attr( "y", row => hasColors ? colorScale( row.tuple( SERIES ).key ) + colorScale.bandwidth() * 0.2 : colorScale.bandwidth() * 0.2 )
            .attr( "width", row => valScale( row.value( OVERLAY1 ) ) - valScale( 0 ) )
            .attr( "height", hasColors ? colorScale.bandwidth() * 0.6 : catScale.bandwidth() * 0.6 )
            .attr( "fill", row => getColor( row, 0.6 ) )
            .attr( "stroke", row => palette.getOutlineColor( row ) );

        elements.select( ".r3" ) // create / update all rectangles (bars)
            .attr( "x", valScale( 0 ) )
            .attr( "y", row => hasColors ? colorScale( row.tuple( SERIES ).key ) + colorScale.bandwidth() * 0.4 : colorScale.bandwidth() * 0.4 )
            .attr( "width", row => valScale( row.value( OVERLAY2 ) ) - valScale( 0 ) )
            .attr( "height", hasColors ? colorScale.bandwidth() * 0.2 : catScale.bandwidth() * 0.2 )
            .attr( "fill", row => getColor( row, 1.0 ) )
            .attr( "stroke", row => palette.getOutlineColor( row ) );

        elements.select( "text" ) // create / update all text labels
            .attr( "visibility", _info.props.get( "labels" ) ? "visible" : "hidden" )
            .attr( "x", valScale( 0 ) + 2 )
            .attr( "y", row => hasColors ? colorScale( row.tuple( SERIES ).key ) : 0 )
            .attr( "dy", hasColors ? colorScale.bandwidth() / 2 : catScale.bandwidth() / 2 )
            .text( d => d.caption( CATEGORIES ) + ( hasColors ? ` - ${d.caption( SERIES )}` : "" ) );
    }
}
