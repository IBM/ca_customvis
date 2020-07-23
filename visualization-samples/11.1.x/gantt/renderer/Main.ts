import { RenderBase, UpdateInfo, Slot, DataPoint, Color, DataSet, Font, Segment, Properties } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";
import { AxesComponent, AxisProperty } from "@businessanalytics/d3-axis-layout";
const TASK = 0, START_DATE = 1, END_DATE = 2, COLOR = 3, LABEL = 4, COLUMNS = 5; // data column indices
const DESC_PADDING = 10, MIN_ARROW_PADDING = 5, MAX_ARROW_PADDING = 15;

type AxesBound = {
    x: number;
    width: number;
    height: number;
}

type Connection = {
    from: DataPoint;
    to: DataPoint;
    path: string;
}

type ColumnValue = {
    x: number;
    text: string;
}

function setColorOpacity( color: Color, opacity = 0 ): Color
{
    return new Color( color.r, color.g, color.b, opacity );
}

function addDays( _date: Date, _days: number ): Date
{
    const result = new Date( _date );
    result.setDate( result.getDate() + _days );
    return result;
}

function calculateArrowPadding( _svgWidth: number ): number
{
    return Math.max( MIN_ARROW_PADDING, Math.min( _svgWidth * 0.02, MAX_ARROW_PADDING ) );
}

/**
 * Check if _date is either null or an "Invalid Date" Date object
 * @param _date
 * @returns True if date is invalid
 */
function isInvalidDate( _date: null | Date ): boolean
{
    return _date === null || isNaN( _date.getTime() );
}

/**
* Compute the date domain based on the rows start and end date value/caption.
* In case of cat date slot tuple caption is used to parse Data otherwise vale.
* @param _rows
* @param _startDateCol Slot of start date
* @param _endDateCol Slot of end date
* @param _getStartDate Function to get start date
* @param _getEndDate Function to get end date
*/
function computeDateDomain( _rows: DataPoint[], _startDateCol: Slot, _endDateCol: Slot, _getStartDate: Function, _getEndDate: Function ): [ Date, Date ]
{
    let startDateMin = null, startDateMax = null;
    let endDateMin = null, endDateMax = null;
    _rows.forEach( ( _dataPoint ) =>
    {
        const startDateVal = _getStartDate( _dataPoint, _startDateCol );
        if ( startDateVal )
        {
            if ( isInvalidDate( startDateMin ) && isInvalidDate( startDateMax ) )
            {
                startDateMin = startDateVal;
                startDateMax = startDateVal;
            }
            else if ( startDateVal < startDateMin )
            {
                startDateMin = startDateVal;
            }
            else if ( startDateVal > startDateMax )
            {
                startDateMax = startDateVal;
            }
        }
        const endDateVal = _getEndDate( _dataPoint, _endDateCol );
        if ( endDateVal )
        {
            if ( isInvalidDate( endDateMin ) && isInvalidDate( endDateMax ) )
            {
                endDateMin = endDateVal;
                endDateMax = endDateVal;
            }
            else if ( endDateVal < endDateMin )
            {
                endDateMin = endDateVal;
            }
            else if ( endDateVal > endDateMax )
            {
                endDateMax = endDateVal;
            }
        }
    } );

    // If all start date is null, set minDate to endDateMin - 2 weeks
    const minDate = startDateMin ? startDateMin : addDays( endDateMin, -14 );
    let maxDate = endDateMax;
    /* If all end date is null or later than startDateMax,
     * set maxDate to startDateMax + 2 weeks */
    if (  startDateMax > maxDate )
        maxDate = addDays( startDateMax, 14 );
    return [ minDate, maxDate ];
}

/**
* Create function that get either Start date or End date of a data point
* @param startOrEnd Slot number of start date or end date
*/
function createGetDateFn( startOrEnd: number ): Function
{
    // Get date string from tuple key, since some dates are automatically parsed,
    // the caption is formatted and can't be recognized by Date parser
    // Used to parse Date object in CA, since it doens't support temporal slot
    // Also see: VIDA-3623, VIDA-3804 and VIDA-4456
    function extractDate( _tupleKey: string ): Date | null
    {
        // Try and parse CA or local key ("DATASET.SLOT->[2018-02-18 19:00:00]" or "[ID].[SLOT].[1533959781804]")
        let dateStartIndex: number = _tupleKey.lastIndexOf( "[" );
        let dateEndIndex: number;
        if ( dateStartIndex === -1 )
        {
            // Try and parse Reporting key ("SLOT-Nov 04, 2019 3:15:00 PM")
            dateStartIndex  = _tupleKey.lastIndexOf( "-" );
            dateEndIndex = _tupleKey.length;
        }
        else
        {
            // Skip opening bracket and find matching bracket
            dateStartIndex++;
            dateEndIndex = _tupleKey.indexOf( "]", dateStartIndex );
        }

        if ( dateStartIndex === -1 || dateEndIndex === -1 )
        {
            console.warn( `Cannot extract date from  ${_tupleKey}` );
            return null;
        }

        const dateString = _tupleKey.slice( dateStartIndex, dateEndIndex );
        const dateNumber = Number( dateString );

        return new Date( isNaN( dateNumber ) ? dateString : dateNumber );
    }

    return ( _dataPoint: DataPoint ): Date | null =>
    {
        const caption = _dataPoint.tuple( startOrEnd ).caption;
        if ( !caption )
            return null;
        const date: Date = _dataPoint.tuple( startOrEnd ).source.value;
        return date ? date : extractDate( _dataPoint.tuple( startOrEnd ).key );
    };
}

