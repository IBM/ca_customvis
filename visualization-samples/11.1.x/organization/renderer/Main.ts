import { RenderBase, UpdateInfo, DataPoint, Tuple, Font, Color } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

const NODES = 0, PARENT = 1, COLOR = 2; // Slot indices

// Defaults
const DEFAULT_WIDTH = 330;
const DEFAULT_HEIGHT = 140;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_BORDER_RADIUS = 5;
const DEFAULT_LINE_WIDTH = 5;
const DEFAULT_PADDING = "3%";

const DEFAULT_ANIMATION_TIME = 600;
const MINIMUM_LIGHTNESS_DIFFERENCE = 50;

const GENERATION_SIBLING_SEPARATION_FACTOR = 1.3;
const GENERATION_COUSIN_SEPARATION_FACTOR = 1.6;
const HORIZONTAL_ANCESTRAL_SEPARATION_FACTOR = 1.3;
const VERTICAL_ANCESTRAL_SEPARATION_FACTOR = 2;

const INITIAL_MINIMUM_THUMBNAIL_ZOOM = 0.03;
const INITIAL_MINIMUM_ZOOM = 0.1;
const INITIAL_MAXIMUM_ZOOM = 1;

// Regex that matches hex color definitions.
//     #9c9c9c     (#RRGGBB)
//     #9c9c9cff   (#RRGGBBAA)
const reHEX = /^\s*#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})[0-9a-fA-F]{0,2}\s*$/;

// Regex that matches CSS rgb(a) statements.
//     rgb ( 0, 255, 99 )
//     rgba( 255, 99, 0, 0.1 )
const reRGBA = /^\s*rgba?\s*\(\s*(\d+\%?)\s*,\s*(\d+\%?)\s*,\s*(\d+\%?)\s*(?:,\s*(\d+(?:\.\d+)?\%?)\s*)?\)\s*/;
const COLOR_R = 1;
const COLOR_G = 2;
const COLOR_B = 3;

const reButtonClass = /\bnode-button-circle\b/;

function createFontString( _font: Font ): string
{
    let fontString = "";

    if ( !_font )
        return fontString;

    if ( _font.family && _font.family.length )
        fontString += "font-family:" + _font.family.join( ", " ) + ";";
    if ( _font.size )
        fontString += "font-size:" + _font.size + ";";
    if ( _font.style )
        fontString += "font-style:" + _font.style + ";";
    if ( _font.weight )
        fontString += "font-weight:" + _font.weight + ";";

    return fontString;
}

const keyPrefix$1 = "$",
    ambiguous = Object.freeze( {} ),
    preroot = Object.freeze( { depth: -1 } ),
    PARENT_SUBSTITUTE = "$$PARENT$$";

function computeHeight( node: any ): void
{
    let height = 0;
    do
        node.height = height;
    while ( ( node = node.parent ) && ( node.height < ++height ) );
}

function calculateAnchorPoint( _point: number[], _direction: string ): number[]
{
    const reversed: boolean = _direction === "left" || _direction === "up";

    let x = 0;
    let y = 0;
    if ( _direction === "left" || _direction === "right" )
        x = ( _point[ 0 ] || 0 ) / ( reversed ? -2 : 2 );
    else
        y = ( _point[ 1 ] || 0 ) / ( reversed ? -2 : 2 );

    return [ x, y ];
}

function transposeCoordinates( _point: number[], _direction: string ): number[]
{
    const horizontal: boolean = _direction === "left" || _direction === "right";

    let x = _point[ horizontal ? 1 : 0 ];
    let y = _point[ horizontal ? 0 : 1 ];
    if ( _direction === "left" || _direction === "up" )
    {
        x *= -1;
        y *= -1;
    }

    return [ x, y ];
}

export default class OrganizationChart extends RenderBase
{
    protected getChartState: Function;
    protected _palette: any;
    public container: any;

