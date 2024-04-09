// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { DataSet } from "@businessanalytics/customvis-lib";
import { IRSDataPoint, IRSTuple } from "@waca/vipr-rs-v1/com/ibm/vipr/rs/v1/data/IRSDataPoint";

const LABEL_FORMAT_KIND = "label";

const CATEGORIES_SLOT = "categories";
const VALUE_SLOT = "value";

export class TreeDatum
{
    public id: string;
    public _children: TreeNode;
    public selected: boolean;
    public x0: number;
    public y0: number;
    public x: number;
    public y: number;
    public downset?: number | null;
}

export type HierarchyDatum = d3.HierarchyNode<TreeNode> & TreeDatum;


export class TreeNode
{
    public readonly id: string;
    public readonly children?: TreeNode[];
    public readonly caption?: string | null;
    public readonly dataPoint?: IRSDataPoint;
    public tuple?: IRSTuple;
    public parent: TreeNode;
    public depth = 0;
    protected value?: number;
    protected treeRoot = false; //main root of tree

    constructor( _id: string, _children = [], _value: number | undefined = undefined, _caption: string | null | undefined = undefined )
    {
        this.id = _id;
        this.children = _children;
        this.value = _value;
        this.caption = _caption;
    }

    public isRoot(): boolean
    {
        return !!this.parent;
    }

    public isTreeRoot(): boolean
    {
        return this.treeRoot;
    }

    public isLeaf(): boolean
    {
        return this.children.length === 0;
    }

    public setParent( _parent: TreeNode ): void
    {
        if ( !this.parent )
        {
            this.depth = _parent.getDepth() + 1;
            this.parent = _parent;
        }
    }

    public getDepth(): number
    {
        return this.depth;
    }

    /**
     * Add a node to children list
     * @param _children
     */
    public addChild( _children: TreeNode ): void
    {
        this.children?.push( _children );
    }

    public getValue(): number
    {
        if( !this.value )
        {
            const childrenValues = this.children.map( treeNode => treeNode.getValue() );
            this.value = childrenValues.length > 0 ? childrenValues.reduce( ( a,b ) => a + b ) : null;
        }

        return this.value;
    }

    public getColumnTotal(): number
    {
        return this.parent ? this.parent.getValue() : -1;
    }

    public getColumnMaximum(): number
    {
        if( !this.isTreeRoot() )
        {
            const childrenValues = this.parent.children.map( treeNode => treeNode.getValue() );
            return childrenValues.length > 0 ? Math.max( ...childrenValues ) : null;
        }
        else return null;
    }

    /**
     * Find a node in children list by its name
     * @param name Name to find the children node
     * @returns The children node with matching name, undefined if not found
     */
    public findChild( _name: string ): TreeNode | undefined
    {
        return this.children?.find( _child => _child.id === _name );
    }
}

export class TreeNodeRoot extends TreeNode
{
    constructor( _id: string, _children = [], _value: number | undefined = undefined, _caption: string | null | undefined = undefined )
    {
        super( _id, _children, _value, _id );
        this.treeRoot = true;
    }
}

export class LeafNode extends TreeNode
{
    public readonly dataPoint: IRSDataPoint;
    private _leafIndex: number;

    public set leafIndex( _index: number )
    {
        this._leafIndex = _index;
    }

    public get leafIndex(): number
    {
        return this._leafIndex;
    }

    constructor( _id: string, _dataPoint: IRSDataPoint, _caption?: string )
    {
        const value = TreeMapData.getSize( _dataPoint );
        const caption = _caption || TreeMapData.getSizeCaption( _dataPoint );
        super( _id, undefined, value, caption );
        this.dataPoint = _dataPoint;
        this._leafIndex = 0;
    }

    public getValue(): number
    {
        return this.value;
    }
}

export class TreeMapData
{
    public static getSize( _dataPoint: IRSDataPoint ): number
    {
        const datum = _dataPoint.get( VALUE_SLOT )?.asCont();
        return datum ? Number( datum.getValue() ) : 0;
    }

    public static getCategory( _dataPoint: IRSDataPoint ): IRSTuple | null
    {
        const dataItem = _dataPoint.get( CATEGORIES_SLOT );
        return ( dataItem && dataItem.asCat() );
    }

    public static getSizeCaption( _dataPoint: IRSDataPoint ): string | null
    {
        const datum = _dataPoint.get( VALUE_SLOT )?.asCont();
        const caption = datum ? datum.getCaption( LABEL_FORMAT_KIND ) : "";
        return caption.length ? caption : null;
    }
}


/**
 * Form a hierarchy tree
 * @param _dataPoints List of input data points
 * @returns Root node
 */
export function buildTree( data: DataSet ): TreeNode | null
{
    const rows = data.rows;
    const dataPoints = rows.map( row => row.source );

    if ( dataPoints.length === 0 ) return null;

    const rootNodeName = data.slotMap.get( VALUE_SLOT ).caption;
    const root = new TreeNodeRoot( rootNodeName );

    for ( const dataPoint of dataPoints )
    {
        let parent = root;
        const hierarchy = TreeMapData.getCategory( dataPoint )!.getItems().slice();

        // Remove the latest tuple item, as leaf node should be data point
        const item = hierarchy.pop();
        if ( !item ) continue;

        // Iterate treeLevel as pointer through each level of hierarchy
        hierarchy.forEach( _tupleItem =>
        {
            const caption = _tupleItem.source.getCaption( LABEL_FORMAT_KIND );
            const key = parent.id + _tupleItem.uniqueName;
            let child = parent.findChild( key );
            if ( !child )
            {
                child = new TreeNode( key, [], null, caption );
                child.setParent( parent );
                child.tuple = _tupleItem;
                parent.addChild( child );
            }
            parent = child;
        } );

        const itemCaption = item.getCaption( LABEL_FORMAT_KIND );
        const itemName = parent.id + item.uniqueName;
        const treeMapLeaf = new LeafNode( itemName, dataPoint, itemCaption );
        treeMapLeaf.setParent( parent );
        parent.addChild( treeMapLeaf );
    }

    return root;
}

export function getDepthRecursive( tree: d3.HierarchyNode<TreeNode> ): number
{
    if ( !tree.children ) return tree.depth;
    if ( tree.children.length === 0 ) return tree.depth;

    const childDepths = tree.children.map( children => getDepthRecursive( children ) );
    return Math.max( ...childDepths );
}

export function getTreeRoot( tree: HierarchyDatum ): HierarchyDatum
{
    if ( tree.parent )
    {
        return getTreeRoot( tree.parent );
    }
    else return tree;
}

export function setSelection( root: HierarchyDatum, selection: boolean ): void
{
    root.selected = selection;
    if( root.children )
    {
        root.children.forEach( children =>
        {
            setSelection( children, selection );
        } );
    }
}

export function closeOtherRoots( root: HierarchyDatum ): void
{
    const parent = root.parent;
    if ( parent )
    {
        parent.children.forEach( children =>
        {
            if ( children.id !== root.id )
            {
                children.children = null;
            }
        } );
    }
}