/* GENERATED FILE */

// Rollup plugins
const { nodeResolve } = require( "@rollup/plugin-node-resolve" );
const commonjs = require( "@rollup/plugin-commonjs" );
const { babel } = require( "@rollup/plugin-babel" );
const replace = require( "@rollup/plugin-replace" );

// Utilities
const path = require( "path" );
const fs = require( "fs" );
const pkgJson = require( "./package.json" );
const dependencies = pkgJson.dependencies || {};

const extensions = [ ".js", ".ts" ];
const input = fs.existsSync( path.join( __dirname, "./renderer/Main.ts" ) ) ?
                    path.join( __dirname, "./renderer/Main.ts" ) :
                    path.join( __dirname, "./renderer/Main.js" );

const hasD3Dependency = !!dependencies.d3;
const paths = {
    "requirejs": "require"
};

if ( !hasD3Dependency )
    paths[ "d3" ] = "https://d3js.org/d3.v5.min.js";

module.exports =
{
    input,
    external:
    [
        ...Object.keys( paths ),
        ...Object.keys( dependencies )
    ],
    plugins:
    [
        // ECharts 6 reads process.env.NODE_ENV, which does not exist in the browser
        replace(
        {
            preventAssignment: true,
            values: { "process.env.NODE_ENV": JSON.stringify( "production" ) }
        } ),
        nodeResolve(
        {
            extensions
        } ),
        commonjs(),
        babel(
        {
            cwd: __dirname,
            babelHelpers: "bundled",
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
        sourcemap: "inline",
        file: "build/renderer/Main.js"
    }
};