    constructor()
    {
        super();

        // Exposed variables
        const attrs: any = {
          svgWidth: null,
          svgHeight: null,
          marginTop: 0,
          marginBottom: 0,
          marginRight: 0,
          marginLeft: 0,
          container: "body",
          defaultFont: null,
          data: null,
          duration: DEFAULT_ANIMATION_TIME,
          initialZoom: 1,
          onNodeClick: ( d: d3.HierarchyNode<any> ) => d,
          direction: null
       };

       this.getChartState = ( () => attrs ) as () => any;

       // Create attribute get/set functions
       Object.keys( attrs ).forEach( ( key ) =>
       {
          this[ key ] = function( _ ): any
          {
             if ( !arguments.length )
                return attrs[ key ];
             attrs[ key ] = _;
             return this;
          };
       } );
    }

    public create( _node: HTMLElement ): Element
    {
        this
            .container( _node )
            .svgWidth( "100%" )
            .svgHeight( "100%" );
        return _node;
    }

    public update( _info: UpdateInfo ): void
    {
        // Get data, properties and svg node.
        const data = _info.data;
        const props = _info.props;

        // Update data and render
        const attrs: any = this.getChartState();

        // Drawing containers
        const container = d3.select( attrs.container );
        const containerRect = container.node().getBoundingClientRect();
        if ( containerRect.width > 0 )
            attrs.svgWidth = containerRect.width;
        if ( containerRect.height > 0 )
            attrs.svgHeight = containerRect.height;

        const chartWidth = attrs.svgWidth - attrs.marginRight - attrs.marginLeft;
        const chartHeight = attrs.svgHeight - attrs.marginBottom - attrs.marginTop;
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;

        // If there is no data, remove all axes and elements.
        if ( !data || !data.rows.length )
        {
            ( container as any ).selectAll( ".svg-chart-container" ).selectAll( ".chart>*" ).remove();
            return;
        }

        this._updateProperties( _info );

        // Store direction (changes layout calculations)
        attrs.direction = props.get( "direction" );
        const horizontal = attrs.direction === "left" || attrs.direction === "right";

        // Generate tree layout function (transpose if necessary)
        attrs.treemapLayout = d3.tree()
            .size( horizontal ? [ chartHeight, chartWidth ] : [ chartWidth, chartHeight ] )
            .nodeSize( horizontal ? [ DEFAULT_HEIGHT, DEFAULT_WIDTH * HORIZONTAL_ANCESTRAL_SEPARATION_FACTOR ] : [ DEFAULT_WIDTH, DEFAULT_HEIGHT * VERTICAL_ANCESTRAL_SEPARATION_FACTOR ] )
            .separation( ( _a: d3.HierarchyNode<any>, _b: d3.HierarchyNode<any> ) => _a.parent === _b.parent ? GENERATION_SIBLING_SEPARATION_FACTOR : GENERATION_COUSIN_SEPARATION_FACTOR );

        // Create or update the tree
        attrs.root = this.stratify( data.rows, props, _info.reason );

        // Add svg
        const zoom = d3.zoom().on( "zoom", () => this.onzoom() );
        const svg = ( container as any ).selectAll( ".svg-chart-container" )
            .data( [ "svg-chart-container" ], ( _d: d3.HierarchyNode<any>, i: number ) => i )
            .join( "svg" )
            .attr( "class", "svg-chart-container" )
            .attr( "width", attrs.svgWidth )
            .attr( "height", attrs.svgHeight )
            .attr( "font-family", attrs.defaultFont )
            .call( d3.zoom().on( "zoom", () => this.onzoom() ) )
            .attr( "cursor", "move" );
        attrs.svg = svg;

        // Add container element
        const chart = svg.selectAll( ".chart" )
            .data( [ "chart" ], ( _d: d3.HierarchyNode<any>, i: number ) => i )
            .join( "g" )
            .attr( "class", "chart" )
            .attr( "transform", `translate(${attrs.marginLeft},${attrs.marginTop})` );

        // Calculate the initial zoom factor if data has changed
        if ( _info.reason.data )
        {
            let minX = 0, minY = 0, maxX = 0, maxY = 0;

            attrs.root.each( ( node: d3.HierarchyPointNode<any> ) =>
            {
                const x = horizontal ? node.y : node.x;
                const y = horizontal ? node.x : node.y;
                if ( x < minX )
                    minX = x;
                if ( y < minY )
                    minY = y;
                if ( x > maxX )
                    maxX = x;
                if ( y > maxY )
                    maxY = y;
            } );

            const totalWidth = maxX - minX + DEFAULT_WIDTH;
            const totalHeight = maxY - minY + DEFAULT_HEIGHT;

            // Note: this only sets the initial zoom; if a tree is unbalanced, it will be partially offscreen
            let minimumZoom;
            if ( chartWidth < 150 || chartHeight < 150 )
                minimumZoom = INITIAL_MINIMUM_THUMBNAIL_ZOOM;
            else
                minimumZoom = INITIAL_MINIMUM_ZOOM;

            attrs.initialZoom = Math.max( minimumZoom, Math.min( chartWidth / totalWidth, chartHeight / totalHeight, INITIAL_MAXIMUM_ZOOM ) );
            attrs.lastTransform = d3.zoomIdentity
                .translate( centerX, centerY )
                .scale( attrs.initialZoom );

            svg.transition()
                .duration( attrs.duration )
                .call( zoom.transform, attrs.lastTransform );
        }

        // Add one more container g element, for better positioning controls
        attrs.centerG = chart.selectAll( ".center-group" )
            .data( [ "center-group" ], ( _d, i ) => i )
            .join( "g" )
            .attr( "class", "center-group" );

        attrs.chart = chart;

        // Display tree contents
        this._update( attrs.root );
    }