/**
* Create function to calculate label background width
* @param _svgElem Dummy SVGTextElement having font-size equal to label's
*/
function createCalLabelWidthFn( _svgElem: SVGTextElement ): Function
{
    return ( _d: DataPoint ): number =>
    {
        const caption = _d.tuple( LABEL ).caption;
        if ( !caption || caption === "" )
            return 0;
        _svgElem.textContent = _d.tuple( LABEL ).caption;
        return _svgElem.getComputedTextLength() + DESC_PADDING;
    };
}

/**
* Calculate path's coordinate of a connection
* @param _calArrowPathX Function that calculate all x coordinates of path
* @param _calArrowPathY Function that calculate all y coordinates of path
*/
function createCalArrowPathFn( _calArrowPathX: Function, _calArrowPathY: Function ): Function
{
    return ( connection: Connection, _arrowPadding: number ): Connection =>
    {
        const x = _calArrowPathX( connection, _arrowPadding );
        const y = _calArrowPathY( connection );
        connection.path = "M";
        for ( let i = 0; i < x.length; ++i )
            connection.path += `${x[ i ]},${y[ i ]} `;
        connection.path = connection.path.slice( 0,-1 );
        return connection;
    };
}

/**
* Recalculate only x coordinates of a path
* Used for zoom handling
* @param _calArrowPathX Function that calculate all x coordinates of path
*/
function createRecalArrowPathXFn( _calArrowPathX: Function ): Function
{
    return ( connection: Connection, _arrowPadding: number ): Connection =>
    {
        const path = connection.path;
        const newPathX = _calArrowPathX( connection, _arrowPadding );
        const pathY = path.substring( 1 )                       // Remove "M" from path
            .split( " " )                                       // Get x,y pair
            .map( e => e.split( "," )[ 1 ] );   // Get y
        connection.path = "M";
        for ( let i = 0; i < newPathX.length; ++i )
            connection.path += `${newPathX[ i ]},${pathY[ i ]} `;
        connection.path = connection.path.slice( 0,-1 );
        return connection;
    };
}

function applyFont( _selection: any, _font: Font ): void
{
    _selection
        .style( "font-size", _font.size ? _font.size.toString() : null )
        .style( "font-family", _font.family ? _font.family.toString() : null )
        .style( "font-style", _font.style ? _font.style.toString() : null )
        .style( "font-weight", _font.weight ? _font.weight.toString() : null );
}

export default class extends RenderBase
{
    private _chartContainer;
    private _x1Axis: d3.Axis<number | Date | { valueOf(): number }>;
    private _x1Scale: d3.ScaleTime<number, number>;
    private _y0Scale: d3.ScaleBand<string>;
    private _zoom: d3.ZoomBehavior<Element, unknown>;
    private _clip: d3.Selection<d3.BaseType, unknown, null, undefined>;
    private _axesComponent: any;
    private _bundleUniqueId: number;
    private _xAxisPlace: string;
    private _palette;
    private _rowTaskMap: object;

    protected create( _node: HTMLElement ): Element
    {
        this._bundleUniqueId = Math.random() * 1000000;
        const svg = d3.select( _node ).append( "svg" )
            .attr( "width", "100%" )
            .attr( "height", "100%" )
            .attr( "class", "gantt" );
        this.loadCss( "../static/gantt.css" );
        const defs = svg.append( "defs" ).attr( "id", "defs" );
        this._clip = defs
            .append( "svg:clipPath" )
            .attr( "id", `chartClip${this._bundleUniqueId}` )
            .append( "svg:rect" );
        const chart = svg.append( "g" )
            .attr( "class", "chart" );
        chart.append( "g" )
            .attr( "class", "axes" );
        chart.append( "g" )
            .attr( "class", "columns" );
        const chartContent = chart.append( "g" )
            .attr( "class", "chartContent" )
            .attr( "clip-path", `url('#chartClip${this._bundleUniqueId}')` );
        chartContent.append( "g" )
            .attr( "class", "ganttBars" );
        chartContent.append( "g" )
            .attr( "class", "arrows" );
        chartContent.append( "g" )
            .attr( "class", "labelBackground" );
        chartContent.append( "g" )
            .attr( "class", "labels" );
        this._chartContainer = d3.select( svg.node() );
        return svg.node();
    }

