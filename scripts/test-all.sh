#!/bin/bash

# Comprehensive Test Script
# Tests all functionality as a real user would

set -e  # Exit on error

echo "🧪 StressMaster Comprehensive Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Test function
test_command() {
    local name="$1"
    local command="$2"
    local expected_executor="${3:-any}"
    
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}Test $TOTAL: $name${NC}"
    echo "Command: $command"
    
    if eval "$command" > /tmp/stressmaster_test_output.log 2>&1; then
        # Check executor selection if specified
        if [ "$expected_executor" != "any" ]; then
            if grep -q "$expected_executor" /tmp/stressmaster_test_output.log; then
                echo -e "${GREEN}✅ PASSED${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${RED}❌ FAILED - Wrong executor selected${NC}"
                FAILED=$((FAILED + 1))
                cat /tmp/stressmaster_test_output.log
            fi
        else
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED=$((FAILED + 1))
        cat /tmp/stressmaster_test_output.log
    fi
    echo ""
}

# Build first
echo "🔨 Building project..."
npm run build
echo ""

# Test 1: Simple GET Request (Simple Executor)
test_command \
    "Simple GET Request - Should use Simple Executor" \
    "npm run start -- 'send 5 GET requests to https://httpbin.org/get'" \
    "Simple executor"

# Test 2: Complex Load Test (K6 Executor)
test_command \
    "Complex Load Test - Should use K6 Executor" \
    "npm run start -- 'spike test with 50 requests in 10 seconds to https://httpbin.org/get'" \
    "K6"

# Test 3: Workflow Test
test_command \
    "Workflow Test - Should use Workflow Executor" \
    "npm run start -- 'workflow: GET https://httpbin.org/get, then GET https://httpbin.org/uuid'" \
    "Workflow"

# Test 4: File Resolution
echo "📁 Testing file resolution..."
mkdir -p test-files
echo '{"test": "data"}' > test-files/test.json
test_command \
    "File Resolution - Should find file by name" \
    "npm run start -- 'POST 3 requests to https://httpbin.org/post with body from @test.json'" \
    "any"
rm -rf test-files

# Test 5: Config Commands
test_command \
    "Config Show" \
    "npm run start -- config show" \
    "any"

# Test 6: File Commands
test_command \
    "File List" \
    "npm run start -- file list" \
    "any"

# Test 7: Template Commands
test_command \
    "Template List" \
    "npm run start -- template list" \
    "any"

# Test 8: Results Commands
test_command \
    "Results List" \
    "npm run start -- results list" \
    "any"

# Test 9: Help Command
test_command \
    "Help Command" \
    "npm run start -- --help" \
    "any"

# Test 10: Version Command
test_command \
    "Version Command" \
    "npm run start -- --version" \
    "any"

# Summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi


