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

var minimumTestData = TestData.fromCsv( [
        [ "Value" ],
        [   10    ]
    ] );

minimumTestData.addMapping( "value", 0 );

var fullTestDataV1 = TestData.fromCsv( [
    [ "Value", "Axis", "Target" ],
    [   10   ,  100  ,    50    ]
] );

fullTestDataV1.addMapping( "value",        0 )
            .addMapping( "max-axis-value", 1 )
            .addMapping( "target",         2 );

var fullTestDataV2 = TestData.fromCsv( [
    [ "HigherValue", "Axis"   , "Target" ],
    [    5000000   , 10000000 ,  7500000  ]
] );

fullTestDataV2.addMapping( "value",        0 )
            .addMapping( "max-axis-value", 1 )
            .addMapping( "target",         2 );

function renderBundle( _bundle, _duration = 60 )
{
    return Promise.all( [ _bundle.vizService.render(), new Promise( resolve => setTimeout( resolve, _duration ) ) ] );
}

describe( "Gas Gauge renderer", () =>
{
    const loader = new TestBundleLoader();
    let bundle;  // TestBundle instance.
    let svg;

    before( function()
    {
        return loader.load( "gas-gauge", "vis/customvis/gas-gauge" ).then( function( _bundle )
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

    it( "renders only the base structure without data", function()
    {
        return renderBundle( bundle ).then( function()
        {
            expectBaseStructure();
        } );
    } );

    it( "transforms to the base structure if the min and max axis values are equal", function()
    {
        // Minimum test data is needed for the full structure to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default full structure
            expectDefaultFullStucture();

            // Change the min and max axis properties to the same value
            bundle.setProperties(
                {
                    "min-axis-value" : "50",
                    "max-axis-value" : "50"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the full structure changed to base structure
            expectBaseStructure();
        } );
    } );

    it( "updates the inner & outer border color when the color properties are changed", function()
    {
        return renderBundle( bundle ).then( function()
        {
            // Check if the current color is set to the default
            expect( svg.querySelector( ".outer-border" ).style.stroke ).to.equal( "rgb(0, 0, 0)" ); // Default: black
            expect( svg.querySelector( ".inner-border" ).style.stroke ).to.equal( "rgb(211, 211, 211)" ); // Default: lightgrey

            // Update the color properties
            bundle.setProperties(
                {
                    "outer-border-stroke" : "blue",
                    "inner-border-stroke" : "yellow"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the properties got updated
            expect( svg.querySelector( ".outer-border" ).style.stroke ).to.equal( "rgb(0, 0, 255)" ); // Updated: blue
            expect( svg.querySelector( ".inner-border" ).style.stroke ).to.equal( "rgb(255, 255, 0)" ); // Updated: yellow
        } );
    } );

    it( "updates the inner & outer border size when the size property is changed", function()
    {
        return renderBundle( bundle ).then( function()
        {
            // Check if the current size is set to the default
            expect( parseFloat( svg.querySelector( ".outer-border" ).style.strokeWidth ) ).to.be.closeTo( 1.16, 0.25 ); // Default total size: 7 - inner-border
            expect( parseFloat( svg.querySelector( ".inner-border" ).style.strokeWidth ) ).to.be.closeTo( 5.83, 0.25 ); // Default total size: 7 - outer-border

            // Update the size property
            bundle.setProperties(
                {
                    "border-size" : 10
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the properties got updated
            expect( parseFloat( svg.querySelector( ".outer-border" ).style.strokeWidth ) ).to.be.closeTo( 1.66, 0.25 ); // Updated total size: 10 - inner-border
            expect( parseFloat( svg.querySelector( ".inner-border" ).style.strokeWidth ) ).to.be.closeTo( 8.33, 0.25 ); // Updated total size: 10 - outer-border
        } );
    } );

    it( "updates the arc interval coloring when the properties are changed", function()
    {
        // Minimum test data is needed for the arc to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            const arcChildNodes = svg.querySelector( ".arc" ).childNodes;

            // For every arc piece, check if it is set to the default color
            for ( let i = 0; i < arcChildNodes.length; i++ )
            {
                expect( arcChildNodes.item( i ).style.fill ).to.equal( "rgba(0, 0, 0, 0)" ); // Default: transparent
            }

            // Update the arc coloring properties
            bundle.setProperties(
                {
                    "first-interval-color" : "red",
                    "second-interval-color" : "orange",
                    "third-interval-color" : "green"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the color properties got updated
            expect( svg.querySelector( ".arc" ).childNodes.item( 0 ).style.fill ).to.equal( "rgb(255, 0, 0)" ); // Updated: red
            expect( svg.querySelector( ".arc" ).childNodes.item( 1 ).style.fill ).to.equal( "rgb(255, 165, 0)" ); // Updated: orange
            expect( svg.querySelector( ".arc" ).childNodes.item( 2 ).style.fill ).to.equal( "rgb(0, 128, 0)" ); // Updated: green
        } );
    } );

    it( "updates the arc interval sizing when the size properties are changed", function()
    {
        // Minimum test data is needed for the arc to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // For every arc piece, check the size
            expect( svg.querySelector( ".arc" ).childNodes.item( 0 ).getTotalLength() ).to.be.closeTo( 90.19, 0.5 ); // Default: Start = 0, End = 25
            expect( svg.querySelector( ".arc" ).childNodes.item( 1 ).getTotalLength() ).to.be.closeTo( 90.19, 0.5 ); // Default: Start = 25, End = 50
            expect( svg.querySelector( ".arc" ).childNodes.item( 2 ).getTotalLength() ).to.be.closeTo( 168.38, 0.5 ); // Default: Start = 50, End = 100

            // Update the arc sizing properties
            bundle.setProperties(
                {
                    "first-interval-start" : "10",
                    "first-interval-end" : "20",
                    "second-interval-start" : "20",
                    "second-interval-end" : "60",
                    "third-interval-start" : "60",
                    "third-interval-end" : "90"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the color properties got updated
            expect( svg.querySelector( ".arc" ).childNodes.item( 0 ).getTotalLength() ).to.be.closeTo( 43.27, 0.5 ); // Updated: Start = 10, End = 20 => Less than before
            expect( svg.querySelector( ".arc" ).childNodes.item( 1 ).getTotalLength() ).to.be.closeTo( 137.10, 0.5 ); // Updated: Start = 20, End = 60 => Greater than before
            expect( svg.querySelector( ".arc" ).childNodes.item( 2 ).getTotalLength() ).to.be.closeTo( 105.83, 0.5 ); // Updated: Start = 50, End = 100 => Less than before
        } );
    } );

    it( "updates the target show + value through property when the target slot is not bound with data", function()
    {
        // Minimum test data is needed for the target to possibly be visible
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // For the target to be visible through a property without slot mapping, the target-show property has to be turned on
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "visibility" ) ).to.equal( "visible" ); // Default: visible

            // Update the target show property
            bundle.setProperties(
                {
                    "target-show" : "true"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Now that the target-show property is on, the target is shown and has a rotation value
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "transform" ) ).to.equal( "rotate(40)" ); // Default target-value = 0

            // Update the target value property
            bundle.setProperties(
                {
                    "target-value" : "20"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the rotation of the target value got changed
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "transform" ) ).to.equal( "rotate(96)" ); // Updated target-value = 20
        } );
    } );

    it( "maps the target slot with data, validates if target slot data has priority over target property settings", function()
    {
        // Full test data is needed for the target to be mapped to a slot
        bundle.setData( fullTestDataV1 );
        bundle.setProperties(
            {
                "target-show" : "true"
            } );

        return renderBundle( bundle ).then( function()
        {
            // For the target to be visible through a property without slot mapping, the target-show property has to be turned on
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "visibility" ) ).to.equal( "visible" ); // Default: visible when target-show is on
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "transform" ) ).to.equal( "rotate(180)" ); // Default: target value is set to 50 in the fullTestDataV1

            // Update the target value property
            bundle.setProperties(
                {
                    "target-value" : "25"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Even though the target value property changed, it should have no effect on the mapped data (this has a higher priority)
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "transform" ) ).to.equal( "rotate(180)" ); // Unupdated: target value is still 50

            // Update the target value
            bundle.setData( fullTestDataV2 );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the target value got changed now that new data is mapped to the target slot
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "transform" ) ).to.equal( "rotate(250)" ); // Updated: target value is set to 75 in fullTestDataV2
        } );
    } );

    it( "updates the color property of the target", function()
    {
        // Minimum test data is needed for the target to possibly be visible
        bundle.setData( minimumTestData );
        bundle.setProperties(
            {
                "target-show" : "true"
            } );

        return renderBundle( bundle ).then( function()
        {
            // Check if the current color is set to the default value
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "stroke" ) ).to.equal( "rgb(15,98,254)" ); // Default: #0f62fe

            // Update the target color property
            bundle.setProperties(
                {
                    "target-color" : "green"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the target color value has changed
            expect( svg.querySelector( ".target-indicator" ).getAttribute( "stroke" ) ).to.equal( "rgb(0,128,0)" ); // Updated: green
        } );
    } );

    it( "updates the min and max value of the axis", function()
    {
        // Minimum test data is needed for the axis to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default axis
            expect( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).textContent ).to.equal( "0" ); // Default: 0
            expect( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).textContent ).to.equal( "100" ); // Default: 100

            // Change the min and max axis properties
            bundle.setProperties(
                {
                    "min-axis-value" : "20",
                    "max-axis-value" : "200"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the min and max axis values got updated
            expect( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).textContent ).to.equal( "20" ); // Updated: 20
            expect( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).textContent ).to.equal( "200" ); // Updated: 200
        } );

    } );

    it( "checks if the axis works inverted", function()
    {
        // Minimum test data is needed for the axis to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default axis
            expect( parseFloat( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).getAttribute( "x" ) ) ).to.be.closeTo( -17.04, 0.5 ); // Default: min starting x coordinate
            expect( parseFloat( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).getAttribute( "x" ) ) ).to.be.closeTo( 16.46, 0.5 ); // Default: max starting x coordinate

            // Change the min and max axis properties
            bundle.setProperties(
                {
                    "min-axis-value" : "200",
                    "max-axis-value" : "20"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the places got swapped after inverting the axis
            expect( parseFloat( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).getAttribute( "x" ) ) ).to.be.closeTo( 16.75, 0.5 ); // Updated: inverted min x coordinate
            expect( parseFloat( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).getAttribute( "x" ) ) ).to.be.closeTo( -16.46, 0.5 ); // Updated: inverted max x coordinate
        } );
    } );

    it( "checks if the axis allows negative values", function()
    {
        // Minimum test data is needed for the axis to be generated
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default axis scale
            expect( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).textContent ).to.equal( "0" ); // Default: 0
            expect( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).textContent ).to.equal( "100" ); // Default: 100

            // Change the min and max axis properties
            bundle.setProperties(
                {
                    "min-axis-value" : "-20",
                    "max-axis-value" : "-10"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the min and max axis values got updated
            expect( svg.querySelector( ".axis" ).childNodes.item( 0 ).childNodes.item( 1 ).textContent ).to.equal( "-20" ); // Updated: -20
            expect( svg.querySelector( ".axis" ).childNodes.item( 7 ).childNodes.item( 1 ).textContent ).to.equal( "-10" ); // Updated: 20
        } );
    } );

    it( "updates the amount of major tick and minor ticks of the axis", function()
    {
        // Minimum test data is needed for the axis to be rendered
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default axis settings
            expect( Array.from( svg.querySelectorAll( ".major-tick" ) ) ).to.have.lengthOf( 5 ); // Default: 3 major ticks (+ 2 main ticks)
            expect( Array.from( svg.querySelectorAll( ".interval" ) ) ).to.have.lengthOf( 4 ); // Default: 4 intervals
            expect( Array.from( svg.querySelectorAll( ".interval line" ) ) ).to.have.lengthOf( 16 ); // Default: 16 (4 per interval)

            // Increase the axis ticks
            bundle.setProperties(
                {
                    "major-ticks-count" : "10",
                    "minor-ticks-per-interval" : "2"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check the updated axis settings
            expect( Array.from( svg.querySelectorAll( ".major-tick" ) ) ).to.have.lengthOf( 12 ); // Updated: 10 major ticks (+ 2 main ticks)
            expect( Array.from( svg.querySelectorAll( ".interval" ) ) ).to.have.lengthOf( 11 ); // Updated: 11 intervals
            expect( Array.from( svg.querySelectorAll( ".interval line" ) ) ).to.have.lengthOf( 22 ); // Updated: 22 (2 per interval)
        } );
    } );

    it( "updates the font and color properties of the axis ticks and labels", function()
    {
        // Minimum test data is needed for the axis to be rendered
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            const axisChildNodes = svg.querySelector( ".axis" ).childNodes;

            // Make sure the axis contains the expected elements
            expect( axisChildNodes.length ).to.equal( 9 ); // Default axis has 9 elements

            // Check the default font settings of the axis tick labels
            for ( let i = 0; i < axisChildNodes.length; i++ )
            {
                let currentItem = axisChildNodes.item( i );

                // Check if every minor tick line is the same color
                if ( currentItem.getAttribute( "class" ) === "major-tick" )
                {
                    for ( let j = 0; j < axisChildNodes.item( i ).length; j++ )
                    {
                        expect( currentItem.querySelector( "line" ).getAttribute( "stroke" ) ).to.equal( "rgb(0,0,0)" ); // Default: black
                    }
                }

                // Check if the current major-tick line and text label have the right settings
                if ( currentItem.getAttribute( "class" ) === "major-tick" )
                {
                    expect( currentItem.querySelector( "line" ).getAttribute( "stroke" ) ).to.equal( "rgb(0,0,0)" ); // Default: black
                    expect( currentItem.querySelector( "text" ).style[ "font-size" ] ).to.equal( "3px" ); // Default: 3px font
                    expect( currentItem.querySelector( "text" ).style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" ); // Default: 3px IBM Plex Sans
                    expect( currentItem.querySelector( "text" ).style.fill ).to.equal( "rgb(0, 0, 0)" ); // Default: black
                }
            }

            // Change the axis font and color properties
            bundle.setProperties(
                {
                    "axis-font" : "5px \"IBM Plex Sans\"",
                    "axis-font-color" : "red",
                    "axis-tick-color" : "blue"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            const axisChildNodes = svg.querySelector( ".axis" ).childNodes;

            // Make sure the axis contains the expected elements
            expect( axisChildNodes.length ).to.equal( 9 ); // Updated axis still has 9 elements

            // Check the updated font settings of the axis tick labels
            for ( let i = 0; i < axisChildNodes.length; i++ )
            {
                let currentItem = axisChildNodes.item( i );

                // Check if every minor tick line is the same color
                if ( currentItem.getAttribute( "class" ) === "major-tick" )
                {
                    for ( let j = 0; j < axisChildNodes.item( i ).length; j++ )
                    {
                        expect( currentItem.querySelector( "line" ).getAttribute( "stroke" ) ).to.equal( "rgb(0,0,255)" ); // Updated: blue
                    }
                }

                // Check if the current major-tick line and text label have the right settings
                if ( currentItem.getAttribute( "class" ) === "major-tick" )
                {
                    expect( currentItem.querySelector( "line" ).getAttribute( "stroke" ) ).to.equal( "rgb(0,0,255)" ); // Updated: blue
                    expect( currentItem.querySelector( "text" ).style[ "font-size" ] ).to.equal( "5px" ); // Updated: 5px font
                    expect( currentItem.querySelector( "text" ).style.fill ).to.equal( "rgb(255, 0, 0)" ); // Updated: red
                }
            }
        } );
    } );

    it( "checks if no axis label overlapping occurs", function()
    {
        // Minimum test data is needed for the axis to be rendered
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            const axisChildNodes = svg.querySelector( ".axis" ).childNodes;
            let majorTickLabelCount = 0;

            // Gather all tick label information
            for ( let i = 0; i < axisChildNodes.length; i++ )
            {
                if ( axisChildNodes.item( i ).getAttribute( "class" ) === "major-tick" )
                {
                    if ( axisChildNodes.item( i ).querySelector( "text" ) )
                    {
                        majorTickLabelCount++;
                    }
                }
            }

            // Check the default axis tick settings
            expect( majorTickLabelCount ).to.equal( 3 + 2 ); // Default: 3 major tick labels (+ 2 main tick labels)

            // Increase the major-ticks count to a point where overlapping will always occur if not prevented
            bundle.setProperties(
                {
                    "major-ticks-count" : "100"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            const axisChildNodes = svg.querySelector( ".axis" ).childNodes;
            let majorTickLabelCount = 0;

            // Gather all tick information
            for ( let i = 0; i < axisChildNodes.length; i++ )
            {
                if ( axisChildNodes.item( i ).getAttribute( "class" ) === "major-tick" )
                {
                    if ( axisChildNodes.item( i ).querySelector( "text" ) )
                    {
                        majorTickLabelCount++;
                    }
                }
            }

            // Check if overlapping is prevented
            expect( majorTickLabelCount ).to.be.closeTo( 14, 10 ); // Updated: usually about 14 labels can be rendered on average at these settings
        } );
    } );

    it( "updates the labels show properties", function()
    {
        // Minimum test data is needed for the labels to receive content
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default settings of the labels
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent ).to.equal( "Value" ); // Default: visible
            expect( svg.querySelector( ".labels " ).childNodes.item( 1 ).textContent ).to.equal( "10" ); // Default: visible

            // Change the labels show properties
            bundle.setProperties(
                {
                    "KPI-label-show" : "false",
                    "value-label-show" : "false"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the labels are hidden
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent ).to.equal( "" ); // Updated: hidden
            expect( svg.querySelector( ".labels " ).childNodes.item( 1 ).textContent ).to.equal( "" ); // Updated: hidden
        } );
    } );

    it( "updates the font and color properties of KPI and Value label", function()
    {
        // Minimum test data is needed for the labels to receive content
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default font settings of the labels
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).style[ "font-size" ] ).to.equal( "4px" ); // Default: 4px font
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" ); // Default: IBM Plex Sans
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).style[ "font-size" ] ).to.equal( "4px" ); // Default: 4px font
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).style[ "font-family" ] ).to.equal( "\"IBM Plex Sans\"" ); // Default: IBM Plex Sans
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).style.fill ).to.equal( "rgb(0, 0, 0)" ); // Default: black
            expect( svg.querySelector( ".labels " ).childNodes.item( 1 ).style.fill ).to.equal( "rgb(0, 0, 0)" ); // Default: black

            // Change the labels font properties
            bundle.setProperties(
                {
                    "KPI-label-font" : "8px \"IBM Plex Sans\"",
                    "KPI-label-font-color" : "red",
                    "value-label-font" : "10px \"IBM Plex Sans\"",
                    "value-label-font-color" : "blue"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the labels font properties are updated
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).style[ "font-size" ] ).to.equal( "8px" ); // Updated: 8px font
            expect( svg.querySelector( ".labels " ).childNodes.item( 1 ).style[ "font-size" ] ).to.equal( "10px" ); // Updated: 10px font
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).style.fill ).to.equal( "rgb(255, 0, 0)" ); // Updated: red
            expect( svg.querySelector( ".labels " ).childNodes.item( 1 ).style.fill ).to.equal( "rgb(0, 0, 255)" ); // Updated: blue
        } );
    } );

    it( "applies trunction for all labels when needed", function()
    {
        // Truncation should apply at these values:
        const valueLabelMaxWidth = 45;
        const KPILabelMaxWidth = 50;

        // Minimum test data is needed for the labels to receive content
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check the default font settings of the labels
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).getBBox().width ).to.lessThan( valueLabelMaxWidth ); // Default: "Value"
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).getBBox().width ).to.lessThan( KPILabelMaxWidth ); // Default: "10"
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent ).to.equal( "Value" ); // Default: "Value"
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).textContent ).to.equal( "10" ); // Default: "10"

            // Update the bundle with label data that is longer than the max width allowed (this will force truncation to apply)
            bundle.setData( fullTestDataV2 );
            bundle.setProperties(
                {
                    "KPI-label-font" : "12px \"IBM Plex Sans\"",
                    "value-label-font" : "12px \"IBM Plex Sans\""
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the updated labels applied truncation
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).getBBox().width ).to.lessThan( valueLabelMaxWidth ); // If truncation has applied, this should be less than max label width
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).getBBox().width ).to.lessThan( KPILabelMaxWidth ); // If truncation has applied, this should be less than max label width
            expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent.length ).to.be.closeTo( 7, 2 ); // Updated: "HigherValue -> truncated to Highe..."
            expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).textContent.length ).to.be.closeTo( 6, 2 ); // Updated: "5000000 -> truncated to 500..."
        } );
    } );

    it( "updates the color properties for the pointer", function()
    {
        // Minimum test data is needed for the full pointer to generate
        bundle.setData( minimumTestData );

        return renderBundle( bundle ).then( function()
        {
            // Check if the current pointer colors are set to the default value
            expect( svg.querySelector( ".pointer" ).childNodes.item( 0 ).style.fill ).to.equal( "rgb(235, 70, 52)" ); // Default: #eb4634
            expect( svg.querySelector( ".pointer" ).childNodes.item( 0 ).style.stroke ).to.equal( "rgb(235, 70, 52)" ); // Default: #eb4634
            expect( svg.querySelector( ".pointer" ).childNodes.item( 1 ).style.fill ).to.equal( "rgb(235, 86, 52)" ); // Default: #eb5634
            expect( svg.querySelector( ".pointer" ).childNodes.item( 1 ).style.stroke ).to.equal( "rgb(235, 70, 52)" ); // Default: #eb4634

            // Update the pointer color properties
            bundle.setProperties(
                {
                    "pointer-circle-fill" : "red",
                    "pointer-circle-stroke" : "red",
                    "pointer-indicator-fill" : "blue",
                    "pointer-indicator-stroke" : "blue"
                } );

            return renderBundle( bundle );
        } ).then( function()
        {
            // Check if the pointer color values have been updated
            expect( svg.querySelector( ".pointer" ).childNodes.item( 0 ).style.fill ).to.equal( "rgb(0, 0, 255)" ); // Updated: blue
            expect( svg.querySelector( ".pointer" ).childNodes.item( 0 ).style.stroke ).to.equal( "rgb(0, 0, 255)" ); // Updated: blue
            expect( svg.querySelector( ".pointer" ).childNodes.item( 1 ).style.fill ).to.equal( "rgb(255, 0, 0)" ); // Updated: red
            expect( svg.querySelector( ".pointer" ).childNodes.item( 1 ).style.stroke ).to.equal( "rgb(255, 0, 0)" ); // Updated: red
        } );
    } );

    function expectBaseStructure()
    {
        // The base structure of the Gas Gauge should look like the following:
        expect( svg.querySelector( ".center" ).childNodes ).to.have.length( 6 ); // Border, Arc, Axis, Labels, Target, Pointer
        expect( svg.querySelector( ".border" ).childNodes ).to.have.length( 2 ); // Inner + Outer border
        expect( svg.querySelector( ".arc" ).childNodes ).to.have.length( 0 ); // Arc should be empty
        expect( svg.querySelector( ".axis" ).childNodes ).to.have.length( 0 ); // Axis hould be empty
        expect( svg.querySelector( ".labels" ).childNodes ).to.have.length( 2 ); // Labels: Value + KPI label
        expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent ).to.equal( "" ); // KPI Label should be empty
        expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).textContent ).to.equal( "" ); // Value label should be empty
        expect( svg.querySelector( ".target" ).childNodes ).to.have.length( 1 ); // Hidden target
        expect( svg.querySelector( ".pointer" ).childNodes ).to.have.length( 1 ); // Pointer circle
    }

    function expectDefaultFullStucture()
    {
        // The default full structure of the Gas Gauge should look like the following:
        expect( svg.querySelector( ".center" ).childNodes ).to.have.length( 6 ); // Border, Arc, Axis, Labels, Target, Pointer
        expect( svg.querySelector( ".border" ).childNodes ).to.have.length( 2 ); // Inner + Outer border
        expect( svg.querySelector( ".arc" ).childNodes ).to.have.length( 3 ); // Arc should have 3 pieces rendered
        expect( svg.querySelector( ".axis" ).childNodes ).to.have.length( 9 ); // Axis: 5x Major ticks (Of which 2x Main ticks) + 4 intervals of 4 Minor ticks
        expect( svg.querySelector( ".labels" ).childNodes ).to.have.length( 2 ); // Labels: Value + KPI label
        expect( svg.querySelector( ".labels" ).childNodes.item( 0 ).textContent ).to.equal( "Value" ); // KPI Label should have minimumTestData content
        expect( svg.querySelector( ".labels" ).childNodes.item( 1 ).textContent ).to.equal( "10" ); // Value label should have minimumTestData content
        expect( svg.querySelector( ".target" ).childNodes ).to.have.length( 1 ); // Hidden target
        expect( svg.querySelector( ".pointer" ).childNodes ).to.have.length( 2 ); // Pointer: Circle + Indicator
    }
} );

} );