    // Update is called during new data, property change, resizing, etc.
    protected update( _info: UpdateInfo ): void
    {
        const width = _info.node.clientWidth;
        const height = _info.node.clientHeight;
        const data = _info.data;
        const margin = { top: 10, right: 0, bottom: 10, left: 0 };
        const props = _info.props;
        const showLabelBg = props.get( "text.background.show" );
        this._xAxisPlace = props.get( "axis.xAxisPlace" );
        const axisLabelFont = props.get( "axis.label.font" ) as Font;
        const axisLabelColor = props.get( "axis.label.color" );

        if ( !data || data.rows.length === 0 )
        {
            this._chartContainer.select( ".axes" ).selectAll( "*" ).remove();
            this._chartContainer.select( ".chartContent" ).selectAll( "*" ).selectAll( "*" ).remove();
            this._chartContainer.select( ".columns" ).selectAll( "*" ).remove();
            return;
        }

        this._updateProperties( _info );

        const rows = data.rows;
        const startDateCol = data.cols[ START_DATE ];
        const endDateCol = data.cols[ END_DATE ];
        const getStartDate = createGetDateFn( START_DATE );
        const getEndDate = createGetDateFn( END_DATE );
        const getX = this._createGetXFn( startDateCol, getStartDate );
        const getWidth = this._createGetWidthFn( startDateCol, endDateCol, getX, getEndDate );

        const calculateArrowPathX = this._createCalArrowPathXFn( getX, getWidth );
        const calculateArrowPathY = this._createCalArrowPathYFn();
        const calculateArrowPath = createCalArrowPathFn( calculateArrowPathX, calculateArrowPathY );
        const recalculateArrowPathX = createRecalArrowPathXFn( calculateArrowPathX );

        const arrowPadding = calculateArrowPadding( width );
        const xAxis = this._chartContainer.select( ".axes" ).select( "." + this._xAxisPlace );

        this._zoom = d3.zoom()
            .scaleExtent( [ 1, 10 ] )
            .translateExtent( [ [ 0, 0 ], [ width, height ] ] )
            .extent( [ [ 0, 0 ], [ width, height ] ] )
            .on( "zoom", () =>
            {
                this._x1Scale.domain( computeDateDomain( rows, startDateCol, endDateCol, getStartDate, getEndDate ) ).nice();
                this._x1Scale = d3.event.transform.rescaleX( this._x1Scale );
                this._chartContainer.select( ".axisTransform." + this._xAxisPlace ).call( this._x1Axis.scale( this._x1Scale ) );
                this._chartContainer.selectAll( ".bar" )
                    .attr( "x", ( d: DataPoint ) => getX( d ) )
                    .attr( "width", ( d: DataPoint ) => getWidth( d ) );
                this._chartContainer.selectAll( ".arrow" )
                    .attr( "d", ( d: Connection ) => recalculateArrowPathX( d, arrowPadding ).path );
                this._chartContainer.selectAll( ".labelBg" )
                    .attr( "x", d => getX( d ) + DESC_PADDING / 2 );
                this._chartContainer.selectAll( ".description" )
                    .attr( "x", ( d: DataPoint ) => getX( d ) + DESC_PADDING );
                this._chartContainer.selectAll( ".startEmpty" )
                    .style( "visibility", ( d: DataPoint ) => getWidth( d ) > 0 ? "visible" : "hidden" );
                const ticks = xAxis.selectAll( ".tick" );
                ticks.selectAll( "text" ).attr( "fill", props.get( "axis.label.color" ) );
                ticks.selectAll( "line" ).style( "stroke", props.get( "axis.grid.color" ) );
                this._chartContainer.select( ".axes" ).selectAll( ".axisTransform" ).selectAll( "path" ).raise();
            } );

        this._chartContainer.select( ".chart" )
            .attr( "transform", `translate( ${margin.left} , ${margin.top})` );

        if ( _info.reason.data || _info.reason.size || _info.reason.properties )
        {
            this._createRadialGradients( data );
            const restructureTasks: any = this._mapRowToTaskArray(  this._restructureTasks( rows, getStartDate, getEndDate ) );
            this._rowTaskMap = restructureTasks.rowMap;
            const numberedTaskArray = restructureTasks.numberedTaskArray.reverse();
            this._x1Scale = d3.scaleTime().domain( computeDateDomain( rows, startDateCol, endDateCol, getStartDate, getEndDate ) ).nice();
            this._y0Scale = d3.scaleBand().domain( numberedTaskArray ).paddingInner( 0.2 ).paddingOuter( 0.4 );
            const leftColumnsSize = Math.min( data.cols[ COLUMNS ].segments.length * 0.1, 0.4 );
            const axesBound: AxesBound = { x : ( width - margin.left - margin.right ) * leftColumnsSize,
                width: ( width - margin.left - margin.right ) * ( 1 - leftColumnsSize ),
                height: height - margin.top - margin.bottom };
            this._axesComponent = this._drawAxes( axesBound, props );
            this._clip
                .attr( "x", axesBound.x + this._axesComponent.getRect( "left" ).width )
                .attr( "y", 0 )
                .attr( "width", Math.max( axesBound.width - this._axesComponent.getRect( "left" ).width - 20, 0 ) )
                .attr( "height", axesBound.height );

            const barHeight = this._y0Scale.bandwidth();

            const dummySvg: any = d3.select( "#defs" )
                    .selectAll( "text" )
                    .data( [ null ] )
                    .join( "text" )
                    .style( "visibility", "hidden" );

            if ( data.cols[ COLUMNS ].mapped )
            {
                // Draw Column headers
                dummySvg.call( applyFont, axisLabelFont );
                const maxColumnWidth = ( width - margin.left - margin.right ) * leftColumnsSize / data.cols[ COLUMNS ].segments.length - 10;
                this._chartContainer.select( ".columns" ).selectAll( ".column" )
                    .data( data.cols[ COLUMNS ].segments )
                    .join( _enterSel =>
                    {
                        const g = _enterSel
                            .append( "g" )
                            .attr( "class", "column" );
                        g.append( "text" );
                        return g;
                    }
                    )
                    .attr( "transform", ( d, i ) => `translate( ${( width - margin.left - margin.right ) * leftColumnsSize * i / data.cols[ COLUMNS ].segments.length}, ${this._axesComponent.getRect( "top" ).y } )` )
                    .select( "text" )
                    .call( applyFont, axisLabelFont )
                    .style( "fill", axisLabelColor )
                    .text( d => d.caption )
                    .attr( "dy", "0.3em" );

                // Draw Column content.
                const getColumnValue = this._createGetColumnValueFn( restructureTasks.taskMap, maxColumnWidth, data.cols[ COLUMNS ].segments.length, dummySvg.node() );
                this._chartContainer.select( ".columns" ).selectAll( ".row" )
                    .data( rows )
                    .join( "g" )
                    .attr( "class", "row" )
                    .attr( "transform", ( d ) => `translate( 0, ${this._axesComponent.getRect( "top" ).y + this._y0Scale( this._rowTaskMap[ d.key ] ) + this._y0Scale.bandwidth() * 0.5 } )` )
                    .selectAll( ".colVal" )
                    .data( ( d: DataPoint ) =>
                    {
                        const results = [];
                        d.tuple( COLUMNS ).segments.forEach( segment => results.push( { segment: segment, dataPointKey: d.key } ) );
                        return results;
                    } )
                    .join( "text" )
                    .attr( "class", "colVal" )
                    .attr( "dy", "0.3em" )
                    .call( applyFont, axisLabelFont )
                    .style( "fill", axisLabelColor )
                    .text( ( d, i ) => getColumnValue( d.dataPointKey, i ).text )
                    .attr( "transform", ( d, i ) => `translate( ${( width - margin.left - margin.right ) * leftColumnsSize * i / data.cols[ COLUMNS ].segments.length + getColumnValue( d.dataPointKey, i ).x}, 0)` );
            }
            else
            {
                this._chartContainer.select( ".columns" ).selectAll( "*" ).remove();
            }

            // Draw bars.
            this._chartContainer.select( ".ganttBars" ).selectAll( ".bar" )
                .data( rows )
                .join( "rect" )
                .attr( "class", "bar" )
                .attr( "x", ( d: DataPoint ) => getX( d ) )
                .attr( "width", ( d: DataPoint ) => getWidth( d ) )
                .attr( "y", ( d ) => this._y0Scale( this._rowTaskMap[ d.key ] ) )
                .attr( "height", barHeight )
                .attr( "rx", barHeight * 0.1 )
                .style( "stroke-width", "2px" );
            if ( data.cols[ LABEL ].mapped && barHeight > 20 )
            {
                const labelFont = props.get( "text.font" ) as Font;
                if ( showLabelBg )
                {
                    const labelBgColor = props.get( "text.background.color" ) as Color;
                    const labelBgOpacity = props.get( "text.background.opacity" ) as number;
                    dummySvg.call( applyFont, labelFont );
                    const getLabelWidth = createCalLabelWidthFn( dummySvg.node() );
                    this._chartContainer.select( ".labelBackground" )
                        .selectAll( "rect" )
                        .data( rows )
                        .join( "rect" )
                        .attr( "class", "labelBg" )
                        .classed( "startEmpty", ( d: DataPoint ) => getStartDate( d ) ? false : true )
                        .attr( "x", d => getX( d ) + DESC_PADDING / 2 )
                        .attr( "y", d => this._y0Scale( this._rowTaskMap[ d.key ] ) + barHeight / 4 )
                        .attr( "width", d => getLabelWidth( d ) )
                        .attr( "height", barHeight / 2 )
                        .attr( "fill-opacity", labelBgOpacity )
                        .attr( "fill", labelBgColor.toString() );
                }
                else
                {
                    this._chartContainer.select( ".labelBackground" ).html( null );
                }
                const labelColor = props.get( "text.color" ) as Color;
                this._chartContainer.select( ".labels" )
                    .selectAll( "text" )
                    .data( rows )
                    .join( "text" )
                    .attr( "class", "description" )
                    .classed( "startEmpty", ( d: DataPoint ) => getStartDate( d ) ? false : true )
                    .attr( "x", d => getX( d ) + DESC_PADDING )
                    .attr( "y", d => this._y0Scale( this._rowTaskMap[ d.key ] ) + barHeight / 2 + DESC_PADDING / 2 )
                    .attr( "fill", labelColor.toString() )
                    .call( applyFont, labelFont )
                    .text( ( d: DataPoint ) =>  d.tuple( LABEL ).caption );
                this._chartContainer.selectAll( ".startEmpty" )
                    .style( "visibility", ( d: DataPoint ) => getWidth( d ) > 0 ? "visible" : "hidden" );
            }
            else
            {
                this._chartContainer.select( ".labels" ).html( null );
                this._chartContainer.select( ".labelBackground" ).html( null );
            }

            const connections = this._getConnectingRows( data.rows, getStartDate ).map( e => calculateArrowPath( e, arrowPadding ) );
            this._chartContainer.select( ".arrows" ).selectAll( ".arrow" )
                .data( connections )
                .join( "path" )
                .attr( "class", "arrow" )
                .attr( "d", ( _d: Connection ) => _d.path )
                .attr( "stroke-width", 1.5 )
                .attr( "fill", "none" );
        }
        const getFillColor = this._createGetFillColorFn( getStartDate, getEndDate, data.cols[ COLOR ] );
        this._chartContainer.select( ".ganttBars" ).selectAll( ".bar" )
            .style( "fill", ( _d: DataPoint ) => getFillColor( _d ) )
            .style( "fill-opacity", ( _d: DataPoint ) =>
            {
                return data.hasSelections && !_d.selected &&
                ( isInvalidDate( getEndDate( _d ) ) || isInvalidDate( getStartDate( _d ) ) ) ? "0.4" : "1";
            } )
            .style( "stroke", ( _d: DataPoint ) => this._palette.getOutlineColor( _d ) );
        this._chartContainer.select( ".arrows" ).selectAll( ".arrow" )
            .attr( "marker-end", ( _d: Connection )  => `url(#${this._getTriangleId( this._palette.getFillColor( _d.from ).toString() ) })` )
            .style( "stroke", ( _d: Connection ) => this._palette.getFillColor( _d.from ) );
        this._chartContainer.select( ".labels" )
            .selectAll( "text" )
            .attr( "fill-opacity", ( _d: DataPoint ) => !data.hasSelections || _d.highlighted || _d.selected ? 1 : 0.4 );
        xAxis.selectAll( ".tick" ).selectAll( "line" )
            .style( "stroke", props.get( "axis.grid.color" ) );
        this._chartContainer.select( ".axes" ).selectAll( ".axisTransform" ).selectAll( "path" ).raise();
    }

