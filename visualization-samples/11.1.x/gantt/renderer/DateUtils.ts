// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

export default class DateUtils
{
    // Get date string from tuple key, since some dates are automatically parsed,
    // the caption is formatted and can't be recognized by Date parser
    // Used to parse Date object in CA, since it doens't support temporal slot
    // Also see: VIDA-3623, VIDA-3804, VIDA-4456 and VIDA-6959
    public static extractDate( _tupleKey: string ): Date | null
    {
        const numberTupleKey = Number.parseFloat( _tupleKey );
        const date = new Date( isNaN( numberTupleKey ) ? _tupleKey : numberTupleKey );
        if ( !Number.isNaN( date.getTime() ) )
        {
            return date;
        }

        // Try and parse Reporting/Image Service "(idx)(idx)20220131"
        const reportingFormat = /^\(\d+\)\(\d+\).+$/; //(idx)(idx)date
        if ( reportingFormat.test( _tupleKey ) )
        {
            const replace = /\(\d+\)\(\d+\)/; // replace (index)(index) with empty string
            const dateString = _tupleKey.replace( replace, "" );
            const dateNumber = Number( dateString );
            return isNaN( dateNumber ) ? new Date( dateString ) : new Date( dateNumber );
        }

        // Try and parse CA or local key ("DATASET.SLOT->[2018-02-18 19:00:00]" or "[ID].[SLOT].[1533959781804]")
        let dateStartIndex: number = _tupleKey.lastIndexOf( "[" );
        let dateEndIndex: number;
        if ( dateStartIndex === -1 )
        {
            // Try and parse Reporting key ("SLOT-Nov 04, 2019 3:15:00 PM")
            dateStartIndex = _tupleKey.lastIndexOf( "-" );
            if ( dateStartIndex !== -1 )
            {
                dateStartIndex++;
            }
            dateEndIndex = _tupleKey.length;
        }
        else
        {
            // Skip opening bracket and find matching bracket
            dateStartIndex++;
            dateEndIndex = _tupleKey.indexOf( "]", dateStartIndex );
        }

        if ( dateStartIndex === -1 || dateEndIndex === -1 || dateStartIndex === dateEndIndex )
        {
            console.warn( `Cannot extract date from  ${_tupleKey}` );
            return null;
        }

        let dateString = _tupleKey.slice( dateStartIndex, dateEndIndex );
        const dateNumber = Number( dateString );
        if ( isNaN( dateNumber ) )
        {
            // work around for invalid date issue VIDA-6740
            if ( dateString.startsWith( "00 " ) )
            {
                dateString = "20" + dateString;
            }

            // Workaround for VIDA-7182. For german content language date contains comma instead of dot
            if ( dateString.includes( "," ) )
            {
                dateString = dateString.replace( ",", "." );
            }

            return new Date( dateString );
        }

        return new Date( dateNumber );
    }
}