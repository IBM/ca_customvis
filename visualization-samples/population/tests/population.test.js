// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2020
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

define( [
    "test/common/com/ibm/vida/vizbundles/testutils/TestContainer",
    "test/common/com/ibm/vida/vizbundles/testutils/TestBundleLoader",
    "test/common/com/ibm/vida/vizbundles/testutils/TestData",
    "colorAssert"
], function(
    TestContainer,
    TestBundleLoader,
    TestData,
    ColorAssert
)
{
"use strict";

const COLOR_PALETTE = "#6929c4;#1192e8";

function renderBundle( _bundle, _duration = 60 )
{
    return Promise.all( [ _bundle.vizService.render(), new Promise( resolve => setTimeout( resolve, _duration ) ) ] );
}

describe( "Population diagram renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;
    let svg;

    const data = TestData.fromCsv( [
        [ "split"    , "y"       , "value"  ],
        [ "M"        , "2010"    , 51       ],
        [ "F"        , "2010"    , 82       ],
        [ "M"        , "2011"    , 28       ],
        [ "F"        , "2011"    , 73       ],
        [ "M"        , "2012"    , 100      ],
        [ "F"        , "2012"    , 75       ],
        [ "M"        , "2013"    , 120      ],
        [ "F"        , "2013"    , 150      ]
    ] );
    data.addMapping( "split", 0 )
        .addMapping( "categories", 1 )
        .addMapping( "values", 2 );

    before( function()
    {
        return loader.load( "population", "vis/customvis/population" ).then( function( _bundle )
        {
            bundle = _bundle;
        } );
    } );

    after( function()
    {
        bundle = null;
        loader.destroy();
    } );

    beforeEach( function()
    {
        return bundle.newViz( TestContainer.create() ).then( function()
        {
            svg = document.querySelector( "svg" );
        } );
    } );

    afterEach( function()
    {
        bundle.reset();
        data.clearDecorations();
        TestContainer.destroy();
    } );

    it( "renders empty chart with no data", function()
    {
        return renderBundle( bundle ).then( function()
        {
            expect( svg.querySelector( ".chartContent" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "renders population chart when data is present", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelectorAll( ".axis" ) ) ).to.have.lengthOf( 3 ); // 1 y and 2 x-axis

            const yCategoryLabels = Array.from( svg.querySelector( ".axisVertical" ).querySelectorAll( "text" ) ).map( e => e.innerHTML );
            expect( yCategoryLabels ).to.have.lengthOf( 5 );
            expect( yCategoryLabels ).to.include( "2010" );
            expect( yCategoryLabels ).to.include( "2011" );
            expect( yCategoryLabels ).to.include( "2012" );
            expect( yCategoryLabels ).to.include( "2013" );
            expect( yCategoryLabels ).to.include( "y" ); // Chart title

            expect( Array.from( svg.querySelectorAll( ".bar" ) ) ).to.have.lengthOf( 8 ); // 8 data points

            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( Number( leftRects[ 0 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( leftRects[ 1 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( leftRects[ 2 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( leftRects[ 3 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );

            const rightRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( Number( rightRects[ 0 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 1 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 2 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 3 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
        } );
    } );

    it( "updates the color based on property", function()
    {
        var palette = bundle.vizService.properties.getPalette( "color" );
        bundle.setPalette( palette, COLOR_PALETTE );
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( leftRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( rightRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
        } );
    } );

    it( "shows highlighted bar", function()
    {
        var palette = bundle.vizService.properties.getPalette( "color" );
        bundle.setPalette( palette, COLOR_PALETTE );
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( leftRects[ 0 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            expect( leftRects[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 2 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( leftRects[ 3 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( rightRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 1 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( rightRects[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            data.decorateDataPoint( 0, { "highlighted": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            // Highlighted bar has new border
            expect( leftRects[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgba(74,29,137)" );
            expect( leftRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "2" );

            // Other bars remain the same
            expect( leftRects[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 2 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( leftRects[ 3 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( rightRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 1 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( rightRects[ 3 ].getAttribute( "stroke" ) ).to.be.null;
        } );
    } );

    it( "shows selected bar", function()
    {
        var palette = bundle.vizService.properties.getPalette( "color" );
        bundle.setPalette( palette, COLOR_PALETTE );
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( leftRects[ 0 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            expect( leftRects[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 2 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( leftRects[ 3 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            expect( leftRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );
            expect( leftRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( rightRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 1 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( rightRects[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            expect( rightRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );
            expect( rightRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "#1192e8" );

            data.decorateDataPoint( 0, { "selected": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            // Selected bar has new border, remains its color
            expect( leftRects[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgba(74,29,137,1)" );
            expect( leftRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "2" );
            expect( leftRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "#6929c4" );

            // Other bars has no border and get a lighter color fill
            expect( leftRects[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( leftRects[ 2 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( leftRects[ 3 ].getAttribute( "stroke-width" ) ).to.equal( "0" );

            expect( leftRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgba(105,41,196,0.4)" );
            expect( leftRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "rgba(105,41,196,0.4)" );
            expect( leftRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgba(105,41,196,0.4)" );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( rightRects[ 0 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 1 ].getAttribute( "stroke-width" ) ).to.equal( "0" );
            expect( rightRects[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( rightRects[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            expect( rightRects[ 0 ].getAttribute( "fill" ) ).to.matchColor( "rgba(17,146,232,0.4)" );
            expect( rightRects[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgba(17,146,232,0.4)" );
            expect( rightRects[ 2 ].getAttribute( "fill" ) ).to.matchColor( "rgba(17,146,232,0.4)" );
            expect( rightRects[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgba(17,146,232,0.4)" );
        } );
    } );


    it( "centers vertical axis based on property", function()
    {
        function getXTransform( _elem )
        {
            let transform = _elem.getAttribute( "transform" );
            return Number( transform.substring( transform.indexOf( "(" ) + 1, transform.indexOf( "," ) ) );
        }
        let svgWidth;
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            svgWidth = svg.clientWidth;
            const verticalAxis = svg.querySelector( ".axisVertical" );
            const verticalAxisXTransform = getXTransform( verticalAxis );

            // Expect y axis to be close to the left of svg (10% of width)
            expect( parseFloat( verticalAxisXTransform / svgWidth ) ).to.be.lessThan( 0.1 );
            // Path (axis line) visible
            expect( verticalAxis.querySelector( "path" ) ).to.not.be.null;

            bundle.setProperties(
                {
                    "axis.center" : "true"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const verticalAxis = svg.querySelector( ".axisVertical" );
            const verticalXAxisTransform = getXTransform( verticalAxis );

            // Expect y axis to be close to the center of svg (between 40% and 60% of svg width)
            expect( parseFloat( verticalXAxisTransform / svgWidth ) ).to.be.greaterThan( 0.4 );
            expect( parseFloat( verticalXAxisTransform / svgWidth ) ).to.be.lessThan( 0.6 );
            // Path removed
            expect( verticalAxis.querySelector( "path" ) ).to.be.null;
        } );
    } );

    it( "updates axis color based on property", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            // Default: axis line color: black, axis label color: black
            const verticalAxis = svg.querySelector( ".axisVertical" );

            const verticalAxisTicks = Array.from( verticalAxis.querySelectorAll( "line" ) );
            expect( verticalAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( verticalAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( verticalAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.be.equal( "rgb(0,0,0)" );
            const verticalAxisLabels = Array.from( verticalAxis.querySelectorAll( "text" ) );
            expect( verticalAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( verticalAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );

            const leftXAxis = svg.querySelector( ".axisBottomLeft" );

            const leftXAxisTicks = Array.from( leftXAxis.querySelectorAll( "line" ) );
            expect( leftXAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( leftXAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( leftXAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            const leftXAxisLabels = Array.from( leftXAxis.querySelectorAll( "text" ) );
            expect( leftXAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( leftXAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );

            const rightXAxis = svg.querySelector( ".axisBottomLeft" );

            const rightXAxisTicks = Array.from( rightXAxis.querySelectorAll( "line" ) );
            expect( rightXAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( rightXAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( rightXAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.matchColor( "rgb(0,0,0)" );
            const rightXAxisLabels = Array.from( rightXAxis.querySelectorAll( "text" ) );
            expect( rightXAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );
            expect( rightXAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,0)" );

            bundle.setProperties(
                {
                    "axis.line.color" : "rgb(255,0,0)",
                    "axis.label.color": "rgb(0,0,255)"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const verticalAxis = svg.querySelector( ".axisVertical" );

            const verticalAxisTicks = Array.from( verticalAxis.querySelectorAll( "line" ) );
            expect( verticalAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( verticalAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( verticalAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            const verticalAxisLabels = Array.from( verticalAxis.querySelectorAll( "text" ) );
            expect( verticalAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );
            expect( verticalAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );

            const leftXAxis = svg.querySelector( ".axisBottomLeft" );

            const leftXAxisTicks = Array.from( leftXAxis.querySelectorAll( "line" ) );
            expect( leftXAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( leftXAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( leftXAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            const leftXAxisLabels = Array.from( leftXAxis.querySelectorAll( "text" ) );
            expect( leftXAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );
            expect( leftXAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );

            const rightXAxis = svg.querySelector( ".axisBottomLeft" );

            const rightXAxisTicks = Array.from( rightXAxis.querySelectorAll( "line" ) );
            expect( rightXAxisTicks[ 0 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( rightXAxisTicks[ 2 ].getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            expect( rightXAxis.querySelector( "path" ).getAttribute( "stroke" ) ).to.matchColor( "rgb(255,0,0)" );
            const rightXAxisLabels = Array.from( rightXAxis.querySelectorAll( "text" ) );
            expect( rightXAxisLabels[ 1 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );
            expect( rightXAxisLabels[ 3 ].getAttribute( "fill" ) ).to.matchColor( "rgb(0,0,255)" );
        } );
    } );

    it( "updates axis label font via property", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const verticalAxis = svg.querySelector( ".axisVertical" );
            expect( verticalAxis.style[ "font-size" ] ).to.equal( "0.75em" );
            expect( verticalAxis.style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" );
            const leftXAxis = svg.querySelector( ".axisVertical" );
            expect( leftXAxis.style[ "font-size" ] ).to.equal( "0.75em" );
            expect( leftXAxis.style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" );
            const rightXAxis = svg.querySelector( ".axisVertical" );
            expect( rightXAxis.style[ "font-size" ] ).to.equal( "0.75em" );
            expect( rightXAxis.style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" );

            bundle.setProperties(
                {
                    "axis.label.font": "10px Arial"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const verticalAxis = svg.querySelector( ".axisVertical" );
            expect( verticalAxis.style[ "font-size" ] ).to.equal( "10px" );
            expect( verticalAxis.style[ "font-family" ] ).to.equal( "Arial" );
            const leftXAxis = svg.querySelector( ".axisVertical" );
            expect( leftXAxis.style[ "font-size" ] ).to.equal( "10px" );
            expect( leftXAxis.style[ "font-family" ] ).to.equal( "Arial" );
            const rightXAxis = svg.querySelector( ".axisVertical" );
            expect( rightXAxis.style[ "font-size" ] ).to.equal( "10px" );
            expect( rightXAxis.style[ "font-family" ] ).to.equal( "Arial" );
        } );
    } );

    it( "doesn't render bars with negative values", function()
    {
        const negData = TestData.fromCsv( [
            [ "split"    , "y"       , "value"  ],
            [ "M"        , "2010"    , -5       ],
            [ "F"        , "2010"    , 82       ],
            [ "M"        , "2011"    , 28       ],
            [ "F"        , "2011"    , 73       ],
            [ "M"        , "2012"    , 20       ],
            [ "F"        , "2012"    , 75       ],
            [ "M"        , "2013"    , 120      ],
            [ "F"        , "2013"    , -150      ]
        ] );
        negData.addMapping( "split", 0 )
            .addMapping( "categories", 1 )
            .addMapping( "values", 2 );
        bundle.setData( negData );
        return renderBundle( bundle ).then( function()
        {
            const leftRects = Array.from( svg.querySelector( ".left" ).querySelectorAll( "rect" ) );
            expect( Number( leftRects[ 0 ].getAttribute( "width" ) ) ).to.be.equal( 0 );
            expect( Number( leftRects[ 1 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( leftRects[ 2 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( leftRects[ 3 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );

            const rightRects = Array.from( svg.querySelector( ".right" ).querySelectorAll( "rect" ) );
            expect( Number( rightRects[ 0 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 1 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 2 ].getAttribute( "width" ) ) ).to.be.greaterThan( 0 );
            expect( Number( rightRects[ 3 ].getAttribute( "width" ) ) ).to.be.equal( 0 );
        } );
    } );
} );

} );