    /**
     * Draw axes using generic axis
     * @param _bounds Axes bound
     */
    private _drawAxes( _bounds: AxesBound, _props: Properties ): any
    {
        const axisLabelFont = _props.get( "axis.label.font" ) as Font;
        const defaultFont =
        {
            "font-size": axisLabelFont.size ? axisLabelFont.size.toString() : "",
            "font-family": axisLabelFont.family ? axisLabelFont.family.toString() : "",
            "font-style": axisLabelFont.style ? axisLabelFont.style.toString() : "",
            "font-weight": axisLabelFont.weight ? axisLabelFont.weight.toString() : ""
        };
        const axisProperty = new AxisProperty().tickLabelFont( defaultFont );
        axisProperty
            .axisLineColor( _props.get( "axis.line.color" ) )
            .tickLabelColor( _props.get( "axis.label.color" ) );
        const axisFn = this._xAxisPlace === "top" ? d3.axisTop : d3.axisBottom;
        this._x1Axis = axisFn( this._x1Scale ).tickSize( -_bounds.height );
        const y0Axis = d3.axisLeft( this._y0Scale );
        const axesComponent = AxesComponent()
            .axes( [ this._x1Axis, y0Axis ] )
            .bounds( _bounds )
            .axisProperty( this._xAxisPlace, axisProperty )
            .axisProperty( "left", axisProperty );
        this._chartContainer.selectAll( ".axes" ).call( axesComponent );
        this._chartContainer.selectAll( ".axisTransform" )
            .attr( "font-family", axisLabelFont.family ? axisLabelFont.family.toString() : null )
            .attr( "font-style", axisLabelFont.style ? axisLabelFont.style.toString() : null );
        return axesComponent;
    }

