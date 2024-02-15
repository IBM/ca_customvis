// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

define( [
        "test/utils/TestContainer",
        "test/utils/TestBundleLoader",
        "test/utils/TestData",
        "text!./state.json"
    ], function(
        TestContainer,
        TestBundleLoader,
        TestData,
        stateData
    )
{
"use strict";

function renderBundle( _bundle, _duration = 60 )
{
    return Promise.all( [ _bundle.vizService.render(), new Promise( resolve => setTimeout( resolve, _duration ) ) ] );
}

const TILES_CLASS_SELECTOR = ".tiles";
const TILE_CLASS_SELECTOR = ".tile";
const TILE_LABELS_CLASS_SELECTOR = ".labels";
const TILE_LABEL_CLASS_SELECTOR = ".label";

const LEFT_AXIS_LABELS_SELECTOR = ".axisTransform.left .tick text";
const BOTTOM_AXIS_LABELS_SELECTOR = ".axisTransform.bottom .tick text";

const Colors = {
    green: "rgb(106,168,79)",
    yellow: "rgb(241,194,50)",
    orange: "rgb(230,145,56)",
    red: "rgb(204,0,0)"
};

describe( "Risk Matrix 4x4 chart renderer", function()
{
    const loader = new TestBundleLoader();
    let bundle;
    let svg;

    const data = TestData.fromStateJson( stateData );

    before( function()
    {
        this.timeout( 30000 );
        return loader.load( "riskMatrix4x4", "packages/vizbundle-customvis-riskmatrix/build" ).then( function( _bundle )
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
        this.timeout( 5000 );
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
            expect( svg.querySelector( TILES_CLASS_SELECTOR ).innerHTML ).to.be.empty;
            expect( svg.querySelector( TILE_LABELS_CLASS_SELECTOR ).innerHTML ).to.be.empty;
        } );
    } );

    it( "renders population chart when data is present", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            // tests ordered visually row by row, from left to right
            // check tile colors
            const tiles = Array.from( svg.querySelectorAll( TILE_CLASS_SELECTOR ) );
            expect( tiles ).to.have.lengthOf( 16 );

            expect( tiles[ 3 ].getAttribute( "fill" ) ).to.equal( Colors.yellow );
            expect( tiles[ 2 ].getAttribute( "fill" ) ).to.equal( Colors.orange );
            expect( tiles[ 1 ].getAttribute( "fill" ) ).to.equal( Colors.red );
            expect( tiles[ 0 ].getAttribute( "fill" ) ).to.equal( Colors.red );

            expect( tiles[ 15 ].getAttribute( "fill" ) ).to.equal( Colors.yellow );
            expect( tiles[ 14 ].getAttribute( "fill" ) ).to.equal( Colors.orange );
            expect( tiles[ 13 ].getAttribute( "fill" ) ).to.equal( Colors.orange );
            expect( tiles[ 12 ].getAttribute( "fill" ) ).to.equal( Colors.red );

            expect( tiles[ 11 ].getAttribute( "fill" ) ).to.equal( Colors.green );
            expect( tiles[ 10 ].getAttribute( "fill" ) ).to.equal( Colors.yellow );
            expect( tiles[ 9 ].getAttribute( "fill" ) ).to.equal( Colors.orange );
            expect( tiles[ 8 ].getAttribute( "fill" ) ).to.equal( Colors.orange );

            expect( tiles[ 7 ].getAttribute( "fill" ) ).to.equal( Colors.green );
            expect( tiles[ 6 ].getAttribute( "fill" ) ).to.equal( Colors.green );
            expect( tiles[ 5 ].getAttribute( "fill" ) ).to.equal( Colors.yellow );
            expect( tiles[ 4 ].getAttribute( "fill" ) ).to.equal( Colors.yellow );

            // check tile labels
            const tileLabels = svg.querySelectorAll( `${TILE_LABELS_CLASS_SELECTOR} ${TILE_LABEL_CLASS_SELECTOR}` );
            expect( tileLabels ).to.have.lengthOf( 16 );

            expect( tileLabels[ 3 ].textContent ).to.equal( "1" );
            expect( tileLabels[ 2 ].textContent ).to.equal( "1" );
            expect( tileLabels[ 1 ].textContent ).to.equal( "0" );
            expect( tileLabels[ 0 ].textContent ).to.equal( "1" );

            expect( tileLabels[ 15 ].textContent ).to.equal( "2" );
            expect( tileLabels[ 14 ].textContent ).to.equal( "1" );
            expect( tileLabels[ 13 ].textContent ).to.equal( "0" );
            expect( tileLabels[ 12 ].textContent ).to.equal( "2" );

            expect( tileLabels[ 11 ].textContent ).to.equal( "2" );
            expect( tileLabels[ 10 ].textContent ).to.equal( "1" );
            expect( tileLabels[ 9 ].textContent ).to.equal( "1" );
            expect( tileLabels[ 8 ].textContent ).to.equal( "0" );

            expect( tileLabels[ 7 ].textContent ).to.equal( "2" );
            expect( tileLabels[ 6 ].textContent ).to.equal( "0" );
            expect( tileLabels[ 5 ].textContent ).to.equal( "5" );
            expect( tileLabels[ 4 ].textContent ).to.equal( "1" );
        } );
    } );

    it( "shows correct axis labels", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const leftAxisLabels = Array.from( svg.querySelectorAll( LEFT_AXIS_LABELS_SELECTOR ) );
            expect( leftAxisLabels ).to.have.lengthOf( 4 );

            expect( leftAxisLabels[ 0 ].textContent ).to.equal( "Low" );
            expect( leftAxisLabels[ 1 ].textContent ).to.equal( "Medium" );
            expect( leftAxisLabels[ 2 ].textContent ).to.equal( "High" );
            expect( leftAxisLabels[ 3 ].textContent ).to.equal( "Very High" );

            const bottomAxisLabels = Array.from( svg.querySelectorAll( BOTTOM_AXIS_LABELS_SELECTOR ) );
            expect( bottomAxisLabels ).to.have.lengthOf( 4 );

            expect( bottomAxisLabels[ 0 ].textContent ).to.equal( "Low" );
            expect( bottomAxisLabels[ 1 ].textContent ).to.equal( "Medium" );
            expect( bottomAxisLabels[ 2 ].textContent ).to.equal( "High" );
            expect( bottomAxisLabels[ 3 ].textContent ).to.equal( "Very High" );
        } );
    } );

    it( "shows highlighted tile", function()
    {
        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const tiles = Array.from( svg.querySelectorAll( TILE_CLASS_SELECTOR ) );
            expect( tiles ).to.have.lengthOf( 16 );

            expect( Number( tiles[ 3 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 2 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 1 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 0 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 15 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 14 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 13 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 12 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 11 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 10 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 9 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 8 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 7 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 6 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 5 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 4 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            // set a highlight
            data.decorateDataPoint( 3, { "highlighted": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const tiles = Array.from( svg.querySelectorAll( TILE_CLASS_SELECTOR ) );
            expect( tiles ).to.have.lengthOf( 16 );

            expect( Number( tiles[ 3 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 2 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 1 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 0 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 15 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 14 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 2 );
            expect( Number( tiles[ 13 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 12 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 11 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 10 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 9 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 8 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );

            expect( Number( tiles[ 7 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 6 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 5 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
            expect( Number( tiles[ 4 ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
        } );
    } );

    it( "shows selected tile", function()
    {
        const selectedDataPointIdx = 3;
        const selectedTileIndex = 14;

        bundle.setData( data );
        return renderBundle( bundle ).then( function()
        {
            const tiles = Array.from( svg.querySelectorAll( TILE_CLASS_SELECTOR ) );
            expect( tiles ).to.have.lengthOf( 16 );

            for( let i = 0; i < tiles.length; i++ )
            {
                expect( Number( tiles[ i ].style.getPropertyValue( "fill-opacity" ) ) ).to.equal( 0.9 );
                expect( Number( tiles[ i ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
                expect( Number( tiles[ i ].style.getPropertyValue( "stroke-opacity" ) ) ).to.equal( 0.8 );
            }

            // set a selection
            data.decorateDataPoint( selectedDataPointIdx, { "selected": true } );
            bundle.setData( data );
            return renderBundle( bundle );
        } ).then( function()
        {
            const tiles = Array.from( svg.querySelectorAll( TILE_CLASS_SELECTOR ) );
            expect( tiles ).to.have.lengthOf( 16 );

            for( let i = 0; i < tiles.length; i++ )
            {
                if( i === selectedTileIndex )
                {
                    expect( Number( tiles[ i ].style.getPropertyValue( "fill-opacity" ) ) ).to.equal( 0.9 );
                    expect( Number( tiles[ i ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 2 );
                    expect( Number( tiles[ i ].style.getPropertyValue( "stroke-opacity" ) ) ).to.equal( 0.8 );
                }

                else
                {
                    expect( Number( tiles[ i ].style.getPropertyValue( "fill-opacity" ) ) ).to.equal( 0.3 );
                    expect( Number( tiles[ i ].style.getPropertyValue( "stroke-width" ) ) ).to.equal( 0 );
                    expect( Number( tiles[ i ].style.getPropertyValue( "stroke-opacity" ) ) ).to.equal( 0.15 );
                }
            }
        } );
    } );
} );

} );
