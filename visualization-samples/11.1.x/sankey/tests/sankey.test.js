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
    "test/common/com/ibm/vida/vizbundles/testutils/TestData"
], function(
    TestContainer,
    TestBundleLoader,
    TestData
)
{
"use strict";

function renderBundle( _bundle, _duration = 60 )
{
    return Promise.all( [ _bundle.vizService.render(), new Promise( resolve => setTimeout( resolve, _duration ) ) ] );
}

describe( "Sankey chart renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;
    let svg;

    const data = TestData.fromCsv( [
        [ "from" , "to" , "weight" ],
        [ "A1"   , "B1" , 400      ],
        [ "A2"   , "B1" , 500      ],
        [ "A1"   , "B2" , 200      ],
        [ "A3"   , "B2" , 400      ],
        [ "A3"   , "B3" , 100      ],
        [ "B1"   , "C1" , 200      ],
        [ "B1"   , "C2" , 700      ],
        [ "B2"   , "C1" , 300      ],
        [ "B2"   , "C3" , 300      ]
    ] );
    data.addMapping( "from", 0 )
        .addMapping( "to", 1 )
        .addMapping( "weight", 2 );

    before( function()
    {
        return loader.load( "sankey", "vis/customvis/sankey" ).then( function( _bundle )
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
            expect( svg.querySelector( ".links" ).innerHTML ).to.be.empty;
            expect( svg.querySelector( ".nodes" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "renders population chart when data is present", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const nodeLabels = Array.from( svg.querySelector( ".labels" ).querySelectorAll( "text" ) ).map( e => e.innerHTML );
            expect( nodeLabels ).to.have.lengthOf( 9 );
            expect( nodeLabels ).to.include( "A1" );
            expect( nodeLabels ).to.include( "A2" );
            expect( nodeLabels ).to.include( "B1" );
            expect( nodeLabels ).to.include( "C1" );

            expect( Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) ) ).to.have.lengthOf( 9 ); // 9 nodes
            expect( Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) ) ).to.have.lengthOf( 9 ); // 9 links
        } );
    } );

    it( "shows highlighted link", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const links = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) );
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            expect( Number( links[ 8 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 0 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 2 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 4 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );

            expect( Number( nodes[ 4 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 8 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 0 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 2 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );

            // Highlight link 8, connect node 4 and 8
            data.decorateDataPoint( 8, { "highlighted": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const links = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) );
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            // Highlighted link increases opacity
            expect( Number( links[ 8 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.9 );
            // Other links remained the same
            expect( Number( links[ 0 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 2 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 4 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );

            // Nodes connecting the highlighted links are also highlighted
            expect( Number( nodes[ 4 ].getAttribute( "fill-opacity" ) ) ).to.equal( 1 );
            expect( Number( nodes[ 8 ].getAttribute( "fill-opacity" ) ) ).to.equal( 1 );

            expect( Number( nodes[ 0 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 2 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
        } );
    } );

    it( "shows selected bar", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const links = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) );
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            expect( Number( links[ 8 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 0 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 2 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );
            expect( Number( links[ 4 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.5 );

            expect( Number( nodes[ 4 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 8 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 0 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );
            expect( Number( nodes[ 2 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.8 );

            // Select link 8, connect node 4 and 8
            data.decorateDataPoint( 8, { "selected": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const links = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) );
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            // Selected link increases opacity
            expect( Number( links[ 8 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.9 );
            // Other links reduce opacity
            expect( Number( links[ 0 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.3 );
            expect( Number( links[ 2 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.3 );
            expect( Number( links[ 4 ].getAttribute( "stroke-opacity" ) ) ).to.equal( 0.3 );

            // Nodes connecting the selected links are also selected
            expect( Number( nodes[ 4 ].getAttribute( "fill-opacity" ) ) ).to.equal( 1 );
            expect( Number( nodes[ 8 ].getAttribute( "fill-opacity" ) ) ).to.equal( 1 );
            // Other nodes reduce opacity
            expect( Number( nodes[ 0 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.4 );
            expect( Number( nodes[ 2 ].getAttribute( "fill-opacity" ) ) ).to.equal( 0.4 );
        } );
    } );

    it( "adjusts nodes appearance based on properties", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            // Default node width: 15px
            expect( Number( nodes[ 0 ].getAttribute( "width" ) ) ).to.equal( 15 );
            expect( Number( nodes[ 1 ].getAttribute( "width" ) ) ).to.equal( 15 );
            // Default stroke width: 1px
            expect( Number( nodes[ 2 ].style[ "stroke-width" ] ) ).to.equal( 0 );
            expect( Number( nodes[ 3 ].style[ "stroke-width" ] ) ).to.equal( 0 );
            // Default stroke color: black
            expect( nodes[ 4 ].style[ "stroke" ] ).to.equal( "rgb(0, 0, 0)" );
            expect( nodes[ 5 ].style[ "stroke" ] ).to.equal( "rgb(0, 0, 0)" );

            const node0EndY = Number( nodes[ 0 ].getAttribute( "y" ) ) + Number( nodes[ 0 ].getAttribute( "height" ) );
            const node1StartY = Number( nodes[ 1 ].getAttribute( "y" ) );
            const padding = node1StartY - node0EndY;
            // Default node padding: 8
            expect( padding ).to.be.closeTo( 8, 0.01 );

            bundle.setProperties(
                {
                    "node.width" : 20,
                    "node.border.width": 3,
                    "node.border.color": "rgb(255, 0, 0)",
                    "node.padding": 10
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );

            // Updated node width: 20px
            expect( Number( nodes[ 0 ].getAttribute( "width" ) ) ).to.equal( 20 );
            expect( Number( nodes[ 1 ].getAttribute( "width" ) ) ).to.equal( 20 );
            // Updated stroke width: 3px
            expect( Number( nodes[ 2 ].style[ "stroke-width" ] ) ).to.equal( 3 );
            expect( Number( nodes[ 3 ].style[ "stroke-width" ] ) ).to.equal( 3 );
            // Updated stroke color: red
            expect( nodes[ 4 ].style[ "stroke" ] ).to.equal( "rgb(255, 0, 0)" );
            expect( nodes[ 5 ].style[ "stroke" ] ).to.equal( "rgb(255, 0, 0)" );

            const node0EndY = Number( nodes[ 0 ].getAttribute( "y" ) ) + Number( nodes[ 0 ].getAttribute( "height" ) );
            const node1StartY = Number( nodes[ 1 ].getAttribute( "y" ) );
            const padding = node1StartY - node0EndY;
            // Updated node padding: 10
            expect( padding ).to.be.closeTo( 10, 0.01 );

        } );
    } );

    it( "adjusts label appearance based on properties", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            // Default font: 0.8em "IBM Plex Sans"
            const labelContainer = svg.querySelector( ".labels" );
            expect( labelContainer.style[ "font-size" ] ).to.equal( "0.8em" );
            expect( labelContainer.style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" );
            // Default color: rgb(38, 38, 38)
            const nodeLabels = Array.from( labelContainer.querySelectorAll( "text" ) );
            expect( nodeLabels[ 0 ].style.fill ).to.equal( "rgb(38, 38, 38)" );
            expect( nodeLabels[ 4 ].style.fill ).to.equal( "rgb(38, 38, 38)" );
            // Default vertical alignment: center
            const node0 = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) )[ 0 ];
            const node0Height = Number( node0.getAttribute( "height" ) );
            const node0LabelY = Number( nodeLabels[ 0 ].getAttribute( "y" ) );
            expect( parseFloat( node0LabelY / node0Height ) ).to.be.closeTo( 0.5, 0.05 );

            bundle.setProperties(
                {
                    "label.font" : "12px Arial",
                    "label.color": "rgb(255, 0, 0)",
                    "label.yAlign": "top"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            // Updated font: 12px Arial
            const labelContainer = svg.querySelector( ".labels" );
            expect( labelContainer.style[ "font-size" ] ).to.equal( "12px" );
            expect( labelContainer.style[ "font-family" ] ).to.equal( "Arial" );
            // Updated color: rgb(255, 0, 0)
            const nodeLabels = Array.from( labelContainer.querySelectorAll( "text" ) );
            expect( nodeLabels[ 0 ].style.fill ).to.equal( "rgb(255, 0, 0)" );
            expect( nodeLabels[ 4 ].style.fill ).to.equal( "rgb(255, 0, 0)" );
            // Updated vertical alignment: top
            const node0 = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) )[ 0 ];
            const node0Height = Number( node0.getAttribute( "height" ) );
            const node0LabelY = Number( nodeLabels[ 0 ].getAttribute( "y" ) );
            expect( parseFloat( node0LabelY / node0Height ) ).to.be.lessThan( 0.1 );

            // Default: show label
            expect( nodeLabels[ 0 ].getAttribute( "visibility" ) ).to.equal( "visible" );
            expect( nodeLabels[ 2 ].getAttribute( "visibility" ) ).to.equal( "visible" );
            expect( nodeLabels[ 4 ].getAttribute( "visibility" ) ).to.equal( "visible" );

            bundle.setProperties(
                {
                    "label.show" : false
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            // Default: hide label
            const nodeLabels = Array.from( svg.querySelector( ".labels" ).querySelectorAll( "text" ) );
            expect( nodeLabels[ 0 ].getAttribute( "visibility" ) ).to.equal( "hidden" );
            expect( nodeLabels[ 2 ].getAttribute( "visibility" ) ).to.equal( "hidden" );
            expect( nodeLabels[ 4 ].getAttribute( "visibility" ) ).to.equal( "hidden" );
        } );
    } );

    it( "adjust link appearance based on properties", function()
    {
        let fromNodeColor, toNodeColor;
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const link = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) )[ 0 ];
            const nodes = Array.from( svg.querySelector( ".nodes" ).querySelectorAll( "rect" ) );
            fromNodeColor = nodes[ 0 ].getAttribute( "fill" );
            toNodeColor = nodes[ 3 ].getAttribute( "fill" );

            // Default: gradient from source node to destination node color
            const gradient = link.querySelector( "linearGradient" );
            const gradientId = gradient.getAttribute( "id" );
            const path = link.querySelector( "path" );
            expect( path.getAttribute( "stroke" ) ).to.equal( `url(#${gradientId})` );
            const colorStops = gradient.querySelectorAll( "stop" );
            expect( colorStops[ 0 ].getAttribute( "stop-color" ) ).to.equal( fromNodeColor );
            expect( colorStops[ 1 ].getAttribute( "stop-color" ) ).to.equal( toNodeColor );

            bundle.setProperties(
                {
                    "linkFillType" : "from"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const link = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) )[ 0 ];
            const path = link.querySelector( "path" );
            expect( path.getAttribute( "stroke" ) ).to.equal( fromNodeColor );
            bundle.setProperties(
                {
                    "linkFillType" : "to"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const link = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) )[ 0 ];
            const path = link.querySelector( "path" );
            expect( path.getAttribute( "stroke" ) ).to.equal( toNodeColor );
            bundle.setProperties(
                {
                    "linkFillType" : "solid",
                    "linkFillSolidColor": "rgb(255,0,0)"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const link = Array.from( svg.querySelector( ".links" ).querySelectorAll( "g" ) )[ 0 ];
            const path = link.querySelector( "path" );
            expect( path.getAttribute( "stroke" ) ).to.equal( "rgb(255,0,0)" );
        } );
    } );
} );

} );
