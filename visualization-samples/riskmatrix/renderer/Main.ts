// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, Color, CatEncoding, CatEncodingEntry, UpdateInfo, Properties, DataSet, DataPoint, Tuple, Point, Encoding, Font } from "@businessanalytics/customvis-lib";
import { AxesComponent, AxisProperty, Orientation } from "@businessanalytics/d3-axis-layout";
import { RiskData, RiskTileData } from "./RiskData";
import { ScaleSteps, scaleStepsMap } from "./ScaleSteps";
import * as d3 from "d3";

const TILE_GUTTER_WIDTH = 2;
const MINIMUM_LIGHTNESS_DIFFERENCE = 50;

function getContrastColor( tileColor: string, labelColor: string ): string
{
    let calulcatedLabelColor: string;

    let labelLightness = 0;
    let tileLightness = 0;

    function getColorLightness( color: Color ): number
    {
        return 0.3 * +color.r + 0.59 * +color.g + 0.11 * +color.b;
    }

    const tileColorObj = Color.fromString( tileColor );

    if ( tileColorObj )
        tileLightness = getColorLightness( tileColorObj );

    const labelColorObj = Color.fromString( labelColor );
    if ( labelColorObj )
    {
        labelLightness = getColorLightness( labelColorObj );
    }

    if ( Math.abs( tileLightness - labelLightness ) < MINIMUM_LIGHTNESS_DIFFERENCE )
        calulcatedLabelColor = tileLightness > 127 ? "black" : "white";

    return calulcatedLabelColor;
}

export default class extends RenderBase
{
    private _tilesLayer: any;
    private _labelsLayer: any;
    private _chartNode: any;
    private _padding: any;
    private _riskData: RiskData = null;
    private readonly _axesComponent: AxesComponent;
    private readonly _bottomAxisProperties: AxisProperty;
    private readonly _leftAxisProperties: AxisProperty;

    constructor()
    {
        super();

        // Create the axes component
        this._bottomAxisProperties = new AxisProperty();
        this._leftAxisProperties = new AxisProperty();
        this._axesComponent = AxesComponent()
            .axisProperty( Orientation.Left, this._leftAxisProperties )
            .axisProperty( Orientation.Bottom, this._bottomAxisProperties );
    }

    protected create( _node: HTMLElement ): HTMLElement
    {
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        this._chartNode = svg.append( "svg:g" )
            .attr( "class", "chart" );
        const chartContentArea = this._chartNode.append( "svg:g" )
            .attr( "class", "chartContent" );
        this._tilesLayer = chartContentArea
            .append( "svg:g" )
            .attr( "class", "tiles" );
        this._labelsLayer = chartContentArea
            .append( "svg:g" )
            .attr( "class", "labels" );
        this._chartNode.append( "svg:g" )
            .attr( "class", "axes" );

        // return the root node so it can be used in `update`.
        return _node;
    }

    protected updateLegend( _data: DataSet ): Encoding[]
    {
        // Call base class implementation to setup initial encodings.
        const encodings = [];
        const encoding = new CatEncoding( "color", null, "Risk Matrix", null, null );

        const colorKeys = scaleStepsMap.keys(); // Note: works until scale steps are the same for axes and color scale
        for ( const colorKey of colorKeys )
        {
            const colorString = this.getFillColor( colorKey );
            const entryColor = Color.fromString( colorString );
            encoding.entries.push( new CatEncodingEntry( colorKey, entryColor, null, false, false, null ) );
        }

        encodings.push( encoding );
        return encodings;
    }

    private getFillColor( _riskCategory: ScaleSteps ): string
    {
        switch ( _riskCategory )
        {
            case ScaleSteps.Low:
                return this.properties.get( "low" ).toString();
            case ScaleSteps.Medium:
                return this.properties.get( "medium" ).toString();
            case ScaleSteps.High:
                return this.properties.get( "high" ).toString();
            case ScaleSteps.VeryHigh:
                return this.properties.get( "veryHigh" ).toString();
            default:
                return "none";
        }
    }

    protected update( _info: UpdateInfo ): void
    {
        const node = _info.node as HTMLElement;
        const data = _info.data as DataSet;

        const properties = _info.props;

        if ( _info.reason.properties )
            this._updateProperties( properties );

        if ( _info.reason.data )
            this._riskData = RiskData.process( data );

        if ( _info.reason.size || _info.reason.properties )
            this._applySize( node );

        if ( _info.reason.data || _info.reason.properties || _info.reason.size )
        {
            this._updateAxes( this._riskData, properties );
            // After updating the axes and setting the size, a re-render needs to be triggered on the AxesComponent.
            this._chartNode.selectAll( ".axes" ).call( this._axesComponent );
            this._updateTiles( this._riskData, properties );
            this._updateLabels( this._riskData, properties );
        }

        if ( _info.reason.decorations )
            this._updateDecorations( this._riskData, properties );
    }

