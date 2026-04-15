#!/bin/bash
# GraphRAG Visualizer Startup Script
# Starts both the GraphRAG API backend and the React frontend.
# Configuration is read from config.yaml.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.yaml"
PID_DIR="$SCRIPT_DIR/.pids"

# ---- Help ----
show_help() {
    cat <<EOF
Usage: ./start.sh [OPTIONS]

Start the GraphRAG Visualizer (API backend + React frontend).
Configuration is read from config.yaml in the same directory.

Options:
  -h, --help          Show this help message and exit
  --api-only          Start only the GraphRAG API server
  --frontend-only     Start only the React frontend (API must be running separately)
  --daemon            Run in background (detached); use stop.sh to stop

Examples:
  ./start.sh                  # Start both API and frontend in foreground
  ./start.sh --daemon         # Start both in background
  ./start.sh --api-only       # Start only the API server
  ./start.sh -h               # Show this help

Related:
  ./stop.sh                   # Stop all running services
  ./stop.sh --api-only        # Stop only the API server
  ./stop.sh --frontend-only   # Stop only the frontend
EOF
    exit 0
}

# ---- Parse arguments ----
API_ONLY=false
FRONTEND_ONLY=false
DAEMON=false

for arg in "$@"; do
    case $arg in
        -h|--help)
            show_help
            ;;
        --api-only)
            API_ONLY=true
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            ;;
        --daemon)
            DAEMON=true
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use -h or --help for usage information."
            exit 1
            ;;
    esac
done

# ---- Config check ----
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: config.yaml not found at $CONFIG_FILE"
    echo "Please create config.yaml from the template."
    exit 1
fi

# Parse config.yaml for host and ports using python
read_config() {
    python3 -c "
import yaml, sys
with open('$CONFIG_FILE') as f:
    cfg = yaml.safe_load(f)
server = cfg.get('server', {})
print(server.get('host', '0.0.0.0'))
print(server.get('frontend_port', 16888))
print(server.get('api_port', 16889))
"
}

CONFIG_VALUES=$(read_config)
HOST=$(echo "$CONFIG_VALUES" | sed -n '1p')
FRONTEND_PORT=$(echo "$CONFIG_VALUES" | sed -n '2p')
API_PORT=$(echo "$CONFIG_VALUES" | sed -n '3p')

# ---- Check if already running ----
if [ -f "$PID_DIR/api.pid" ] || [ -f "$PID_DIR/frontend.pid" ]; then
    RUNNING=""
    if [ -f "$PID_DIR/api.pid" ]; then
        API_OLD_PID=$(cat "$PID_DIR/api.pid")
        if kill -0 "$API_OLD_PID" 2>/dev/null; then
            RUNNING="$RUNNING API(PID $API_OLD_PID)"
        fi
    fi
    if [ -f "$PID_DIR/frontend.pid" ]; then
        FE_OLD_PID=$(cat "$PID_DIR/frontend.pid")
        if kill -0 "$FE_OLD_PID" 2>/dev/null; then
            RUNNING="$RUNNING Frontend(PID $FE_OLD_PID)"
        fi
    fi
    if [ -n "$RUNNING" ]; then
        echo "WARNING: Services already running:$RUNNING"
        echo "Run ./stop.sh first, or use --daemon to start additional services."
        exit 1
    fi
fi

mkdir -p "$PID_DIR"

echo "============================================"
echo "  GraphRAG Visualizer"
echo "============================================"
echo "  Host:           $HOST"
echo "  Frontend Port:  $FRONTEND_PORT"
echo "  API Port:       $API_PORT"
echo "  Config:         $CONFIG_FILE"
echo "  Mode:           $([ "$DAEMON" = true ] && echo 'daemon' || echo 'foreground')"
echo "============================================"

cleanup() {
    echo ""
    echo "Shutting down..."
    if [ -n "$API_PID" ]; then
        kill "$API_PID" 2>/dev/null || true
        echo "  Stopped API server (PID $API_PID)"
        rm -f "$PID_DIR/api.pid"
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        echo "  Stopped Frontend server (PID $FRONTEND_PID)"
        rm -f "$PID_DIR/frontend.pid"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# ---- Start API server ----
if [ "$FRONTEND_ONLY" = false ]; then
    echo ""
    echo "Starting GraphRAG API server on $HOST:$API_PORT ..."
    cd "$SCRIPT_DIR/graphrag-api"
    python3 api.py &
    API_PID=$!
    echo "$API_PID" > "$PID_DIR/api.pid"
    echo "  API server PID: $API_PID"
    cd "$SCRIPT_DIR"
    sleep 2
fi

# ---- Start Frontend ----
if [ "$API_ONLY" = false ]; then
    echo ""
    echo "Starting React frontend on $HOST:$FRONTEND_PORT ..."
    export PORT=$FRONTEND_PORT
    export HOST=$HOST
    export REACT_APP_API_URL="http://${HOST}:${API_PORT}"
    if [ "$HOST" = "0.0.0.0" ]; then
        export REACT_APP_API_URL="http://localhost:${API_PORT}"
    fi
    export BROWSER=none
    cd "$SCRIPT_DIR"
    npx react-app-rewired start &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"
    echo "  Frontend PID: $FRONTEND_PID"
fi

echo ""
echo "============================================"
echo "  Services running:"
if [ "$FRONTEND_ONLY" = false ]; then
    echo "  API:      http://${HOST}:${API_PORT}  (PID $API_PID)"
fi
if [ "$API_ONLY" = false ]; then
    echo "  Frontend: http://${HOST}:${FRONTEND_PORT}  (PID $FRONTEND_PID)"
fi
if [ "$DAEMON" = true ]; then
    echo ""
    echo "  Running in daemon mode."
    echo "  Use ./stop.sh to stop all services."
else
    echo "  Press Ctrl+C to stop all services"
fi
echo "============================================"

if [ "$DAEMON" = true ]; then
    disown
    exit 0
fi

# Foreground mode: wait for background processes
wait
