#!/bin/bash

# Startup script for StressMaster application
# This script handles initialization and startup sequence

set -e

# Configuration
DATA_DIR="${DATA_DIR:-/app/data}"
SCRIPTS_DIR="${SCRIPTS_DIR:-/app/scripts/k6}"
RESULTS_DIR="${RESULTS_DIR:-/app/results}"

# Function to create required directories
create_directories() {
    echo "Creating required directories..."
    
    local dirs=("$DATA_DIR" "$SCRIPTS_DIR" "$RESULTS_DIR")
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            echo "Created directory: $dir"
        else
            echo "Directory already exists: $dir"
        fi
    done
    
    # Set proper permissions
    chmod 755 "$DATA_DIR" "$SCRIPTS_DIR" "$RESULTS_DIR"
    echo "Directory creation completed"
}

# Function to check Docker availability for K6 execution
check_docker() {
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            echo "Docker is available for K6 script execution"
            return 0
        else
            echo "Warning: Docker daemon is not accessible"
            return 1
        fi
    else
        echo "Warning: Docker is not installed"
        return 1
    fi
}

# Function to initialize application configuration
init_config() {
    echo "Initializing application configuration..."
    
    # Create default configuration file if it doesn't exist
    local config_file="$DATA_DIR/config.json"
    
    if [ ! -f "$config_file" ]; then
        cat > "$config_file" << EOF
{
  "k6": {
    "image": "grafana/k6:latest",
    "scriptsDir": "$SCRIPTS_DIR",
    "resultsDir": "$RESULTS_DIR",
    "defaultTimeout": 300000
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
EOF
        echo "Created default configuration file: $config_file"
    else
        echo "Configuration file already exists: $config_file"
    fi
}

# Function to perform health checks
health_check() {
    echo "Performing startup health checks..."
    
    # Check if Node.js application files exist
    if [ ! -f "/app/dist/index.js" ]; then
        echo "Error: Application build not found at /app/dist/index.js"
        return 1
    fi
    
    # Check if package.json exists
    if [ ! -f "/app/package.json" ]; then
        echo "Error: package.json not found"
        return 1
    fi
    
    echo "Health checks passed"
    return 0
}

# Function to start the application
start_application() {
    echo "Starting StressMaster application..."
    
    # Export environment variables for the application
    export NODE_ENV="${NODE_ENV:-production}"
    export DATA_DIR="$DATA_DIR"
    export SCRIPTS_DIR="$SCRIPTS_DIR"
    export RESULTS_DIR="$RESULTS_DIR"
    export OLLAMA_URL="$OLLAMA_URL"
    
    # Start the Node.js application
    exec node /app/dist/index.js
}

# Main startup function
main() {
    echo "=== StressMaster Startup ==="
    echo "Environment: ${NODE_ENV:-development}"
    echo "Data directory: $DATA_DIR"
    echo "Scripts directory: $SCRIPTS_DIR"
    echo "Results directory: $RESULTS_DIR"
    echo "Ollama URL: $OLLAMA_URL"
    echo "================================"
    
    # Create required directories
    create_directories
    
    # Initialize configuration
    init_config
    
    # Perform health checks
    if ! health_check; then
        echo "Startup failed: Health checks failed"
        exit 1
    fi
    
    # Check Docker availability (non-blocking)
    check_docker || true
    
    # Start the application
    start_application
}

# Handle script termination
cleanup() {
    echo "Startup interrupted"
    exit 1
}

trap cleanup SIGINT SIGTERM

# Execute main function
main "$@"