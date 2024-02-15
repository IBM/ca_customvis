/* GENERATED FILE */

// Rollup plugins
const { nodeResolve } = require( "@rollup/plugin-node-resolve" );
const commonjs = require( "@rollup/plugin-commonjs" );
const { babel } = require( "@rollup/plugin-babel" );

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
    paths[ "d3" ] = "https://d3js.org/d3.v7.min.js";

module.exports =
{
    input,
    plugins:
    [
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
            inputSourceMap: false,
            presets:
            [
                "@babel/env",
                "@babel/typescript"
            ],
            plugins:
            [
                "@babel/transform-class-properties",
                "@babel/transform-object-rest-spread"
            ]
        } )
    ],
    output:
    {
        paths,
        format: "amd",
        sourcemap: true
    }
};
