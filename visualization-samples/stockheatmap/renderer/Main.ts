import { RenderBase, UpdateInfo, DataSet, DataPoint, Color, ColorStops, Segment, Slot } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";
import { TreeNode } from "./TreeNode";

const HIERARCHY = 0, HEAT = 2;
const TITLE_HEIGHT = 15, PADDING = 1;
const MINIMUM_PROPORTION = 0.002;
const MINIMUM_HEIGHT_STOCK_LABEL = 30;
const MINIMUM_WIDTH_STOCK_HEAT = 50, MINIMUM_HEIGHT_STOCK_HEAT = 40;
const GROUP_LABEL_FONT_SIZE = 11;

/**
 * Calculate the hierarchy of data, based on HIERARCHY value of rows
 * @param _data
 */
function hierarchicalData( _data: DataSet ): TreeNode
{
    const tree = new TreeNode( "root" );
    _data.rows.forEach( row =>
    {
        const hierarchy = row.tuple( HIERARCHY ).segments.map( e => e.caption );
        const nodeName = hierarchy.pop();
        let treeLevel = tree;
        // Iterate treeLevel as pointer through each level of hierarchy
        hierarchy.forEach( key =>
        {
            let treeNodeIndex = treeLevel.findChild( key );
            if ( treeNodeIndex < 0 ) // Hierarchy not found, creating
            {
                const newNode = new TreeNode( key );
                treeNodeIndex = treeLevel.addChild( newNode );
            }
            treeLevel = treeLevel.children[ treeNodeIndex ];
        } );
        const leafNodeData = new TreeNode( nodeName );
        leafNodeData.setData( row );
        treeLevel.addChild( leafNodeData );

        treeLevel = tree;
    } );
    return tree;
}

/**
 * Generate function to check if a group title should be rendered
 * @param root Root node
 */
function createCheckGroupTitleVisibleFn( root: d3.HierarchyNode<TreeNode> ): Function
{
    // Minimum size to show group label is MINIMUM_PROPORTION of root size
    const minimumSize = root.value * MINIMUM_PROPORTION;
    return ( _node: d3.HierarchyNode<any> ): boolean => _node.value > minimumSize;
}

/**
 * Generate function to check if a stock name should be shown
 * @param _svgElem
 */
function createCheckStockNameVisibleFn( _svgElem: SVGTextElement ): Function
{
    const padding = 15;
    return ( _leaf: d3.HierarchyNode<TreeNode> ): boolean =>
    {
        const name = _leaf.data.name;
        const width = _leaf[ "x1" ] - _leaf[ "x0" ];
        const height = _leaf[ "y1" ] - _leaf[ "y0" ];
        _svgElem.textContent = name;
        return _svgElem.getComputedTextLength() <= width - padding
            && height >= MINIMUM_HEIGHT_STOCK_LABEL;
    };
}

/**
 * Generate function to check if a stock heat should be shown
 * @param _isStockNameVisible Function that return a boolean if stock name is visible
 */
function createCheckStockHeatVisibleFn( _isStockNameVisible: Function ): Function
{
    return ( _leaf: d3.HierarchyNode<TreeNode> ): boolean =>
    {
        const width = _leaf[ "x1" ] - _leaf[ "x0" ];
        const height = _leaf[ "y1" ] - _leaf[ "y0" ];
        return width >= MINIMUM_WIDTH_STOCK_HEAT
            && height >= MINIMUM_HEIGHT_STOCK_HEAT
            && _isStockNameVisible( _leaf );
    };
}

/**
 * Return offset if only stock name is shown
 * @param _isStockNameVisible
 * @param _isStockHeatVisible
 */
function createGetStockLabelOffsetFn( _isStockNameVisible: Function, _isStockHeatVisible: Function, showStockValue: boolean ): Function
{
    return ( _leaf: d3.HierarchyNode<TreeNode> ): number =>
    {
        return !showStockValue || ( _isStockNameVisible( _leaf ) && !_isStockHeatVisible( _leaf ) ) ? 5 : 0;
    };
}

