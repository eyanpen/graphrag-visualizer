#!/bin/bash
# Usage: ./load_output.sh <path-to-graphrag-output-directory>
# Example: ./load_output.sh ../../examples/graphrag-example/output
#
# This script creates a symlink from public/artifacts to the specified
# graphrag output directory, so the visualizer auto-loads the parquet
# files in development mode.

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path-to-graphrag-output-directory>"
    echo ""
    echo "Examples:"
    echo "  $0 ../../examples/graphrag-example/output"
    echo "  $0 /absolute/path/to/output"
    exit 1
fi

OUTPUT_DIR="$1"

# Resolve to absolute path
if [[ "$OUTPUT_DIR" != /* ]]; then
    OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"
fi

if [ ! -d "$OUTPUT_DIR" ]; then
    echo "Error: Directory '$OUTPUT_DIR' does not exist."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARTIFACTS_LINK="$SCRIPT_DIR/public/artifacts"

# Remove existing artifacts link/directory
if [ -L "$ARTIFACTS_LINK" ]; then
    rm "$ARTIFACTS_LINK"
    echo "Removed existing symlink: $ARTIFACTS_LINK"
elif [ -d "$ARTIFACTS_LINK" ]; then
    rm -rf "$ARTIFACTS_LINK"
    echo "Removed existing directory: $ARTIFACTS_LINK"
fi

ln -s "$OUTPUT_DIR" "$ARTIFACTS_LINK"
echo "Linked: $ARTIFACTS_LINK -> $OUTPUT_DIR"
echo ""
echo "Parquet files found:"
ls -1 "$ARTIFACTS_LINK"/*.parquet 2>/dev/null || echo "  (none)"
echo ""
echo "Restart the dev server (npm start) or refresh the browser to load."