    protected hitTest( _elem: Element ): DataPoint | Tuple | null
    {
        // Fetch element and its respective data
        const elem = d3.select<Element,any>( _elem );
        const datum = elem.empty() ? null : elem.datum();

        // Don't highlight or select on expand button
        const className = _elem && _elem.getAttribute( "class" ) || "";
        if ( reButtonClass.test( className ) )
            return null;

        return datum && datum.data && datum.data.dataPoint;
    }

    protected stratify( _rows: any, _props: any, _reason: any ): d3.StratifyOperator<any>
    {
        let orgNode: any,
            i: number,
            rowLength = _rows.length,
            root: any,
            parent: any,
            node: any,
            nodeId: string|null,
            nodeKey: any;
        const nodes = new Array( rowLength ),
            nodeByKey = {},
            attrs: any = this.getChartState();

        // Check for references
        let byRef = false;
        for ( i = 0; i < rowLength; ++i )
        {
            byRef = byRef || !!_rows[ i ].tuple( PARENT ).source.reference;
            if ( byRef )
                break;
        }

        // If data hasn't changed, keep the current tree in tact and only update the properties
        if (  !_reason.data && attrs.allNodes )
        {
            for ( i = 0; i < rowLength; ++i )
            {
                orgNode = this._createOrgNode( _rows[ i ], i, _props, byRef );
                if ( ( nodeId = orgNode.nodeId ) !== null && ( nodeId += "" ) )
                {
                    nodeKey = keyPrefix$1 + nodeId;
                    nodeByKey[ nodeKey ] = nodeKey in nodeByKey ? ambiguous : orgNode;
                }
            }

            for ( i = 0, rowLength = attrs.allNodes.length; i < rowLength; ++i )
            {
                node = attrs.allNodes[ i ];
                orgNode = nodeByKey[ keyPrefix$1 + node.data.nodeId ];
                if ( orgNode )
                    Object.assign( node.data, orgNode );
            }

            return attrs.root;
        }

        // First pass: create all know nodes and store by (adapted) id.
        for ( i = 0; i < rowLength; ++i )
        {
            node = nodes[ i ] = d3.hierarchy( this._createOrgNode( _rows[ i ], i, _props, byRef ) );
            if ( ( nodeId = node.data.nodeId ) !== null && ( nodeId += "" ) )
            {
                nodeKey = keyPrefix$1 + ( node.id = nodeId );
                nodeByKey[ nodeKey ] = nodeKey in nodeByKey ? ambiguous : node;
            }
        }

        // Second pass: iterate nodes and find their corresponding parent. If not found, create a substitute.
        for ( i = 0; i < rowLength; ++i )
        {
            node = nodes[ i ];
            nodeId = node.data.parentNodeId;
            parent = nodeByKey[ keyPrefix$1 + nodeId ];

            if ( nodeByKey[ keyPrefix$1 + node.data.nodeId ] === ambiguous )
            {
                console.warn( `Ignoring ambiguous node: ${node.data.nodeId}` );
                continue;
            }
            else if ( parent === ambiguous )
            {
                console.warn( `Removing ambiguous parent: ${nodeId}` );
                parent = null;
            }

            if ( parent )
            {
                // Valid parent; assign parent-child relationship
                node.parent = parent;
                if ( parent.children )
                    parent.children.push( node );
                else
                    parent.children = [ node ];
            }
            else
            {
                // Orphan
                if ( !root )
                {
                    // Set as root
                    root = node;
                }
                else if ( root.data.nodeId === PARENT_SUBSTITUTE )
                {
                    // Add orphan to substitute root
                    root.children.push( node );
                    node.parent = root;
                    // Note: this 'destroys' the original id
                    node.data.parentNodeId = PARENT_SUBSTITUTE;
                    console.warn( `Add orphan ${root.children.length}: ${node.data.nodeId} to substitute root` );
                }
                else if ( node.data.nodeId !== root.data.nodeId )
                {
                    // Create substitute root and add previous root + current node
                    console.warn( `Creating substitute root for ${node.data.nodeId} and ${root.data.nodeId}` );
                    node.parent = root.parent = nodeByKey[ keyPrefix$1 + PARENT_SUBSTITUTE ] = d3.hierarchy( { nodeId: PARENT_SUBSTITUTE } );
                    node.data.parentNodeId = root.data.parentNodeId = PARENT_SUBSTITUTE;
                    root.parent.children = [ root, node ];
                    root = root.parent;
                }
                else
                {
                    console.warn( `Ignoring ambiguous node: ${node.data.nodeId}` );
                }
            }
        }

        if ( !root )
            throw new Error( "no root" );
        root.parent = preroot;
        root.eachBefore( ( node: any ) => { node.depth = node.parent.depth + 1; --rowLength; } ).eachBefore( computeHeight );
        root.parent = null;

        if ( rowLength > 0 )
            console.warn( "Not all nodes linked: Either cyclic Parent-Nodes relationship or ambigous parents/children." );

        // Set child nodes enter appearance positions
        root.x0 = 0;
        root.y0 = 0;

        // Store flat list of nodes
        attrs.allNodes = attrs.treemapLayout( root ).descendants();

        return root;
    }