    /**
     * Create gradients for start empty and end empty bar
     * @param _col
     * @param _palette
     */
    private _createRadialGradients( _data: DataSet ): void
    {
        if ( _data.cols[ COLOR ].mapped )
        {
            if ( _data.cols[ COLOR ].dataType === "cat" )
                this._createRadialGradientsCat( _data.cols[ COLOR ] );
            else
                this._createRadialGradientsCont( _data );
        }
        else
        {
            const defs = this._chartContainer.select( "#defs" );
            const defaultColor = this._palette.getColor( null );
            const transparentDefaultColor = setColorOpacity( defaultColor );
            defs.selectAll( "linearGradient" ).remove();
            let gradients = defs.append( "linearGradient" )
                .attr( "id", "startEmpty_noStatus" )
                .attr( "class", "startempty" );
            gradients.append( "stop" ).attr( "offset", "10%" ).attr( "stop-color", transparentDefaultColor.toString() );
            gradients.append( "stop" ).attr( "offset", "80%" ).attr( "stop-color", defaultColor.toString() );
            gradients = defs.append( "linearGradient" )
                .attr( "id", "endEmpty_noStatus" )
                .attr( "class", "endempty" );
            gradients.append( "stop" ).attr( "offset", "20%" ).attr( "stop-color", defaultColor.toString() );
            gradients.append( "stop" ).attr( "offset", "90%" ).attr( "stop-color", transparentDefaultColor.toString() );
        }
    }

    private _createRadialGradientsCat( _col: Slot ): void
    {
        const defs = this._chartContainer.select( "#defs" );
        defs.selectAll( "linearGradient" ).remove();

        const tuples = _col.tuples;
        let gradients = defs.selectAll( "linearGradient .startempty" ).data( tuples )
            .join( ( _enter ) => _enter.append( "linearGradient" ) )
            .attr( "id", ( _tuple ) => `startEmpty_${_tuple.key}_${this._bundleUniqueId}` )
            .attr( "class", "startempty" );
        gradients.selectAll( "stop" ).remove();

        gradients.append( "stop" )
            .attr( "offset", "10%" )
            .attr( "stop-color", ( _d: DataPoint ) => setColorOpacity( this._palette.getColor( _d ) ).toString() );
        gradients.append( "stop" )
            .attr( "offset", "80%" )
            .attr( "stop-color", ( _d: DataPoint ) => this._palette.getColor( _d ).toString() );

        gradients = defs.selectAll( "linearGradient .endempty" ).data( tuples )
            .join( ( _enter ) => _enter.append( "linearGradient" ) )
            .attr( "class", "endempty" )
            .attr( "id", ( _tuple ) => `endEmpty_${_tuple.key}_${this._bundleUniqueId}` );
        gradients.selectAll( "stop" ).remove();

        gradients.append( "stop" )
            .attr( "offset", "20%" )
            .attr( "stop-color", ( _d: DataPoint ) => this._palette.getColor( _d ).toString() );
        gradients.append( "stop" )
            .attr( "offset", "90%" )
            .attr( "stop-color", ( _d: DataPoint ) => setColorOpacity( this._palette.getColor( _d ) ).toString() );
    }

