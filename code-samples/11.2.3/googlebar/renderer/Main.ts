// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2022
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { RenderBase, UpdateInfo, CatPalette } from "@businessanalytics/customvis-lib";
import { loadGoogleCharts } from "@vida/google-vizbundle-utils";

const loadPromise = loadGoogleCharts();
loadPromise.then( () => google.charts.load( "current", { packages: [ "corechart" ] } ) );

const CATEGORY = 0, SERIES = 1, VALUE = 2;

const defaultOptions = {
    animation: {
        duration: 100
    }
};

export default class extends RenderBase
{
    private _chart: any;

    protected create( _node: HTMLElement ): void
    {
        // Initialize the chart
        loadPromise.then( () => google.charts.setOnLoadCallback( () => this._chart = new google.visualization.BarChart( _node ) ) );
    }

    protected update( _info: UpdateInfo ): void
    {
        const data = _info.data;
        const props = _info.props;

        // Clear chart if there's no data
        if ( !data || data.rows.length === 0 )
        {
            if ( this._chart )
                this._chart.clearChart();
            return;
        }

        // Convert data source to google charts format
        const chartData = [];
        if ( data.cols[ SERIES ].mapped )
        {
            // Get list of categories and series
            const categories = data.cols[ CATEGORY ].tuples.map( e => e.caption );
            const series = data.cols[ SERIES ].tuples.map( e => e.caption );
            // initialize chart data as 2d array
            // header row
            chartData.push( [ data.cols[ CATEGORY ].caption ].concat( series ) );
            // empty array for each category
            categories.forEach( _category =>
                {
                    // for each category, create an array of series.length + 1, with an extra (first) item for category name
                    // Fill with 0 since in some cases, null data is not handled well
                    const catArray = new Array( series.length + 1 ).fill( 0 );
                    catArray[ 0 ] = _category;
                    chartData.push( catArray );
                } );
            // fill chart data with data rows
            data.rows.forEach( _row =>
                {
                    chartData[ categories.indexOf( _row.tuple( CATEGORY ).caption ) + 1 ][ series.indexOf( _row.tuple( SERIES ).caption ) + 1 ] = _row.value( VALUE );
                } );
        }
        else
        {
            // header row
            chartData.push( [ data.cols[ CATEGORY ].caption, data.cols[ VALUE ].caption ] );
            // add data
            data.rows.forEach( _row =>
            {
                chartData.push( [ _row.tuple( CATEGORY ).caption, _row.value( VALUE ) ] );
            } );
        }

        // Hide series options if series is not mapped
        props.setActive( "series.type", data.cols[ SERIES ].mapped );

        // Set google chart options via properties and
        const palette: CatPalette = props.get( "colors" );
        const stack = props.get( "series.type" );

        const options: any = {
            ...defaultOptions,
            backgroundColor: {
                fill: props.get( "background.color" ).toString()
            },
            // If series is mapped, return an array of colors (from the palette) corresponding to tuples of series slot
            // Else, return an array containing the first color from the palette
            colors: data.cols[ SERIES ].mapped ? data.cols[ SERIES ].tuples.map( _t => palette.getColor( _t ).toString() ) : [ palette.getColor( null ).toString() ],
            hAxis: {
                title: props.get( "hAxis.title" ),
                titleTextStyle: { color: props.get( "hAxis.title.color" ).toString() },
                textStyle:{ color: props.get( "hAxis.label.color" ).toString() },
                direction: props.get( "hAxis.inverse" ) ? -1 : 1,
                gridlines: { color: props.get( "hAxis.grid.color" ).toString() },
                baselineColor: props.get( "hAxis.baseline.color" ).toString(),
                minValue: props.get( "hAxis.minValue" ),
                maxValue: props.get( "hAxis.maxValue" )
            },
            vAxis: {
                title: props.get( "vAxis.title" ),
                titleTextStyle: { color: props.get( "vAxis.title.color" ).toString() },
                textStyle:{ color: props.get( "vAxis.label.color" ).toString() },
                direction: props.get( "vAxis.inverse" ) ? -1 : 1
            },
            chartArea: {
                left: props.get( "grid.left.padding" ),
                right: props.get( "grid.right.padding" ),
                top: props.get( "grid.top.padding" ),
                bottom: props.get( "grid.bottom.padding" )
            },
            bar: { groupWidth: props.get( "bar.width" ) },
            isStacked: stack === "grouped" ? false : stack === "stacked" ? true : "percent",
            legend: {
                position: props.get( "googleLegend.position" ),
                alignment: props.get( "googleLegend.alignment" ),
                textStyle:{ color: props.get( "googleLegend.color" ).toString() }
            }
        };

        google.charts.setOnLoadCallback( () => this._chart.draw( google.visualization.arrayToDataTable( chartData ), options ) );
    }

    // Disable/enable properties based on property update
    protected updateProperty( _name: string, _value: any ): void
    {
        switch( _name )
        {
            case "hAxis.title":
                this.properties.setActive( "hAxis.title.color", _value );
                break;
            case "vAxis.title":
                this.properties.setActive( "vAxis.title.color", _value );
                break;
            case "googleLegend.position":
                this.properties.setActive( "googleLegend.alignment", _value !== "none" );
                this.properties.setActive( "googleLegend.color", _value !== "none" );
        }
    }
}
