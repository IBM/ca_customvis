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

describe( "Gantt chart renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;
    let svg;

    before( function()
    {
        return loader.load( "gantt", "vis/customvis/gantt" ).then( function( _bundle )
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
        TestContainer.destroy();
    } );

    it( "renders empty chart with no data", function()
    {
        return renderBundle( bundle ).then( function()
        {
            expect( svg.querySelector( ".axes" ).innerHTML ).to.be.empty;
            expect( svg.querySelector( ".ganttBars" ).innerHTML ).to.be.empty;
        } );
    } );

    const minimumData = TestData.fromCsv( [
        [ "task"    , "startDate"   , "endDate"     ],
        [ "Task1"   , "15/Dec/19"   , "10/Jan/20"   ],
        [ "Task2"   , "1/Jan/20"    , "14/Jan/20"   ],
        [ "Task3"   , "20/Dec/19"   , ""            ],
        [ "Task4"   , ""            , "14/Jan/20"   ]
    ] );
    minimumData.addMapping( "task", 0 )
            .addMapping( "startDate", 1 )
            .addMapping( "endDate", 2 );

    it( "renders Gantt chart when data is present", function()
    {
        bundle.setData( minimumData );
        return renderBundle( bundle ).then( function()
        {
            expect( svg.querySelector( ".axes" ).innerHTML ).to.not.be.empty;
            expect( Array.from( svg.querySelectorAll( ".axisTransform" ) ) ).to.have.lengthOf( 2 ); // x and y axes
            expect( svg.querySelector( ".ganttBars" ).innerHTML ).to.not.be.empty;
            expect( Array.from( svg.querySelectorAll( ".bar" ) ) ).to.have.lengthOf( 4 ); // 4 gantt bars
        } );
    } );

    it( "fills empty start gradient to gantt bar without start date", function()
    {
        bundle.setData( minimumData );
        return renderBundle( bundle ).then( function()
        {
            const noStartDateBar = Array.from( svg.querySelectorAll( ".bar" ) )[ 3 ];
            expect( noStartDateBar.style.fill ).to.equal( "url(\"#startEmpty_noStatus\")" );
        } );
    } );

    it( "fills empty end gradient to gantt bar without end date", function()
    {
        bundle.setData( minimumData );
        return renderBundle( bundle ).then( function()
        {
            const noEndDateBar = Array.from( svg.querySelectorAll( ".bar" ) )[ 2 ];
            expect( noEndDateBar.style.fill ).to.equal( "url(\"#endEmpty_noStatus\")" );
        } );
    } );

    it( "adjusts x axis position based on property", function()
    {
        function getXAxis( _axesSelector )
        {
            return Array.from( svg.querySelectorAll( _axesSelector ) )
                .filter( axis => !axis.getAttribute( "class" ).includes( "left" ) )[ 0 ];
        }
        function getYTransform( _elem )
        {
            let transform = _elem.getAttribute( "transform" );
            return Number( transform.substring( transform.indexOf( "," ) + 1, transform.indexOf( ")" ) ) );
        }
        let svgHeight;
        bundle.setData( minimumData );
        return renderBundle( bundle ).then( function()
        {
            svgHeight = svg.clientHeight;
            const xAxis = getXAxis( ".axisTransform" );
            const xAxisYTransform = getYTransform( xAxis );

            // Expect x axis to be close to the top of svg ( 5% of height )
            expect( parseFloat( xAxisYTransform / svgHeight ) ).to.be.lessThan( 0.05 );
            expect( xAxis.getAttribute( "class" ) ).to.includes( "top" );

            bundle.setProperties(
                {
                    "axis.xAxisPlace" : "bottom"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const xAxis = getXAxis( ".axisTransform" );
            const xAxisYTransform = getYTransform( xAxis );

            // Expect x axis to be close to the bottom of svg ( 95% of height )
            expect( parseFloat( xAxisYTransform / svgHeight ) ).to.be.greaterThan( 0.95 );
            expect( xAxis.getAttribute( "class" ) ).to.includes( "bottom" );
        } );
    } );

    it( "render colors based on category", function()
    {
        bundle.setData( TestData.fromCsv( [
            [ "task"    , "startDate"   , "endDate"     , "status"      ],
            [ "Task1"   , "15/Dec/19"   , "10/Jan/20"   , "Done"        ],
            [ "Task2"   , "1/Jan/20"    , "14/Jan/20"   , "Done"        ],
            [ "Task3"   , "20/Dec/19"   , "14/Jan/20"   , "In Progress" ],
            [ "Task4"   , "15/Dec/19"   , "14/Jan/20"   , "To Do"       ]
        ] ).addMapping( "task", 0 )
            .addMapping( "startDate", 1 )
            .addMapping( "endDate", 2 )
            .addMapping( "color", 3 )
        );
        var catPalette = bundle.vizService.properties.getPalette( "colors.cat" );
        bundle.setPalette( catPalette, "#FF0000;#00FF00;#0000FF" );

        return renderBundle( bundle ).then( function()
        {
            const bars = Array.from( svg.querySelectorAll( ".bar" ) );
            expect( bars[ 0 ].style.fill ).to.equal( "rgb(255, 0, 0)" );
            expect( bars[ 1 ].style.fill ).to.equal( "rgb(255, 0, 0)" );
            expect( bars[ 2 ].style.fill ).to.equal( "rgb(0, 255, 0)" );
            expect( bars[ 3 ].style.fill ).to.equal( "rgb(0, 0, 255)" );
        } );
    } );

    it( "render colors based on continous", function()
    {
        bundle.setData( TestData.fromCsv( [
            [ "task"    , "startDate"   , "endDate"     , "progress" ],
            [ "Task1"   , "15/Dec/19"   , "10/Jan/20"   , 100        ],
            [ "Task2"   , "1/Jan/20"    , "14/Jan/20"   , 90         ],
            [ "Task3"   , "20/Dec/19"   , "14/Jan/20"   , 50         ],
            [ "Task4"   , "15/Dec/19"   , "14/Jan/20"   , 0          ]
        ] ).addMapping( "task", 0 )
            .addMapping( "startDate", 1 )
            .addMapping( "endDate", 2 )
            .addMapping( "color", 3 )
        );
        var catPalette = bundle.vizService.properties.getPalette( "colors.cont" );
        bundle.setPalette( catPalette, "#000000;#00FF00" );

        return renderBundle( bundle ).then( function()
        {
            const bars = Array.from( svg.querySelectorAll( ".bar" ) );
            expect( bars[ 0 ].style.fill ).to.equal( "rgb(0, 255, 0)" );
            expect( bars[ 1 ].style.fill ).to.equal( "rgb(0, 230, 0)" );
            expect( bars[ 2 ].style.fill ).to.equal( "rgb(0, 128, 0)" );
            expect( bars[ 3 ].style.fill ).to.equal( "rgb(0, 0, 0)" );
        } );
    } );

    const dataWithDescription = TestData.fromCsv( [
        [ "task"    , "startDate"   , "endDate"     , "status"      ],
        [ "Task1"   , "15/Dec/19"   , "10/Jan/20"   , "Done"        ],
        [ "Task2"   , "1/Jan/20"    , "14/Jan/20"   , "Done"        ],
        [ "Task3"   , "20/Dec/19"   , ""            , "In Progress" ],
        [ "Task4"   , ""            , "14/Jan/20"   , "To Do"       ]
    ] );
    dataWithDescription.addMapping( "task", 0 )
            .addMapping( "startDate", 1 )
            .addMapping( "endDate", 2 )
            .addMapping( "label", 3 );

    it( "renders label on chart when it's mapped", function()
    {
        bundle.setData( dataWithDescription );
        return renderBundle( bundle ).then( function()
        {
            const labels = Array.from( svg.querySelector( ".labels " ).querySelectorAll( "text" ) );
            expect( labels ).to.have.lengthOf( 4 );
            expect( labels[ 0 ].innerHTML ).to.equal( "Done" );
            expect( labels[ 1 ].innerHTML ).to.equal( "Done" );
            expect( labels[ 2 ].innerHTML ).to.equal( "In Progress" );
            expect( labels[ 3 ].innerHTML ).to.equal( "To Do" );
            expect( Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) ) ).to.have.lengthOf( 4 );
        } );
    } );

    it( "shows/hides label background based on property", function()
    {
        bundle.setData( dataWithDescription );
        return renderBundle( bundle ).then( function()
        {
            expect( Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) ) ).to.have.lengthOf( 4 );
            bundle.setProperties(
                {
                    "text.background.show" : false
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            expect( svg.querySelector( ".labelBackground" ).innerHTML ).to.be.empty;
        } );
    } );

    it( "changes label background color based on property", function()
    {
        bundle.setData( dataWithDescription );
        return renderBundle( bundle ).then( function()
        {
            const labelBgs = Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) );
            labelBgs.forEach( _bg => expect( _bg.getAttribute( "fill" ) ).to.equal( "rgb(255,255,255)" ) );

            bundle.setProperties(
                {
                    "text.background.color" : "#FF0000"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const labelBgs = Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) );
            labelBgs.forEach( _bg => expect( _bg.getAttribute( "fill" ) ).to.equal( "rgb(255,0,0)" ) );
        } );
    } );

    it( "changes text color based on property", function()
    {
        bundle.setData( dataWithDescription );
        return renderBundle( bundle ).then( function()
        {
            const labels = Array.from( svg.querySelector( ".labels " ).querySelectorAll( "text" ) );
            labels.forEach( _label => expect( _label.getAttribute( "fill" ) ).to.equal( "rgb(0,0,0)" ) );

            bundle.setProperties(
                {
                    "text.color" : "#FF0000"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const labels = Array.from( svg.querySelector( ".labels " ).querySelectorAll( "text" ) );
            labels.forEach( _label => expect( _label.getAttribute( "fill" ) ).to.equal( "rgb(255,0,0)" ) );
        } );
    } );

    it( "adjusts label background opacity based on property", function()
    {
        bundle.setData( dataWithDescription );
        return renderBundle( bundle ).then( function()
        {
            const labelBgs = Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) );
            labelBgs.forEach( _bg => expect( _bg.getAttribute( "fill-opacity" ) ).to.equal( "0.5" ) );

            bundle.setProperties(
                {
                    "text.background.opacity" : "0.8"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const labelBgs = Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) );
            labelBgs.forEach( _bg => expect( _bg.getAttribute( "fill-opacity" ) ).to.equal( "0.8" ) );

            bundle.setProperties(
                {
                    "text.background.opacity" : "2"
                } );
            return renderBundle( bundle );
        } ).then( function()
        {
            const labelBgs = Array.from( svg.querySelector( ".labelBackground" ).querySelectorAll( "rect" ) );
            labelBgs.forEach( _bg => expect( _bg.getAttribute( "fill-opacity" ) ).to.equal( "1" ) ); // maximum opacity is 10
        } );
    } );

    it( "puts overlapping tasks to new rows and draws arrows between them", function()
    {
        const getStartPointCoord = path =>
        {
            const coord = path.substring( 1 ).split( " " )[ 0 ].split( "," );
            return { x: parseFloat( coord[ 0 ] ), y: parseFloat( coord[ 1 ] ) };
        };
        const getEndPointCoord = path =>
        {
            const coord = path.substring( 1 ).split( " " ).slice( -1 )[ 0 ].split( "," );
            return { x: parseFloat( coord[ 0 ] ), y: parseFloat( coord[ 1 ] ) };
        };

        bundle.setData( TestData.fromCsv( [
            [ "task"    , "startDate"   , "endDate"     , "progress" ],
            [ "Task1"    , "15/Dec/19"   , "5/Jan/20"    , 100        ],
            [ "Task1"    , "1/Jan/20"    , "14/Jan/20"   , 50         ],
            [ "Task1"    , "12/Jan/20"   , ""            , 80         ],
            [ "Task2"    , ""            , "1/Jan/20"    , 70         ]
        ] ).addMapping( "task", 0 )
            .addMapping( "startDate", 1 )
            .addMapping( "endDate", 2 )
            .addMapping( "color", 3 )
        );
        var catPalette = bundle.vizService.properties.getPalette( "colors.cont" );
        bundle.setPalette( catPalette, "#000000;#00FF00" );
        return renderBundle( bundle ).then( function()
        {
            const error = 0.0001;
            expect( Array.from( svg.querySelector( ".left" ).querySelectorAll( ".tick" ) ) ).to.have.lengthOf( 3 ); // 2 for Task1, 1 for Task2

            const arrows = Array.from( svg.querySelectorAll( ".arrow" ) );
            expect( arrows ).to.have.lengthOf( 2 );
            const arrow1Path = arrows[ 0 ].getAttribute( "d" );
            const arrow1StartPoint = getStartPointCoord( arrow1Path );
            const arrow1EndPoint = getEndPointCoord( arrow1Path );
            const arrow2Path = arrows[ 1 ].getAttribute( "d" );
            const arrow2StartPoint = getStartPointCoord( arrow2Path );
            const arrow2EndPoint = getEndPointCoord( arrow2Path );

            const bars = Array.from( svg.querySelectorAll( ".bar" ) );
            expect( arrow1StartPoint.x ).to.be
                .closeTo( parseFloat( bars[ 0 ].getAttribute( "x" ) ) + parseFloat( bars[ 0 ].getAttribute( "width" ) ), error );
            expect( arrow1StartPoint.y ).to.be
                .closeTo( parseFloat( bars[ 0 ].getAttribute( "y" ) ) + parseFloat( bars[ 0 ].getAttribute( "height" ) / 2 ), error );
            expect( arrow1EndPoint.x ).to.be
                .closeTo( parseFloat( bars[ 1 ].getAttribute( "x" ) ), error );
            expect( arrow1EndPoint.y ).to.be
                .closeTo( parseFloat( bars[ 1 ].getAttribute( "y" ) ) + parseFloat( bars[ 1 ].getAttribute( "height" ) / 2 ), error );

            expect( arrow2StartPoint.x ).to.be
                .closeTo( parseFloat( bars[ 1 ].getAttribute( "x" ) ) + parseFloat( bars[ 1 ].getAttribute( "width" ) ), error );
            expect( arrow2StartPoint.y ).to.be
                .closeTo( parseFloat( bars[ 1 ].getAttribute( "y" ) ) + parseFloat( bars[ 1 ].getAttribute( "height" ) / 2 ), error );
            expect( arrow2EndPoint.x ).to.be
                .closeTo( parseFloat( bars[ 2 ].getAttribute( "x" ) ), error );
            expect( arrow2EndPoint.y ).to.be
                .closeTo( parseFloat( bars[ 2 ].getAttribute( "y" ) ) + parseFloat( bars[ 2 ].getAttribute( "height" ) / 2 ), error );
        } );
    } );

} );

} );