    private _createRadialGradientsCont( _data: DataSet ): void
    {
        const defs = this._chartContainer.select( "#defs" );
        defs.selectAll( "linearGradient" ).remove();

        let values = _data.rows.map( row => row.value( COLOR ) );
        values = values.filter( ( item, index ) => values.indexOf( item ) === index ); // Remove duplicate items

        let gradients = defs.selectAll( "linearGradient .startempty" ).data( values )
            .join( ( _enter ) => _enter.append( "linearGradient" ) )
            .attr( "id", ( _value ) => `startEmpty_${_value.toFixed( 2 )}_${this._bundleUniqueId}` )
            .attr( "class", "startempty" );
        gradients.selectAll( "stop" ).remove();

        const colorStops = this._palette.getColorStops( _data.cols[ COLOR ] );
        gradients.append( "stop" )
            .attr( "offset", "10%" )
            .attr( "stop-color", ( _d: DataPoint ) => setColorOpacity(  colorStops.getColor( _d ) ).toString() );
        gradients.append( "stop" )
            .attr( "offset", "80%" )
            .attr( "stop-color", ( _d: DataPoint ) => colorStops.getColor( _d ).toString() );

        gradients = defs.selectAll( "linearGradient .endempty" ).data( values )
            .join( ( _enter ) => _enter.append( "linearGradient" ) )
            .attr( "class", "endempty" )
            .attr( "id", ( _value ) => `endEmpty_${_value.toFixed( 2 )}_${this._bundleUniqueId}` );
        gradients.selectAll( "stop" ).remove();

        gradients.append( "stop" )
            .attr( "offset", "20%" )
            .attr( "stop-color", ( _d: DataPoint ) => colorStops.getColor( _d ).toString() );
        gradients.append( "stop" )
            .attr( "offset", "90%" )
            .attr( "stop-color", ( _d: DataPoint ) => setColorOpacity(  colorStops.getColor( _d ) ).toString() );
    }

    private _createGetFillColorFn( _getStartDate: Function, _getEndDate: Function, _col: Slot ): Function
    {
        let getValue;
        if ( _col.dataType === "cat" )
            getValue = ( _d: DataPoint ): string => _d.tuple( COLOR ).key;
        else
            getValue = ( _d: DataPoint ): string => _d.value( COLOR ).toFixed( 2 ).toString();
        return ( _d: DataPoint ): string =>
        {
            const startDate = _getStartDate( _d );
            const endDate = _getEndDate( _d );
            if ( isInvalidDate( startDate ) && isInvalidDate( endDate ) )
                return "none";
            if ( !_col.mapped )
            {
                if ( isInvalidDate( startDate ) )
                    return "url('#startEmpty_noStatus')";
                if ( isInvalidDate( endDate ) )
                    return "url('#endEmpty_noStatus')";
            }
            if ( isInvalidDate( startDate ) )
                return `url('#startEmpty_${getValue( _d )}_${this._bundleUniqueId }')`;
            if ( isInvalidDate( endDate ) )
                return `url('#endEmpty_${getValue( _d )}_${this._bundleUniqueId }')`;
            return this._palette.getFillColor( _d );
        };
    }

    /**
     * Enable/disable properties based on data mapping
     * @param _info
     */
    private _updateProperties( _info: UpdateInfo ): void
    {
        const isColorMapped = _info.data.cols[ COLOR ].mapped;
        const isColorCont = _info.data.cols[ COLOR ].dataType === "cont";
        this.properties.setActive( "colors.cont", isColorMapped && isColorCont );
        this.properties.setActive( "colors.cat", !isColorMapped || !isColorCont );
        this._palette = _info.props.get( isColorCont ? "colors.cont" : "colors.cat" );

        const isLabelMapped = _info.data.cols[ LABEL ].mapped;
        const isShowBackgroundChecked = this.properties.get( "text.background.show" );
        this.properties.setActive( "text.background.show", isLabelMapped );
        this.properties.setActive( "text.background.color", isLabelMapped && isShowBackgroundChecked );
        this.properties.setActive( "text.background.opacity", isLabelMapped && isShowBackgroundChecked );
        this.properties.setActive( "text.color", isLabelMapped );
        this.properties.setActive( "text.font", isLabelMapped );
    }

    /**
    * Create function that get x coordinate for gantt bar of a data point
    * @param _startDateCol
    * @param _getStartDate
    */
    private _createGetXFn( _startDateCol: Slot, _getStartDate: Function ): Function
    {
        return ( _dataPoint: DataPoint ): number =>
        {
            const xVal = _getStartDate( _dataPoint, _startDateCol );
            if ( isInvalidDate( xVal ) )
                return this._x1Scale.range()[ 0 ];
            return this._x1Scale( xVal );
        };
    }

    /**
    * Create function that calculate width of gantt bar of a data point
    * @param _startDateCol
    * @param _endDateCol
    * @param _getX
    * @param _getEndDate
    */
    private _createGetWidthFn( _startDateCol: Slot, _endDateCol: Slot, _getX: Function, _getEndDate: Function ): Function
    {
        return ( _dataPoint: DataPoint ): number =>
        {
            const start = _getX( _dataPoint, _startDateCol );
            let end;
            const endVal = _getEndDate( _dataPoint, _endDateCol );
            if ( isInvalidDate( endVal ) )
                end = this._x1Scale.range()[ 1 ];
            else
                end = this._x1Scale( endVal );
            return Math.max( end - start, 0 );
        };
    }

