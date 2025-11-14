#!/bin/bash
set -e

# Check for jq dependency
if ! command -v jq >/dev/null 2>&1; then
    echo "❌ Error: 'jq' is required but not installed."
    echo "Please install jq:"
    echo "  - sudo apt install jq"
    exit 1
fi

ACTION=$1
shift || true # remove first argument (action)

if [ -z "$ACTION" ]; then
    echo "❌ Error: First argument must be ACTION (BUILD, PUBLISH, REMOVE)"
    exit 1
fi
BACKEND_VERSION=$(jq -r .version ./package.json)
#####################################
# BUILD
#####################################
if [ "$ACTION" = "BUILD" ]; then
    PKG_NAME=$1
    PKG_VERSION="${2:-$BACKEND_VERSION}"

    if [ -z "$PKG_NAME" ]; then
        echo "❌ Error: BUILD requires <package-name> [package-version]"
        exit 1
    fi

    # try to locate folder automatically under ./packages
    PKG_DIR=$(find ./packages -maxdepth 3 -type d -exec bash -c \
        'jq -r .name "$1/package.json" 2>/dev/null | grep -q "^'"$PKG_NAME"'$" && echo "$1"' _ {} \; | head -n1)

    if [ -z "$PKG_DIR" ]; then
        echo "⚠️  Could not locate package '$PKG_NAME' in ./packages. Creating it..."
        PKG_DIR="./packages/$PKG_NAME" 
        mkdir -p "$PKG_DIR"

        cat > "$PKG_DIR/package.json" <<EOF
{
  "name": "$PKG_NAME",
  "version": "$BACKEND_VERSION",
  "types": "src/generated/index.api.d.ts",
  "license": "MIT"
}
EOF

        echo "📦 Created new package scaffold at $PKG_DIR"
    fi

    echo "🏗️ Building $PKG_NAME:$PKG_VERSION (dir: $PKG_DIR)"

    tsc -b ./tsconfig.build.json 2>&1 | tee >(grep -i "error" >&2) || \
      echo "⚠️ TypeScript build completed with warnings or errors, but continuing execution."

    exit 0
fi


npm-cli-login \
  -u sorin \
  -p sorin \
  -e sorin@nb.com \
  -r http://localhost:8888 \
  --config-path ~/.npmrc

BACKEND_VERSION=$(jq -r .version ./package.json)

#####################################
# PUBLISH
#####################################
if [ "$ACTION" = "PUBLISH" ]; then
    PKG_FOLDER=$1
    if [ -z "$PKG_FOLDER" ]; then
        echo "❌ Error: PUBLISH requires <package-folder>"
        exit 1
    fi

    cd "./packages/$PKG_FOLDER"

    PKG_NAME=$(jq -r .name package.json)
    PKG_VERSION=$(jq -r .version package.json)

    echo "🚀 Publishing $PKG_NAME@$PKG_VERSION from ./packages/$PKG_FOLDER"
    npm publish --registry http://localhost:8888
    echo "✅ Published $PKG_NAME@$PKG_VERSION to localhost registry."
    exit 0
fi

#####################################
# REMOVE
#####################################
if [ "$ACTION" = "REMOVE" ]; then
    PKG_NAME=$1
    if [ -z "$PKG_NAME" ]; then
        echo "❌ Error: REMOVE requires <package-name>"
        exit 1
    fi

    echo "🗑️ Removing $PKG_NAME from localhost registry..."
    npm unpublish "$PKG_NAME" --registry http://localhost:8888 --force
    echo "✅ Removed $PKG_NAME from localhost registry."
    exit 0
fi

#####################################
# FALLBACK
#####################################
echo "❌ Unknown action: $ACTION"
echo "Usage:"
echo "  $0 BUILD <package-name> [package-version]"
echo "  $0 PUBLISH <package-folder>"
echo "  $0 REMOVE <package-name>"
exit 1
