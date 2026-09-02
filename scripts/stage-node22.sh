#!/usr/bin/env bash
set -euo pipefail

# Stage the Node 22 binary for packaging
# Copies the Node 22 binary into build/node22-bin/ so electron-builder can bundle it

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/../build"
NODE22_BIN_DIR="${BUILD_DIR}/node22-bin"

# Source for Node 22 binary (override via env if needed)
NODE22_SRC="${OPENCLAW_NODE22_SRC:-${SCRIPT_DIR}/../spikes/openclaw-test/.nvm/versions/node/v22.23.2}"

if [[ ! -f "${NODE22_SRC}/bin/node" ]]; then
  echo "Error: Node 22 binary not found at ${NODE22_SRC}/bin/node" >&2
  echo "Set OPENCLAW_NODE22_SRC to point to a Node 22 installation directory" >&2
  exit 1
fi

# Create staging directory
mkdir -p "${NODE22_BIN_DIR}"

# Copy the binary
cp "${NODE22_SRC}/bin/node" "${NODE22_BIN_DIR}/node"
chmod +x "${NODE22_BIN_DIR}/node"

# Report
STAGED_PATH="${NODE22_BIN_DIR}/node"
STAGED_SIZE=$(ls -lh "${STAGED_PATH}" | awk '{print $5}')
echo "Staged Node 22 binary: ${STAGED_PATH} (${STAGED_SIZE})"