    /**
     * Create object whose key is task names
     * Each task contains an array of array, where each (small) array contains rows that don't overlap eachother
     * If a new overlapping row is found, it will be pushed to a new (small) array
     * @param _rows
     * @param _getStartDate
     * @param _getEndDate
     */
    private _restructureTasks( _rows: DataPoint[], _getStartDate: Function, _getEndDate: Function ): any
    {
        function areRowsOverlap( _row1: DataPoint, _row2: DataPoint, _getStartDate: Function, _getEndDate: Function ): boolean
        {
            function dateToTime( _date: Date | null, startOrEnd: string ): number
            {
                if ( startOrEnd === "start" )
                    return _date ? _date.getTime() : 0;
                else
                    return _date ? _date.getTime() : Number.MAX_SAFE_INTEGER;
            }
            const start1 = dateToTime( _getStartDate( _row1 ), "start" );
            const end1 = dateToTime( _getEndDate( _row1 ), "end" );
            const start2 = dateToTime( _getStartDate( _row2 ), "start" );
            const end2 = dateToTime( _getEndDate( _row2 ), "end" );
            return ( end2 < start1 || start2 > end1 ) ? false : true;
        }
        const tasks: { [taskName: string]: DataPoint[][] } = {};
        _rows.forEach( row =>
        {
            const taskName = row.tuple( TASK ).caption;
            if ( !( taskName in tasks ) ) // Task name not in object, initiate it with row
            {
                tasks[ taskName ] = [ [ row ] ];
            }
            else
            {
                const task: DataPoint[][] = tasks[ taskName ];
                let targetArrayFound = false;
                for ( let i = 0; i < task.length; ++i ) // Iterate through candidate arrays
                {
                    const taskArray = task[ i ];
                    let overlap = false;
                    for ( let j = 0; j < taskArray.length; ++j )
                    {
                        const existingRow = taskArray[ j ];
                        if ( areRowsOverlap( row, existingRow, _getStartDate, _getEndDate ) )
                        {
                            overlap = true; // Row overlaps another row, move on to next array
                            break;
                        }
                    }
                    if ( !overlap ) // An array that can fit the row is found, break loop
                    {
                        targetArrayFound = true;
                        taskArray.push( row );
                        break;
                    }

                }
                if ( !targetArrayFound )
                    task.push( [ row ] ); // No suitable array found, create a new array
            }
        } );
        return tasks;
    }

    /**
     * Map row to its "new" task
     * @param _taskArray Object contains tasks, generated from this._restructureTasks
     */
    private _mapRowToTaskArray( _taskArray: object ): object
    {
        const result: any = {};
        result[ "rowMap" ] = {};
        result[ "numberedTaskArray" ]  = [];
        result[ "taskMap" ] = [];
        Object.keys( _taskArray ).forEach( taskName =>
        {
            const task = _taskArray[ taskName ];
            for ( let i = 0; i < task.length; ++i )
            {
                let numberedTaskName = "";
                for ( let j = 0; j < i; ++j )
                    numberedTaskName += " ";
                numberedTaskName += taskName;
                result.numberedTaskArray.push( numberedTaskName );
                task[ i ].forEach( row =>
                {
                    result.rowMap[ row.key ] = numberedTaskName;
                    if ( !result.taskMap[ numberedTaskName ] )
                        result.taskMap[ numberedTaskName ] = [ row ];
                    else
                        result.taskMap[ numberedTaskName ].push( row );
                } );
            }
        } );
        return result;
    }

    /**
     * Create function to get column starting x and trimmed text
     * @param _taskMap Object map from numbered task to its rows, generated from this._restructureTasks
     * @param _maxColumnWidth Maximum width of a column
     * @param _columnSegments Number of column segments
     * @param _svgElem SVGTextElement object to measure text width
     * @returns A function that returns ColumnValue object from datapoint key and index of column segment
     */
    private _createGetColumnValueFn(
        _taskMap: {[key: string]: [DataPoint]},
        _maxColumnWidth: number,
        _columnSegments: number,
        _svgElem: SVGTextElement ): Function
    {
        function trimText( _text: string, _maxWidth: number ): string | null
        {
            if ( _maxWidth <= 0 )
                return null;
            _svgElem.textContent = _text;
            let i;
            for ( i = _text.length; i > 0 && _svgElem.getSubStringLength( 0, i ) > _maxWidth; i = i - 3 );
            for ( i; i < _text.length && _svgElem.getSubStringLength( 0, i + 1 ) <= _maxWidth; ++i );
            return i < _text.length ? _text.substr( 0, Math.max( 0, i - 1 ) ) + "..." : _text;
        }
        const padding = 10;
        const result: { [key: string]: ColumnValue[]} = {};
        Object.keys( _taskMap ).forEach( taskName =>
        {
            for ( let segmentIndex = 0; segmentIndex < _columnSegments; ++segmentIndex )
            {
                let x = 0;
                _taskMap[ taskName ].forEach( ( row: DataPoint ) =>
                {
                    if ( !( row.key in result ) )
                        result[ row.key ] = new Array( _columnSegments );
                    const trimmedText = trimText( row.tuple( COLUMNS ).segments[ segmentIndex ].caption, _maxColumnWidth - x );
                    result[ row.key ][ segmentIndex ] = {
                        x: x,
                        text: trimmedText
                    };
                    _svgElem.textContent = trimmedText;
                    x = _svgElem.getComputedTextLength() + padding;
                } );
            }
        } );
        return ( dataPointKey: string, i: number ): ColumnValue =>
        {
            return result[ dataPointKey ][ i ];
        };
    }

    /**
     * Create function that return arrows, which connects rows belonging to the same task
     * @param _rows All rows
     * @param _getStartDate Get start date function of DataPoint
     */
    private _getConnectingRows( _rows: DataPoint[], _getStartDate: Function ): Connection[]
    {
        const connections: Connection[] = [];
        const tasks = {};
        _rows.forEach( _row =>
        {
            const taskName = _row.tuple( TASK ).caption;
            if ( !( taskName in tasks ) )
                tasks[ taskName ] = [ _row ];
            else
                tasks[ taskName ].push( _row );
        } );
        for ( const taskName of Object.keys( tasks ) )
        {
            const task: DataPoint[] = tasks[ taskName ];
            task.sort( ( a: DataPoint, b: DataPoint ) => _getStartDate( a ) - _getStartDate( b ) );
            for ( let i = 1; i < task.length; ++i )
                if ( this._rowTaskMap[ task[ i - 1 ].key ] !== this._rowTaskMap[ task[ i ].key ] )
                    connections.push( { from: task[ i - 1 ], to: task[ i ], path: "" } );
        }
        return connections;
    }

