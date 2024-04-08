/**
 * Licensed Materials - Property of IBM
 *
 * Copyright IBM Corp. 2019 All Rights Reserved.
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { Pt2d, Triangle, Rect2d } from "./Geometry";

// Class that holds all the information needed to render a ternary chart. Create an instance
// of this class by calling Ternary.createLayout().
export class TernaryLayout
{
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    public constructor(
        public readonly center: Pt2d,
        public readonly triangle: Triangle,
        public readonly circleXFn: ( _d: any ) => number, // circle x-position
        public readonly circleYFn: ( _d: any ) => number, // circle y-position
        public readonly circleRFn: ( _d: any ) => number, // circle radius
        public readonly labelXFn: ( _d: any ) => number, // label x-position
        public readonly labelYFn: ( _d: any ) => number // label y-position
    ) {}
}

// Calculate the size of the largest triangle that fits into the width / height.
function calcLimits( _width: number, _height: number, _margin: number ): Rect2d
{
    const width = _width - 2 * _margin; // apply margin to left and right
    const height = _height - 2 * _margin; // apply margin to top and bottom
    const calcH = width * Math.sqrt( 3 ) / 2;
    if ( calcH <= height ) // portrait orientation
        return new Rect2d( _margin, _margin + ( height - calcH ) / 2, width, calcH );
    const calcW = height * 2 / Math.sqrt( 3 ); // landscape orientation
    return new Rect2d( _margin + ( width - calcW ) / 2, _margin, calcW, height );
}

// Factory class for creating TernaryLayout instances.
export class Ternary
{
    public labelPlacement = "TopLeft"; // placement of a point label.
    public pointSize: ( ( _n: number ) => number ) | number = 10; // fixed or variable point size
    public width = 0; // width of the container
    public height = 0; // height of the container
    public titleMargin = 50; // number of pixels around the chart reserved for titles
    public topValue: ( _d: any ) => number = () => 0; // resolver for the top value
    public leftValue: ( _d: any ) => number = () => 0; // resolver for the left value
    public rightValue: ( _d: any ) => number = () => 0; // resolver for the right value
    public sizeValue: ( _d: any ) => number = () => 0; // resolver for the point size

    // Create a TernaryLayout instance that can be used for rendering the chart.
    public createLayout(): TernaryLayout
    {
        const rect = calcLimits( this.width, this.height, this.titleMargin );
        const centerX = rect.x + rect.w / 2;
        const centerY = rect.y + rect.h - ( rect.w / ( 2 * Math.sqrt( 3 ) ) );
        const radius = centerY - rect.y;
        const triangle = new Triangle( [ -90, 150, 30 ].map( _d => new Pt2d(
            Math.cos( _d * Math.PI / 180 ) * radius,
            Math.sin( _d * Math.PI / 180 ) * radius ) ) );

        // Create accessor function for calculating position and radius.
        const v = triangle.vertices;
        const circleXFn = ( _d: any ): number =>
        {
            const v0 = this.topValue( _d ), v1 = this.leftValue( _d ), v2 = this.rightValue( _d );
            return ( v[ 0 ].x * v0 + v[ 1 ].x * v1 + v[ 2 ].x * v2 ) / ( v0 + v1 + v2 );
        };
        const circleYFn = ( _d: any ): number =>
        {
            const v0 = this.topValue( _d ), v1 = this.leftValue( _d ), v2 = this.rightValue( _d );
            return ( v[ 0 ].y * v0 + v[ 1 ].y * v1 + v[ 2 ].y * v2 ) / ( v0 + v1 + v2 );
        };
        const circleRFn = ( _d: any ): number =>
        {
            if ( typeof this.pointSize === "function" )
                return this.pointSize( this.sizeValue( _d ) ) / 2;
            return this.pointSize as number / 2;
        };
        const dX = this.labelPlacement.indexOf( "Left" ) !== -1 ? 1 : -1;
        const dY = this.labelPlacement.indexOf( "Top" ) !== -1 ? -1 : 1;
        const labelXFn = ( _d ): number => circleXFn( _d ) + dX * circleRFn( _d ) * Math.SQRT2 / 4;
        const labelYFn = ( _d ): number => circleYFn( _d ) + dY * circleRFn( _d ) * Math.SQRT2 / 4;

        return new TernaryLayout( new Pt2d( centerX, centerY ), triangle, circleXFn, circleYFn, circleRFn, labelXFn, labelYFn );
    }
}
