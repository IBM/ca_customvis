// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2019, 2023
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

// ******** FOR INTERNAL USE ONLY! ********

// sample from https://observablehq.com/@d3/sankey-diagram
import { RenderBase, UpdateInfo, CatPalette, DataSet, DataPoint, Tuple, Font } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

// Sankey plugin
import * as d3Sankey from "d3-sankey";

// RBush — a high-performance JavaScript R-tree-based 2D spatial index for points and rectangles
// For labels collision checking.
import { default as RBush } from "rbush";

// Data column indices
const FROM = 0, TO = 1, WEIGHT = 2;

const DATA_POINTS_LIMIT = 10000; // TODO: Arbitrary limit for datapoints for now, to avoid blowing up.

const Y_BUFFER = 5; // for vertical adjustment to give enough padding at top/bottom for label (px assumed).

// Key function for d3.data to uniquely identify data elements.
const keyFn = ( elem: any ): string => elem.key || "";

function getSankeyAlignment( _alignment: string ): Function
{
    switch ( _alignment )
    {
        case "left": return d3Sankey.sankeyLeft;
        case "right": return d3Sankey.sankeyRight;
        case "center": return d3Sankey.sankeyCenter;
        default: return d3Sankey.sankeyJustify;
    }
}

type Node =
{
    key: string;
    $: Tuple;
    x0?: number;
    x1?: number;
    y0?: number;
    y1?: number;
    sourceLinks?: Link[];
    targetLinks?: Link[];
    layer?: number;
}

type Link =
{
    key: string;
    $: DataPoint;
    source: any; // source and target can be string / Node
    target: any;
    value: number;
    _negated?: boolean;
}

type Decoration =
{
    highlighted: boolean;
    selected: boolean;
}

function buildLabelDomains( _nodes: Node[] ): string[]
{
    const colorDomains: string[] = []; // specific for color lookup.
    for ( const node of _nodes )
    {
        const dv: string = node.$.caption;
        if ( colorDomains.indexOf( dv ) < 0 ) // don't want duplicated caption.
        {
            colorDomains.push( dv );
        }
    }
    colorDomains.sort();
    return colorDomains;
}

function mergeNodes( _from: Node[], _to: Node[] ): Node[]
{
    const nodes: Node[] = [].concat( _from );
    for ( const toNode of _to )
    {
        const n = nodes.some( _e => _e.key === toNode.key );
        if ( !n )
            nodes.push( toNode );
    }
    return nodes;
}

function filterNodes( _nodes: Node[], _links: Link[] ): Node[]
{
    const nodes: Node[] = [].concat( _nodes );
    if ( _links && _links.length > 0 )
    {
        return nodes.filter( function( _n )
        {
            const anyLink = _links.some( function( _l )
            {
                return _l.source === _n.key || _l.target === _n.key;
            } );
            return !!anyLink;
        } );
    }
    else
        return nodes;
}

function createLinkOpacityFn( _hasSelections: boolean ): ( d: Link ) => number
{
    if ( _hasSelections )
        return ( d: Link ): number => d.$.highlighted || d.$.selected ? 0.9 : 0.3;
    return ( d: Link ): number => d.$.highlighted ? 0.9 : 0.5;
}

function createNodeOpacityFn( _hasSelections: boolean ): ( d: Node ) => number
{
    const nodeDecoration = ( d: Node ): Decoration =>
    {
        // A node is decorated (highlighted/selected) if its datum (Tuple)
        // is decorated or one of its link is decorated
        const decoration = {
            highlighted: d.$.highlighted,
            selected: d.$.selected
        };
        [ d.sourceLinks, d.targetLinks ].forEach( ( links: Link[] ) =>
        {
            // Stop the loop if both highlighted and selected are set to true
            for ( let i = 0; !( decoration.highlighted && decoration.selected ) && i < links.length; ++i )
            {
                const source = links[ i ].$;
                decoration.highlighted = decoration.highlighted || source.highlighted;
                decoration.selected = decoration.selected || source.selected;
            }
        } );
        return decoration;
    };
    if ( _hasSelections )
        return ( d: Node ): number =>
        {
            const decoration = nodeDecoration( d );
            return decoration.highlighted || decoration.selected ? 1 : 0.4;
        };
    return ( d: Node ): number =>
    {
        const decoration = nodeDecoration( d );
        return decoration.highlighted ? 1 : 0.8;
    };
}

