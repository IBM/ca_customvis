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
    "text!./state.json",
    "text!./state_small_data.json"
], function(
    TestContainer,
    TestBundleLoader,
    TestData,
    stateData,
    stateSmallData
)
{
"use strict";

var data = TestData.fromStateJson( stateData );

const COLOR_PALETTE = "#ff78c3;#797979;#73ffaf";

function renderBundle( _bundle, _duration = 60 )
{
    return Promise.all( [ _bundle.vizService.render(), new Promise( resolve => setTimeout( resolve, _duration ) ) ] );
}

describe( "Stock heatmap renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;
    let svg;

    before( function()
    {
        return loader.load( "stock-heatmap", "vis/customvis/stock-heatmap" ).then( function( _bundle )
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

    function getTextContents( selector )
        {
            return Array.from( svg.querySelector( selector ).querySelectorAll( "text" ) ).map( e => e.innerHTML );
        }

    it( "renders empty heatmap with no data", function()
    {
        return renderBundle( bundle ).then( function()
        {
            expect( svg.querySelector( ".elem" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "render elements when there is data", function()
    {
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) ) ).to.have.lengthOf( 4 );

            const nameArray = getTextContents( ".names" );
            expect( nameArray ).to.have.lengthOf( 4 );
            expect( nameArray ).to.include( "VKL" );
            expect( nameArray ).to.include( "VLTN" );
            expect( nameArray ).to.include( "DCM" );
            expect( nameArray ).to.include( "NCL" );

            const valueArray = getTextContents( ".values" );
            expect( valueArray ).to.have.lengthOf( 4 );
            expect( valueArray ).to.include( "+0.5" );
            expect( valueArray ).to.include( "-0.2" );
            expect( valueArray ).to.include( "+0.3" );
            expect( valueArray ).to.include( "+0.1" );

            const smallTitlesArray = getTextContents( ".smallTitles" );
            expect( smallTitlesArray ).to.have.lengthOf( 3 );
            expect( smallTitlesArray ).to.includes( "A1" );
            expect( smallTitlesArray ).to.includes( "A2" );
            expect( smallTitlesArray ).to.includes( "B1" );

            const bigTitlesArray = getTextContents( ".bigTitles" );
            expect( bigTitlesArray ).to.have.lengthOf( 2 );
            expect( bigTitlesArray ).to.includes( "A" );
            expect( bigTitlesArray ).to.includes( "B" );
        } );
    } );

    it( "updates the property to show/hide group label", function()
    {
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "text" ) ) ).to.have.lengthOf( 3 );
            expect( Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) ) ).to.have.lengthOf( 3 );
            expect( Array.from( svg.querySelector( ".bigTitles" ).querySelectorAll( "text" ) ) ).to.have.lengthOf( 2 );
            bundle.setProperties(
                {
                    "text.showGroup" : "false"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            expect( svg.querySelector( ".smallTitles" ).innerHTML ).to.be.empty;
            expect( svg.querySelector( ".bigTitles" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "updates the property to show/hide stock symbol", function()
    {
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelector( ".names" ).querySelectorAll( "text" ) ) ).to.have.lengthOf( 4 );
            bundle.setProperties(
                {
                    "text.showName" : "false"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            expect( svg.querySelector( ".names" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "updates the property to show/hide stock heat", function()
    {
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelector( ".values" ).querySelectorAll( "text" ) ) ).to.have.lengthOf( 4 );
            bundle.setProperties( {
                    "text.showValue" : "false"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            expect( svg.querySelector( ".values" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "shows highlighted datapoint and its group label", function()
    {
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            const elems = Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) );
            expect( elems[ 0 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            const groupLabels = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) );
            expect( groupLabels[ 0 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 1 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 2 ].style.stroke ).to.equal( "white" );

            data.decorateDataPoint( 0, { "highlighted": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const elems = Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) );
            expect( elems[ 0 ].getAttribute( "stroke" ) ).to.not.be.null;
            expect( elems[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            const groupLabels = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) );
            expect( groupLabels[ 0 ].style.stroke ).to.not.equal( "white" );
            expect( groupLabels[ 1 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 2 ].style.stroke ).to.equal( "white" );
        } );
    } );

    it( "shows selected datapoint and its group label", function()
    {
        function transparent( color )
        {
            const rgb = color.substring( color.indexOf( "(" ) + 1, color.indexOf( ")" ) ).split( "," );
            return `rgba(${rgb[ 0 ]},${rgb[ 1 ]},${rgb[ 2 ]}, 0.4)`;
        }
        bundle.setData( data );
        var elemsInitialColors = [];
        var groupInitialColors = [];

        return renderBundle( bundle ).then( function()
        {
            const elems = Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) );
            expect( elems[ 0 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            elemsInitialColors = elems.map( e => e.style.fill );

            const groupLabels = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) );
            expect( groupLabels[ 0 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 1 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 2 ].style.stroke ).to.equal( "white" );

            groupInitialColors = groupLabels.map( e => e.style.fill );

            data.decorateDataPoint( 0, { "selected": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const elems = Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) );

            expect( elems[ 0 ].style.fill ).to.equal( elemsInitialColors[ 0 ] );
            expect( elems[ 0 ].getAttribute( "stroke" ) ).to.not.be.null;

            expect( elems[ 1 ].style.fill ).to.equal( transparent( elemsInitialColors[ 1 ] ) );
            expect( elems[ 2 ].style.fill ).to.equal( transparent( elemsInitialColors[ 2 ] ) );
            expect( elems[ 3 ].style.fill ).to.equal( transparent( elemsInitialColors[ 3 ] ) );

            expect( elems[ 1 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 2 ].getAttribute( "stroke" ) ).to.be.null;
            expect( elems[ 3 ].getAttribute( "stroke" ) ).to.be.null;

            const groupLabels = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) );
            expect( groupLabels[ 0 ].style.fill ).to.equal( groupInitialColors[ 0 ] );
            expect( groupLabels[ 0 ].style.stroke ).to.not.equal( "white" );

            expect( groupLabels[ 1 ].style.fill ).to.equal( transparent( groupInitialColors[ 1 ] ) );
            expect( groupLabels[ 2 ].style.fill ).to.equal( transparent( groupInitialColors[ 2 ] ) );

            expect( groupLabels[ 1 ].style.stroke ).to.equal( "white" );
            expect( groupLabels[ 2 ].style.stroke ).to.equal( "white" );
        } );
    } );

    it( "updates the color based on property", function()
    {
        var palette = bundle.vizService.properties.getPalette( "color" );
        bundle.setPalette( palette, COLOR_PALETTE );
        bundle.setData( data );

        return renderBundle( bundle ).then( function()
        {
            const elems = Array.from( svg.querySelector( ".elem" ).querySelectorAll( "rect" ) );
            expect( elems[ 0 ].style.fill ).to.equal( "rgb(115, 255, 175)" );
            expect( elems[ 1 ].style.fill ).to.equal( "rgb(175, 121, 151)" );
            expect( elems[ 2 ].style.fill ).to.equal( "rgb(117, 201, 153)" );
            expect( elems[ 3 ].style.fill ).to.equal( "rgb(120, 148, 132)" );
        } );
    } );

    it( "doesn't render group label if the group is too small", function()
    {
        bundle.setData( TestData.fromStateJson( stateSmallData ) );
        return renderBundle( bundle ).then( function()
        {
            const groupLabelPolygons = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "polygon" ) );
            const groupLabelTexts = Array.from( svg.querySelector( ".smallTitles" ).querySelectorAll( "text" ) );
            expect( groupLabelPolygons ).to.have.lengthOf( 3 );
            expect( groupLabelTexts ).to.have.lengthOf( 3 );
            expect( groupLabelTexts.map( e => e.innerHTML ) ).to.not.include( "B2" );
        } );
    } );

    it( "doesn't render stock label if the area is too small", function()
    {
        bundle.setData( TestData.fromStateJson( stateSmallData ) );
        return renderBundle( bundle ).then( function()
        {
            const nameArray = getTextContents( ".names" );
            expect( nameArray ).to.have.lengthOf( 4 );
            expect( nameArray ).to.not.include( "Clipper" );
        } );
    } );
} );

} );