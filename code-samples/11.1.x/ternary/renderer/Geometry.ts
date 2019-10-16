// Represents a 2d point.
/**
 * Licensed Materials - Property of IBM
 * 
 * Copyright IBM Corp. 2019 All Rights Reserved.
 * 
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

export class Pt2d
{
    constructor( public readonly x: number, public readonly y: number ) {}

    public toString(): string
    {
        return `${this.x},${this.y}`;
    }
}

// Represents a rectangle with an x, y, width and height.
export class Rect2d
{
    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly w: number,
        public readonly h: number ) {}
}

// Represents an edge with a start and end point.
export class Edge
{
    public readonly center: Pt2d;

    constructor( public readonly pt1: Pt2d, public readonly pt2: Pt2d )
    {
        this.center = new Pt2d( ( pt1.x +  pt2.x ) / 2, ( pt1.y + pt2.y ) / 2 );
    }

    // Evaluates a ratio from 0 - 1 and returns its position the edge.
    public eval( _t: number ): Pt2d
    {
        return new Pt2d(
            this.pt1.x + _t * ( this.pt2.x - this.pt1.x ),
            this.pt1.y + _t * ( this.pt2.y - this.pt1.y ) );
    }
}

// Represents a triangle consisting of three edges and three vertices.
export class Triangle
{
    public readonly edges: Edge[];

    constructor( public readonly vertices: Pt2d[] )
    {
        this.edges = [
            new Edge( vertices[ 1 ], vertices[ 2 ] ),
            new Edge( vertices[ 2 ], vertices[ 0 ] ),
            new Edge( vertices[ 0 ], vertices[ 1 ] ) ];
    }

    // Returns a path representation of the triangle.
    public toPath(): string
    {
        return `M${this.vertices[0]}L${this.vertices[1]}L${this.vertices[2]}Z`
    }
}
