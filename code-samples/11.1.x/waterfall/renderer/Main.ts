import { RenderBase, UpdateInfo, DataPoint, Font, Color } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";
import { AxesComponent, AxisProperty } from "@businessanalytics/d3-axis-layout";

const CATEGORIES = 0, TYPE = 1, VALUE = 2;            // data column indices
const margin = { left: 50, top: 10, right: 50, bottom: 10 }; // chart margins

// data type which is used to determine the positions
type StickBar = {
    open: number;
    close: number;
    ref: DataPoint;
}

// data type which is used to determine the delta line positions
type DeltaLine = { start: DataPoint; end: DataPoint };

// data type to describe a connection
type Connection = {
    s: DataPoint;
    e: DataPoint;
    y1: number;
    y2: number;
};

// darker the color by a factor
const darker = ( _color: Color, _factor = 0.7 ): string => `rgba(${_factor * _color.r},${_factor * _color.g},${_factor * _color.b},${_color.a})`;

export default class extends RenderBase
{
    private readonly _uuid = `id${Math.random().toString( 36 ).substring( 2, 15 ) + Math.random().toString( 36 ).substring( 2, 15 )}`;
    private readonly _axisComp = new AxesComponent();

    // Create is called during initialization
    protected create( _node: HTMLElement ): Element
    {
        // Create a svg node
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        svg.append( "defs" )
            .append( "clipPath" )
            .attr( "id", this._uuid )
            .append( "rect" );
        const container = svg.append( "g" )
            .attr( "class", "container" )
            .attr( "transform", `translate( ${margin.left} ${margin.top} )` );

        container.append( "g" ).attr( "class", "chartContent" ).append( "g" ).attr( "class", "elements" );
        container.append( "g" ).attr( "class", "axes" );

        // return the container
        return _node;
    }

