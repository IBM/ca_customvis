// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2019
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
        [ "categories", "values", "group" ],
        [ "A", 5, "AAAAAAAAA" ],
        [ "A", 15, "BB" ],
        [ "A", 25, "CC" ],
        [ "B", 10, "AAAAAAAAA" ],
        [ "B", 30, "BB" ],
        [ "B", 50, "CC" ],
        [ "C", 20, "AAAAAAAAA" ],
        [ "C", 60, "BB" ],
        [ "C", 100, "CC" ]
    ]
};

csvdata.csv[ 0 ].forEach( function( _c, _i ) { csvdata[ _c ] = _i; } );

function createWait( _duration = 60 )
{
    return new Promise( resolve => setTimeout( resolve, _duration ) );
}

function renderBundle( _bundle )
{
    return Promise.all( [ _bundle.vizService.render(), createWait( 100 ) ] );
}

describe( "Parallel renderer", () =>
{
    const loader = new TestBundleLoader();
    let container;
    let bundle;  // TestBundle instance.
    let data;    // TestData instance.
    let svg;

    before( function()
    {
        return loader.load( "parallel", "vis/customvis/parallel" ).then( function( _bundle )
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
        container = TestContainer.create();
        return bundle.newViz( container ).then( function()
        {
            svg = document.querySelector( "svg" );
        } );
    } );

    afterEach( function()
    {
        bundle.reset();
        TestContainer.destroy();
        data.clearMappings();
        data.clearDecorations();
    } );

    it( "updates axis to the number of groups", function()
    {
        // render nothing if no data is set
        return bundle.vizService.render().then( function()
        {
            expect( svg.querySelector( ".chartContent" ).innerHTML ).to.be.empty;

            data.addMapping( "series", csvdata.categories )
                .addMapping( "values", csvdata.values )
                .addMapping( "coordinates", csvdata.group );
            bundle.setData( data );

            return bundle.vizService.render();
        } ).then( function()
        {
            expect( svg.querySelectorAll( ".chartContent .axis" ) ).to.have.length( 3 );

            const dt = TestData.fromCsv( [
                [ "categories", "values", "group" ],
                [ "A", 5, "AA" ],
                [ "B", 10, "BB" ]
            ] );

            dt.addMapping( "series", csvdata.categories )
                .addMapping( "values", csvdata.values )
                .addMapping( "coordinates", csvdata.group );

            bundle.setData( dt );

            return bundle.vizService.render();
        } ).then( function()
        {
            expect( svg.querySelectorAll( ".chartContent .axis" ) ).to.have.length( 2 );
        } );
    } );

    it( "renders inside viewport", function()
    {
        data.addMapping( "series", csvdata.categories )
                .addMapping( "values", csvdata.values )
                .addMapping( "coordinates", csvdata.group );
        bundle.setData( data );
        bundle.setProperties( {
            "transition.duration": 0
        } );

        const content = svg.querySelector( ".chartContent" );

        return renderBundle( bundle ).then( function()
        {
            const clientRect = container.getBoundingClientRect();
            const chartRect = content.getBoundingClientRect();
            expect( chartRect.width ).to.be.below( clientRect.width );
            expect( chartRect.height ).to.be.below( clientRect.height );

            TestContainer.resize( 1280, 750 );
            return renderBundle( bundle );
        } ).then( function()
        {
            const clientRect = container.getBoundingClientRect();
            const chartRect = content.getBoundingClientRect();
            expect( chartRect.width ).to.be.below( clientRect.width );
            expect( chartRect.height ).to.be.below( clientRect.height );

            TestContainer.resize( 750, 750 );
            return renderBundle( bundle );
        } ).then( function()
        {
            const clientRect = container.getBoundingClientRect();
            const chartRect = content.getBoundingClientRect();
            expect( chartRect.width ).to.be.below( clientRect.width );
            expect( chartRect.height ).to.be.below( clientRect.height );
        } );
    } );

    it( "applies properties to the chart", () =>
    {
        data.addMapping( "series", csvdata.categories )
                .addMapping( "values", csvdata.values )
                .addMapping( "coordinates", csvdata.group );
        bundle.setData( data );
        // setting optimize size to false triggers the error
        bundle.setProperties( {
            "line.width": 5
        } );

        return bundle.vizService.render().then( function()
        {
            expect( +svg.querySelector( ".chartContent .linesGroup path" ).getAttribute( "stroke-width" ) ).to.eq( 5 );
            bundle.setProperties( {
                "line.width": 2
            } );

            return renderBundle( bundle );
        } ).then( function()
        {
            expect( +svg.querySelector( ".chartContent .linesGroup path" ).getAttribute( "stroke-width" ) ).to.eq( 2 );
        } );
    } );
} );

} );
