// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2019, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, DataSet, DataPoint, Point, Font, Length, LengthUnit } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

// General global settings
const ACTUAL_VALUE_SLOT                             = 0;
const MAX_AXIS_VALUE_SLOT                           = 1;
const CENTER_X                                      = 200;
const CENTER_Y                                      = 200;
const BORDER_START_RADIUS                           = 152;
const ARC_START_RADIUS                              = 116;
const ARC_END_RADIUS                                = 140;
const POINTER_INDICATOR_LENGTH                      = ARC_END_RADIUS - 4;
const POINTER_INDICATOR_SIZE                        = 6;
const POINTER_INDICATOR_ANIMATION_DURATION_IN_MS    = 1000;
const MAIN_AXIS_TICKS                               = 2; // results in default being min and max tick
const AXIS_TICKS_DISTANCE_FROM_CENTER               = 120;
const STANDARD_TICK_SIZE                            = 20;
const AXIS_TICK_TEXT_MAX_WIDTH                      = 60;
const AXIS_TICK_TEXT_DISTANCE_FROM_TICKS            = 10;
const AXIS_FONT_WEIGHT                              = 1.25;
const STANDARD_TRUNCATION_END_SECTION               = "...";
const STANDARD_FONT_SIZE                            = 12;

// CSS global class names
const VISUALIZATION_CLASS_NAME                      = "gas-gauge";
const AXIS_CLASS_NAME                               = "axis";
const POINTER_INDICATOR_CLASS_NAME                  = "pointer-indicator";
const POINTER_CIRCLE_CLASS_NAME                     = "pointer-circle";
const TARGET_INDICATOR_CLASS_NAME                   = "target-indicator";
const OUTER_BORDER_CLASS_NAME                       = "outer-border";
const INNER_BORDER_CLASS_NAME                       = "inner-border";

function applyFont( _selection: any, _font: Font ): void
{
    _selection
        .style( "font-size", _font.size ? _font.size.toString() : new Length( STANDARD_FONT_SIZE, LengthUnit.Pixel ).toString() )
        .style( "font-family", _font.family ? _font.family.toString() : null )
        .style( "font-style", _font.style ? _font.style.toString() : null )
        .style( "font-weight", _font.weight ? _font.weight.toString() : null );
}

export default class extends RenderBase
{
    // Private fields
    private _dataSet: DataSet;
    private _svg: d3.Selection<Element, unknown, null, undefined>;
    private _minAxisValue: number;
    private _maxAxisValue: number;
    private _angleScale: number;
    private _startAngleInDegrees: number;
    private _endAngleInDegrees: number;
    private _isAxisInverted: boolean;
    private _axisScaleLength: number;
    private _lastAngleValue: number = null; // last angle  value that was rendered
    private _KPILabel: d3.Selection<SVGTextElement, unknown, null, undefined>;
    private _valueLabel: d3.Selection<SVGTextElement, unknown, null, undefined>;
    private readonly _arcGenerator = d3.arc();