    // Update is called during new data, property change, resizing, etc.
    protected update( _info: UpdateInfo ): void
    {
        const defs = d3.select( _info.node ).select( "defs" );
        const container = d3.select( _info.node ).select( ".container" );

        // if no data is mapped, clean up and exit
        if ( !_info.data )
        {
            container.select( ".elements" ).selectAll( "*" ).remove();
            container.select( ".axes" ).selectAll( "*" ).remove();
            return;
        }

        // get all the props
        const baseRatio = _info.props.get( "baseRatio" );
        const totalBarColor = _info.props.get( "totalBarColor" );
        const adjustmentBarColor = _info.props.get( "adjustmentBarColor" );
        const posDeltaColor = _info.props.get( "posDeltaColor" );
        const negDeltaColor = _info.props.get( "negDeltaColor" );

        const labelFont = _info.props.get( "labelFont" ) as Font;
        const axisFont = _info.props.get( "axisFont" ) as Font;

        const totalType = _info.props.get( "totalType" ).toString();
        const adjustmentType = _info.props.get( "adjustmentType" ).toString();
        const deltaType = _info.props.get( "deltaType" ).toString();

        const showDeltaLines = _info.props.get( "deltaLines" );

        function isDelta( _d: DataPoint ): boolean
        {
            return _d.caption( TYPE ) === deltaType;
        }

        function isAdjustment( _d: DataPoint ): boolean
        {
            return _d.caption( TYPE ) === adjustmentType;
        }

        function isTotal( _d: DataPoint ): boolean
        {
            return _d.caption( TYPE ) === totalType;
        }

        // calculate containerBounds
        const containerBounds = {
            width: _info.node.clientWidth - margin.left - margin.right,
            height: _info.node.clientHeight - margin.top - margin.bottom
        };

        // generate key categories
        const cats = _info.data.cols[ CATEGORIES ].tuples.map( _t => _t.key );
        // cache the xScale for performance
        const xScale = d3.scaleBand().paddingOuter( 0.05 ).paddingInner( 0.3 ).domain( cats );
        // create tick format
        const bottomAxis = d3.axisBottom( xScale ).tickFormat( ( _val, _idx ) => _info.data.cols[ CATEGORIES ].tuples[ _idx ].caption );

        // create/update axis
        const axisProp = new AxisProperty().tickLabelFont( {
            "font-size": axisFont.size ? axisFont.size : null,
            "font-family": axisFont.family ? axisFont.family : null,
            "font-style": axisFont.style ? axisFont.style : null,
            "font-weight": axisFont.weight ? axisFont.weight : null
        } );
        container.select( ".axes" ).call( this._axisComp.bounds( containerBounds ).axisProperty( "bottom", axisProp ).axes( [ bottomAxis ] ) );

        const bottomRect = this._axisComp.getRect( "bottom" );

        // calculate the chart rects ( without axis )
        const chartTopPadding = 60;
        const chartBounds = {
            height: containerBounds.height - bottomRect.height - chartTopPadding,
            width: containerBounds.width
        };

        // update the clip rect
        defs.select( `#${this._uuid} rect` )
            .attr( "width", chartBounds.width )
            .attr( "height", containerBounds.height - bottomRect.height  );

        const baseHeight = chartBounds.height * baseRatio;
        const totalValues = _info.data.rows.filter( isTotal );

        // generate a model from data which is used to calculate the bar positions
        const bars: StickBar[] = new Array( _info.data.rows.length );

        for ( let i = 0; i < _info.data.rows.length; ++i )
        {
            const dp = _info.data.rows[ i ];
            if ( ( isAdjustment( dp ) || isDelta( dp ) ) && i > 0 )
            {
                bars[ i ] = {
                    ref: dp,
                    close: bars[ i - 1 ].close + dp.value( VALUE ),
                    open: bars[ i - 1 ].close
                };
            }
            else
            {
                bars[ i ] = {
                    ref: dp,
                    close: dp.value( VALUE ),
                    open: dp.value( VALUE )
                };
            }
        }

        // determine the min and max of the domain
        const min = Math.min( ...bars.map( v => v.close ) );
        const max = Math.max( ...bars.map( v => v.close ) );

        const domain = [ min, max ];

        const yScale = d3.scaleLinear().domain( domain ).range( [ 0, chartBounds.height - baseHeight ] );
        const elementsSelection = container.select( ".chartContent" )
            .attr( "clip-path", `url(#${this._uuid})` )
            .select( ".elements" )
            .attr( "transform", `translate( 0 ${chartTopPadding} )` );
        const barWidth = xScale.bandwidth();


        function getBarHeight( _row: DataPoint, _idx: number ): number
        {
            if ( isTotal( _row ) )
                return Math.max( 1, yScale( bars[ _idx ].open ) - yScale( domain[ 0 ] ) );

            return Math.max( 1, Math.abs( yScale( bars[ _idx ].open ) - yScale( bars[ _idx ].close ) ) );
        }

        function getBarY( _row: DataPoint, _idx: number ): number
        {
            if ( isTotal( _row ) )
                return chartBounds.height - baseHeight - yScale( bars[ _idx ].open );

            return chartBounds.height - baseHeight - ( yScale( Math.max( bars[ _idx ].open, bars[ _idx ].close ) ) );
        }

        function barFill( _row: DataPoint, _idx ): Color
        {
            if ( isDelta( _row ) )
                return _row.value( VALUE ) > 0 ? posDeltaColor : _row.value( VALUE ) < 0 ? negDeltaColor : totalBarColor;

            if ( isAdjustment( _row ) )
                return adjustmentBarColor;

            return totalBarColor;
        }

        function applyBarStyling( _selection: any ): void
        {
            _selection.attr( "stroke-width", _d => _d.selected || _d.highlighted ? 2.5 : 0 )
                .attr( "stroke", ( _row, _idx ) => darker( barFill( _row, _idx ) ) )
                .attr( "fill-opacity", _d => !_info.data.hasSelections ? 1 : _d.selected ? 1 : 0.75 )
                .attr( "fill", ( _row, _idx ) => barFill( _row, _idx ).toString() );
        }

        elementsSelection.selectAll( ".dataBar" )
            .data( _info.data.rows, ( d: DataPoint )  => d.key )
            .join( "rect" )
            .attr( "class", "dataBar" )
            .attr( "x", row => xScale( row.tuple( CATEGORIES ).key ) )
            .attr( "y", getBarY )
            .attr( "width", barWidth )
            .attr( "height", getBarHeight )
            .call( applyBarStyling );

        elementsSelection.selectAll( ".baseBar" )
            .data( totalValues, ( d: DataPoint )  => d.key )
            .join( "rect" )
            .attr( "class", "baseBar" )
            .attr( "x", row => xScale( row.tuple( CATEGORIES ).key ) )
            .attr( "y", chartBounds.height - baseHeight + 10 )
            .attr( "width", barWidth )
            .attr( "height", Math.max( 1, baseHeight - 10 ) )
            .call( applyBarStyling );

        // connections between bars
        // there are next possibilities:
        // connection between 2 delta/adjustment bars
        // connection between total bar and adjustment/delta bar
        // which means no ancestor total bars have connection
        const connections: Connection[] = [];
        for ( let i = 0; i < _info.data.rows.length - 1; ++i )
        {
            const b1 = _info.data.rows[ i ];
            const b2 = _info.data.rows[ i + 1 ];
            if ( !( isTotal( b1 ) && isTotal( b2 ) ) )
                connections.push( { s: b1, e: b2, y1: bars[ i ].close, y2: bars[ i + 1 ].open } );
        }


        elementsSelection.selectAll( ".connection" )
            .data( connections, ( d: Connection )  => d.s.key )
            .join( "line" )
            .attr( "class", "connection" )
            .attr( "x1", ( _row, _idx )  => xScale( _row.s.tuple( CATEGORIES ).key ) + barWidth )
            .attr( "x2", ( _row, _idx ) => xScale( _row.e.tuple( CATEGORIES ).key ) )
            .attr( "y1", ( _row, _idx ) => chartBounds.height - baseHeight - yScale( _row.y1 ) )
            .attr( "y2", ( _row, _idx ) => chartBounds.height - baseHeight - yScale( _row.y2 ) )
            .style( "stroke-width", 1 )
            .style( "stroke-dasharray", 4 )
            .style( "stroke", "black" );

        const labelContainers = elementsSelection.selectAll( ".barLabel" )
            .data( _info.data.rows, ( d: DataPoint )  => d.key )
            .join( enter =>
            {
                const textContainer = enter.append( "g" );
                textContainer.append( "rect" );
                textContainer.append( "text" );
                return textContainer;
            } )
            .attr( "class", "barLabel" )
            .style( "font", labelFont.toString() )
            .attr( "transform", ( _row, _idx ) =>
            {
                let y;
                // center of the bar
                if ( isDelta( _row ) || isAdjustment( _row ) )
                    y = chartBounds.height - baseHeight - yScale( _row.value( VALUE ) * 0.5 + bars[ _idx ].open );
                else
                    y = chartBounds.height - baseHeight - yScale( _row.value( VALUE ) ) - 10;
                return `translate( ${xScale( _row.tuple( CATEGORIES ).key ) + barWidth * 0.5} ${y} )`;
            } );

        labelContainers.select( "rect" )
            .attr( "width", row => `${ row.value( VALUE ).toString().length * 0.75 }em` )
            .attr( "height", "1.01em" )
            .attr( "x", row => `-${ row.value( VALUE ).toString().length * 0.75 * 0.5 }em` )
            .attr( "y", "-0.55em" )
            .attr( "fill", "white" )
            .attr( "fill-opacity", 0.6 );

        labelContainers.select( "text" )
            .attr( "dy", "0.3em" )
            .attr( "text-anchor", "middle" )
            .text( row => row.value( VALUE ) );

        // render delta lines
        const deltaLines: DeltaLine[] = [];

        // only calculate delta lines if property is enabled
        if ( showDeltaLines )
            for ( let i = 0; i < totalValues.length - 1; ++i )
                deltaLines.push( { start: totalValues[ i ], end: totalValues[ i + 1 ] } );

        elementsSelection.selectAll( ".deltaLine" )
            .data( deltaLines, ( _d: DeltaLine ) => _d.start.key )
            .join( "path" )
            .attr( "class", "deltaLine" )
            .attr( "d", ( _d: DeltaLine ) =>
            {
                const yLeft = chartBounds.height - baseHeight - yScale( _d.start.value( VALUE ) );
                const yRight = chartBounds.height - baseHeight - yScale( _d.end.value( VALUE ) );
                const maxY = Math.min( yLeft, yRight );

                const x1 = xScale( _d.start.tuple( CATEGORIES ).key ) + barWidth * 0.5;
                const y1 = yLeft - 30;
                const x2 = xScale( _d.start.tuple( CATEGORIES ).key ) + barWidth * 0.5;
                const y2 = maxY - 40;
                const x3 = xScale( _d.end.tuple( CATEGORIES ).key ) + barWidth * 0.5;
                const y3 = maxY - 40;
                const x4 = xScale( _d.end.tuple( CATEGORIES ).key ) + barWidth * 0.5;
                const y4 = yRight - 30;

                return `M${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;
            } )
            .attr( "stroke-width", 1.5 )
            .attr( "fill", "none" )
            .attr( "stroke", "black" );

        const lineLabels = elementsSelection.selectAll( ".deltaLineLabel" )
            .data( deltaLines, ( _d: DeltaLine ) => _d.start.key )
            .join( enter =>
            {
                const textContainer = enter.append( "g" );
                textContainer.append( "rect" );
                textContainer.append( "text" );
                return textContainer;
            } )
            .attr( "class", "deltaLineLabel" )
            .style( "font", labelFont.toString() )
            .attr( "transform", ( _d: DeltaLine, _idx: number ) =>
            {
                const yLeft = chartBounds.height - baseHeight - yScale( _d.start.value( VALUE ) );
                const yRight = chartBounds.height - baseHeight - yScale( _d.end.value( VALUE ) );
                const maxY = Math.min( yLeft, yRight );

                const x2 = xScale( _d.start.tuple( CATEGORIES ).key ) + barWidth * 0.5;
                const y2 = maxY - 40;
                const x3 = xScale( _d.end.tuple( CATEGORIES ).key ) + barWidth * 0.5;

                return `translate( ${( x3 - x2 ) * 0.5 + x2} ${ y2 })`;
            } );

        function getPercentage( _d: DeltaLine ): string
        {
            return `${Math.round( ( _d.end.value( VALUE ) - _d.start.value( VALUE ) ) / _d.start.value( VALUE ) * 100 )}%`;
        }

        lineLabels.select( "rect" )
            .attr( "width", _d => `${ getPercentage( _d ).toString().length }em` )
            .attr( "height", "1.1em" )
            .attr( "x", _d => `-${ getPercentage( _d ).toString().length * 0.5 }em` )
            .attr( "y", "-0.55em" )
            .attr( "rx", 5 )
            .attr( "ry", 5 )
            .attr( "stroke", "black" )
            .attr( "fill", "white" );

        lineLabels.select( "text" )
            .attr( "dy", "0.3em" )
            .attr( "text-anchor", "middle" )
            .text( getPercentage );
    }
}
