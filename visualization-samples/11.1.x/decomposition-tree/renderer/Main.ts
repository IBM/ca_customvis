// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, DataPoint, Segment, Color, Properties, DataSet, FormatType } from "@businessanalytics/customvis-lib";

import * as d3 from "d3";
import { buildTree, getDepthRecursive, getTreeRoot, setSelection, closeOtherRoots, TreeNode, HierarchyDatum } from "./TreeData";

const CONTAINER_SVG_CLASS = "svg-chart-container";
const SVG_GROUP = "svg-group";
const LINKS_CLASS = "links";
const NODES_CLASS = "nodes";
const CATEGORIES_CLASS = "categories";
const ROOT_TITLE_CLASS = "rootTitle";
const ROOT_SUBTITLE_CLASS = "rootSubtitle";

const BAR_TARGET_CLASS = "nodeRectTarget";
const BAR_ACTUAL_CLASS = "nodeRectActual";

const VALUE_SLOT = 1;

const X_OFFSET = 10;
const Y_OFFSET = 25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

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

const enum NodesAlignment
{
    AUTO = "Auto",
    CENTER = "Center",
    CURRENT = "Current",
    TOP = "Top"
}

class TransitionManager
{
    public transtionPromises: Promise<void>[] = [];

    public register( transition: any ): void
    {
        if( transition.end !== undefined ) this.transtionPromises.push( transition.end() );
    }

    public clear(): void
    {
        this.transtionPromises = [];
    }

    public resolveAll(): Promise<any>
    {
        return Promise.all( this.transtionPromises );
    }
}

/**
 * Based on collapsable tree from https://observablehq.com/@d3/collapsible-tree
 */
export default class extends RenderBase
{

    private _chartContainer: HTMLElement;
    private root: HierarchyDatum;
    private svg: d3.Selection<SVGSVGElement, string, HTMLElement, unknown>;
    private treeFn: d3.TreeLayout<TreeNode>;
    private locale: string;

    private width: number;
    private height: number;
    private marginTop: number;
    private marginRight: number;
    private marginBottom: number;
    private marginLeft: number;
    private minimumNodeSpace: number;

    private svgGroup;
    private gLink;
    private gNode;
    private gCategories;

    private _zoom;
    private zoomState: d3.ZoomTransform;

    private categories;
    private readonly selectionState = new Map<number, HierarchyDatum>();
    private readonly transitionManager = new TransitionManager();

    private valueFormatter: ( _value: number, _type?: FormatType ) => string;

    private readonly props = {
        transitionDuration: 100,
        barWidth: 100,
        barHeight: 15,
        siblingFactor: 3.5,
        labelOption: "ValueAndPercentage",
        pathCurve: 25,
        labelColor: new Color( 255,0,0, 1 ),
        labelFont: "bold 15px \"IBM Plex Sans\"",
        valueLabelFont: "15px IBM Plex Sans",
        categoryLabelFont: "bold 15px \"IBM Plex Sans\"",
        categorySubLabelFont: "15px \"IBM Plex Sans\"",
        categorySubLabelColor: new Color( 0,0,0,1 ),
        categoryLabelColor: new Color( 0,0,0,1 ),
        barActualColor: new Color( 0,0,0,1 ),
        barTargetColor: new Color( 0,0,0,1 ),
        pathColor: new Color( 0,0,0,1 ),
        selectedPathColor: new Color( 0,0,0,1 ),
        nodesAlignment: NodesAlignment.AUTO
    };

    protected create( _node: HTMLElement ): Element
    {
        this._chartContainer = _node;
        this._zoom = d3.zoom();
        return this._chartContainer;
    }

    private _updateProps( props: Properties ): void
    {
        this.props.transitionDuration = props.get( "transitionDuration" );
        this.props.barWidth = props.get( "barWidth" );
        this.props.barHeight = props.get( "barHeight" );
        this.props.siblingFactor = props.get( "siblingFactor" );
        this.props.labelOption = props.get( "labelOption" );
        this.props.pathCurve = props.get( "pathCurve" );
        this.props.labelColor = props.get( "labelColor" );
        this.props.labelFont = props.get( "labelFont" );
        this.props.valueLabelFont = props.get( "valueLabelFont" );
        this.props.categoryLabelFont = props.get( "categoryLabelFont" );
        this.props.categoryLabelColor = props.get( "categoryLabelColor" );
        this.props.categorySubLabelFont = props.get( "categorySubLabelFont" );
        this.props.categorySubLabelColor = props.get( "categorySubLabelColor" );
        this.props.barActualColor = props.get( "colorActual" );
        this.props.barTargetColor = props.get( "colorTarget" );
        this.props.pathColor = props.get( "pathColor" );
        this.props.selectedPathColor = props.get( "selectedPathColor" );
        this.props.nodesAlignment = props.get( "nodesAlignment" );
    }

