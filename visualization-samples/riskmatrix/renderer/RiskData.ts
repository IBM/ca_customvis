// Licensed Materials - Property of IBM
//
// IBM Watson Analytics
//
// (C) Copyright IBM Corp. 2023, 2024
//
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

import { DataSet, Slot, Tuple, DataPoint } from "@businessanalytics/customvis-lib";
import { ScaleSteps, getColorCategory, scaleStepsMap } from "./ScaleSteps";

const PROBABILITY = 0, IMPACT = 1;

const xSymbol = "×";
const PROBABILITY_DATUM = "probability";
const IMPACT_DATUM = "impact";

export class RiskTileData
{
    public readonly children: DataPoint[] = [];
    public probabilityTuple: Tuple;
    public impactTuple: Tuple;
    private readonly _probabilityCaption: ScaleSteps;
    private readonly _impactCaption: ScaleSteps;

    constructor( probabilityTuple: Tuple, impactTuple: Tuple )
    {
        this.probabilityTuple = probabilityTuple;
        this.impactTuple = impactTuple;
        this._probabilityCaption = ScaleSteps.parse( probabilityTuple.caption );
        this._impactCaption = ScaleSteps.parse( impactTuple.caption );
    }

    public addChild( _dataPoint: DataPoint ): void
    {
        this.children.push( _dataPoint );
    }

    public getKey(): string
    {
        return `${this.probabilityKey}${xSymbol}${this.impactKey}`;
    }

    public get childrenCount() : number
    {
        return this.children.length;
    }

    public get probabilityKey(): string
    {
        return this.probabilityTuple.key;
    }

    public get impactKey(): string
    {
        return this.impactTuple.key;
    }

    public get probabilityCaption(): ScaleSteps
    {
        return this._probabilityCaption;
    }

    public get impactCaption(): ScaleSteps
    {
        return this._impactCaption;
    }

    public get riskRating(): ScaleSteps
    {
        const impactWeight = scaleStepsMap.get( this.probabilityCaption ).weight;
        const probabilityWeight = scaleStepsMap.get( this.impactCaption ).weight;
        return getColorCategory( impactWeight * probabilityWeight );
    }

    public get selected(): boolean
    {
        return this.children.some( function( _item )
        {
            return _item.selected;
        } );
    }

    public get highlighted(): boolean
    {
        return this.children.some( function( _item )
        {
            if( _item.highlighted )
                return _item.highlighted;
        } );
    }
}

export class RiskData
{
    private readonly _dataSet: DataSet = null;
    private readonly _isEmpty: boolean;
    private readonly _tiles: Map<string, RiskTileData>;
    private _impactCaption: string;
    private _probabilityCaption: string;

    private constructor( _dataSet: DataSet )
    {
        this._dataSet = _dataSet;
        this._isEmpty = _dataSet === null;
        this._tiles = new Map<string, RiskTileData>();
        this._impactCaption = "";
        this._probabilityCaption = "";
    }

    public static process( _dataSet: DataSet ): RiskData
    {
        const riskData = new RiskData( _dataSet );

        // If the data we received is null, we assume empty data.
        // In that case there is not much to process, so we're done.
        if ( !_dataSet )
            return riskData;

        const probabilitySlot: Slot = _dataSet.cols[ PROBABILITY ];
        const impactSlot: Slot = _dataSet.cols[ IMPACT ];

        const probabilityTuples = probabilitySlot.tuples;
        const impactTuples = impactSlot.tuples;

        probabilityTuples.forEach( ( probabilityTuple ) =>
            {
                impactTuples.forEach( ( impactTuple ) =>
                    {
                        riskData.addRiskTile( probabilityTuple, impactTuple ); //.set( key , new RiskTileData( probabilityKey, impactKey ) );
                    } );
            } );

        // Remember the titles
        riskData._impactCaption = impactSlot.caption;
        riskData._probabilityCaption = probabilitySlot.caption;

        // Iterate all data points and add LineItems to each LineGroup. A LineGroup represents
        // a series item. A LineItem is added for each category item.

        _dataSet.rows.forEach( ( row: DataPoint ) =>
            {
                const probabilityKey = row.source.get( PROBABILITY_DATUM ).asCat().getKey( true );
                const impactKey = row.source.get( IMPACT_DATUM ).asCat().getKey( true );

                // extract function to create key - maybe static on RiskTileData
                const rowString = `${probabilityKey}${xSymbol}${impactKey}`;
                const riskTile = riskData._tiles.get( rowString );

                if( riskTile )
                {
                    // TODO: keep this if we want to have a property
                    // riskTile.riskRating = row.source.get( "risk" ).asCat().getCaption( FormatType.label );
                    riskTile.addChild( row );
                }
            }
        );

        return riskData;
    }

    // TODO: hittest on axes labels
    public static getHittestData( _data: any ): DataPoint | null
    {
        if ( _data instanceof RiskTileData )
        {
            if( _data.children.length !== 0 )
            {
                return _data.children;
            }
        }

        return null;
    }

    public get hasSelection(): boolean
    {
        return this._dataSet ? this._dataSet.hasSelections : false;
    }

    public get riskTiles(): RiskTileData[]
    {
        return Array.from( this._tiles.values() );
    }

    private addRiskTile(  _probabilityTuple: Tuple, _impactTuple: Tuple ): void
    {
        const key = `${_probabilityTuple.key}${xSymbol}${_impactTuple.key}`;
        this._tiles.set( key, new RiskTileData( _probabilityTuple, _impactTuple ) );
    }

    public get probabilityCaption(): string
    {
        return this._probabilityCaption;
    }

    public get impactCaption(): string
    {
        return this._impactCaption;
    }
}