    /**
     * Create function that calculates all X coordinates of a path
     * @param _getX Get x of gantt bar function
     * @param _getWidth Get width of gantt bar function
     */
    private _createCalArrowPathXFn( _getX: Function, _getWidth: Function ): Function
    {
        return ( _connection: Connection, _arrowPadding: number ): number[] =>
        {
            const x: number[] = [];
            const fromNode = _connection.from;
            const toNode = _connection.to;
            const startPointX = _getX( fromNode ) + _getWidth( fromNode );
            const endPointX  = _getX( toNode );

            x[ 0 ] = startPointX;
            x[ 1 ] = startPointX + _arrowPadding;
            x[ 2 ] = startPointX + _arrowPadding;
            x[ 3 ] = endPointX - _arrowPadding;
            x[ 4 ] = endPointX - _arrowPadding;
            x[ 5 ] = endPointX;
            return x;
        };
    }

    /**
     * Create function that calculates all Y coordinates of a path
     */
    private _createCalArrowPathYFn(): Function
    {
        return ( _connection: Connection ): number[] =>
        {
            const y: number[] = [];
            const fromNode = _connection.from;
            const toNode = _connection.to;
            const barHeight = this._y0Scale.bandwidth();
            const firstLevelY = this._y0Scale( this._rowTaskMap[ fromNode.key ] ) + barHeight / 2;
            const thirdLevelY = this._y0Scale( this._rowTaskMap[ toNode.key ] ) + barHeight / 2;
            const secondLevelY = ( firstLevelY + thirdLevelY ) / 2;

            y[ 0 ] = firstLevelY;
            y[ 1 ] = firstLevelY;
            y[ 2 ] = secondLevelY;
            y[ 3 ] = secondLevelY;
            y[ 4 ] = thirdLevelY;
            y[ 5 ] = thirdLevelY;
            return y;
        };
    }

    /**
     * Get triangle ( svg marker ) id from color
     * Used for arrow
     * If the wanted triangle does not exist, create one
     * @param color
     */
    private _getTriangleId( color: string ): string
    {
        const colorId = color.replace( "#", "" )
            .split( "," ).join( "_" ).replace( ".", "" )
            .replace( "(", "" ).replace( ")", "" ) ;
        const defs = this._chartContainer.select( "#defs" );
        if ( defs.select( `#triangle_${colorId}` ).empty() )
            defs.append( "svg:marker" )
                .attr( "id", `triangle_${colorId}` )
                .attr( "refX", 5 )
                .attr( "refY", 2.5 )
                .attr( "markerWidth", 30 )
                .attr( "markerHeight", 30 )
                .attr( "markerUnits","userSpaceOnUse" )
                .attr( "orient", "auto" )
                .append( "path" )
                .attr( "d", "M0,0 5,2.5 0,5" )
                .attr( "fill", color );
        return `triangle_${colorId}`;
    }

    public getInteractivity(): any
    {
        return this;
    }

    public startInteractivity(): void
    {}

    public cancelInteractivity( _visCoord, _viewPortPoint ): void
    {}

    public endInteractivity( _visCoord, _viewPortPoint ): void
    {}

    public canTranslate(): boolean
    {
        return true;
    }

    public canZoom(): boolean
    {
        return true;
    }

    public translate( _visCoord, _viewPortPoint, _viewDelta ): void
    {
        const currenttransform = d3.zoomTransform( this._chartContainer.select( ".chart" ).node() as Element );
        let dx = currenttransform.x + _viewDelta.x;
        const xScaleRange = this._x1Scale.range();
        const rightLimit = xScaleRange[ 1 ] - ( xScaleRange[ 1 ] * currenttransform.k );
        const leftLimit = xScaleRange[ 0 ] - ( xScaleRange[ 0 ] * currenttransform.k );
        // reached the limits on left and right.
        if ( ( currenttransform.x <= rightLimit && _viewDelta.x < 0 ) || ( currenttransform.x >= leftLimit && _viewDelta.x > 0 ) )
            return;
        dx = Math.max( rightLimit, Math.min( leftLimit, dx ) );
        this._zoom.translateBy( this._chartContainer.select( ".chart" ), dx - currenttransform.x, 0 );
    }

    public zoom( _visCoord, _viewPortPoint, _zoom ): void
    {
        const currenttransform = d3.zoomTransform( this._chartContainer.select( ".chart" ).node() as Element );
        let zoomScale = Math.max( 1, currenttransform.k * _zoom );
        zoomScale = Math.min( zoomScale, 20 );
        let left = _viewPortPoint.x - ( _viewPortPoint.x - currenttransform.x ) * zoomScale / currenttransform.k;
        if ( zoomScale === 1 )
            left = 0;
        this._chartContainer.select( ".chart" ).call(
            this._zoom.transform,
            d3.zoomIdentity.translate( left , 0 ).scale( zoomScale )
        );
    }

    protected hitTest( _elem: Element | null ): DataPoint | Segment | null
    {
        // Retrieve the d3 datum of the element that was hit.
        const elem = d3.select<Element, any>( _elem );
        const node = elem.empty() ? null : elem.datum();
        if ( node instanceof Object && "segment" in node )
            return node.segment;
        return node;
    }
}