    private _updateTiles( _data: RiskData, _properties: Properties ): void
    {
        if( !_data )
            return;

        const elements = this._tilesLayer.selectAll( ".tile" ).data( _data.riskTiles );

        this._removeElements( elements.exit() );
        this._createElements( elements.enter(), _properties );
        this._updateElements( elements, _properties );
    }

    private _removeElements( _selection: any ): any
    {
        return _selection.remove();
    }

    private _createElements( _selection: any, _properties: Properties ): void
    {
        // Draw the matrix by creating a rect for each data element.
        const elements = _selection.append( "rect" )
            .attr( "class", "tile" )
            .attr( "fill", "none" );

        // For all created elements: Call update as well.
        this._updateElements( elements, _properties );
    }

    private _updateElements( _selection: any, _properties: Properties ): void
    {
        const bottomScale = this._axesComponent.getScale( Orientation.Bottom );
        const leftScale = this._axesComponent.getScale( Orientation.Left );

        _selection
            .attr( "x", d => bottomScale( d.impactCaption ) )
            .attr( "y", d => leftScale( d.probabilityCaption ) + TILE_GUTTER_WIDTH )
            .attr( "width", bottomScale.bandwidth() - TILE_GUTTER_WIDTH )
            .attr( "height", leftScale.bandwidth() - TILE_GUTTER_WIDTH )
            .attr( "fill", d => this.getFillColor( d.riskRating ) );
    }

    private _updateLabels( _data: RiskData, _properties: Properties ): void
    {
        if( !_data )
            return;

        const elements = this._labelsLayer.selectAll( ".label" ).data( _data.riskTiles );

        this._removeTileLabels( elements.exit() );
        this._createTileLabels( elements.enter(), _properties );
        this._updateTileLabels( elements, _properties );
    }

    private _removeTileLabels( _selection: any ): any
    {
        return _selection.remove();
    }

    private _createTileLabels( _selection: any, _properties: Properties ): void
    {
        // TODO: hide labels if they don't fit anymore
        const labels = _selection.append( "text" )
                .attr( "class", "label" )
                .attr( "dy", "0.4em" )
                .text( ( d: RiskTileData ) => d.childrenCount )
                .style( "text-anchor", "middle" );

        // For all created elements: Call update as well.
        this._updateTileLabels( labels, _properties );
    }

    private _getContrastLabelColor( d: RiskTileData, labelColor: string | null ): string
    {
            const tileColor = this.getFillColor( d.riskRating );
            return getContrastColor( tileColor, labelColor ?? tileColor );
    }

    private _updateTileLabels( _selection: any, _properties: Properties ): void
    {
        const bottomScale = this._axesComponent.getScale( Orientation.Bottom );
        const leftScale = this._axesComponent.getScale( Orientation.Left );
        const font =  _properties.get( "valueLabels.font" ) as Font;
        const contrastColorProp = _properties.get( "contrast.label.color" ) as boolean;
        _selection
            .attr( "x", d => bottomScale( d.impactCaption ) + ( bottomScale.bandwidth() / 2 ) )
            .attr( "y", d => leftScale( d.probabilityCaption ) + ( leftScale.bandwidth() / 2 ) )
            .style( "fill", d =>
                {
                    if( contrastColorProp )
                        return this._getContrastLabelColor( d, _properties.get( "valueLabels.color" ).toString() );
                    else
                        return _properties.get( "valueLabels.color" ).toString();
                } );

        if( font )
            _selection
                .style( "font-size", font.size ? font.size.toString() : null )
                .style( "font-family", font.family ? font.family.toString() : null )
                .style( "font-style", font.style ? font.style.toString() : null )
                .style( "font-weight", font.weight ? font.weight.toString() : null );
    }

