import { DataPoint } from "@businessanalytics/customvis-lib";

const SIZE = 1, HEAT = 2;

/**
 * Used for hierarchical structures
 * A node contains either an array of nodes as children
 * or a DataPoint instance (leaf node)
 */
export class TreeNode
{
    public name: string;
    public heat: number;
    public size: number;
    public children: TreeNode[] | null;
    public dataPoint: DataPoint | null;

    constructor( name: string )
    {
        this.name = name;
    }

    /**
     * Add a node to children array and return its index
     * @param child
     */
    public addChild( child: TreeNode ): number
    {
        if ( !this.children )
            this.children = new Array<TreeNode>();
        this.children.push( child );
        return this.children.length - 1;
    }

    /**
     * Find a child node in the children array and return its index
     * @param childName Name of the child node
     */
    public findChild( childName: string ): number
    {
        if ( !this.children )
            return -1; // No children
        for ( let i = 0, len = this.children.length; i < len; ++i )
            if ( this.children[ i ].name === childName )
                return i;
        return -1; // Child not found
    }

    /**
     * Set data point and assign heat and size, only for leave node
     * @param row DataPoint
     */
    public setData( row: DataPoint ): void
    {
        this.dataPoint = row;
        this.heat = row.value( HEAT );
        this.size = row.value( SIZE );
    }

    /**
     * Calculate and return size (sum of children' size) of a node recursively
     */
    private _getSize(): number
    {
        if ( this.size !== undefined )
            return this.size;
        this.size = this.children.map( e => e._getSize() ).reduce( ( a, b ) => a + b, 0 );
        return this.size;
    }

    /**
     * Calculate and return heat (weighted average of children' size and heat) of a node recursively
     */
    private _getHeat(): number
    {
        if ( this.heat !== undefined )
            return this.heat;
        this.heat = this.children.map( e => e._getSize() * e._getHeat() ).reduce( ( a, b ) => a + b, 0 ) / this._getSize();
        return this.heat;
    }

    /**
     * Calculate heat and size of a node and its descandants
     * Call this function after creating the tree and before processing it further (using heat and size)
     */
    public calculateHeatAndSize(): void
    {
        this._getHeat();
    }

    /**
     * Determine if a node is highlighted (if one of its children is highlighted)
     */
    public isHighlighted(): boolean
    {
        if ( this.dataPoint )
            return this.dataPoint.highlighted;
        return this.children.some( child => child.isHighlighted() );
    }

    /**
     * Determine if a node is selected (if one of its children is selected)
     */
    public isSelected(): boolean
    {
        if ( this.dataPoint )
            return this.dataPoint.selected;
        return this.children.some( child => child.isSelected() );
    }
}