export default class extends RenderBase
{
    private _renderId: string; // This should be unique per rendering instance for generating unique id to gradient element.

    private _domains: string[];    // current set of domains of categories
    private _colorsFn: any;             // _colorsFn function based on current domains and choice of palette.

    // Store current links and nodes to avoid keep on recalculating them unnecessarily for rendering
    // reasons like decorations change or resizing.
    private _links: Link[];
    private _nodes: Node[];

    protected create( _parent: HTMLElement ): void
    {
        this.meta.dataLimit = DATA_POINTS_LIMIT;

        // Create an svg canvas with groups for nodes, links and labels.
        const svg = d3.select( _parent ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .style( "position", "absolute" );
        svg.append( "g" ).attr( "class", "chartContent links" ).attr( "fill", "none" );
        svg.append( "g" ).attr( "class", "chartContent nodes" );
        svg.append( "g" ).attr( "class", "chartContent labels" );

        // A pesudo uuid - see https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript/2117523#2117523
        // At the moment, there seems to be no instanceid = dynamic from renderer, uniquely identifies the bundle instance with customvis.
        // Was considering of using such instanceid as unique id as part of the id of the gradient.
        this._renderId = ( "" + 1e7 + -1e3 + -4e3 + -8e3 + -1e11 ).replace( /1|0/g, () => ( 0 || Math.random() * 16 ).toString( 16 ) );


        // Return void so that in update(), _info.node will be the container HTML Element as we
        // need to get clientWidth/clientHeight for all browser as for Firefox, a SVG node
        // clientWidth/clientHeight prop always returns zero!
        // (see https://stackoverflow.com/questions/13122790/how-to-get-svg-element-dimensions-in-firefox)
    }

    protected updateProperty( _name: string, _value: any ): void
    {
        switch( _name )
        {
            case "label.show":
                this.properties.setActive( "label.font", _value );
                this.properties.setActive( "label.color", _value );
                this.properties.setActive( "label.yAlign", _value );
                this.properties.setActive( "label.wrapLongLabel", _value );
                this.properties.setActive( "label.hideCollidedLabel", _value );
                this.properties.setActive( "label.hideCollidedLabelIncludeNodes", _value && this.properties.get( "label.hideCollidedLabel" ) );
                break;
            case "label.hideCollidedLabel":
                this.properties.setActive( "label.hideCollidedLabelIncludeNodes", _value );
                break;
            case "linkFillType":
                this.properties.setActive( "linkFillSolidColor", this.properties.get( "linkFillType" ) === "solid" );
                break;
            case "node.border.width":
                this.properties.setActive( "node.border.color", _value > 0 );
        }
    }

    protected hitTest( _elem: Element | null ): DataPoint | Tuple | null
    {
        const elem = d3.select<Element, any>( _elem );
        const data = elem.empty() ? null : elem.datum();
        return data && data.$; // the underlying vipr data is bound to "$" of datum.
    }

    protected update( _info: UpdateInfo ): void
    {
        // Retrieve svg node (see `create`) and determine size.
        const svg = d3.select( _info.node ).select( "svg" );
        const reason = _info.reason;

        if ( reason.data || reason.properties || reason.size )
        {
            // width and height from container parent node - needed for firefox.
            const width = _info.node.clientWidth;
            const height = _info.node.clientHeight - ( 2 * Y_BUFFER ); // plus adjustment to give gaps for labels in extreme case.

            const data = _info.data;

            // If there is no data, remove everything from the canvas and exit.
            if ( !data )
            {
                svg.selectAll( "g>*" ).remove();
                return;
            }

            // Generate data structure for sankey. Note the prefix that is used for the source
            // and target node.
            this._buildNodesAndLinks( _info ); // this may rebuild this._links and this._nodes if required.
            const links = this._links;
            const nodes = this._nodes;

            if ( links.length === 0 || nodes.length === 0 ) // equivalent to no data, due to options.
            {
                svg.selectAll( "g>*" ).remove();
                return;
            }

            const nodeBorderWidth = _info.props.get( "node.border.width" );

            // Generate sankey data from the data structures.
            const createSankey = d3Sankey.sankey()
                .nodeId( ( n: Node ) => n.key )
                .nodeWidth( _info.props.get( "node.width" ) )
                .nodeAlign( getSankeyAlignment( _info.props.get( "node.alignment" ) ) )
                .nodePadding( _info.props.get( "node.padding" ) )
                .size( [ width - nodeBorderWidth * 2, height - nodeBorderWidth * 2 ] ); // prevent node border from being cut off by chart container
            svg.selectAll( ".chartContent" ).attr( "transform", `translate(${nodeBorderWidth}, ${nodeBorderWidth})` );
            createSankey( { nodes, links } );

            // Create color function
            this._colorsFn = this._createColorFn( _info );

            // Update nodes.
            this._renderNodes( _info, svg, nodes );

            // // Update links that connect the nodes.
            this._renderLinks( _info, svg, links );

            // Update labels for each node.
            this._renderLabels( _info, svg, width, nodes, links );
        }

        // Decoration for highlight / selection on links
        this._decorate( svg, _info.data.hasSelections );
    }

    private _buildNodesAndLinks( _info: UpdateInfo ): void
    {
        // We only process and rebuild this._links and this._nodes if required. (i.e. skipping decoration/resize events)
        // TODO: fine tune to rebuild if we can work out the exact defails of _info.reason.properties.
        if ( _info.reason.data || _info.reason.properties )
        {
            const data = _info.data;
            // We CANNOT use tuple's key to drive Sankey APIs, as the key is unique per column
            // and we cannot correctly "merge" two column data together show multiple levels.
            // Therefore we NEED to use captions.
            const links: Link[] = this._dataLinks( data, _info.props.get( "algorithm.considerNegatives" ) );
            const fromTuples = data.cols[ FROM ].tuples;
            const fromNodes: Node[] = fromTuples.map( ( t: Tuple ) => ( {
                key: `N:${t.caption}`,
                $: t // bound vipr tuple - for hittest
            } ) );
            const toTuples = data.cols[ TO ].tuples;
            const toNodes: Node[] = toTuples.map( ( t: Tuple ) => ( {
                key: `N:${t.caption}`,
                $: t // bound vipr tuple - for hittest
            } ) );

            // we need to "merge" To and From nodes here via captions
            let nodes: Node[] = mergeNodes( fromNodes, toNodes );

            // Now update this._domains due to change of this._nodes.
            // build domain before before filtering of nodes, to have consistent color per category, e.g. for small multiples.
            this._domains = buildLabelDomains( nodes ); // color domains based on unique values from both from and to columns.

            // TODO: we may want to handle our own palette (as a property) and create our own colors function.
            // Not sure how to achieve that we need to have a single categorical palette for 2 slots - limited by current
            // customvis support. So we choose to use the predefined set of colours from Carbon palette.

            // We may filter the nodes rendering based on values available from links.
            if ( _info.props.get( "suppressUnused" ) )
            {
                nodes = filterNodes( nodes, links );
            }

            // update member _links and _nodes on renderer
            this._links = links;
            this._nodes = nodes;
        }
    }

    private _createColorFn( _info: UpdateInfo ): ( d: Node ) => string
    {
        const palette: CatPalette = _info.props.get( "color" );
        if ( _info.props.get( "node.level-color" ) )
            return ( _d: Node ): string => palette.getColor( this._nodes[ _d.layer ].$ ).toString();
        else
            return ( _d: Node ): string => palette.getColor( _d.$ ).toString();
    }

    private _decorate( _svg: any, _hasSelections: boolean ): void
    {
        const linkOpacity = createLinkOpacityFn( _hasSelections );
        const nodeOpacity = createNodeOpacityFn( _hasSelections );
        _svg.select( ".links" )
            .selectAll( "g" )
            .attr( "stroke-opacity", linkOpacity );
        _svg.select( ".nodes" )
            .selectAll( "rect" )
            .attr( "fill-opacity", nodeOpacity );
        _svg.select( ".links" )
            .selectAll( "g" )
            .filter( ( _d: Link ) => _d.$.selected || _d.$.highlighted )
            .raise();
    }

    private _renderNodes( _info: UpdateInfo , _svg: any, _nodes: Node[] ): void
    {
        _svg.select( ".nodes" )
        .selectAll( "rect" )
        .data( _nodes, keyFn )
        .join( "rect" )
            .style( "stroke-width", _info.props.get( "node.border.width" ) )
            .style( "stroke", _info.props.get( "node.border.color" ) )
            .attr( "x", ( d: Node ) => d.x0 )
            .attr( "y", ( d: Node ) => d.y0 )
            .attr( "height", ( d: Node ) => Math.max( 0, d.y1 - d.y0 ) )
            .attr( "width", ( d: Node ) => d.x1 - d.x0 )
            .attr( "fill", ( d: Node ) => this._colorsFn( d ) );
    }

    private _renderLinks( _info: UpdateInfo , _svg: any, _links: Link[] ): void
    {
        const linkFillType = _info.props.get( "linkFillType" );

        const strokeFn = ( d: Link ): string =>
        {
            switch( linkFillType )
            {
            case "from":
                return this._colorsFn( d.source );
            case "to":
                return this._colorsFn( d.target );
            case "solid":
                return _info.props.get( "linkFillSolidColor" ).toString();
            default:
                return `url(#${this._gradient( d )})`;
            }
        };

        _svg.select( ".links" )
        .selectAll( "g" )
        .data( _links, keyFn )
        .join( ( enter: any ) => enter.append( "g" ).call( this._createLinks.bind( this ) ) )
            .call( ( g: any ) => // 'g' represents a link with a path and linearGradient
            {
                if ( linkFillType === "gradient" )
                {
                    g.select( "linearGradient" )
                        .attr( "x1", ( d: Link ) => d.source.x1 )
                        .attr( "x2", ( d: Link ) => d.target.x0 )
                        .attr( "id", ( _ ) => this._gradient( _ ) );
                    g.select( "stop:nth-of-type(1)" )
                        .attr( "stop-color", ( d: Link ) => this._colorsFn( d.source ) );
                    g.select( "stop:nth-of-type(2)" )
                        .attr( "stop-color", ( d: Link ) => this._colorsFn( d.target ) );
                }
                g.select( "path" )
                    .attr( "d", d3Sankey.sankeyLinkHorizontal() )
                    .attr( "stroke-width", ( d: any ) => Math.max( 1, d.width ) )
                    .attr( "stroke", strokeFn ); // either a predefined gradient or use solid fill.
            } );
    }

    private _renderLabels( _info: UpdateInfo , _svg: any, _width: number, _nodes: Node[], _links: Link[] ): void
    {
        const showLabel = _info.props.get( "label.show" );
        const wrapLongLabel = _info.props.get( "label.wrapLongLabel" );
        const hideCollidedLabel = _info.props.get( "label.hideCollidedLabel" );
        const hideCollidedLabelIncludeNodes = _info.props.get( "label.hideCollidedLabelIncludeNodes" );

        const labelYAlign = _info.props.get( "label.yAlign" );
        const labelYFn = ( _d: Node ): number =>
        {
            switch( labelYAlign )
            {
                case "top": return _d.y0 + Y_BUFFER;
                case "bottom": return _d.y1 - Y_BUFFER;
                default: return ( _d.y1 + _d.y0 ) / 2 + Y_BUFFER;
            }
        };

        const labelFont: Font = _info.props.get( "label.font" );

        _svg.select( ".labels" )
            .style( "font-size", labelFont.size ? labelFont.size.toString() : null )
            .style( "font-family", labelFont.family ? labelFont.family.toString() : null )
            .style( "font-style", labelFont.style ? labelFont.style.toString() : null )
            .style( "font-weight", labelFont.weight ? labelFont.weight.toString() : null )
            .selectAll( "text" )
            .data( _nodes, keyFn )
            .join( "text" )
                .style( "fill", _info.props.get( "label.color" ).toString() )
                .attr( "x" , ( d: Node ) => d.x0 < _width / 2 ? d.x1 + 6 : d.x0 - 6 )
                .attr( "y", labelYFn )
                .attr( "dy", "0.35em" )
                .attr( "text-anchor", ( d: Node ) => d.x0 < _width / 2 ? "start" : "end" )
                .attr( "font-weight", ( d: Node ) => d.$.selected ? "bold" : "normal" )
                .attr( "visibility", showLabel ? "visible" : "hidden" )
                .text( ( d: Node ) => d.$.caption );

        // Extra label layout processing:
        if ( showLabel )
        {
            if ( wrapLongLabel )
                this._wrapLabels( _svg, _links );

            if ( hideCollidedLabel )
                this._hideCollidedLabels( _svg, hideCollidedLabelIncludeNodes );
            else // reset visibiilty
                _svg.select( ".labels" ).selectAll( "text" ).attr( "visibility", "visible" );
        }
    }

    private _dataLinks( _data: DataSet, _considerNegatives: boolean ): Link[]
    {
        // Generate data structure for sankey. Note the prefix that is used for the source
        // and target node. This is done to prevent circular links in case the FROM and TO
        // columns are mapped to the same data item.
        // We CANNOT use tuple's key to drive Sankey APIs, as the key is unique per column
        // and we cannot correctly "merge" two column data together show multiple levels.
        // Therefore we NEED to use captions.
        let links: Link[] = _data.rows.map( ( _row: DataPoint ) => (
            {
                source: `N:${_row.tuple( FROM ).caption}`,
                target: `N:${_row.tuple( TO ).caption}`,
                value: _row.value( WEIGHT ),
                key: _row.key,
                $: _row // bound vipr datapoint - for hittest
            } ) );
        // Option
        if ( _considerNegatives )
        {
            links = links.map( ( _d: Link ) =>
            {
                if ( _d.value < 0 )
                {
                    return {
                        source: _d.target,
                        target: _d.source,
                        value: -1 * _d.value,
                        key: _d.key,
                        $: _d.$, // bound vipr datapoint - for hittest
                        _negated: true // special flag to help extra data processing if needed
                    };
                }
                else
                    return _d;
            } );
        }

        // Skip negative value - as the Sankey cannot show negative values - Sankey is not designed for that.
        // Skip duplicated links as we DO NOT/CANNOT "aggregate" the values - simply keep first
        // non-"made positive" link.
        links = links.filter( ( _d: Link ) => _d.value >= 0 ); // skip negative values
        if ( links.length > 1 )
            links = links.reduce<Link[]>( function( _accum, _curr, _currentIndex )
            {
                let index = -1;
                for ( let i = 0; i < _accum.length; ++i )
                {
                    if ( _accum[ i ].source === _curr.source && _accum[ i ].target === _curr.target )
                    {
                        index = i;
                        break;
                    }
                }
                if ( index < 0 )
                    _accum.push( _curr ); // add if unfound
                else if ( _accum[ index ]._negated && !_curr._negated ) // found "made" postitive and _curr is not "made" positive
                    _accum[ index ] = _curr; // Prefer normal to "made positive" link
                return _accum;
            }, [] );

        // TODO: To consider Circular linkings between nodes, and "break" the link.

        return links;
    }


    private _gradient( d: Link ): string
    {
        const keys = [ this._domains.indexOf( d.source.$.caption ), this._domains.indexOf( d.target.$.caption ) ].sort();
        return `grad_${this._renderId}_${keys[ 0 ]}_${keys[ 1 ]}`;
    }

    private _createLinks( _selection: d3.Selection<any, any, any, any> ): void
    {
        // Create a linear gradient and a path.
        _selection.append( "linearGradient" )
            .attr( "gradientUnits", "userSpaceOnUse" )
            .call( g => g.append( "stop" ).attr( "offset", "0%" ) )
            .call( g => g.append( "stop" ).attr( "offset", "100%" ) );
        // TODO: optimise to create/remove gradient fills instead of predefining all, whether being used or not.
        _selection.append( "path" );
    }


    // Labels helpers:

    private _hideCollidedLabels( _svg: any, _includeNodesCheck: boolean ): void
    {
        const tree = new RBush();

        if ( _includeNodesCheck )
        {
            _svg.select( ".nodes" )
                .selectAll( "rect" )
                .each( function( _d: any, _i: number, _n: any )
                {
                    const a = _n[ _i ] as SVGRectElement;
                    const bbox = a.getBoundingClientRect();
                    tree.insert( { minX: bbox.left, minY: bbox.top, maxX: bbox.right, maxY: bbox.bottom } );
                } );
        }

        _svg.select( ".labels" )
            .selectAll( "text" )
            .each( function( _d: any, _i: number, _n: any )
            {
                const a = _n[ _i ] as SVGTextElement;
                const bbox = a.getBoundingClientRect();
                const treeItem = { minX: bbox.left, minY: bbox.top, maxX: bbox.right, maxY: bbox.bottom };
                // check in the tree to see if we overlap
                const result = tree.search( treeItem );
                if ( result === null || result.length === 0 )
                {
                    // not in the tree - this label doesn't overlap
                    tree.insert( treeItem );
                    a.setAttribute( "visibility", "visible" );
                }
                else
                    a.setAttribute( "visibility", "hidden" );
            } );
    }

    private _wrapLabels( _svg: any, _links: Link[] ): void
    {
        const gapMinWidth = this._getMinimumGapWidth( _links );
        _svg.select( ".labels" )
            .selectAll( "text" )
            .call( this._wrap, gapMinWidth * 4 / 7 ); // a factor to keep it smaller than gap width - particularly useful when in small multiple mode.
    }

    private _getMinimumGapWidth( _links: Link[] ): number
    {
        let w = Number.MAX_VALUE;
        for ( const l of _links )
        {
            w = Math.min( w, l.target.x0 - l.source.x1 );
        }
        return w;
    }

    private _wrap( texts: any, width: number ): void
    {
        // logic idea from https://bl.ocks.org/mbostock/7555321 to wrap text.
        texts.each( function()
        {
            const text = d3.select( this ),
                words = text.text().split( /\s+/ ).reverse(),
                lineHeight = 1.1, // ems
                y = text.attr( "y" ),
                x = text.attr( "x" ),
                dy = parseFloat( text.attr( "dy" ) );
            let word: string,
                line = [],
                lineNumber = 0,
                tspan = text.text( "" ).append( "tspan" ).attr( "x", x ).attr( "y", y ).attr( "dy", dy + "em" );
            // eslint-disable-next-line no-cond-assign
            while ( word = words.pop() )
            {
                line.push( word );
                tspan.text( line.join( " " ) );
                if ( tspan.node().getComputedTextLength() > width )
                {
                    line.pop();
                    if ( line.length > 0 )
                    {
                        tspan.text( line.join( " " ) );
                        line = [ word ];
                        tspan = text.append( "tspan" ).attr( "x", x ).attr( "y", y ).attr( "dy", ++lineNumber * lineHeight + dy + "em" ).text( word );
                    }
                    else
                    {
                        line = [];
                        if ( words.length > 0 )
                            tspan = text.append( "tspan" ).attr( "x", x ).attr( "y", y ).attr( "dy", ++lineNumber * lineHeight + dy + "em" ).text( "" );
                    }
                }
            }
        } );
    }
}