    protected create( _node: HTMLElement ): Element
    {
        // Create an svg canvas that sizes to its parent.
        // Note that Safari has issues determining the SVG's size upon rerender: we need position: absolute
        const svg = d3.select( _node ).append( "svg" )
            .style( "position", "absolute" )
            .attr( "viewBox", "0 0 400 400" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        // Create a group for the chart
        const chart = svg.append( "g" ).attr( "class", `${VISUALIZATION_CLASS_NAME}` );

        // Create a group for the center of the chart
        const center = chart.append( "g" )
            .attr( "class", "center" )
            .attr( "transform", `translate(${CENTER_X} ${CENTER_Y})` );

        // Create all group elements attached to the center
        const border = center.append( "g" ).attr( "class", "border" );
        center.append( "g" ).attr( "class", "arc" );
        center.append( "g" ).attr( "class", `${AXIS_CLASS_NAME}` );
        const labels = center.append( "g" ).attr( "class", "labels" );
        const target = center.append( "g" ).attr( "class", "target" );
        const pointer = center.append( "g" ).attr( "class", "pointer" );

        border.append( "circle" ).attr( "class", OUTER_BORDER_CLASS_NAME );
        border.append( "circle" ).attr( "class", INNER_BORDER_CLASS_NAME );

        pointer.append( "circle" )
            .attr( "class", POINTER_CIRCLE_CLASS_NAME )
            .attr( "cx", 0 )
            .attr( "cy", 0 )
            .attr( "r", "24" )
            .style( "stroke-width", "2" );

        this._KPILabel = labels.append( "text" )
            .attr( "class", "KPI-label" )
            .style( "fill", "black" )
            .style( "text-anchor", "middle" );

        this._valueLabel = labels.append( "text" )
            .attr( "class", "value-label" )
            .style( "fill", "black" )
            .style( "text-anchor", "middle" );

        target.append( "line" )
            .attr( "class", TARGET_INDICATOR_CLASS_NAME )
            .attr( "y1", AXIS_TICKS_DISTANCE_FROM_CENTER )
            .attr( "y2", AXIS_TICKS_DISTANCE_FROM_CENTER + STANDARD_TICK_SIZE )
            .attr( "stroke-width", "4" );

        // Return the svg node as the visualization root node.
        return svg.node();
    }

    protected update( _info: UpdateInfo ): void
    {
        // Update dataSet, svg and properties
        this.dataSet = _info.data;
        this.svg = d3.select( _info.node );
        this.minAxisValue = this.properties.get( "min-axis-value" );
        const maxAxisValueProperty = this.properties.get( "max-axis-value" );
        this.startAngleInDegrees = this._calculateStartAngle();

        if ( this.dataSet && this.dataSet.rows.length )
        {
            if ( this.dataSet.rows[ 0 ].value( "max-axis-value" ) )
            {
                this.maxAxisValue =  this.dataSet.rows[ 0 ].value( "max-axis-value" );
                this.properties.setActive( "max-axis-value", false );
            }
            else
            {
                this.maxAxisValue = maxAxisValueProperty;
                this.properties.setActive( "max-axis-value", true );
            }
        }

        if ( !this.dataSet || !this.dataSet.rows.length || this.minAxisValue === this.maxAxisValue )
        {
            // Empty all labels
            this.svg.select( "text.value-label" ).text( "" );
            this.svg.select( "text.KPI-label" ).text( "" );

            // Remove the pointer, axis and target indicator
            this.svg.select( "." + POINTER_INDICATOR_CLASS_NAME ).remove();
            this.svg.selectAll( "." + AXIS_CLASS_NAME ).selectAll( "g" ).remove();
            this.svg.select( ".arc" ).selectAll( "path" ).remove();
            this.svg.select( "." + TARGET_INDICATOR_CLASS_NAME ).attr( "visibility", "hidden" );

            // No data, reset lastAngleValue
            this._lastAngleValue = null;

            this._updateMainProperties();
            return;
        }

        // Update the inverted axis boolean
        this.isAxisInverted = this.maxAxisValue < this.minAxisValue;

        if ( _info.reason.properties )
        {
            this._updateAllProperties();

            if ( !_info.reason.data )
            {
                this._updateAngleScale();
                this._updatePointerIndicator();
                this._updateTargetIndicator();
                this._updateArc();
                this._updateAxis();
            }
        }

        if ( _info.reason.data )
        {
            if ( !_info.reason.properties )
            {
                this._updateLabels();
            }

            this._updateAngleScale();
            this._updatePointerIndicator();
            this._updateTargetIndicator();
            this._updateArc();
            this._updateAxis();
        }

        if ( _info.reason.decorations )
        {
            // Choose between _enableFullDecorations or _enableCoreDecorations functions for tooltip support
            this._enableFullDecorations();
        }

        if ( this._lastAngleValue === null )
        {
            this._lastAngleValue = this.startAngleInDegrees;
        }
    }

    private _updateAllProperties(): void
    {
        this._updateMainProperties();
        this._updateLabels();
    }

    private _updateLabels(): void
    {
        const valueColumn = this.dataSet.cols[ ACTUAL_VALUE_SLOT ];
        const KPILabelValue = valueColumn.caption;
        const ValueLabelValue = valueColumn.format( this.dataSet.rows[ 0 ].value( "value" ) );

        this.svg.select( "text.KPI-label" )
            .call( applyFont, this.properties.get( "KPI-label-font" ) )
            .style( "fill", this.properties.get( "KPI-label-font-color" ) )
            .text( this.properties.get( "KPI-label-show" ) ? KPILabelValue : "" );

        this.svg.select( "text.value-label" )
            .call( applyFont, this.properties.get( "value-label-font" ) )
            .style( "fill", this.properties.get( "value-label-font-color" ) )
            .text( this.properties.get( "value-label-show" ) ? ValueLabelValue : "" );

        const calculateMaxTextWidth = this._createCalculateMaxTextWidthFn();
        const kpiLabelMaxWidth = calculateMaxTextWidth( this.properties.get( "KPI-label-offset" ) );
        const valueLabelMaxWidth = calculateMaxTextWidth( this.properties.get( "value-label-offset" ) );
        this._truncateTextLabel( this._KPILabel, kpiLabelMaxWidth, STANDARD_TRUNCATION_END_SECTION );
        this._truncateTextLabel( this._valueLabel, valueLabelMaxWidth, STANDARD_TRUNCATION_END_SECTION );
    }

    /**
     * Called for updating the main properties that should always render even if there is no data
     */
    private _updateMainProperties(): void
    {
        this.svg.style( "background-color", this.properties.get( "background-color" ) );

        const borderSize = this.properties.get( "border-size" );

        this.svg.select( "." + OUTER_BORDER_CLASS_NAME )
            .style( "stroke", this.properties.get( "outer-border-stroke" ) )
            .style( "fill", this.properties.get( "elements-background-color" ) )
            .attr( "r", BORDER_START_RADIUS + borderSize )
            .style( "stroke-width", 1 / 6 * borderSize );

        this.svg.select( "." + INNER_BORDER_CLASS_NAME )
            .style( "stroke", this.properties.get( "inner-border-stroke" ) )
            .style( "fill", this.properties.get( "elements-background-color" ) )
            .attr( "r", BORDER_START_RADIUS + borderSize / 2 )
            .style( "stroke-width", 5 / 6 * borderSize );

        this.svg.select( "." + POINTER_CIRCLE_CLASS_NAME )
            .style( "stroke", this.properties.get( "pointer-circle-stroke" ) )
            .style( "fill", this.properties.get( "pointer-circle-fill" ) );

        const showBorder = this.properties.get( "show-border" );
        this.svg.select( ".border" )
            .style( "display", showBorder ? "inherit" : "none" );
        this.properties.setActive( "outer-border-stroke", showBorder );
        this.properties.setActive( "inner-border-stroke", showBorder );
        this.properties.setActive( "border-size", showBorder );

        this.svg.select( "text.KPI-label" ).attr( "y", this.properties.get( "KPI-label-offset" ) );
        this.svg.select( "text.value-label" ).attr( "y", this.properties.get( "value-label-offset" ) );

        const showPointerCircle = this.properties.get( "show-pointer-circle" );
        this.svg.select( "circle.pointer-circle" )
            .style( "display", showPointerCircle ? "inherit" : "none" );
        this.properties.setActive( "pointer-circle-fill", showPointerCircle );
        this.properties.setActive( "pointer-circle-stroke", showPointerCircle );

        const extraHeight = this._calculateChartExtraHeight();
        this.svg.attr( "viewBox", this._calculateViewBox( extraHeight ) );
        this.svg.select( "g.center" ).attr( "transform", this._calculateTranslation( extraHeight ) );
    }

    private _updateAngleScale(): void
    {
        this.axisScaleLength = this._delta( this.minAxisValue, this.maxAxisValue );
        this.angleScale = ( this.endAngleInDegrees - this.startAngleInDegrees ) / this.axisScaleLength;
    }

    private _updateTargetIndicator(): void
    {
        const targetSlotValue = this.dataSet.rows[ 0 ].value( "target" );
        const targetColor = this.properties.get( "target-color" );

        // If the target slot has no value, set the target-value property to true, otherwise set it to false
        if ( !targetSlotValue )
        {
            this.properties.setActive( "target-value", true );
        }
        else
        {
            this.properties.setActive( "target-value", false );
        }

        // If the target is set to hidden, change the visibility of the target and return
        if ( !this.properties.get( "target-show" ) )
        {
            this.svg.select( "." + TARGET_INDICATOR_CLASS_NAME ).attr( "visibility", "hidden" );
            return;
        }

        // Set target value to the target slot if it has a value (is mapped), otherwise use the target-value property
        const targetValue = targetSlotValue || this.properties.get( "target-value" );

        // Calculate the target indicator angle and secure the angle limits
        const targetIndicatorAngle = this._clamp( this._calculateAngle( targetValue ), this.startAngleInDegrees, this.endAngleInDegrees );

        this.svg.select( "." + TARGET_INDICATOR_CLASS_NAME )
            .attr( "y1", AXIS_TICKS_DISTANCE_FROM_CENTER )
            .attr( "y2", AXIS_TICKS_DISTANCE_FROM_CENTER + STANDARD_TICK_SIZE )
            .attr( "stroke", targetColor )
            .attr( "stroke-width", "4" )
            .attr( "visibility", "visible" )
            .attr( "transform", `rotate(${targetIndicatorAngle})` );
    }

    private _updateArc(): void
    {
        this.svg.select( ".arc" ).selectAll( "path" ).remove();

        this._createArcPiece( this.properties.get( "first-interval-start" ), this.properties.get( "first-interval-end" ), this.properties.get( "first-interval-color" ) );
        this._createArcPiece( this.properties.get( "second-interval-start" ), this.properties.get( "second-interval-end" ), this.properties.get( "second-interval-color" ) );
        this._createArcPiece( this.properties.get( "third-interval-start" ), this.properties.get( "third-interval-end" ), this.properties.get( "third-interval-color" ) );
    }

    /**
     * Used for creating a single arc piece that contributes to building the entire arc
     * @param _startValueInPercentage The starting value of the arc piece in percentage
     * @param _endValueInPercentage The ending value of the arc piece in percentage
     * @param _color The color of the arc piece
     */
    private _createArcPiece( _startValueInPercentage: number, _endValueInPercentage: number, _color: string ): void
    {
        const arcGeneratorStandardAngle = 180; // Standard arc start angle, use this to normalize the actual angle
        const startValueInDecimals = ( _startValueInPercentage > 100 ? 100 : _startValueInPercentage ) / 100;
        const endValueInDecimals = ( _endValueInPercentage > 100 ? 100 : _endValueInPercentage ) / 100;
        const startAngle = this._clamp( startValueInDecimals * ( this.endAngleInDegrees - this.startAngleInDegrees ) + this.startAngleInDegrees, this.startAngleInDegrees, this.endAngleInDegrees ) ;
        const endAngle = this._clamp( endValueInDecimals * ( this.endAngleInDegrees - this.startAngleInDegrees ) + this.startAngleInDegrees, this.startAngleInDegrees, this.endAngleInDegrees ) ;

        const intervalData = this._arcGenerator( {
            startAngle: ( this._degreesToRadians( startAngle - arcGeneratorStandardAngle ) ),
            endAngle: ( this._degreesToRadians( endAngle - arcGeneratorStandardAngle ) ),
            innerRadius: ARC_START_RADIUS,
            outerRadius: ARC_END_RADIUS
        } );

        this.svg.select( ".arc" )
            .datum( this.dataSet.rows[ 0 ] )
            .append( "path" )
            .attr( "d", intervalData )
            .style( "fill", _color );
    }

    /**
     * Used for updating the axis with new data
     */
    private _updateAxis(): void
    {
        // Get properties needed to create the axis
        const minorTicksPerInterval = this.properties.get( "minor-ticks-per-interval" );
        const extraMajorTicksValue  = this.properties.get( "major-ticks-count" );
        const axisTickColor         = this.properties.get( "axis-tick-color" );
        const axisFontColor         = this.properties.get( "axis-font-color" );
        const font                  = this.properties.get( "axis-font" );

        // Create the axis
        this._createCustomAxis( extraMajorTicksValue, minorTicksPerInterval, axisTickColor, axisFontColor, font );
    }

    /**
     * Used for updating the pointer indicator when the actual value slot has been updated or the axis has changed
     */
    private _updatePointerIndicator(): void
    {
        // Get value from value slot
        const valueSlotValue = this.dataSet.rows[ 0 ].value( "value" );

        // Calculate the pointer indicator angle and secure the angle limits
        const pointerIndicatorAngle = this._clamp( this._calculateAngle( valueSlotValue ), this.startAngleInDegrees, this.endAngleInDegrees );

        const pointerIndicator: any = this.svg.select( ".pointer" )
            .selectAll( "polygon" )
            .data( this.dataSet.rows, ( row: DataPoint ) => row.key );

        const lastAngleValue = this._lastAngleValue;
        this._lastAngleValue = pointerIndicatorAngle;

        pointerIndicator.enter()
            .insert( "polygon", ":first-child" )
            .attr( "points", `-${POINTER_INDICATOR_SIZE},0 ${POINTER_INDICATOR_SIZE},0 0,${POINTER_INDICATOR_LENGTH}` )
            .attr( "transform", `rotate(${this.startAngleInDegrees})` )
            .attr( "class", POINTER_INDICATOR_CLASS_NAME )
            .style( "stroke-width", "2" )
            .merge( pointerIndicator )
            .style( "stroke", this.properties.get( "pointer-indicator-stroke" ) )
            .style( "fill", this.properties.get( "pointer-indicator-fill" ) )
            .transition()
            .duration( POINTER_INDICATOR_ANIMATION_DURATION_IN_MS )
            .tween( "pointerindicator.transform", function()
            {
                const elem = d3.select( this );
                const interpolator = d3.interpolateString(
                    `rotate( ${lastAngleValue} )`,
                    `rotate( ${pointerIndicatorAngle} )` );
                return ( value: number ): d3.Selection<any, unknown, null, undefined> => elem.attr( "transform", interpolator( value ) );
            } );
    }

    /**
     * Used for creating the custom axis that is needed in this visualization
     * @param _extraMajorTicks The amount of extra major ticks that need to applied to the axis ticks. (Standard has the main axis ticks only)
     * @param _minorTicksPerInterval The amount of minor ticks per interval (in between major ticks)
     * @param _axisTickColor The color of the axis ticks
     * @param _axisFontColor The font color of the major axis tick labels
     * @param _font The font of the major axis tick labels
     */
    private _createCustomAxis( _extraMajorTicks: number, _minorTicksPerInterval: number, _axisTickColor: string, _axisFontColor: string, _font: Font ): void
    {
        const totalMajorTicks = Math.max( _extraMajorTicks + MAIN_AXIS_TICKS, MAIN_AXIS_TICKS );
        let previousTickAngle: number;
        let previousMajorTickLabel: any;

        // Clear all elements
        this.svg.select( "." + AXIS_CLASS_NAME ).selectAll( "g" ).remove();

        for ( let i = 0; i < totalMajorTicks; i++ )
        {
            // Set up all the variables needed to create the axis
            const totalTicksIndexed = totalMajorTicks - 1; // Start at 0 instead of 1
            const currentTickAsMultiplier = i / ( totalTicksIndexed );
            const value = this._clamp( currentTickAsMultiplier * this.axisScaleLength
                + ( this.isAxisInverted ? this.minAxisValue : this.maxAxisValue ) - this.axisScaleLength
            , this.isAxisInverted ? this.maxAxisValue : this.minAxisValue
            , this.isAxisInverted ? this.minAxisValue : this.maxAxisValue );
            const fontSize = _font && _font.size ? _font.size.value : STANDARD_FONT_SIZE;
            const currentTickAngleLineLocation = this._clamp( this._calculateLineAngle( value ), this.startAngleInDegrees, this.endAngleInDegrees );
            const currentTickAngleTextLocation = this._clamp( this._calculateAngle( value ), this.startAngleInDegrees, this.endAngleInDegrees );
            const majorTickSelection = this.svg.select( "." + AXIS_CLASS_NAME )
                .append( "g" )
                .attr( "class", "major-tick" );

            // Create main ticks
            majorTickSelection.append( "line" )
                .datum( this.dataSet.rows[ 0 ] )
                .attr( "y1", AXIS_TICKS_DISTANCE_FROM_CENTER )
                .attr( "y2", AXIS_TICKS_DISTANCE_FROM_CENTER + STANDARD_TICK_SIZE )
                .attr( "stroke", _axisTickColor )
                .attr( "stroke-width", "4" )
                .attr( "shape-rendering", "geometricPrecision" )
                .attr( "transform", `rotate(${currentTickAngleLineLocation})` );

            const showMajorTicksText = this.properties.get( "show-major-tick-text" );
            const maxAxisValueColumn = this.dataSet.cols[ MAX_AXIS_VALUE_SLOT ];

            const formattedMajorTickText = maxAxisValueColumn.mapped ? maxAxisValueColumn.format( value )
                : this.dataSet.cols[ ACTUAL_VALUE_SLOT ].format( value );

            // Create text labels
            if ( showMajorTicksText || ( !showMajorTicksText && ( i === 0 || i === totalTicksIndexed ) ) )
            {
                const majorTickLabel = majorTickSelection.append( "text" )
                    .datum( this.dataSet.rows[ 0 ] )
                    .call( applyFont, _font )
                    .style( "fill", _axisFontColor )
                    .style( "text-anchor", "middle" )
                    .text( formattedMajorTickText );

                this._truncateTextLabel( majorTickLabel, AXIS_TICK_TEXT_MAX_WIDTH, STANDARD_TRUNCATION_END_SECTION );

                const y = AXIS_TICKS_DISTANCE_FROM_CENTER - AXIS_TICK_TEXT_DISTANCE_FROM_TICKS
                    - majorTickLabel.node().getBBox().width / 4
                    - this._calculateFontImpactOnAxisTickLabel( fontSize, currentTickAngleLineLocation );
                const point = this._calculateCoordinatesAfterRotation( 0, y, currentTickAngleTextLocation );

                majorTickLabel.attr( "x", point.x )
                    .attr( "y", point.y + majorTickLabel.node().getBBox().height / 4 );

                // Check if labels overlap
                if ( previousMajorTickLabel && this._checkLabelOverlap( majorTickLabel, previousMajorTickLabel ) )
                {
                    // Main tick always has priority over Major tick, therefore the previous label will be removed
                    if ( i === totalTicksIndexed )
                    {
                        previousMajorTickLabel.remove();
                    }
                    else majorTickLabel.remove();
                }
                else previousMajorTickLabel = majorTickLabel;
            }

            // Create minor ticks
            if ( _minorTicksPerInterval > 0 && previousTickAngle )
            {
                const currentIntervalTotalAngle = this._delta( currentTickAngleLineLocation, previousTickAngle );
                const minorTickMultiplier = currentIntervalTotalAngle / ( _minorTicksPerInterval + 1 );

                const axisIntervalSelection = this.svg.select( "." + AXIS_CLASS_NAME )
                    .append( "g" )
                    .attr( "class", "interval" );

                for ( let j = 1; j <= _minorTicksPerInterval; ++j )
                {
                    const currentMinorTickAngle = previousTickAngle + minorTickMultiplier * j;

                    axisIntervalSelection.append( "line" )
                        .datum( this.dataSet.rows[ 0 ] )
                        .attr( "y1", AXIS_TICKS_DISTANCE_FROM_CENTER + 8 )
                        .attr( "y2", AXIS_TICKS_DISTANCE_FROM_CENTER + STANDARD_TICK_SIZE )
                        .attr( "stroke", _axisTickColor )
                        .attr( "stroke-width", "2" )
                        .attr( "shape-rendering", "geometricPrecision" )
                        .attr( "transform", `rotate(${currentMinorTickAngle})` );
                }
            }

            // End of loop, currentTickAngleLineLocation becomes the previousTickAngle
            previousTickAngle = currentTickAngleLineLocation;
        }
    }

    /**
     * Used for calculating the font impact on an axis tick label, the bigger the font, the more distance the tick label will have from a tick
     * @param _fontSize The current font size
     * @param _tickAngle The current angle of the tick, depending on the angle more or less distance should be given to the tick label
     * @returns {number} The calculated impact multiplier the font has on the axis tick label
     */
    private _calculateFontImpactOnAxisTickLabel( _fontSize: number, _tickAngle: number ): number
    {
        const side = 180;
        const fontWeight = _fontSize / AXIS_FONT_WEIGHT;

        if ( _tickAngle <= side && _tickAngle > ( side * 0.75 ) || _tickAngle >= side && _tickAngle < ( side + ( side * 0.25 ) ) )
        {
            return 0.25 * fontWeight;
        }
        if ( _tickAngle <= side )
        {
            return ( _tickAngle / side ) * fontWeight;
        }
        return ( ( side * 2 - _tickAngle ) / side * fontWeight );
    }

    private _calculateAngle( _value: number ): number
    {
        if ( !this.isAxisInverted )
        {
            return this.startAngleInDegrees + ( _value - this.minAxisValue ) * this.angleScale;
        }
        return this.endAngleInDegrees - ( _value - this.maxAxisValue ) * this.angleScale;
    }

    private _calculateLineAngle( _value: number ): number
    {
        return this.startAngleInDegrees + ( _value - ( !this.isAxisInverted ? this.minAxisValue : this.maxAxisValue ) ) * this.angleScale;
    }

    /**
     * Used for securing a value to never go out of a given range
     * @param _value the value to be secured
     * @param _min the minimum of the range for the value to be in
     * @param _max the maximum of the range for the value to be in
     */
    private _clamp( _value: number, _min: number, _max: number ): number
    {
        return Math.min( Math.max( _value, _min ), _max );
    }

    /**
     * Used to apply truncation to a given text element, will only apply truncation if it meets the requirements
     * @param _textElement The text element that needs to be possibly be truncated
     * @param _maxWidth The max width that the text element is suposed to be. (If it goes over max width, truncation will apply till it no longer does)
     * @param _endingSection The optional ending section that will be applied to the end of the truncated label
     */
    private _truncateTextLabel( _textElement: d3.Selection<SVGTextElement, unknown, null, undefined>, _maxWidth: number, _endingSection = "" ): void
    {
        let currentText = _textElement.text();

        // Check if the width of the text is too long
        if ( _textElement.node().getBBox().width > _maxWidth )
        {
            // Keep reducing the width of the text as long as the width is longer than the maxWidth
            let iterator = currentText.length;
            while ( _textElement.node().getBBox().width > _maxWidth && iterator > 0 )
            {
                currentText = currentText.substring( 0, iterator ).trim();
                _textElement.text( currentText + _endingSection );
                iterator--;
            }
        }
    }

    /**
     * Use a formula to determine the coordinates of an element after it rotated
     * @param _x The X coordinate before rotation
     * @param _y The Y coordinate before rotation
     * @param _angleInDegrees The angle that shows the amount of rotation that has taken place
     * @returns {Point} The point with the new X and Y coordinates inside of it
     */
    private _calculateCoordinatesAfterRotation( _x: number, _y: number, _angleInDegrees: number ): Point
    {
        const point = new Point();
        const angleInRadians = this._degreesToRadians( _angleInDegrees );

        point.y = _y * Math.cos( angleInRadians ) + _x * Math.sin( angleInRadians );
        point.x = _x * Math.cos( angleInRadians ) - _y * Math.sin( angleInRadians );

        return point;
    }

    /**
     * Check if overlapping occurs between labels
     * @param _firstLabel The first label that needs to be checked for overlapping
     * @param _secondLabel The second label that needs to be checked for overlapping
     * @param _deviation The optional deviation to be used for eliminating borderline cases, e.g. elements that look like they are overlapping but in reality are not
     */
    private _checkLabelOverlap( _firstLabel: d3.Selection<SVGTextElement, unknown, null, undefined>, _secondLabel: d3.Selection<SVGTextElement, unknown, null, undefined>, _deviation = 8 ): boolean
    {
        const firstLabelBBox = _firstLabel.node().getBBox();
        const secondLabelBBox = _secondLabel.node().getBBox();

        // Get deltas from x and y coordinates, then investigate if these are smaller than the Box height and width, if both apply then overlapping occurs
        const checkHeight: boolean = this._delta( secondLabelBBox.y, firstLabelBBox.y ) < firstLabelBBox.height + _deviation;
        const checkWidth: boolean = this._delta( secondLabelBBox.x, firstLabelBBox.x ) < firstLabelBBox.width + _deviation;

        return checkHeight && checkWidth;
    }

    /**
     * Core decorations for the visualization, this will enable tooltip support for the core only
     */
    private _enableCoreDecorations(): void
    {
        this.svg.select( ".pointer" ).select( "circle" ).datum( this.dataSet.rows[ 0 ] );
        this.svg.select( ".pointer" ).select( "polygon" ).datum( this.dataSet.rows[ 0 ] );
        this.svg.select( ".labels" ).select( "text.KPI-label" ).datum( this.dataSet.rows[ 0 ] );
        this.svg.select( ".labels" ).select( "text.value-label" ).datum( this.dataSet.rows[ 0 ] );
        this.svg.select( ".target" ).select( "line" ).datum( this.dataSet.rows[ 0 ] );
    }

    /**
     * Additional decorations for the visualization, this will enable tooltip support for the entire visualization
     */
    private _enableFullDecorations(): void
    {
        this._enableCoreDecorations();
        this.svg.select( ".border" ).select( "circle.inner-border" ).datum( this.dataSet.rows[ 0 ] );
        this.svg.select( ".border" ).select( "circle.outer-border" ).datum( this.dataSet.rows[ 0 ] );
    }

    /**
     * Formula for converting degrees to radians
     * @param _degrees Amount of degrees that need to be converted
     */
    private _degreesToRadians( _degrees: number ): number
    {
        return _degrees * Math.PI / 180;
    }

    private _delta( _value1: number, _value2: number ): number
    {
        return Math.abs( _value1 - _value2 );
    }

    private _calculateStartAngle(): number
    {
        return ( 360 - this.properties.get( "sweep-angle" ) ) / 2;
    }

    // Calculate the circle extra height (vertical distance from the bottom of the circle to center)
    // Chart has minimum extra height at sweep angle <= 180
    // maximum height at maximum angle ( 350 degree )
    private _calculateCircleExtraHeight(): number
    {
        const startAngle = this._calculateStartAngle();
        return ARC_END_RADIUS * Math.cos( this._degreesToRadians( startAngle ) );
    }

    // Calculate extra height of the chart (distance from chart bottom to center)
    // Comparing extra height of the circle and label offset
    private _calculateChartExtraHeight(): number
    {
        if ( this.properties.get( "show-border" ) )
            return ARC_END_RADIUS; // always return full height when gauge border is shown
        const circleExtraHeight = this._calculateCircleExtraHeight();
        const labelOffset = this.properties.get( "KPI-label-show" ) ? this.properties.get( "KPI-label-offset" ) : 0;
        const valueOffset = this.properties.get( "value-label-show" ) ? this.properties.get( "value-label-offset" ) : 0;
        return this._clamp( Math.max( circleExtraHeight, labelOffset, valueOffset ), 0, ARC_END_RADIUS );
    }

    private _calculateViewBox( _extraGaugeHeight: number ): string
    {
        const maxGaugeExtraHeight = ARC_END_RADIUS;

        const showBorder = this.properties.get( "show-border" );
        const borderOffset = showBorder ? 0 : -40;

        const maxExtraHeight = 200 + borderOffset / 2; // Height including padding
        const minHeight = 200 + borderOffset / 2;
        const width = 400;
        let height = minHeight + Math.round( _extraGaugeHeight / maxGaugeExtraHeight * maxExtraHeight );

        const showPointerCircle = this.properties.get( "show-pointer-circle" );
        if ( showPointerCircle )
            height = Math.max( height, minHeight + 12 );

        return `0 0 ${width + borderOffset * 2} ${height + borderOffset / 2}`;
    }

    private _calculateTranslation( _extraGaugeHeight: number ): string
    {
        const maxExtraHeight = ARC_END_RADIUS;
        const maxYOffset = 40;
        const yOffset = maxYOffset - Math.round( _extraGaugeHeight / maxExtraHeight * maxYOffset );
        const showBorder = this.properties.get( "show-border" );
        const borderOffset = showBorder ? 0 : -40;
        return `translate(${CENTER_X + borderOffset} ${CENTER_Y - yOffset + borderOffset / 2})`;
    }

    // Create function that calculate maximum text width of KPI and value label
    // Based on their offset (y position) and current sweep angle, border visibility
    private _createCalculateMaxTextWidthFn(): ( _textOffset: number ) => number
    {
        return ( _textOffset: number ): number =>
        {
            const padding = 12;
            const circleExtraHeight = this._calculateCircleExtraHeight();
            const innerRadius = ARC_START_RADIUS - padding * 2;
            // Vertical distance from first tick to circle center
            const firstTickHeight = ARC_START_RADIUS * Math.cos( this._degreesToRadians( this._calculateStartAngle() ) );

            // Text is under the whole gauge
            if ( _textOffset > circleExtraHeight + padding )
            {
                if ( this.properties.get( "show-border" ) )
                    return Math.sqrt( Math.pow( BORDER_START_RADIUS, 2 ) - Math.pow( _textOffset, 2 ) ) * 2;
                else
                    return 400;
            }
            // Text is between first tick and bottom of gauge
            else if ( _textOffset > firstTickHeight )
                return Math.sqrt( Math.pow( ARC_END_RADIUS - padding, 2 ) - Math.pow( _textOffset, 2 ) ) * 2;
            // Text is inside the inner circle
            else
                return Math.sqrt( Math.pow( innerRadius, 2 ) - Math.pow( _textOffset, 2 ) ) * 2;
        };
    }

    //#region GETTERS AND SETTERS
    public get dataSet(): DataSet
    {
        return this._dataSet;
    }

    public set dataSet( _dataSet: DataSet )
    {
        this._dataSet = _dataSet;
    }

    public get svg(): d3.Selection<Element, unknown, null, undefined>
    {
        return this._svg;
    }

    public set svg( _svg: d3.Selection<Element, unknown, null, undefined> )
    {
        this._svg = _svg;
    }

    public get minAxisValue(): number
    {
        return this._minAxisValue;
    }

    public set minAxisValue( _minAxisValue: number )
    {
        this._minAxisValue = _minAxisValue;
    }

    public get maxAxisValue(): number
    {
        return this._maxAxisValue;
    }
    public set maxAxisValue( _maxAxisValue: number )
    {
        this._maxAxisValue = _maxAxisValue;
    }

    public get angleScale(): number
    {
        return this._angleScale;
    }

    public set angleScale( _angleScale: number )
    {
        this._angleScale = _angleScale;
    }

    public get startAngleInDegrees(): number
    {
        return this._startAngleInDegrees;
    }

    public set startAngleInDegrees( _startAngleInDegrees: number )
    {
        this._startAngleInDegrees = _startAngleInDegrees;
        this._endAngleInDegrees = 360 - _startAngleInDegrees;
    }

    public get endAngleInDegrees(): number
    {
        return this._endAngleInDegrees;
    }

    public get isAxisInverted(): boolean
    {
        return this._isAxisInverted;
    }

    public set isAxisInverted( _isAxisInverted: boolean )
    {
        this._isAxisInverted = _isAxisInverted;
    }

    public get axisScaleLength(): number
    {
        return this._axisScaleLength;
    }

    public set axisScaleLength( _axisScaleLength: number )
    {
        this._axisScaleLength = _axisScaleLength;
    }
    //#endregion
}