    // This function basically redraws visible graph, based on nodes state
    protected _update( { x0, y0, x, y } ): void
    {
        const attrs: any = this.getChartState();
        const chart = attrs.chart;

        // Reposition and rescale chart accordingly
        chart.attr( "transform", attrs.lastTransform );

        // Get tree nodes and links and attach some properties
        const nodes = attrs.allNodes = attrs.treemapLayout( attrs.root ).descendants();

        // Get all links
        const links = nodes.slice( 1 );

        // Get links selection
        const linkSelection = attrs.centerG.selectAll( "path.link" )
            .data( links, ( { id } ) => id );

        // Enter any new links at the parent's previous position.
        const linkEnter = linkSelection.enter()
            .insert( "path", "g" )
            .attr( "class", "link" )
            .attr( "pointer-events", "all" )
            .attr( "d", () =>
            {
                const o = {
                    x: x0,
                    y: y0
                };
                return this.diagonal( o, o, attrs.direction );
            } );

        // Get links update selection
        const linkUpdate = linkEnter.merge( linkSelection );

        // Styling links
        linkUpdate
            .attr( "fill", "none" )
            .attr( "stroke-width", ( { data } ) => data.connectorLineWidth || 2 )
            .attr( "stroke", ( { data } ) => data.connectorLineColor )
            .attr( "stroke-dasharray", ( { data } ) =>
            {
                return data.dashArray ? data.dashArray : "";
            } );

        // Transition back to the parent element position
        linkUpdate.transition()
            .duration( attrs.duration )
            .attr( "d", ( d: d3.HierarchyNode<any> ) => this.diagonal( d, d.parent, attrs.direction ) );

        // Remove any  links which is exiting after animation
        linkSelection.exit()
            .attr( "pointer-events", "none" )
            .transition()
            .duration( attrs.duration )
            .attr( "d",  () =>
            {
                const o = {
                    x: x,
                    y: y
                };
                return this.diagonal( o, o, attrs.direction );
            } )
            .remove();

        // Get nodes selection
        const nodesSelection = attrs.centerG.selectAll( "g.node" )
            .data( nodes, ( { id } ) => id );

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = nodesSelection.enter().append( "g" )
            .attr( "pointer-events", "all" )
            .attr( "class", "node" )
            .attr( "transform", () => `translate(${transposeCoordinates( [ x0, y0 ], attrs.direction )})` )
            .attr( "cursor", "pointer" )
            .on( "click", ( { data } ) =>
            {
                const className = d3.event.srcElement && d3.event.srcElement.getAttribute( "class" ) || "";
                if ( reButtonClass.test( className ) )
                    return;
                attrs.onNodeClick( data.nodeId );
            } );

        // Add background rectangle for the nodes
        nodeEnter.append( "rect" )
            .attr( "class", "node-rect" );

        const content = nodeEnter.append( "g" )
            .attr( "transform", ( { data } ) => `translate(${-( data.width || 0 ) / 2}, ${-( data.height || 0 ) / 2})` )
            .append( "text" );

        content.append( "tspan" )
            .attr( "class", "title" )
            .attr( "x", ( { data } ) => data.padding )
            .attr( "y", ( { data } ) => data.padding )
            .attr( "dy", "1em" );

        content.append( "tspan" )
            .attr( "class", "subtitle" )
            .attr( "x", ( { data } ) => data.padding )
            .attr( "dy", "1em" );

        // Node update styles
        const nodeUpdate = nodeEnter.merge( nodesSelection );

        nodeUpdate.selectAll( "tspan.title" )
            .data( nodes, ( data: d3.HierarchyNode<any> ) => data.id )
            .attr( "style", ( { data } ) => createFontString( data.titleFont ) )
            .attr( "fill", ( { data } ) => data.titleColor )
            .text( ( { data } ) => data.title );

        nodeUpdate.selectAll( "tspan.subtitle" )
            .data( nodes, ( data: d3.HierarchyNode<any> ) => data.id )
            .attr( "style", ( { data } ) => createFontString( data.nodeFont ) )
            .attr( "fill", ( { data } ) => data.color )
            .text( ( { data } ) => data.subtitle );

        // Add Node button circle's group (expand-collapse button)
        const nodeButtonGroups = nodeEnter.append( "g" )
            .attr( "class", "node-button-g" )
            .data( nodes, ( data: d3.HierarchyNode<any> ) => data.id )
            .on( "click", ( d: d3.HierarchyNode<any> ) => this.onButtonClick( d ) )
            .on( "dblclick", ( d: d3.HierarchyNode<any> ) => this.onButtonClick( d ) );

        // Add expand collapse button circle
        nodeButtonGroups.append( "circle" )
            .attr( "class", "node-button-circle" )
            .data( nodes, ( data: d3.HierarchyNode<any> ) => data.id );

        // Add button text
        nodeButtonGroups.append( "text" )
            .attr( "class", "node-button-text" )
            .data( nodes, ( data: d3.HierarchyNode<any> ) => data.id )
            .attr( "pointer-events", "none" );

        // Transition to the proper position for the node
        nodeUpdate.transition()
            .attr( "opacity", 0 )
            .duration( attrs.duration )
            .attr( "transform", ( { x, y } ) => `translate(${transposeCoordinates( [ x, y ], attrs.direction )})` )
            .attr( "opacity", 1 );

        // Style node rectangles
        nodeUpdate.select( ".node-rect" )
            .attr( "width", ( { data } ) => data.width )
            .attr( "height", ( { data } ) => data.height )
            .attr( "x", ( { data } ) => -( data.width || 0 ) / 2 )
            .attr( "y", ( { data } ) => -( data.height || 0 ) / 2 )
            .attr( "rx", ( { data } ) => data.borderRadius || 0 )
            .attr( "stroke-width", ( { data } ) => data.borderWidth )
            .attr( "cursor", "pointer" )
            .attr( "stroke", ( { data } ) => data.borderColor )
            .style( "fill", ( { data } ) => data.nodeColor );

        // Move node button group to the desired position
        nodeUpdate.select( ".node-button-g" )
            .attr( "transform", ( { data } ) => `translate(${calculateAnchorPoint( [ data.width, data.height ], attrs.direction )})` )
            .attr( "opacity", ( { children, collapsedChildren, data } ) =>
            {
                return data.connectorLineWidth && ( children || collapsedChildren ) ? 1 : 0;
            } );

        // Restyle node button circle
        nodeUpdate.select( ".node-button-circle" )
            .attr( "r", 16 )
            .attr( "stroke-width", ( { data } ) => data.borderWidth )
            .attr( "fill", ( { data } ) => data.nodeColor )
            .attr( "stroke", ( { data } ) => data.borderColor );

        // Restyle button texts
        // NOTE: alignment-baseline breaks for Firefox and IE11/Edge (originally for tspan)
        //.      dominant-baseline breaks for IE11/Edge
        //       (See VIDA-4131)
        nodeUpdate.select( ".node-button-text" )
            .attr( "text-anchor", "middle" )
            .attr( "dy", ".3em" )
            .attr( "fill", ( { data } ) => data.color )
            .attr( "font-size", ( { children } ) =>
            {
                return children ? 40 : 26;
            } )
            .text( ( { children } ) =>
            {
                return children ? "-" : "+";
            } )
            .attr( "y", 0 )
            .attr( "pointer-events", "none" );

        // Remove any exiting nodes after transition
        const nodeExitTransition = nodesSelection.exit()
            .attr( "opacity", 1 )
            .attr( "pointer-events", "none" )
            .transition()
            .duration( attrs.duration )
            .attr( "transform", () => `translate(${transposeCoordinates( [ x, y ], attrs.direction )})` )
            .on( "end", function()
            {
                d3.select( this ).remove();
            } )
            .attr( "opacity", 0 );

        // On exit reduce the node rects size to 0
        nodeExitTransition.selectAll( ".node-rect" )
            .attr( "width", 10 )
            .attr( "height", 10 )
            .attr( "x", 0 )
            .attr( "y", 0 );

        // Store the old positions for transition.
        nodes.forEach( ( d: any ) =>
        {
            d.x0 = d.x;
            d.y0 = d.y;
        } );
    }