/**
 * Generate function that trims the group title until it fits the container
 * @param _svgElem SVGTextElement having font-size same as the group title
 */
function createTrimGroupTitleFn( _svgElem: SVGTextElement ): Function
{
    const padding = 10;
    return ( _node: d3.HierarchyNode<TreeNode> ): string =>
    {
        const maxWidth = _node[ "x1" ] - _node[ "x0" ] - padding;
        const name = _node.data.name;
        _svgElem.textContent = name;
        let i;
        for ( i = name.length; i > 0 && _svgElem.getSubStringLength( 0, i ) > maxWidth; i = i - 3 );
        for ( i; i < name.length && _svgElem.getSubStringLength( 0, i + 1 ) <= maxWidth; ++i );
        return name.substr( 0, i );
    };
}

/**
 * Generate coordinates of the polygon for the group title
 * @param _node Group node, direct parents of leaves
 */
function getGroupTitleContainerCoordinates( _node: d3.HierarchyNode<TreeNode> ): number[][]
{
    const x0 = _node[ "x0" ];
    const x1 = _node[ "x1" ];
    const y0 = _node[ "y0" ];
    const coordinates = [
        [ x0 + PADDING, y0 ],
        [ x1 - PADDING * 2, y0 ],
        [ x1 - PADDING * 2, y0 + TITLE_HEIGHT - PADDING ],
        [ x0 + TITLE_HEIGHT, y0 + TITLE_HEIGHT - PADDING ],
        [ x0 + 0.75 * TITLE_HEIGHT, y0 + 1.25 * TITLE_HEIGHT - PADDING ],
        [ x0 + 0.5 * TITLE_HEIGHT, y0 + TITLE_HEIGHT - PADDING ],
        [ x0 + PADDING, y0 + TITLE_HEIGHT - PADDING ]
    ];
    return coordinates;
}

const transparent = ( color: Color ): string => `rgba(${color.r},${color.g},${color.b},0.4)`;
const darker = ( color: Color ): string => `rgba(${0.7 * color.r},${0.7 * color.g},${0.7 * color.b},${color.a})`;

/**
 * Generate styling functions for group label container
 * @param _colorStops
 * @param _hasSelections If any data row is selected
 */
function createGroupLabelStyleFn( _colorStops: ColorStops, _hasSelections: boolean ): Function
{
    return ( _node: d3.HierarchyNode<TreeNode>, _elem: Element ): void =>
    {
        const highlighted = _node.data.isHighlighted();
        const selected = _node.data.isSelected();
        const color = _colorStops.getColor( _node.data.heat );
        const stroke = highlighted || selected ? darker( color ) : "white";
        const strokeWidth = highlighted || selected ? "2px" : "1px";
        const fillColor = !selected && _hasSelections ? transparent( color ) : color;
        const elem = d3.select( _elem );
        elem.style( "stroke", stroke );
        elem.style( "stroke-width", strokeWidth );
        elem.style( "fill", fillColor.toString() );
    };
}

/**
 * Create function that format stock heat using the host's formatter
 * @param _col Heat column
 */
function createFormatStockHeatFn( _col: Slot ): Function
{
    return ( _leaf: d3.HierarchyNode<TreeNode> ): string =>
    {
        const value = _leaf.data.heat;
        const formattedValue = _col.format( value );
        return value > 0 ? "+" + formattedValue : formattedValue;
    };
}

export default class extends RenderBase
{
    private _root: d3.HierarchyNode<TreeNode>;

    protected create( _node: HTMLElement ): Element
    {
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        const chart = svg.append( "g" ).attr( "class", "chart" );
        chart.append( "g" ).attr( "class", "elem data" );
        chart.append( "g" ).attr( "class", "names data" );
        chart.append( "g" ).attr( "class", "values data" );
        chart.append( "g" ).attr( "class", "smallTitles titles data" );
        chart.append( "g" ).attr( "class", "bigTitles titles data" );

        return svg.node();
    }

