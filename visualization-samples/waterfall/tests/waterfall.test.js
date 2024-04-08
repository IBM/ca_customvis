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

const csvdata =
{
    csv: [
        [ "categories","value","type" ],
        [ "LY",300,"TOTAL" ],
        [ "x1",-15,"ADJUSTMENT" ],
        [ "x3",-100,"ADJUSTMENT" ],
        [ "LY Base",285,"TOTAL" ],
        [ "xxxx",-8,"DELTA" ],
        [ "xxx",-22,"DELTA" ],
        [ "fuel",0,"DELTA" ],
        [ "owner costs",2,"DELTA" ],
        [ "engineering",3,"DELTA" ],
        [ "user charges",-4,"DELTA" ],
        [ "other costs",19,"DELTA" ],
        [ "FP",275,"TOTAL" ]
    ]
};

csvdata.csv[ 0 ].forEach( function( _c, _i ) { csvdata[ _c ] = _i; } );

describe( "Waterfall renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;  // TestBundle instance.
    let data;    // TestData instance.
    let svg;

    before( function()
    {
        return loader.load( "waterfall", "vis/code-samples/waterfall" ).then( function( _bundle )
        {
            bundle = _bundle;
            data = TestData.fromCsv( csvdata.csv );
        } );
    } );

    after( function()
    {
        bundle = null;
        loader.destroy();
    } );

    beforeEach( function()
    {
        const container = TestContainer.create();
        return bundle.newViz( container ).then( function()
        {
            svg = container.querySelector( "svg" );
        } );
    } );

    afterEach( function()
    {
        TestContainer.destroy();
        data.clearMappings();
        data.clearDecorations();
        return bundle.reset();
    } );

    it( "renders empty waterfall with no data", function()
    {
        return bundle.vizService.render().then( function()
        {
            expect( svg.querySelector( ".elements" ).innerHTML ).to.be.empty;
            expect( svg.querySelector( ".axes" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "renders elements and axes with data", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );
        bundle.setData( data );

        return bundle.vizService.render().then( function()
        {
            expect( Array.from( svg.querySelectorAll( ".dataBar" ) ) ).to.have.lengthOf( csvdata.csv.length - 1 );
            expect( svg.querySelector( ".axes" ).innerHTML ).to.be.not.empty;
        } );
    } );

    it( "clears elements", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );
        bundle.setData( data );

        return bundle.vizService.render().then( function()
        {
            expect( svg.querySelectorAll( ".dataBar" ) ).to.have.lengthOf( csvdata.csv.length - 1 ); // -1 for the data headers

            const emptyData = TestData.fromCsv( csvdata.csv.slice( 0, csvdata.csv.length - 2 ) );
            emptyData.addMapping( "categories", csvdata.categories );
            emptyData.addMapping( "value", csvdata.value );
            emptyData.addMapping( "type", csvdata.type );
            bundle.setData( emptyData );

            return bundle.vizService.render();
        } ).then( function()
        {
            expect( svg.querySelectorAll( ".dataBar" )  ).to.have.lengthOf( csvdata.csv.length - 3 ); // -1 for the data headers
        } );
    } );

    it( "updates bar colors according to properties", function()
    {
        const props = {
            "totalBarColor" : "rgb(0,0,255)",
            "adjustmentBarColor" : "rgb(255,0,0)",
            "posDeltaColor" : "rgb(255,0,0)",
            "negDeltaColor" : "rgb(255,255,0)"
        };
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );
        bundle.setData( data );
        bundle.setProperties( props );

        return bundle.vizService.render().then( function()
        {
            const bars = svg.querySelectorAll( ".dataBar" );
            expect( bars[ 0 ].getAttribute( "fill" ) ).to.be.eql( props.totalBarColor );
            expect( bars[ 1 ].getAttribute( "fill" ) ).to.be.eql( props.adjustmentBarColor );
            expect( bars[ 4 ].getAttribute( "fill" ) ).to.be.eql( props.negDeltaColor );
            expect( bars[ 7 ].getAttribute( "fill" ) ).to.be.eql( props.posDeltaColor );
        } );
    } );

    it( "renders connections", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );
        bundle.setData( data );

        return bundle.vizService.render().then( function()
        {
            expect( Array.from( svg.querySelectorAll( ".connection" ) ) ).to.have.lengthOf( csvdata.csv.length - 2 );
        } );
    } );

    it( "toggles delta lines according to property", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );
        bundle.setData( data );
        // setting optimize size to false triggers the error
        bundle.setProperties( {
            deltaLines: true
        } );

        const expectedLines = csvdata.csv.reduce( ( prev, curr ) => curr[ 2 ] === "TOTAL" ? ++prev : prev, 0 );

        return bundle.vizService.render().then( function()
        {
            expect( Array.from( svg.querySelectorAll( ".deltaLine" ) ) ).to.have.lengthOf( expectedLines - 1 );

            bundle.setProperties( {
                deltaLines: false
            } );

            return bundle.vizService.render();
        } ).then( function()
        {
            expect( Array.from( svg.querySelectorAll( ".deltaLine" ) ) ).to.have.lengthOf( 0 );
        } );
    } );

    it( "highlight bars", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );

        data.decorateDataPoint( 0, { "highlighted": true } );
        data.decorateDataPoint( 2, { "highlighted": true } );
        bundle.setData( data );

        return bundle.vizService.render().then( function()
        {
            const bars = svg.querySelectorAll( ".dataBar" );
            expect( bars[ 0 ].getAttribute( "stroke-width" ) ).to.be.eql( "2.5" );
            expect( bars[ 2 ].getAttribute( "stroke-width" ) ).to.be.eql( "2.5" );
            expect( bars[ 3 ].getAttribute( "stroke-width" ) ).to.be.eql( "0" );
        } );
    } );

    it( "select bars", function()
    {
        data.addMapping( "categories", csvdata.categories );
        data.addMapping( "value", csvdata.value );
        data.addMapping( "type", csvdata.type );

        data.decorateDataPoint( 0, { "selected": true } );
        data.decorateDataPoint( 2, { "selected": true } );
        bundle.setData( data );

        return bundle.vizService.render().then( function()
        {
            const bars = svg.querySelectorAll( ".dataBar" );
            expect( bars[ 0 ].getAttribute( "stroke-width" ) ).to.be.eql( "2.5" );
            expect( bars[ 2 ].getAttribute( "stroke-width" ) ).to.be.eql( "2.5" );
            expect( bars[ 2 ].getAttribute( "fill-opacity" ) ).to.be.eql( "1" );
            expect( bars[ 3 ].getAttribute( "stroke-width" ) ).to.be.eql( "0" );

            expect( bars[ 3 ].getAttribute( "fill-opacity" ) ).to.be.eql( "0.75" );
        } );
    } );
} );

} );
