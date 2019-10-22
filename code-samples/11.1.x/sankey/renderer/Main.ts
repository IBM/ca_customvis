/**
 * Licensed Materials - Property of IBM
 * 
 * Copyright IBM Corp. 2019 All Rights Reserved.
 * 
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo, DataPoint, Tuple } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";
import * as d3Sankey from "d3-sankey";

/**
 * This example shows how to use an external library into a custom visualization.
 * The 'd3-sankey' library used in this example was added to 'package.json' and
 * imported in this Main.ts file. It is used to calculate Sankey paths.
 * This sample also shows how to deal with hit-testing in case the nodes that are
 * generated have an indirect link to the data. The 'hitTest' method in this sample
 * shows how to do this.
 */

// Data column indices (see vizdef.xml).
const FROM = 0, TO = 1, WEIGHT = 2;

// Key function that uniquely identifies data elements. Used in 'update'.
const keyFn = ( elem: any ) => elem.key || "";

// Creates empty paths for each link between two nodes. Called during 'update' when
// new data needs to be rendered.
function createLinks( _selection: d3.Selection<any, any, any, any> )
{
    // Create a linear gradient and a stroke refering to that gradient.
    const id = Math.random().toString( 36 ).substr( 2 ); // claim a new gradient id.
    const gradient = ( i: number ) => `grad_${id}:${i}`;
    _selection.style( "mix-blend-mode", "multiply" )
        .append( "linearGradient" )
            .attr( "gradientUnits", "userSpaceOnUse" )
            .attr( "id", ( _, i ) => gradient( i ) )
            .call( g => g.append( "stop" ).attr( "offset", "0%" ) )
            .call( g => g.append( "stop" ).attr( "offset", "100%" ) );
    _selection.append( "path" ).attr( "stroke", ( _, i ) => `url(#${gradient( i )})` );
}

export default class Sankey extends RenderBase
{
    // Custom hitTest method to return the data point or tuple that was hit.
    protected hitTest( _elem: Element ): DataPoint | Tuple | null
    {
        // Data is stored in the '$' field of each d3 datum.
        const elem = d3.select<Element, any>( _elem ).datum();
        return elem && elem.$;
    }

    // Initial setup of the visualization.
    protected create( _parent: HTMLElement ): Element
    {
        // Create an svg canvas with groups for nodes, links and labels.
        const svg = d3.select( _parent ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );
        svg.append( "g" ).attr( "class", "nodes" ).attr( "stroke", "#000" );
        svg.append( "g" ).attr( "class", "links" ).attr( "fill", "none" );
        svg.append( "g" ).attr( "class", "labels" );

        // Return the svg element so it can be used in the `update` method.
        return svg.node();
    }

    // Called every time the visualization needs updating.
    protected update( _info: UpdateInfo ): void
    {
        // Retrieve svg node (see `create`) and determine size.
        const svg = d3.select( _info.node );
        const width = _info.node.clientWidth;
        const height = _info.node.clientHeight;
        const data = _info.data;

        // If there is no data, remove everything from the canvas and exit.
        if ( !data || !data.rows.length )
        {
            svg.selectAll( "g>*" ).remove();
            return;
        }

        // Generate data structure for Sankey. Note the prefix that is used for the source
        // and target node. This is done to prevent circular links in case the FROM and TO
        // columns are mapped to the same data item. The field '$' is added to each link to
        // store a reference to the original data row (needed for hit testing support).
        // The nodes are created from the tuples in the 'from' and 'to' slots. Notice that
        // we use a 'filter' operation on the nodes to remove nodes that are not used in any
        // links. This is to prevent rendering unnecessary 'empty' nodes.
        const keys = new Set(); // source and target keys, needed to delete unused nodes
        const links: any[] = data.rows.map( _row =>
        {
            const link =
            {
                source: `F:${_row.tuple( FROM ).key}`,
                target: `T:${_row.tuple( TO ).key}`,
                value: Math.abs( _row.value( WEIGHT ) ), // negative values are not allowed
                key: _row.key,
                $: _row
            };
            keys.add( link.source ).add( link.target );
            return link;
        } );
        const fromNodes = data.cols[ FROM ].tuples.map( t => ( { $: t, key: `F:${t.key}` } ) );
        const toNodes = data.cols[ TO ].tuples.map( t => ( { $: t, key: `T:${t.key}` } ) );
        const nodes: any[] = fromNodes.concat( toNodes ).filter( _node => keys.has( _node.key ) );

        // Generate sankey data from the data structures.
        const createSankey = d3Sankey.sankey()
            .nodeId( ( n: any ) => n.key )
            .nodeWidth( 15 ) // width (in px) of a node rectangle
            .linkSort( null ) // links are in row order
            .nodeSort( null ) // nodes are in tuple order
            .size( [ width, height ] ); // size of the visualization
        createSankey( { nodes, links } ); // generate Sankey data

        // An ordinal color scale assigns a new color to each unique node.
        const colors = d3.scaleOrdinal( d3.schemeSet3 );

        // Update nodes. Ensure that tuples are colored based on tuple key.
        svg.select( ".nodes" )
            .selectAll( "rect" )
            .data( nodes, keyFn )
            .join( "rect" )
                .attr( "x", d => d.x0 )
                .attr( "y", d => d.y0 )
                .attr( "height", d => Math.max( 0, d.y1 - d.y0 ) )
                .attr( "width", d => d.x1 - d.x0 )
                .attr( "stroke-width", 0 )
                .attr( "fill", d  => colors( d.$.key ) ); // node color

        // Update links that connect the nodes. From and to colors are based on tuple key.
        svg.select( ".links" )
            .selectAll( "g" )
            .data( links, keyFn )
            .join( enter => enter.append( "g" ).call( createLinks ) )
                .call( g => // 'g' represents a link with a path and linearGradient
                {
                    g.attr( "stroke-opacity", d => d.$.highlighted || d.$.selected ? 1 : 0.4 );
                    g.select( "linearGradient" ) // gradient offsets
                        .attr( "x1", d => d.source.x1 )
                        .attr( "x2", d => d.source.x2 );
                    g.select( "stop:nth-of-type(1)" ) // 'from' color
                        .attr( "stop-color", d => colors( d.source.$.key ) );
                    g.select( "stop:nth-of-type(2)" ) // 'to' color
                        .attr( "stop-color", d => colors( d.target.$.key ) );
                    g.select( "path" ) // uses the generated path in 'links'
                        .attr( "d", d3Sankey.sankeyLinkHorizontal() )
                        .attr( "stroke-width", d => Math.max( 1, d.width ) );
                } );

        // Update labels for each node.
        svg.select( ".labels" )
            .selectAll( "text" )
            .data( nodes, keyFn )
            .join( "text" )
                .attr( "x" , d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6 ) // 6px margin
                .attr( "y", d => ( d.y1 + d.y0 ) / 2 ) // center vertically
                .attr( "dy", "0.35em" ) // offset to center of the node
                .attr( "text-anchor", d => d.x0 < width / 2 ? "start" : "end" ) // alignment
                .attr( "font-weight", d => d.$.selected ? "bold" : "normal" ) // bold if selected
                .text( d => d.$.caption ); // use the tuple caption
    }
}