    /**
     * Enable/disable properties based on data mapping
     * @param _info
     */
    private _updateProperties( _info: UpdateInfo ): void
    {
        const isColorCont = _info.data.cols[ COLOR ].dataType === "cont";
        this.properties.setActive( "contcolor", isColorCont );
        this.properties.setActive( "catcolor", !isColorCont );
        this._palette = _info.props.get( isColorCont ? "contcolor" : "catcolor" );
    }

    private _createOrgNode( _dataPoint: DataPoint, _index: number, _props: any, _byRef: boolean ): any
    {
        const caption: string = _dataPoint.caption( NODES );
        const titleFont: Font = _props.get( "title.font" );
        const titleColor: Color = _props.get( "title.color" );
        const nodeFont: Font = _props.get( "node.font" );
        const nodeColor: Color = _props.get( "node.color" );

        // NOTE: since reference is not yet supported, fetch it from `source`
        const reference: string|null = _byRef ? _dataPoint.tuple( PARENT ).source.reference : _dataPoint.tuple( PARENT ).caption;
        const key: string|null = _byRef ? _dataPoint.tuple( NODES ).key : caption;
        const colorCaption: string = _dataPoint.caption( COLOR );
        const backgroundColor: string = this._palette.getFillColor( _dataPoint );
        let nodeColorString: string = nodeColor.toString();
        let titleColorString: string = titleColor && titleColor.toString() || nodeColorString;

        if ( _props.get( "contrast.text.color" ) )
        {
            // Poor man's lightness calculations
            const nodeLightness = 0.3 * nodeColor.r + 0.59 * nodeColor.g + 0.11 * nodeColor.b;

            let lightness = 0;

            // Test against color notations
            let parts = reRGBA.exec( backgroundColor );
            if ( parts )
            {
                lightness = 0.3 * +parts[ COLOR_R ] + 0.59 * +parts[ COLOR_G ] + 0.11 * +parts[ COLOR_B ] ;
            }
            else
            {
                parts = reHEX.exec( backgroundColor );
                if ( parts )
                    lightness = 0.3 * parseInt( parts[ COLOR_R ], 16 ) + 0.59 * parseInt( parts[ COLOR_G ], 16 ) + 0.11 * parseInt( parts[ COLOR_B ], 16 ) ;
            }

            if ( Math.abs( lightness - nodeLightness ) < MINIMUM_LIGHTNESS_DIFFERENCE )
                nodeColorString = lightness > 127 ? "black" : "white";

            if ( titleColor )
            {
                const titleLightness = 0.3 * titleColor.r + 0.59 * titleColor.g + 0.11 * titleColor.b;
                if ( Math.abs( lightness - titleLightness ) < MINIMUM_LIGHTNESS_DIFFERENCE )
                    titleColorString = lightness > 127 ? "black" : "white";
            }
            else
            {
                titleColorString = nodeColorString;
            }
        }

        const datum = {
            nodeId: key,
            parentNodeId: reference,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            padding: DEFAULT_PADDING,
            borderWidth: DEFAULT_BORDER_WIDTH,
            borderRadius: DEFAULT_BORDER_RADIUS,
            color: nodeColorString,
            borderColor: this._palette.getOutlineColor( _dataPoint ),
            nodeColor: backgroundColor,
            titleColor: titleColorString,
            nodeFont: nodeFont,
            titleFont: titleFont,
            title: caption,
            subtitle: colorCaption,
            connectorLineColor: _props.get( "line.color" ),
            connectorLineWidth: DEFAULT_LINE_WIDTH,
            dashArray: "",
            curvature: _props.get( "line.curvature" ),
            dataPoint: _dataPoint,
            direction: _props.get( "direction" )
        };

        return datum;
    }


