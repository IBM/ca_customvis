/* GENERATED FILE */

// Rollup plugins
const resolve = require( "@rollup/plugin-node-resolve" );
const commonjs = require( "@rollup/plugin-commonjs" );
const babel = require( "rollup-plugin-babel" );

// Utilities
const path = require( "path" );
const fs = require( "fs" );
const pkgJson = require( "./package.json" );

const extensions = [ ".js", ".ts" ];
const input = fs.existsSync( path.join( __dirname, "./renderer/Main.ts" ) ) ?
                    path.join( __dirname, "./renderer/Main.ts" ) :
                    path.join( __dirname, "./renderer/Main.js" );

const hasD3Dependency = !!pkgJson.dependencies.d3;
const paths = {
    "requirejs": "require"
};

if ( !hasD3Dependency )
    paths[ "d3" ] = "https://d3js.org/d3.v5.min.js";

module.exports =
{
    input,
    plugins:
    [
        resolve(
        {
            extensions
        } ),
        commonjs(),
        babel(
        {
            cwd: __dirname,
            babelrc: false,
            exclude: [ "node_modules/**" ],
            extensions,
            presets:
            [
                "@babel/env",
                "@babel/typescript"
            ],
            plugins:
            [
                "@babel/proposal-class-properties",
                "@babel/proposal-object-rest-spread"
            ]
        } )
    ],
    output:
    {
        paths,
        format: "amd",
        sourcemap: "inline"
    }
};