    private _clear(): void
    {
        d3.select( this._chartContainer ).selectAll(  `.${CONTAINER_SVG_CLASS}>*` ).remove();
    }

    protected handleZoom( transform: d3.ZoomTransform, zoomTriggeredManually = false ): void
    {
        this.zoomState = transform;
        this.svgGroup.attr( "transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})` );

        if( zoomTriggeredManually )
        {
           this._updateZoomState( transform );
        }
    }

    private _updateZoomState( transform: d3.ZoomTransform ): void
    {
        const zoomIdentity =  d3.zoomTransform( d3.select( this._chartContainer ).node() );
        ( zoomIdentity.x as any ) = transform.x;
        ( zoomIdentity.y as any ) = transform.y;
        ( zoomIdentity.k as any ) = transform.k;
        d3.select( this._chartContainer ).call( this._zoom.transform, zoomIdentity );
    }

    private _createDOM(): void
    {
        // Create the SVG container, a layer for the links and a layer for the nodes.
        this._zoom
            .scaleExtent( [ MIN_ZOOM, MAX_ZOOM ] )
            .on( "zoom", ( event: d3.D3ZoomEvent<any, any> ) => this.handleZoom( event.transform ) );

        const container = d3.select( this._chartContainer )
            .attr( "width", this.width )
            .attr( "height", this.height )
            .call( this._zoom )
            .on( "dblclick.zoom", null );

        this.svg = container.selectAll<SVGSVGElement, string>( `.${CONTAINER_SVG_CLASS}` )
            .data( [ CONTAINER_SVG_CLASS ] )
            .join( "svg" )
            .attr( "class", CONTAINER_SVG_CLASS )
            .attr( "width", this.width )
            .attr( "height", this.height );

        this.svgGroup = this.svg
            .selectAll( `.${SVG_GROUP}` )
            .data( [ SVG_GROUP ] )
            .join( "g" )
            .attr( "class", SVG_GROUP );

        this.gCategories = this.svgGroup
            .selectAll( `.${CATEGORIES_CLASS}` )
            .data( [ CATEGORIES_CLASS ] )
            .join( "g" )
            .attr( "class", CATEGORIES_CLASS )
            .attr( "fill", this.props.categoryLabelColor.toString() );

        this.gLink = this.svgGroup
            .selectAll( `.${LINKS_CLASS}` )
            .data( [ LINKS_CLASS ] )
            .join( "g" )
            .attr( "class", LINKS_CLASS )
            .attr( "fill", "none" )
            .attr( "stroke", "#777" )
            .attr( "stroke-opacity", 0.4 )
            .attr( "stroke-width", 1.5 );

        this.gNode = this.svgGroup
            .selectAll( `.${NODES_CLASS}` )
            .data( [ NODES_CLASS ] )
            .join( "g" )
            .attr( "class", NODES_CLASS )
            .attr( "cursor", "pointer" )
            .attr( "pointer-events", "all" );

    }

    protected update( _info: UpdateInfo ): Promise<void>
    {
        if( !_info.reason.data && !_info.reason.properties && !_info.reason.size )
        {
            return;
        }

        const props = _info.props;
        this.locale = _info.locale;
        this._updateProps( props );

        // Specify the charts’ dimensions. The height is variable, depending on the layout.
        this.width = this._chartContainer.clientWidth;
        this.height = this._chartContainer.clientHeight;
        this.marginTop = 50;
        this.marginRight = 50;
        this.marginBottom = 50;
        this.marginLeft = 10;


        if ( !_info.data || !_info.data.rows.length )
        {
            this._clear();
            return;
        }

        if( _info.reason.properties || _info.reason.decorations )
        {
            this._clear();
            this._createDOM();
            this._center();
        }

        // Create or update the tree
        if( _info.reason.data )
        {
            const data = _info.data;
            this.categories = data.slotMap.get( "categories" );
            this.root = this.stratify( data );
            this._center();
            this._createDOM();
        }

        this.valueFormatter = ( _value: number, _type?: FormatType ): string => _info.data.cols[ VALUE_SLOT ].format( _value, _type );

        const animate = _info.reason.properties || _info.reason.decorations ? false : true;
        return this._update( animate );
    }

    private _update( animate: boolean ): Promise<any>
    {
        this.transitionManager.clear();
        const dx = this.props.barHeight;
        const visibleTreeDepth = getDepthRecursive( this.root );
        let dy = ( this.width - this.marginRight - this.marginLeft ) / ( 1 + visibleTreeDepth );

        const minimumSpace = this.props.barWidth + ( this.props.barWidth / 2 );
        if( dy < minimumSpace ) dy = minimumSpace;

        this.minimumNodeSpace = dy;
        this.treeFn = d3.tree<TreeNode>()
            .nodeSize( [ dx, this.minimumNodeSpace ] )
            .separation( () => this.props.siblingFactor );

        // Compute the new tree layout.
        this.treeFn( this.root );

        let leftNode = this.root;
        let rightNode = this.root;
        this.root.eachBefore( node =>
        {
            if ( node.x < leftNode.x ) leftNode = node;
            if ( node.x > rightNode.x ) rightNode = node;
        } );

        this._alignNodes( leftNode, this.root.descendants() );
        this._drawCategories();
        this._drawNodes( animate );
        this._drawPaths( animate );

        // Stash the old positions for transition.
        this.root.eachBefore( datum =>
        {
            datum.x0 = datum.x;
            datum.y0 = datum.y;
        } );

        return this.transitionManager.resolveAll();
    }

    private _drawCategories(): void
    {
        const nodes = this.root.descendants().reverse();
        const nodeDepthArray = [];
        const depthMap = nodes.reduce( ( map, node ) =>
        {
            map.set( node.depth, node.y );
            nodeDepthArray.push( { depth: node.depth, node: node } );
            return map;
        }, new Map() );

        const groupOnClickFn = ( _event: Event, index: number ): void =>
        {
            const parents = nodeDepthArray.filter( node => node.depth === index );
            const ids = parents.map( parent => parent.node.id );

            ids.forEach( id =>
            {
                this.root.descendants().reverse().forEach( node =>
                {
                    if( node.id === id ) node.children = null;
                } );
            } );

            this._update( true );
        };

        const visibleTreeDepth = getDepthRecursive( this.root );
        const segments = this.categories.segments.slice( 0, visibleTreeDepth );

        const getCrossPosition = ( _datum: HierarchyDatum, index: number, label: SVGElement ): string =>
        {
            const labelWidth = label ? label.getBoundingClientRect().width : 0;
            let labelOffset = labelWidth + X_OFFSET;
            if ( labelWidth < this.props.barWidth - X_OFFSET )
            {
                labelOffset = this.props.barWidth;
            }

            const x = depthMap.get( index + 1 ) + labelOffset;
            const y = Y_OFFSET;
            return`translate(${x},${y}) rotate(45)`;
        };

        const getSelectedNodeCaption = ( index: number ): string =>
        {
            const selectedNode = this.selectionState.get( index );
            return selectedNode ? selectedNode.data.caption : "";
        };

        const updateCategories = (): void =>
        {
            const text = this.gCategories.selectAll( "text" )
                .attr( "x", ( _datum: HierarchyDatum, index: number ) => depthMap.get( index + 1 ) )
                .attr( "y", Y_OFFSET );

            text.each( function( _datum: any, index: number )
            {
                d3.select( this ).selectAll( "tspan" )
                    .attr( "x", depthMap.get( index + 1 ) )
                    .attr( "y", Y_OFFSET );
            } );

            this.gCategories.selectAll( "tspan.selectedNodeCaption" )
                .text( ( _datum: HierarchyDatum, index: number ) => getSelectedNodeCaption( index + 1 ) );

            this.gCategories.selectAll( "path" )
                .attr( "transform", ( datum: HierarchyDatum, index: number ) => getCrossPosition( datum, index, this.gCategories.selectAll( "text" ).nodes()[ index ] ) );
        };

        this.gCategories.selectAll( "g" )
            .data( segments )
            .join(
                enter =>
                {
                    const group = enter.append( "g" )
                        .attr( "class", "categoryLabel" )
                        .attr( "data-index", ( _datum: HierarchyDatum, index: number ) => index );

                    const text = group.append( "text" )
                        .attr( "x", ( _datum: HierarchyDatum, index: number ) => depthMap.get( index + 1 ) )
                        .attr( "y", Y_OFFSET );

                    text.append( "tspan" )
                        .attr( "class", "categoryCaption" )
                        .text( datum => datum.caption )
                        .attr( "text-anchor", "start" )
                        .attr( "cursor", "pointer" )
                        .attr( "fill", this.props.categoryLabelColor.toString() )
                        .attr( "dominant-baseline", "middle" )
                        .style( "font", this.props.categoryLabelFont.toString() )
                        .attr( "x", ( _datum: HierarchyDatum, index: number ) => depthMap.get( index + 1 ) )
                        .attr( "dy", "0" );

                    text.append( "tspan" )
                        .attr( "class", "selectedNodeCaption" )
                        .text( ( _datum: HierarchyDatum, index: number ) => getSelectedNodeCaption( index + 1 ) )
                        .attr( "dy", `${Y_OFFSET}px` )
                        .attr( "text-anchor", "start" )
                        .attr( "cursor", "pointer" )
                        .attr( "fill", this.props.categorySubLabelColor.toString() )
                        .attr( "dominant-baseline", "middle" )
                        .style( "font", this.props.categorySubLabelFont.toString() )
                        .attr( "x", ( _datum: HierarchyDatum, index: number ) => depthMap.get( index + 1 ) )
                        .attr( "dy", "1.2em" );

                    group.each( function( _datum, index )
                    {
                        d3.select( this ).on( "click", ( event: Event ) => groupOnClickFn( event, index ) );
                    } );

                    const symbolGenerator = d3.symbol()
                        .type( d3.symbolCross )
                        .size( 65 );

                    group.append( "path" )
                        .attr( "d", symbolGenerator )
                        .attr( "fill", this.props.categoryLabelColor.toString() )
                        .attr( "cursor", "pointer" )
                        .attr( "transform", ( datum: HierarchyDatum, index: number ) => getCrossPosition( datum, index, group.select( "text" ).node() ) )
                        .attr( "stroke", "none" );

                    return group;
                },
                update =>
                {
                    updateCategories();
                    return update;
                },
                exit =>
                {
                    updateCategories();
                    return exit.remove();
                }
            );
    }

    private getCategoryNodeHeight(): number
    {
        return this.gCategories ? this.gCategories.node().getBBox().height : 0;
    }

    private applySelectionForParents( root: HierarchyDatum, selection: boolean ): void
    {
        root.selected = selection;
        this.selectionState.set( root.depth, root );
        const parent = root.parent;
        if( parent )
        {
            this.applySelectionForParents( parent, selection );
        }
    }
    private _alignNodes( leftNode, _nodes: HierarchyDatum[] ): void
    {
        const leftNodeX = leftNode.x;
        if ( this.props.nodesAlignment === NodesAlignment.CENTER )
        {
            _nodes.forEach( ( d ) =>
            {
                d.x += Math.abs( leftNodeX ) + Y_OFFSET;
            } );
            return;
        }

        _nodes.forEach( ( d ) =>
        {
            let currentLength = 1;
            d.downset = 0;
            if ( d.parent !== null )
            {
                currentLength = d.parent.children.length;
                for ( let i = 0; i < currentLength; i++ )
                {
                    if ( d.parent.children[ i ].id === d.id )
                    {
                        d.downset = i;
                    }
                }
                if ( this.props.nodesAlignment === NodesAlignment.AUTO )
                    d.downset += Math.max( 0, d.parent.downset - currentLength + 1 );
                else if ( this.props.nodesAlignment === NodesAlignment.CURRENT )
                    d.downset += d.parent.downset;
            }
            d.x = ( d.downset * 80 ) + 20;
            const treeHeight = ( 1 + this.root.height );
            const availableSpace = ( 1 + this.root.height ) * this.minimumNodeSpace;
            d.y = d.depth * availableSpace / treeHeight;
        } );

    }

    private _center(): void
    {
        if( this.svg && this.svgGroup )
        {
            const container = this.svg.node().getBoundingClientRect();
            const tree = this.svgGroup.node().getBoundingClientRect();
            const currentScale = this.zoomState ? this.zoomState.k : 1;
            const treeHeight = ( tree.height + X_OFFSET ) * currentScale;
            const treeWidth = ( tree.width + Y_OFFSET ) * currentScale;

            const isTreeBiggerThanContainer = container.height < treeHeight || container.width < treeWidth;
            const bestScaleFactor = Math.min( ...[ container.height / treeHeight, container.width / treeWidth ] );
            let scale = isTreeBiggerThanContainer ? bestScaleFactor : currentScale;
            scale = scale < MIN_ZOOM ? MIN_ZOOM : scale;
            const newZoomState = { x: 0, y: 0, k: scale };

            this.handleZoom( newZoomState as d3.ZoomTransform, true );
        }
    }

    private _drawNodes( animate: boolean ): void
    {
        const nodes = this.root.descendants().reverse();

        const transition = this._getTransition( animate );

        const nodeOnClickFn = async( _event: Event, datum: any ): Promise<void> =>
        {
            const treeRoot = getTreeRoot( datum );
            setSelection( treeRoot, false );
            closeOtherRoots( datum );

            datum.children = datum.children ? null : datum._children;
            datum.selected = !datum.selected;
            this.applySelectionForParents( datum, datum.selected );

            this.selectionState.forEach( ( _value: HierarchyDatum, key: number ) =>
            {
                if( key > datum.depth ) this.selectionState.set( key, null );
            } );
            await this._update( true );
            this._center();
        };

        this.gNode.selectAll( "g" )
            .data( nodes, ( datum: HierarchyDatum ) => datum.id )
            .attr( "dy", "3em" )
            .on( "click", ( event: Event, datum: HierarchyDatum ) => nodeOnClickFn( event, datum ) )
            .join(
                enter =>
                {
                    const group = enter.append( "g" )
                        .attr( "transform", ( datum: HierarchyDatum ) => `translate(${datum.y0},${datum.x0 + this.getCategoryNodeHeight()})` )
                        .attr( "fill-opacity", 0 )
                        .attr( "class", ( datum: HierarchyDatum ) => datum.data.isTreeRoot() ? "treeRootGroup" : "treeGroup" )
                        .attr( "stroke-opacity", 0 )
                        .on( "click", ( event: Event, datum: HierarchyDatum ) => nodeOnClickFn( event, datum ) );

                    group.append( "rect" )
                        .attr( "class", BAR_TARGET_CLASS );

                    group.select( `.${BAR_TARGET_CLASS}` )
                        .attr( "y", this.props.barHeight )
                        .attr( "rx", 0 )
                        .attr( "y", 0 )
                        .attr( "width", ( datum: HierarchyDatum ) =>
                        {
                            const columnMaximum = datum.data.isTreeRoot() ? datum.data.getValue() : datum.data.getColumnMaximum();
                            const x = d3.scaleLinear()
                                .domain( [ 0, columnMaximum ] )
                                .range( [ 0, this.props.barWidth ] );

                            return x( columnMaximum );
                        } )
                        .attr( "height", this.props.barHeight )
                        .attr( "fill", this.props.barTargetColor.toString() )
                        .style( "display", datum => datum.data.isTreeRoot() ? "none" : "" );

                    group
                        .append( "rect" )
                        .attr( "class", BAR_ACTUAL_CLASS );

                    group.select( `.${BAR_ACTUAL_CLASS}` )
                        .attr( "y", this.props.barHeight )
                        .attr( "rx", 0 )
                        .attr( "y", 0 )
                        .attr( "width", ( datum: HierarchyDatum ) =>
                        {
                            const dataValue = datum.data.getValue();
                            const columnMaximum = datum.data.isTreeRoot() ? dataValue : datum.data.getColumnMaximum();
                            const x = d3.scaleLinear()
                                .domain( [ 0, columnMaximum ] )
                                .range( [ 0, this.props.barWidth ] );

                            return x( dataValue );
                        } )
                        .attr( "height", this.props.barHeight )
                        .attr( "fill", this.props.barActualColor.toString() );

                    const text = group.append( "text" )
                        .attr( "y", this.props.barHeight )
                        .attr( "dy", "3em" );

                    text.append( "tspan" )
                        .attr( "class", ROOT_TITLE_CLASS )
                        .style( "font", this.props.labelFont.toString() )
                        .attr( "fill", this.props.labelColor.toString() )
                        .text( ( datum: HierarchyDatum ) =>
                        {
                            return `${datum.data.caption}`;
                        } )
                        .attr( "x", 0 )
                        .attr( "dy", "1.2em" );

                    text.append( "tspan" )
                        .attr( "class", ROOT_SUBTITLE_CLASS )
                        .attr( "fill", this.props.labelColor.toString() )
                        .text( ( datum: HierarchyDatum ) => this._valueLabelAccesor( datum ) )
                        .attr( "x", 0 )
                        .attr( "dy", "1.2em" )
                        .style( "font", this.props.valueLabelFont.toString() );

                    const nodeTransition = group.call( group => group.transition( transition )
                        .attr( "transform", ( datum: HierarchyDatum ) => `translate(${datum.y},${datum.x + this.getCategoryNodeHeight()})` )
                        .attr( "fill-opacity", 1 )
                        .attr( "stroke-opacity", 1 )
                    );

                    this.transitionManager.register( nodeTransition );
                    return nodeTransition;
                },
                update =>
                {
                    const nodeTransition = update.transition( transition )
                        .attr( "transform", ( datum: HierarchyDatum ) => `translate(${datum.y},${datum.x + this.getCategoryNodeHeight()})` )
                        .attr( "fill-opacity", 1 )
                        .attr( "stroke-opacity", 1 );

                    this.transitionManager.register( nodeTransition );
                    return nodeTransition;
                },
                exit =>
                {
                    const nodeTransition = exit.transition( transition ).remove()
                        .attr( "transform", ( datum: HierarchyDatum ) => `translate(${datum.y},${datum.x + this.getCategoryNodeHeight()})` )
                        .attr( "fill-opacity", 0 )
                        .attr( "stroke-opacity", 0 );

                    this.transitionManager.register( nodeTransition );
                    return nodeTransition;
                }
            );
    }

    private _valueLabelAccesor( datum: HierarchyDatum ): string
    {
        // Use localized number format
        const percentFormatter = new Intl.NumberFormat(
            this.locale,
            {
                style: "percent",
                minimumSignificantDigits: 2,
                maximumSignificantDigits: 3
            }
        );
        const value = datum.data.getValue();
        if( !datum.data.isRoot() ) return `${this.valueFormatter( value, FormatType.label )}`;
        const total = datum.data.getColumnTotal();
        const percentage = value / total;

        if( this.props.labelOption === "ValueAndPercentage" )
        {
            return `${this.valueFormatter( value, FormatType.label )} (${percentFormatter.format( percentage )})`;
        }

        if( this.props.labelOption === "Value" )
        {
            return this.valueFormatter( value, FormatType.label );
        }

        if( this.props.labelOption === "Percentage" )
        {
            return percentFormatter.format( percentage );
        }
    }

    private _drawPaths( animate: boolean ): void
    {
        const links = this.root.links();
        const transition = this._getTransition( animate );

        this.gLink.selectAll( "path" )
            .data( links, ( datum: d3.HierarchyLink<TreeNode> ) => datum )
            .join(
                enter =>
                {
                    const links = enter.append( "path" )
                        .attr( "d", datum =>
                        {
                            const source = { x: datum.source.x0 + this.getCategoryNodeHeight(), y: datum.target.y0 };
                            return this.diagonal( source, source, "right" );
                        } )
                        .attr( "stroke", datum => datum.target.selected ? this.props.selectedPathColor.toString() : this.props.pathColor.toString()  )
                        .attr( "stroke-width", datum => datum.target.selected ? "3px" : "1px" )
                        .attr( "stroke-opacity", datum => datum.target.selected ? 1 : 0.4 );

                    return links.attr( "d", ( datum: d3.HierarchyLink<TreeNode> ) => this.diagonal( datum.source, datum.target, "right" ) );
                },
                update =>
                {
                    const pathTransition = update.transition( transition )
                        .attr( "stroke", datum => datum.target.selected ? this.props.selectedPathColor.toString() : this.props.pathColor.toString()  )
                        .attr( "stroke-width", datum => datum.target.selected ? "3px" : "1px" )
                        .attr( "stroke-opacity", datum => datum.target.selected ? 1 : 0.4 )
                        .attr( "d", ( datum: d3.HierarchyLink<TreeNode> ) => this.diagonal( datum.source, datum.target, "right" ) );

                    this.transitionManager.register( pathTransition );
                    return pathTransition;
                },
                exit =>
                {
                    const pathTransition = exit.transition( transition ).remove()
                        .attr( "stroke-opacity", 0 );

                    this.transitionManager.register( pathTransition );
                    return pathTransition;
                }
            );
    }

    private _getTransition( animate: boolean ): any
    {
        return this.svgGroup.transition()
            .duration( animate ? this.props.transitionDuration : 0 )
            .attr( "height", this.height );
    }

    // Generate custom link connector line
    protected diagonal( _source: any, _target: any, _direction: string ): string
    {
        const width = _source.data && _source.data.width || 0;
        const height = _source.data && _source.data.height || 0;

        // Input values
        const horizontal: boolean = _direction === "left" || _direction === "right";

        const sourceCurveValue = this.props.pathCurve;
        const targetCurveValue = this.props.pathCurve;

        // Translated to ratios
        const sourceRatio1: number = Math.min( 1, sourceCurveValue / 50 );
        const sourceRatio2: number = Math.max( 0, ( sourceCurveValue - 50 ) / 50 );
        const targetRatio1: number = Math.min( 1, targetCurveValue / 50 );
        const targetRatio2: number = Math.max( 0, ( targetCurveValue - 50 ) / 50 );

        // Node point and offset
        const xOffset = this.props.barWidth;
        const yOffset = ( this.props.barHeight ) / 2;
        const sourcePoint: number[] = transposeCoordinates( [ _source.x + yOffset + this.getCategoryNodeHeight(), _source.y + xOffset ], _direction );
        const sourceSize: number[] = transposeCoordinates( [ width / 2, height / 2 ], _direction );
        const targetPoint: number[] = transposeCoordinates( [ _target.x + yOffset + this.getCategoryNodeHeight(), _target.y ], _direction );
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

    protected stratify( data: DataSet ): HierarchyDatum
    {
        const root: d3.HierarchyNode<TreeNode> = d3.hierarchy( buildTree( data ) );
        const visibleDepth = 1; //Number of visible categories on render

        root.sort( ( nodeA, nodeB ) =>
        {
            const aValue = nodeA.data.getValue();
            const bValue = nodeB.data.getValue();
            return nodeA.height - nodeB.height || bValue - aValue;
        } );

        root.descendants().forEach( ( datum: any ) =>
        {
            datum.id = datum.data.id;
            datum._children = datum.children;
            datum.selected = false;
        } );

        root.descendants().forEach( ( datum, index: number ) =>
        {
            if( datum.data.getDepth() >= visibleDepth )
            {
                if( index !== 0 ) datum.children = null;
            }
        } );

        return root as HierarchyDatum;
    }

    protected hitTest( _element: Element | null ): DataPoint | Segment | any
    {
        // Retrieve the d3 datum of the element that was hit.
        const data = [];
        const element = d3.select<Element, any>( _element );
        const node = element.empty() ? null : element.datum();

        function getChildren( element: d3.Selection<Element, any, null, undefined> ): TreeNode[] | null
        {
            const allChildren = [];
            const elementsChildren = [];
            const firstElement = element.data()[ 0 ];
            function collectChildren( element: TreeNode ): void
            {
                const childKey = "_children";
                if( element[ childKey ] )
                {
                    const children = element[ childKey ];
                    children.forEach( child =>
                    {
                        allChildren.push( child );
                        collectChildren( child );
                    } );
                }
            }

            if( firstElement && firstElement._children )
            {
                const children = firstElement._children;
                children.forEach( child =>
                {
                    elementsChildren.push( child );
                    allChildren.push( child );
                } );
            }
            elementsChildren.forEach( child => collectChildren( child ) );
            return allChildren;
        }

        function getData( node ): any
        {
        if ( node instanceof Object && "segment" in node ) return node.segment;

        if ( node instanceof Object && "data" in node )
            {
                if( node.data.dataPoint )
                {
                    return {
                        source: node.data.dataPoint,
                        key: node.key,
                        caption: node.caption
                    };
                }
                return null;
            }
        }

        if( !node.parent )
            return null;

        const children = getChildren( element );

        if( children.length )
        {
            children.forEach( child =>
            {
                const childData = getData( child );
                if( childData )
                    data.push( childData );
            } );
        }
        else
        {
            data.push( getData( node ) );
        }
        return data;
    }
}