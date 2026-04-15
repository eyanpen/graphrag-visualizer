#!/bin/bash
# GraphRAG Visualizer Stop Script
# Stops the API backend and/or React frontend started by start.sh.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

# ---- Help ----
show_help() {
    cat <<EOF
Usage: ./stop.sh [OPTIONS]

Stop the GraphRAG Visualizer services started by start.sh.

Options:
  -h, --help          Show this help message and exit
  --api-only          Stop only the GraphRAG API server
  --frontend-only     Stop only the React frontend

Examples:
  ./stop.sh                   # Stop all services
  ./stop.sh --api-only        # Stop only the API server
  ./stop.sh --frontend-only   # Stop only the frontend
EOF
    exit 0
}

# ---- Parse arguments ----
STOP_API=true
STOP_FRONTEND=true

for arg in "$@"; do
    case $arg in
        -h|--help)
            show_help
            ;;
        --api-only)
            STOP_API=true
            STOP_FRONTEND=false
            ;;
        --frontend-only)
            STOP_API=false
            STOP_FRONTEND=true
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use -h or --help for usage information."
            exit 1
            ;;
    esac
done

# ---- Read ports from config.yaml ----
CONFIG_FILE="$SCRIPT_DIR/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
    read_ports() {
        python3 -c "
import yaml
with open('$CONFIG_FILE') as f:
    cfg = yaml.safe_load(f)
server = cfg.get('server', {})
print(server.get('frontend_port', 16888))
print(server.get('api_port', 16889))
"
    }
    PORT_VALUES=$(read_ports 2>/dev/null || true)
    FRONTEND_PORT=$(echo "$PORT_VALUES" | sed -n '1p')
    API_PORT=$(echo "$PORT_VALUES" | sed -n '2p')
fi
FRONTEND_PORT=${FRONTEND_PORT:-16888}
API_PORT=${API_PORT:-16889}

# ---- Fallback: kill by port when PID files are missing ----
kill_by_port() {
    local port=$1
    local label=$2
    local pids
    pids=$(ss -tlnp "sport = :$port" 2>/dev/null | awk -F'pid=' '/pid=/{print $2}' | awk -F',' '{print $1}' | sort -u)
    for pid in $pids; do
        echo "Stopping $label (PID $pid) found on port $port ..."
        kill "$pid" 2>/dev/null || true
        for i in $(seq 1 10); do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.5
        done
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Force killing $label (PID $pid) ..."
            kill -9 "$pid" 2>/dev/null || true
        fi
        echo "  $label stopped."
        STOPPED=$((STOPPED + 1))
    done
}

if [ ! -d "$PID_DIR" ]; then
    echo "No PID directory found. Trying to find services by port..."
    STOPPED=0
    [ "$STOP_API" = true ] && kill_by_port "$API_PORT" "API server"
    [ "$STOP_FRONTEND" = true ] && kill_by_port "$FRONTEND_PORT" "Frontend server"
    if [ "$STOPPED" -eq 0 ]; then
        echo "No running services found."
    else
        echo "Stopped $STOPPED service(s)."
    fi
    exit 0
fi

STOPPED=0

# ---- Stop API ----
if [ "$STOP_API" = true ] && [ -f "$PID_DIR/api.pid" ]; then
    API_PID=$(cat "$PID_DIR/api.pid")
    if kill -0 "$API_PID" 2>/dev/null; then
        echo "Stopping API server (PID $API_PID) ..."
        kill "$API_PID" 2>/dev/null || true
        # Wait up to 5 seconds for graceful shutdown
        for i in $(seq 1 10); do
            if ! kill -0 "$API_PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
        # Force kill if still running
        if kill -0 "$API_PID" 2>/dev/null; then
            echo "  Force killing API server ..."
            kill -9 "$API_PID" 2>/dev/null || true
        fi
        echo "  API server stopped."
        STOPPED=$((STOPPED + 1))
    else
        echo "API server (PID $API_PID) is not running."
    fi
    rm -f "$PID_DIR/api.pid"
fi

# ---- Stop Frontend ----
if [ "$STOP_FRONTEND" = true ] && [ -f "$PID_DIR/frontend.pid" ]; then
    FE_PID=$(cat "$PID_DIR/frontend.pid")
    if kill -0 "$FE_PID" 2>/dev/null; then
        echo "Stopping Frontend server (PID $FE_PID) ..."
        kill "$FE_PID" 2>/dev/null || true
        # Also kill the child node process (react-scripts spawns a child)
        pkill -P "$FE_PID" 2>/dev/null || true
        for i in $(seq 1 10); do
            if ! kill -0 "$FE_PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
        if kill -0 "$FE_PID" 2>/dev/null; then
            echo "  Force killing Frontend server ..."
            kill -9 "$FE_PID" 2>/dev/null || true
        fi
        echo "  Frontend server stopped."
        STOPPED=$((STOPPED + 1))
    else
        echo "Frontend server (PID $FE_PID) is not running."
    fi
    rm -f "$PID_DIR/frontend.pid"
fi

# ---- Clean up empty PID dir ----
if [ -d "$PID_DIR" ] && [ -z "$(ls -A "$PID_DIR")" ]; then
    rmdir "$PID_DIR"
fi

if [ "$STOPPED" -eq 0 ]; then
    echo "No running services found."
else
    echo ""
    echo "Stopped $STOPPED service(s)."
fi