    protected update( _info: UpdateInfo ): void
    {
        const data = _info.data;
        const node = _info.node;
        const svg = d3.select( node );
        const props = _info.props;
        const updateReason = _info.reason;
        const width = node.clientWidth;
        const height = node.clientHeight;
        const palette = props.get( "color" );
        const showHierarchy = props.get( "text.showGroup" );
        const showStockName = props.get( "text.showName" );
        const showStockValue = props.get( "text.showValue" );
        const textColor = props.get( "text.color" ) as Color;

        if ( !data )
        {
            svg.selectAll( ".data>*" ).remove();
            return;
        }

        svg.call( d3.zoom()
            .extent( [ [ 0, 0 ], [  width, height ] ] )
            .scaleExtent( [ 1, 4 ] )
            .translateExtent( [ [ 0, 0 ], [ width, height ] ] )
            .on( "zoom", () => svg.select( ".chart" ).attr( "transform", d3.event.transform ) )
        );

        if ( updateReason.data )
        {
            // Using treemap to calculate coordinate from hierarchical data format
            const hierarchyData = hierarchicalData( data );
            this._root = d3.hierarchy<TreeNode>( hierarchyData, d => d.children )
                .sum( d => Math.max( d.size, 0 ) ) // Ignore negative data values
                .sort( ( a, b ) => b.value - a.value );
            // Calculate heat for all nodes, recursively
            this._root.data.calculateHeatAndSize();
        }

        const isGroupTitleVisible = createCheckGroupTitleVisibleFn( this._root );

        if ( updateReason.data || updateReason.size || updateReason.properties )
            d3.treemap()
                .size( [ width, height ] )
                .tile( d3.treemapBinary )
                .round( true )
                .padding( PADDING )
                .paddingTop( ( d ) => isGroupTitleVisible( d ) && showHierarchy ? TITLE_HEIGHT : PADDING )
                .paddingRight( PADDING * 2 )( this._root );

        // Label of small groups (parents of leaves)
        const nodesWithSmallLabel = this._root.descendants()
            .filter( node => node.height === 1 && node.depth > 0 && isGroupTitleVisible( node ) );
        const leaves: d3.HierarchyNode<TreeNode>[] = this._root.leaves().filter( leaf => leaf.data.size > 0 );

        if ( updateReason.data || updateReason.size || updateReason.properties )
        {
            // Draw treemap
            svg.select( ".elem" )
                .selectAll( "rect" )
                .data( leaves )
                .join( "rect" )
                .attr( "x", leaf => leaf[ "x0" ] )
                .attr( "y", leaf => leaf[ "y0" ] )
                .attr( "width", leaf => leaf[ "x1" ] - leaf[ "x0" ] )
                .attr( "height", leaf => leaf[ "y1" ] - leaf[ "y0" ] )
                .attr( "stroke-width", 2 );

            const dummySvg: any = svg.select( ".elem" )
                .selectAll( "text" )
                .data( [ null ] )
                .join( "text" )
                .style( "visibility", "hidden" )
                .style( "font-size", "1em" );
            const isStockNameVisible = createCheckStockNameVisibleFn( dummySvg.node() );
            const isStockHeatVisible = createCheckStockHeatVisibleFn( isStockNameVisible );
            const getStockLabelOffset = createGetStockLabelOffsetFn( isStockNameVisible, isStockHeatVisible, showStockValue );
            const formatStockHeat = createFormatStockHeatFn( data.cols[ HEAT ] );

            if ( showStockName )
                svg.select( ".names" )
                    .selectAll( "text" )
                    .data( leaves.filter( node => isStockNameVisible( node ) ) )
                    .join( "text" )
                    .attr( "x", leaf => leaf[ "x0" ] + ( leaf[ "x1" ] - leaf[ "x0" ] ) / 2 )
                    .attr( "y", leaf => leaf[ "y0" ] + ( leaf[ "y1" ] - leaf[ "y0" ] ) / 2 + getStockLabelOffset( leaf ) )
                    .text( leaf => leaf.data.name )
                    .style( "text-anchor", "middle" )
                    .attr( "fill", textColor.toString() );
            else
                svg.selectAll( ".names" ).html( null );

            if( showStockValue )
                svg.select( ".values" )
                    .selectAll( "text" )
                    .data( leaves.filter( node => isStockHeatVisible( node ) ) )
                    .join( "text" )
                    .attr( "x", leaf => leaf[ "x0" ] + ( leaf[ "x1" ] - leaf[ "x0" ] ) / 2 )
                    .attr( "y", leaf => leaf[ "y0" ] + ( leaf[ "y1" ] - leaf[ "y0" ] ) / 2 + 15 )
                    .text( leaf => formatStockHeat( leaf ) )
                    .attr( "font-size", "0.8em" )
                    .style( "text-anchor", "middle" )
                    .attr( "fill", textColor.toString() );
            else
                svg.selectAll( ".values" ).html( null );

            if( showHierarchy )
            {
                dummySvg.style( "font-size", GROUP_LABEL_FONT_SIZE + "px" );
                const formatGroupTitle = createTrimGroupTitleFn( dummySvg.node() );

                // Parent of leaves label container
                svg.select( ".smallTitles" )
                    .selectAll( "polygon" )
                    .data( nodesWithSmallLabel )
                    .join( "polygon" )
                    .attr( "points", node => getGroupTitleContainerCoordinates( node ).map( e => e[ 0 ] + "," + e[ 1 ] ).join( " " ) );

                // Parent of leaves (small label)
                svg.select( ".smallTitles" )
                    .selectAll( "text" )
                    .data( nodesWithSmallLabel )
                    .join( "text" )
                    .attr( "x", node => node[ "x0" ] + 3 )
                    .attr( "y", node => node[ "y0" ] + 11 )
                    .attr( "fill", textColor.toString() )
                    .attr( "font-size", GROUP_LABEL_FONT_SIZE + "px" )
                    .text( node => formatGroupTitle( node ) );

                // Big group label (leaves' grandparents and above, exclude root)
                svg.select( ".bigTitles" )
                    .selectAll( "text" )
                    .data( this._root.descendants().filter( node => node.depth > 0 && node.height > 1 && isGroupTitleVisible( node ) ) )
                    .join( "text" )
                    .attr( "x", node => node[ "x0" ] + 3 )
                    .attr( "y", node => node[ "y0" ] + 11 )
                    .attr( "font-size", ( GROUP_LABEL_FONT_SIZE + 1 ) + "px" )
                    .text( node => formatGroupTitle( node ) );
            }
            else
            {
                svg.selectAll( ".smallTitles" ).html( null );
                svg.selectAll( ".bigTitles" ).html( null );
            }
        }

        // Color styling
        svg.select( ".elem" )
            .selectAll( "rect" )
            .data( leaves )
            .join( "rect" )
            .attr( "stroke", ( leaf ) => palette.getOutlineColor( leaf.data.dataPoint ) )
            .style( "fill", ( leaf )  => palette.getFillColor( leaf.data.dataPoint ) );

        if ( showHierarchy )
        {
            const groupLabelStyle = createGroupLabelStyleFn( palette.getColorStops( data.cols[ HEAT ] ), data.hasSelections );
            svg.select( ".smallTitles" )
                .selectAll( "polygon" )
                .data( nodesWithSmallLabel )
                .join( "polygon" )
                .each( ( d, i, groups ) => groupLabelStyle( d, groups[ i ] ) );
        }
    }

    protected hitTest( _elem: Element | null ): DataPoint | Segment | null
    {
        // Retrieve the d3 datum of the element that was hit.
        const elem = d3.select<Element, d3.HierarchyNode<TreeNode>>( _elem );
        const node = elem.empty() ? null : elem.datum();
        // If parent of a leaf was hit, return all of its children
        if ( node && node.height === 1 )
        {
            const segments = node.data.children[ 0 ].dataPoint.tuple( HIERARCHY ).segments;
            return segments[ segments.length - 2 ];
        }
        // If there was data on the element, return its DataPoint.
        return node && node.data && node.data.dataPoint;
    }
}