    // Generate custom link connector line
    protected diagonal( _source: any, _target: any, _direction: string ): string
    {
        const width = _source.data && _source.data.width || 0;
        const height = _source.data && _source.data.height || 0;

        if ( ( _source.data && !_source.data.connectorLineWidth ) || ( _target.data && !_target.data.connectorLineWidth ) )
            return "";

        // Input values
        const horizontal: boolean = _direction === "left" || _direction === "right";

        const sourceCurveValue: number = _source.data && ( "curvature" in _source.data ) ? _source.data.curvature : 100;
        const targetCurveValue: number = _target.data && ( "curvature" in _target.data ) ? _target.data.curvature : 100;

        // Translated to ratios
        const sourceRatio1: number = Math.min( 1, sourceCurveValue / 50 );
        const sourceRatio2: number = Math.max( 0, ( sourceCurveValue - 50 ) / 50 );
        const targetRatio1: number = Math.min( 1, targetCurveValue / 50 );
        const targetRatio2: number = Math.max( 0, ( targetCurveValue - 50 ) / 50 );

        // Node point and offset
        const sourcePoint: number[] = transposeCoordinates( [ _source.x, _source.y ], _direction );
        const sourceSize: number[] = transposeCoordinates( [ width / 2, height / 2 ], _direction );
        const targetPoint: number[] = transposeCoordinates( [ _target.x, _target.y ], _direction );
        const targetSize: number[] = transposeCoordinates( [ width / 2, height / 2 ], _direction );

        // Fixed line points
        if ( horizontal )
        {
            sourcePoint[ 0 ] -= sourceSize[ 1 ];
            targetPoint[ 0 ] += targetSize[ 1 ];
        }
        else
        {
            sourcePoint[ 1 ] -= sourceSize[ 1 ];
            targetPoint[ 1 ] += targetSize[ 1 ];
        }
        const centerPoint = [ ( sourcePoint[ 0 ] + targetPoint[ 0 ] ) / 2, ( sourcePoint[ 1 ] + targetPoint[ 1 ] ) / 2 ];

        // Dynamic line points
        const sourceCurve = [ sourcePoint[ 0 ], sourcePoint[ 1 ] ];
        const targetCurve = [ targetPoint[ 0 ], targetPoint[ 1 ] ];
        const sourceCenterOffset = [ centerPoint[ 0 ], centerPoint[ 1 ] ];
        const targetCenterOffset = [ centerPoint[ 0 ], centerPoint[ 1 ] ];
        if ( horizontal )
        {
            sourceCurve[ 0 ] = sourceRatio1 * centerPoint[ 0 ] + ( 1 - sourceRatio1 ) * sourcePoint[ 0 ];
            targetCurve[ 0 ] = targetRatio1 * centerPoint[ 0 ] + ( 1 - targetRatio1 ) * targetPoint[ 0 ];
            sourceCenterOffset[ 1 ] = sourceRatio2 * sourcePoint[ 1 ] + ( 1 - sourceRatio2 ) * centerPoint[ 1 ];
            targetCenterOffset[ 1 ] = targetRatio2 * targetPoint[ 1 ] + ( 1 - targetRatio2 ) * centerPoint[ 1 ];
        }
        else
        {
            sourceCurve[ 1 ] = sourceRatio1 * centerPoint[ 1 ] + ( 1 - sourceRatio1 ) * sourcePoint[ 1 ];
            targetCurve[ 1 ] = targetRatio1 * centerPoint[ 1 ] + ( 1 - targetRatio1 ) * targetPoint[ 1 ];
            sourceCenterOffset[ 0 ] = sourceRatio2 * sourcePoint[ 0 ] + ( 1 - sourceRatio2 ) * centerPoint[ 0 ];
            targetCenterOffset[ 0 ] = targetRatio2 * targetPoint[ 0 ] + ( 1 - targetRatio2 ) * centerPoint[ 0 ];
        }

        return `M${sourcePoint} Q${sourceCurve} ${sourceCenterOffset} L${targetCenterOffset} Q${targetCurve} ${targetPoint}`;
    }

