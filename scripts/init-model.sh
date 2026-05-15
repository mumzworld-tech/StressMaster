#!/bin/bash

# (Deprecated) Model initialization script for Ollama
# Ollama support has been removed from StressMaster in favor of cloud AI providers.
# This script is kept only for historical reference and is no longer used.

set -e

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
MODEL_NAME="${MODEL_NAME:-llama3}"
MAX_RETRIES=10
RETRY_DELAY=30

# Function to wait for Ollama service to be ready
wait_for_ollama() {
    local retry_count=0
    
    echo "Waiting for Ollama service to be ready..."
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        if curl -f -s "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
            echo "Ollama service is ready"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo "Ollama not ready yet, attempt $retry_count/$MAX_RETRIES. Waiting ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    done
    
    echo "Failed to connect to Ollama service after $MAX_RETRIES attempts"
    return 1
}

# Function to check if model is already installed
check_model_exists() {
    local model_list
    model_list=$(curl -s "$OLLAMA_HOST/api/tags" | grep -o "\"name\":\"[^\"]*\"" | grep "$MODEL_NAME" || true)
    
    if [ -n "$model_list" ]; then
        echo "Model $MODEL_NAME is already installed"
        return 0
    else
        echo "Model $MODEL_NAME is not installed"
        return 1
    fi
}

# Function to pull the model
pull_model() {
    echo "Pulling model $MODEL_NAME..."
    
    # Use curl to send pull request to Ollama API
    local pull_response
    pull_response=$(curl -s -X POST "$OLLAMA_HOST/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$MODEL_NAME\"}" || true)
    
    if [ $? -eq 0 ]; then
        echo "Model pull request sent successfully"
        
        # Wait for model to be available
        local wait_count=0
        local max_wait=60  # Wait up to 30 minutes (60 * 30s)
        
        while [ $wait_count -lt $max_wait ]; do
            if check_model_exists; then
                echo "Model $MODEL_NAME is now available"
                return 0
            fi
            
            wait_count=$((wait_count + 1))
            echo "Waiting for model download to complete... ($wait_count/$max_wait)"
            sleep 30
        done
        
        echo "Model download timed out after waiting for $((max_wait * 30)) seconds"
        return 1
    else
        echo "Failed to send model pull request"
        return 1
    fi
}

# Function to test the model
test_model() {
    echo "Testing model $MODEL_NAME..."
    
    local test_prompt="Hello, can you help me with StressMaster load testing?"
    local test_response
    
    test_response=$(curl -s -X POST "$OLLAMA_HOST/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$MODEL_NAME\",\"prompt\":\"$test_prompt\",\"stream\":false}" || true)
    
    if [ $? -eq 0 ] && echo "$test_response" | grep -q "response"; then
        echo "Model test successful"
        return 0
    else
        echo "Model test failed"
        return 1
    fi
}

# Function to create model configuration
create_model_config() {
    echo "Creating model configuration..."
    
    # Create a custom model configuration for load testing tasks
    local modelfile_content="FROM $MODEL_NAME

SYSTEM \"You are StressMaster's AI assistant specialized in load testing and performance testing. Your role is to parse natural language commands and convert them into structured load test specifications. Always respond with valid JSON when asked to parse load test commands.\"

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER top_k 40"

    # Save the modelfile
    echo "$modelfile_content" > /tmp/Modelfile
    
    # Create the custom model
    curl -s -X POST "$OLLAMA_HOST/api/create" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"stressmaster\",\"modelfile\":\"$(cat /tmp/Modelfile | sed 's/"/\\"/g' | tr '\n' '\\n')\"}" || true
    
    if [ $? -eq 0 ]; then
        echo "Custom model 'stressmaster' created successfully"
        return 0
    else
        echo "Failed to create custom model, will use base model"
        return 1
    fi
}

# Main initialization function
main() {
    echo "Starting Ollama model initialization..."
    echo "Target Ollama host: $OLLAMA_HOST"
    echo "Model to install: $MODEL_NAME"
    
    # Wait for Ollama service
    if ! wait_for_ollama; then
        echo "Model initialization failed: Ollama service not available"
        exit 1
    fi
    
    # Check if model already exists
    if check_model_exists; then
        echo "Model is already available, skipping download"
    else
        # Pull the model
        if ! pull_model; then
            echo "Model initialization failed: Could not download model"
            exit 1
        fi
    fi
    
    # Test the model
    if ! test_model; then
        echo "Warning: Model test failed, but continuing..."
    fi
    
    # Create custom model configuration
    create_model_config
    
    echo "Model initialization completed successfully"
    exit 0
}

# Handle script termination
cleanup() {
    echo "Model initialization interrupted"
    exit 1
}

trap cleanup SIGINT SIGTERM

# Execute main function
main "$@"