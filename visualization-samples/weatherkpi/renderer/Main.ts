/**
 * Licensed Materials - Property of IBM
 *
 * Copyright IBM Corp. 2019 All Rights Reserved.
 *
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

import { RenderBase, UpdateInfo } from "@businessanalytics/customvis-lib";
import * as d3 from "d3";

/**
 * This sample illustrates the use of static images to represent a single data
 * value. In addition, the data value is displayed as a formatted number and
 * optionally the corresponding measure name is displayed in the visualization.
 */
export default class extends RenderBase
{
    /**
     * Initial setup of the visualization. Called only once during creation.
     * @param _node Visualization container node.
     * @returns The svg node in which the visualization is rendered.
     */
    protected create( _node: HTMLElement ): Element
    {
        // Create an svg node with two text fields for value and title.
        const svg = d3.select( _node ).append( "svg" )
            .attr( "viewBox", "0 0 100 100" )
            .attr( "width", "100%" )
            .attr( "height", "100%" );

        svg.append( "image" )
            .attr( "x", "15" )
            .attr( "width", "70" )
            .attr( "height", "70" );

        svg.append( "text" )
            .attr( "class", "value" )
            .attr( "x", "50" )
            .attr( "y", "78" )
            .style( "font-size", "12px" )
            .style( "text-anchor", "middle" )
            .style( "text-shadow","4px 4px 8px white" );

        svg.append( "text" )
            .attr( "class", "title" )
            .attr( "x", "50" )
            .attr( "y", "92" )
            .style( "font-size", "10px" )
            .style( "text-anchor", "middle" )
            .style( "text-shadow","4px 4px 8px white" );

        // Return the svg node as the visualization root node.
        return svg.node();
    }

    /**
     * Called each time the visualization needs to update. For instance when the
     * data has changed, the visualization is resized or one of the property values
     * has changed.
     * @param _info Update information (like data, node, reason etc.).
     */
    protected update( _info: UpdateInfo ): void
    {
        const data = _info.data;
        const props = _info.props;
        const svg = d3.select( _info.node );

        svg.style( "background-color", props.get( "background-color" ) );

        if ( !data )
        {
            // No data specified, remove the image and titles.
            svg.select( "image" ).attr( "xlink:href", "" );
            svg.select( "text.value" ).text( "No Data" );
            svg.select( "text.title" ).text( "" );
        }
        else
        {
            // Determine the min-max range that should be applied to the data.
            const min = props.get( "min" );
            const max = props.get( "max" );

            // Calculate a fraction based on the input data and the min-max range.
            let fraction = 0;
            if ( min !== max ) // prevent division by zero
                fraction = ( data.rows[ 0 ].value( "value" ) - min ) / ( max - min );

            // Determine image file name based on the calculated fraction.
            const imageId = fraction < 0.2 ? "5" : // thunderstorm
                            fraction < 0.4 ? "4" : // rain
                            fraction < 0.6 ? "3" : // cloudy
                            fraction < 0.8 ? "2" : // partly cloudy
                            /* default */    "1";  // sunny
            const filename = this.toUrl( `../static/weather-${imageId}.png` );

            // Binding the svg node to data automatically provides us with tooltip support.
            svg.data( data.rows );

            // Set the image, value and title.
            svg.select( "image" ).attr( "xlink:href", `${filename}` );
            svg.select( "text.value" ).text( props.get( "value" ) ? data.rows[ 0 ].caption( "value" ) : "" );
            svg.select( "text.title" ).text( props.get( "title" ) ? data.cols[ 0 ].caption : "" );
        }
    }
}