    private _centerNode( source: any ): void
    {
        const attrs: any = this.getChartState();
        const t = attrs.lastTransform;
        const chartWidth = attrs.svgWidth - attrs.marginRight - attrs.marginLeft;
        const chartHeight = attrs.svgHeight - attrs.marginBottom - attrs.marginTop;
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;

        // Center the node relative to the zoom factor
        const offset = transposeCoordinates( [ source.x * t.k, source.y * t.k ], attrs.direction );
        t.x = centerX - offset[ 0 ];
        t.y = centerY - offset[ 1 ];

        // Reposition and rescale chart accordingly
        attrs.chart.transition()
            .duration( attrs.duration )
            .attr( "transform", t );
      }

    // Toggle children on click.
    protected onButtonClick( d: any ): void
    {
        // Expanded children?
        if ( d.children )
        {
            // Store as collapsed
            d.collapsedChildren = d.children;
            d.children = null;
        }
        else if ( d.collapsedChildren )
        {
            // Store as expanded
            d.children = d.collapsedChildren;
            d.collapsedChildren = null;

            // Set children as expanded
            d.children.forEach( ( { data } ) => data.expanded = true );
        }

        // Redraw Graph
        this._update( d );
        this._centerNode( d );
    }

   // Zoom handler
    protected onzoom(): void
    {
        const attrs: any = this.getChartState();
        const chart = attrs.chart;

        // Store d3 event transform object
        const transform = d3.event.transform;
        attrs.lastTransform = transform;

        // Reposition and rescale chart accordingly
        chart.attr( "transform", transform );
    }
}