    private _updateProperties( _properties: Properties ): void
    {
        this._padding = {
            left: _properties.get( "visualization.padding.left" ).value,
            right: _properties.get( "visualization.padding.right" ).value,
            top: _properties.get( "visualization.padding.top" ).value,
            bottom: _properties.get( "visualization.padding.bottom" ).value
        };
    }
    private _updateAxisProperty( _axisProperties: AxisProperty, _prefix: string, _properties: Properties, _axisTitle: string ): any
    {
        const titleProp = _properties.get( _prefix + ".title" );

        _axisProperties
            .title( titleProp !== "" ? titleProp : _axisTitle )
            .showTitle( _properties.get( _prefix + ".title.visible" ) )
            .showTicks( _properties.get( _prefix + ".ticks.visible" ) )
            .ticksColor( _properties.get( _prefix + ".ticks.color" ).toString() )
            .showTickLabels( _properties.get( _prefix + ".ticks.labels.visible" ) )
            .tickLabelMode( _prefix === "left" || _prefix === "right" ? "horizontal" : _properties.get( _prefix + ".ticks.labels.layoutMode" ) )
            .showAxisLine( _properties.get( _prefix + ".line.visible" ) )
            .axisLineColor( _properties.get( _prefix + ".line.color" ) )
            .tickLabelFont( this._createFontCss( _properties.get( _prefix + ".ticks.labels.font" ) ) )
            .tickLabelColor( _properties.get( _prefix + ".ticks.labels.color" ).toString() )
            .titleFont( this._createFontCss( _properties.get( _prefix + ".title.font" ) ) )
            .titleColor( _properties.get( _prefix + ".title.color" ).toString() );
    }

    private _createFontCss( _font: Font ): any
    {
        if ( !_font )
            return { "font-size": "0.75em", "font-family": "", "font-style": "", "font-weight": "" };

        const fontSize = _font.size?.toString();
        const fontFamily = _font.family?.toString();
        const fontStyle = _font.style?.toString();
        const fontWeight = _font.weight?.toString();

        return { "font-size": fontSize, "font-family": fontFamily, "font-style": fontStyle, "font-weight": fontWeight };
    }

    private _updateAxes( _data: RiskData, _properties: Properties ): void
    {
        if( !_data )
            return;

        let leftAxisTitle = "";
        let bottomAxisTitle = "";
        let bottomAxis: d3.Axis<string>;
        let leftAxis: d3.Axis<d3.AxisDomain>;

        if ( _data )
        {
            const domain = Array.from( scaleStepsMap.keys() );

            const bottomScale = d3.scaleBand().domain( domain );
            const leftScale = d3.scaleBand().domain( domain );

            bottomAxis = d3.axisBottom( bottomScale );
            leftAxis = d3.axisLeft( leftScale );

            leftAxisTitle = _data.probabilityCaption;
            bottomAxisTitle = _data.impactCaption;
        }
        else
        {
            const bottomScale = d3.scaleBand().padding( TILE_GUTTER_WIDTH );
            const leftScale = d3.scaleBand().padding( TILE_GUTTER_WIDTH );
            bottomAxis = d3.axisBottom( bottomScale );
            leftAxis = d3.axisLeft( leftScale );
        }

        this._axesComponent.axes( [ leftAxis, bottomAxis ] );

        this._updateAxisProperty( this._leftAxisProperties, "left", _properties, leftAxisTitle );
        this._updateAxisProperty( this._bottomAxisProperties, "bottom", _properties, bottomAxisTitle );
    }

    private _applySize( _node: HTMLElement ): void
    {
        const margin = {
            left: this._padding ? this._padding.left : 20,
            right: this._padding ? this._padding.right : 20,
            top: this._padding ? this._padding.top : 10,
            bottom: this._padding ? this._padding.bottom : 10
        };

        this._chartNode.attr( "transform", `translate(${margin.left}, ${margin.top})` );

        const { clientHeight, clientWidth } = _node;
        this._axesComponent.bounds( {
            width: clientWidth - margin.left - margin.right,
            height: clientHeight - margin.top - margin.bottom
        } );
    }

    private _updateDecorations( _data: RiskData, _properties: Properties ): void
    {
        const tiles = this._tilesLayer.selectAll( ".tile" );
        const tileLabels = this._labelsLayer.selectAll( ".label" );
        const hasSelection = _data.hasSelection;

        tiles.style( "stroke-opacity", function( d: RiskTileData )
            {
                if ( hasSelection === false )
                    return 0.8;
                return ( d.selected || d.highlighted ) ? 0.8 : 0.15;
            } );

        tiles
            .style( "fill-opacity", function( d: RiskTileData )
            {
                return ( hasSelection && !d.selected ) ? 0.3 : 0.9;
            } )
            .style( "stroke", ( d: RiskTileData ) => Color.darker( Color.fromString( this.getFillColor( d.riskRating ) ) ) )
            .style( "stroke-width", function( d: RiskTileData )
            {
                // The border should be applied in case the data is either highlighted or selected
                if ( d.highlighted || ( hasSelection && d.selected ) )
                    return 2;
                return 0;
            } );

        tileLabels
            .style( "fill-opacity", function( d: RiskTileData )
            {
                return ( hasSelection && !d.selected ) ? 0.3 : 1;
            } );
    }

    protected hitTest( _element: Element | null, _client: Point, _viewport: Point ): DataPoint | Tuple | null
    {
        const selection: any = d3.select( _element );
        return RiskData.getHittestData( selection.datum() );
    }
}
