/* eslint-disable @typescript-eslint/no-namespace */
// Licensed Materials - Property of IBM
//
// VIDA Bundles
//
// (C) Copyright IBM Corp. 2023, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.


export enum ScaleSteps
{
    Low         = "Low",
    Medium      = "Medium",
    High        = "High",
    VeryHigh    = "Very High"
}

export namespace ScaleSteps
{
   /**
     * Parse a [[ScaleSteps]] from `string`.
     * @param {string} _value The `string` value to parse.
     * @return The parsed `ScaleSteps`.
     */
    export function parse( _value: string ): ScaleSteps
    {
        switch ( _value.toLowerCase() )
        {
            case "low":
                return ScaleSteps.Low;
            case "medium":
                return ScaleSteps.Medium;
            case "high":
                return ScaleSteps.High;
            case "very high":
                return ScaleSteps.VeryHigh;
            default:
                throw new TypeError( `${_value} is not a valid scale value. Please use "${ScaleSteps.Low}", "${ScaleSteps.Medium}", "${ScaleSteps.High}" or "${ScaleSteps.VeryHigh}"` );
        }
    }
}

export const colorThresholds = [
    {
        name: ScaleSteps.Low,
        threshold: 0.2
    },
    {
        name: ScaleSteps.Medium,
        threshold: 0.4
    },
    {
        name: ScaleSteps.High,
        threshold: 0.8
    },
    {
        name: ScaleSteps.VeryHigh,
        threshold: 1
    }
];

export function getColorCategory( value: number ): ScaleSteps
{
    for ( const colorEntry of colorThresholds )
    {
        if( value < colorEntry.threshold )
            return colorEntry.name;
    }

    return ScaleSteps.VeryHigh;
}

export const scaleStepsMap = new Map(
    [
        [ ScaleSteps.Low, { weight: 0.3 } ],
        [ ScaleSteps.Medium, { weight: 0.5 } ],
        [ ScaleSteps.High, { weight: 0.8 } ],
        [ ScaleSteps.VeryHigh, { weight: 1 } ]
    ] );