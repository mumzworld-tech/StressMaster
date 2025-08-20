# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with StressMaster.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Service Startup Problems](#service-startup-problems)
- [AI Model Issues](#ai-model-issues)
- [Input Formatting Issues](#input-formatting-issues)
- [Load Test Execution Problems](#load-test-execution-problems)
- [Performance Issues](#performance-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Resource and Memory Issues](#resource-and-memory-issues)
- [Data and Storage Issues](#data-and-storage-issues)
- [Advanced Debugging](#advanced-debugging)

## Quick Diagnostics

### System Health Check

Run the comprehensive health check:

```bash
# Check overall system status
./scripts/monitor.sh status

# Check individual services
curl http://localhost:3000/health
curl http://localhost:11434/api/tags

# View service logs
docker-compose logs --tail=50
```

### Common Quick Fixes

```bash
# Restart all services
docker-compose restart

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Reset to clean state
docker-compose down -v
./scripts/deploy.sh
```

## Installation Issues

### Docker Not Found

**Error:**

```
bash: docker: command not found
```

**Solution:**

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker (macOS)
brew install --cask docker

# Install Docker (Windows)
# Download Docker Desktop from docker.com
```

### Docker Compose Not Found

**Error:**

```
bash: docker-compose: command not found
```

**Solution:**

```bash
# Install Docker Compose v2 (recommended)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Or use Docker Compose v1
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Permission Denied

**Error:**

```
permission denied while trying to connect to the Docker daemon socket
```

**Solution:**

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again, or run:
newgrp docker

# Test Docker access
docker run hello-world
```

### Unicode and Special Characters

**Issue:** Problems with Unicode characters, emojis, or special symbols

**Solution:** The system automatically normalizes:

- Unicode smart quotes and apostrophes
- Low-9 quotes and angle quotes
- Ellipsis, en/em dashes
- Excessive whitespace and formatting

**If you still encounter issues:**

```bash
# Check character encoding
echo 'your-command' | hexdump -C

# Try with simple ASCII characters
Send 1 POST request to https://api.example.com/test with body {"id": "test123"}
```

## Service Startup Problems

### Ollama Service Won't Start

**Error:**

```
stressmaster-ollama exited with code 1
```

**Diagnosis:**

```bash
# Check Ollama logs
docker-compose logs ollama

# Check available memory
free -h

# Check port availability
netstat -tlnp | grep 11434
```

**Solutions:**

1. **Memory Issue:**

```bash
# Reduce memory limit
echo "OLLAMA_MEMORY_LIMIT=2g" >> .env
docker-compose restart ollama
```

2. **Port Conflict:**

```bash
# Change Ollama port
echo "OLLAMA_PORT=11435" >> .env
docker-compose down && docker-compose up -d
```

3. **Model Download Issue:**

```bash
# Manually download model
docker-compose exec ollama ollama pull llama3

# Or use smaller model
echo "MODEL_NAME=llama3:8b" >> .env
docker-compose restart
```

### Main Application Won't Start

**Error:**

```
stressmaster-app exited with code 1
```

**Diagnosis:**

```bash
# Check application logs
docker-compose logs stressmaster

# Check if Ollama is ready
curl http://localhost:11434/api/tags

# Check required directories
docker-compose exec stressmaster ls -la /app/data /app/scripts/k6 /app/results
```

**Solutions:**

1. **Ollama Not Ready:**

```bash
# Wait for Ollama to be fully ready
docker-compose logs -f ollama
# Wait for "Ollama server is running" message

# Restart main app
docker-compose restart stressmaster
```

2. **Missing Directories:**

```bash
# Recreate volumes
docker-compose down -v
docker-compose up -d
```

3. **Build Issues:**

```bash
# Rebuild application
docker-compose build --no-cache stressmaster
docker-compose up -d stressmaster
```

### Services Start But Health Checks Fail

**Error:**

```
Health check failed
```

**Diagnosis:**

```bash
# Check health check scripts
docker-compose exec stressmaster ./scripts/health-check.sh

# Check service endpoints manually
curl -v http://localhost:3000/health
curl -v http://localhost:11434/api/tags
```

**Solutions:**

1. **Increase Health Check Timeout:**

```yaml
# In docker-compose.yml
healthcheck:
  interval: 60s
  timeout: 30s
  retries: 5
  start_period: 120s
```

2. **Check Network Connectivity:**

```bash
# Test internal network
docker-compose exec stressmaster ping ollama
docker-compose exec ollama ping stressmaster
```

## AI Model Issues

### Model Download Fails

**Error:**

```
Failed to download model
```

**Diagnosis:**

```bash
# Check internet connectivity
curl -I https://ollama.ai

# Check available disk space
df -h

# Check Ollama service logs
docker-compose logs ollama
```

**Solutions:**

1. **Network Issues:**

```bash
# Test connectivity
ping ollama.ai

# Check proxy settings if behind corporate firewall
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

2. **Disk Space:**

```bash
# Clean up space
docker system prune -a -f

# Use smaller model
echo "MODEL_NAME=llama3:8b" >> .env
docker-compose --profile init up model-init
```

3. **Manual Download:**

```bash
# Download model manually
docker-compose exec ollama ollama pull llama3

# Verify model is available
docker-compose exec ollama ollama list
```

### Model Responses Are Poor

**Error:**

```
AI parsing produces incorrect results
```

**Solutions:**

1. **Use Custom Model:**

```bash
# Reinitialize with custom prompts
docker-compose --profile init up model-init --force-recreate
```

2. **Adjust Model Parameters:**

```bash
# Create custom model with better parameters
docker-compose exec ollama ollama create stressmaster -f - <<EOF
FROM llama3
PARAMETER temperature 0.1
PARAMETER top_p 0.9
SYSTEM "You are StressMaster's load testing expert. Always respond with valid JSON."
EOF
```

3. **Fallback to Rule-Based Parsing:**

```bash
# Enable fallback mode
echo "ENABLE_FALLBACK_PARSER=true" >> .env
docker-compose restart stressmaster
```

### Model Is Too Slow

**Error:**

```
AI responses take too long
```

**Solutions:**

1. **Use Faster Model:**

```bash
# Switch to smaller, faster model
echo "MODEL_NAME=llama3:8b" >> .env
docker-compose restart
```

2. **Increase Resources:**

```bash
# Allocate more memory to Ollama
echo "OLLAMA_MEMORY_LIMIT=8g" >> .env
docker-compose restart ollama
```

3. **Enable Response Caching:**

```bash
# Enable caching for common patterns
echo "ENABLE_RESPONSE_CACHE=true" >> .env
docker-compose restart stressmaster
```

## Load Test Execution Problems

### K6 Scripts Fail to Execute

**Error:**

```
K6 script execution failed
```

**Diagnosis:**

```bash
# Check K6 logs
docker-compose logs k6-runner

# Check generated script
docker-compose exec stressmaster cat /app/scripts/k6/latest-script.js

# Test script manually
docker run --rm -v $(pwd)/scripts:/scripts grafana/k6:latest run /scripts/test-script.js
```

**Solutions:**

1. **Script Generation Issues:**

```bash
# Check script syntax
docker run --rm -v $(pwd)/scripts:/scripts grafana/k6:latest run --check /scripts/test-script.js

# Regenerate script with simpler command
# Try: "Send 10 GET requests to https://httpbin.org/get"
```

2. **Network Issues:**

```bash
# Test target URL accessibility
docker-compose exec stressmaster curl -I https://your-target-api.com

# Check DNS resolution
docker-compose exec ai-load-tester nslookup your-target-api.com
```

3. **Resource Constraints:**

```bash
# Increase K6 memory limit
echo "K6_MEMORY_LIMIT=4g" >> .env
docker-compose restart
```

### Target API Returns Errors

**Error:**

```
High error rate in test results
```

**Diagnosis:**

```bash
# Check error details in results
docker-compose exec stressmaster cat /app/results/latest-results.json | jq '.errors'

# Test API manually
curl -v https://your-target-api.com/endpoint
```

**Solutions:**

1. **Rate Limiting:**

```bash
# Reduce request rate
# Try: "Send requests at 5 per second instead of 100 per second"
```

2. **Authentication Issues:**

```bash
# Verify API credentials
# Try: "Test with valid API key in Authorization header"
```

3. **Payload Issues:**

```bash
# Simplify payload
# Try: "Send simple JSON payload with just name and email fields"
```

### Tests Run But No Results

**Error:**

```
Test completes but no results generated
```

**Diagnosis:**

```bash
# Check results directory
docker-compose exec stressmaster ls -la /app/results/

# Check K6 output format
docker-compose logs k6-runner | grep -i json

# Check file permissions
docker-compose exec stressmaster ls -la /app/results/
```

**Solutions:**

1. **Results Directory Issues:**

```bash
# Recreate results volume
docker volume rm stressmaster_test_results
docker volume create stressmaster_test_results
docker-compose restart
```

2. **K6 Output Configuration:**

```bash
# Check K6 output settings
docker-compose exec stressmaster env | grep K6_OUT
```

## Performance Issues

### High Memory Usage

**Error:**

```
System running out of memory
```

**Diagnosis:**

```bash
# Check memory usage
free -h
docker stats --no-stream

# Check individual container usage
docker stats stressmaster-ollama stressmaster-app
```

**Solutions:**

1. **Reduce Memory Limits:**

```bash
# Adjust memory limits
echo "OLLAMA_MEMORY_LIMIT=2g" >> .env
echo "APP_MEMORY_LIMIT=512m" >> .env
docker-compose restart
```

2. **Use Smaller Model:**

```bash
# Switch to smaller model
echo "MODEL_NAME=llama3:8b" >> .env
docker-compose restart
```

3. **Enable Swap:**

```bash
# Add swap space (Linux)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Slow Response Times

**Error:**

```
AI parsing or test execution is slow
```

**Solutions:**

1. **Optimize Docker Resources:**

```bash
# Increase CPU allocation
# In Docker Desktop: Settings > Resources > Advanced
# Set CPUs to 4+ and Memory to 8GB+
```

2. **Use SSD Storage:**

```bash
# Move Docker data to SSD
# Stop Docker
sudo systemctl stop docker

# Move data directory
sudo mv /var/lib/docker /path/to/ssd/docker
sudo ln -s /path/to/ssd/docker /var/lib/docker

# Start Docker
sudo systemctl start docker
```

3. **Enable Performance Mode:**

```bash
# Set performance governor (Linux)
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### High CPU Usage

**Error:**

```
CPU usage consistently high
```

**Solutions:**

1. **Limit Concurrent Operations:**

```bash
# Reduce virtual users in tests
# Try: "Test with 10 users instead of 100"
```

2. **Adjust Model Parameters:**

```bash
# Reduce model complexity
docker-compose exec ollama ollama create stressmaster-fast -f - <<EOF
FROM llama3:8b
PARAMETER num_ctx 1024
PARAMETER temperature 0.3
EOF
```

## Network and Connectivity

### Cannot Reach Target APIs

**Error:**

```
Connection refused or timeout errors
```

**Diagnosis:**

```bash
# Test connectivity from container
docker-compose exec stressmaster curl -v https://your-target-api.com

# Check DNS resolution
docker-compose exec stressmaster nslookup your-target-api.com

# Check network configuration
docker network ls
docker network inspect stressmaster-network
```

**Solutions:**

1. **Firewall Issues:**

```bash
# Check firewall rules
sudo ufw status
sudo iptables -L

# Allow outbound connections
sudo ufw allow out 80
sudo ufw allow out 443
```

2. **Proxy Configuration:**

```bash
# Configure proxy in container
echo "HTTP_PROXY=http://proxy.company.com:8080" >> .env
echo "HTTPS_PROXY=http://proxy.company.com:8080" >> .env
docker-compose restart
```

3. **DNS Issues:**

```bash
# Use custom DNS
echo "DNS_SERVERS=8.8.8.8,8.8.4.4" >> .env
# Add to docker-compose.yml:
# dns:
#   - 8.8.8.8
#   - 8.8.4.4
```

### Internal Service Communication Fails

**Error:**

```
Services cannot communicate with each other
```

**Diagnosis:**

```bash
# Test internal connectivity
docker-compose exec stressmaster ping ollama
docker-compose exec ollama ping stressmaster

# Check network configuration
docker network inspect stressmaster-network
```

**Solutions:**

1. **Recreate Network:**

```bash
# Remove and recreate network
docker-compose down
docker network rm stressmaster-network
docker-compose up -d
```

2. **Check Service Names:**

```bash
# Verify service names in docker-compose.yml
# Ensure OLLAMA_URL uses correct service name
echo "OLLAMA_URL=http://ollama:11434" >> .env
```

## Resource and Memory Issues

### Out of Disk Space

**Error:**

```
No space left on device
```

**Solutions:**

1. **Clean Docker Data:**

```bash
# Remove unused containers, networks, images
docker system prune -a -f

# Remove unused volumes
docker volume prune -f

# Remove specific volumes
docker volume rm stressmaster_ollama_data
```

2. **Move Docker Root:**

```bash
# Stop Docker
sudo systemctl stop docker

# Edit daemon configuration
sudo nano /etc/docker/daemon.json
# Add: {"data-root": "/path/to/larger/disk/docker"}

# Move existing data
sudo mv /var/lib/docker /path/to/larger/disk/docker

# Start Docker
sudo systemctl start docker
```

3. **Clean Application Data:**

```bash
# Clean old test results
./scripts/monitor.sh cleanup

# Remove old logs
find ./logs -name "*.log" -mtime +7 -delete
```

### Memory Leaks

**Error:**

```
Memory usage increases over time
```

**Diagnosis:**

```bash
# Monitor memory usage over time
./scripts/monitor.sh monitor

# Check for memory leaks in containers
docker stats --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

**Solutions:**

1. **Restart Services Periodically:**

```bash
# Add to crontab for daily restart
0 2 * * * cd /path/to/stressmaster && docker-compose restart
```

2. **Limit Memory Usage:**

```bash
# Set strict memory limits
echo "OLLAMA_MEMORY_LIMIT=2g" >> .env
echo "APP_MEMORY_LIMIT=512m" >> .env
docker-compose restart
```

3. **Enable Memory Monitoring:**

```bash
# Monitor memory usage
watch -n 5 'docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"'
```

## Data and Storage Issues

### Volume Mount Failures

**Error:**

```
Volume mount failed
```

**Diagnosis:**

```bash
# Check volume status
docker volume ls | grep stressmaster
docker volume inspect stressmaster_ollama_data

# Check mount points
docker-compose exec stressmaster mount | grep /app
```

**Solutions:**

1. **Recreate Volumes:**

```bash
# Remove and recreate volumes
docker-compose down -v
docker volume create stressmaster_ollama_data
docker volume create stressmaster_shared_data
docker-compose up -d
```

2. **Fix Permissions:**

```bash
# Fix volume permissions
docker-compose exec stressmaster chown -R nodejs:nodejs /app/data /app/results
```

### Data Corruption

**Error:**

```
Invalid or corrupted data files
```

**Solutions:**

1. **Restore from Backup:**

```bash
# List available backups
ls -la ./backups/

# Restore from backup
./scripts/monitor.sh restore ./backups/stressmaster-backup-20240115_120000
```

2. **Reset Data:**

```bash
# Reset all data (WARNING: This removes all data)
docker-compose down -v
./scripts/deploy.sh
```

## Advanced Debugging

### Enable Debug Logging

```bash
# Enable debug mode
echo "LOG_LEVEL=debug" >> .env
echo "NODE_ENV=development" >> .env
docker-compose restart

# View debug logs
docker-compose logs -f stressmaster | grep DEBUG
```

### Container Shell Access

```bash
# Access main application container
docker-compose exec stressmaster /bin/sh

# Access Ollama container
docker-compose exec ollama /bin/bash

# Run commands inside container
docker-compose exec stressmaster npm run test
```

### Manual Testing

```bash
# Test AI parsing manually
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"command": "Send 10 GET requests to https://httpbin.org/get"}'

# Test Ollama directly
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3", "prompt": "Parse this load test command: Send 10 requests", "stream": false}'
```

### Performance Profiling

```bash
# Profile application performance
docker-compose exec stressmaster node --prof dist/index.js

# Analyze profile
docker-compose exec stressmaster node --prof-process isolate-*.log > profile.txt
```

### Collect Diagnostic Information

```bash
# Collect comprehensive diagnostics
./scripts/monitor.sh logs /tmp/diagnostics

# Create support bundle
tar -czf support-bundle.tar.gz \
  /tmp/diagnostics \
  .env \
  docker-compose.yml \
  logs/

# System information
docker version > system-info.txt
docker-compose version >> system-info.txt
uname -a >> system-info.txt
free -h >> system-info.txt
df -h >> system-info.txt
```

## Getting Additional Help

If you're still experiencing issues after trying these solutions:

1. **Collect Diagnostic Information:**

   ```bash
   ./scripts/monitor.sh status > diagnostics.txt
   ./scripts/monitor.sh logs /tmp/support-logs
   ```

2. **Check System Requirements:**

   - Ensure you have sufficient RAM (8GB minimum)
   - Verify Docker version compatibility
   - Check available disk space

3. **Search Documentation:**

   - Review the [README](../README.md)
   - Check [deployment guide](../DEPLOYMENT.md)
   - Review [examples](EXAMPLES.md)

4. **Report Issues:**
   - Include diagnostic information
   - Provide steps to reproduce
   - Specify your system configuration
   - Include relevant log excerpts

Remember: Most issues are related to resource constraints, network connectivity, or configuration problems. Start with the quick diagnostics and work through the relevant sections based on your specific error messages.
