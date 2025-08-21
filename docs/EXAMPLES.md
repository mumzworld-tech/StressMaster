# StressMaster Examples

This document provides comprehensive examples of how to use StressMaster for various load testing scenarios.

## Table of Contents

- [Basic Examples](#basic-examples)
- [Advanced Scenarios](#advanced-scenarios)
- [Load Patterns](#load-patterns)
- [Authentication Testing](#authentication-testing)
- [API-Specific Examples](#api-specific-examples)
- [Performance Testing Patterns](#performance-testing-patterns)
- [Real-World Use Cases](#real-world-use-cases)

## Basic Examples

### Simple GET Request

**Command:**

```
Test https://httpbin.org/get with 50 requests
```

**What it does:**

- Sends 50 GET requests to the specified endpoint
- Uses default timing (as fast as possible)
- Reports response times and success rates

**Generated K6 Script Preview:**

```javascript
import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 10,
  iterations: 50,
};

export default function () {
  let response = http.get("https://httpbin.org/get");
  check(response, {
    "status is 200": (r) => r.status === 200,
  });
}
```

### POST Request with JSON Payload

**Command:**

```
Send 100 POST requests to https://httpbin.org/post with JSON payload containing random user data
```

**What it does:**

- Creates POST requests with dynamically generated JSON payloads
- Includes random user data (names, emails, IDs)
- Validates response status and structure

**Example Generated Payload:**

```json
{
  "id": "uuid-12345",
  "name": "RandomUser_789",
  "email": "user123@example.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Rate-Limited Testing

**Command:**

```
Test https://api.example.com/users at 20 requests per second for 2 minutes
```

**What it does:**

- Maintains exactly 20 RPS for 120 seconds
- Total of 2,400 requests
- Provides consistent load pattern

## Advanced Scenarios

### Complex JSON Payloads

**Command:**

```
Send POST requests to https://api.example.com/orders with complex JSON:
{
  "orderId": "{sequence}",
  "customer": {
    "name": "{randomString}",
    "email": "customer{sequence}@example.com"
  },
  "items": [
    {
      "productId": "PROD-{randomNumber}",
      "quantity": "{randomNumber:1-10}"
    }
  ]
}
```

**What it does:**

- Generates complex nested JSON structures
- Uses dynamic data generation for realistic payloads
- Maintains data consistency across requests

### Authentication Testing

**Command:**

```
Test API with JWT authentication:
1. POST login to get token
2. Use token for subsequent requests
3. Test 500 authenticated requests per minute
```

**What it does:**

- Tests authentication system performance
- Validates token handling
- Tests secure endpoint access

## Load Patterns

### Spike Testing

**Command:**

```
Perform spike test on https://api.example.com/products:
Start with 10 users, spike to 500 users for 30 seconds, then back to 10 users
```

**What it does:**

- Tests system behavior under sudden load increases
- Identifies breaking points
- Measures recovery time
- Useful for traffic surge scenarios

**Load Pattern Visualization:**

```
Users
500 |     ████████
    |    ██      ██
    |   ██        ██
 10 |███            ███████
    |________________________
    0   2   4   6   8   10  Time(min)
```

### Stress Testing with Gradual Ramp-up

**Command:**

```
Stress test https://api.example.com/search:
Start with 5 users, gradually increase to 200 users over 20 minutes,
maintain 200 users for 30 minutes, then ramp down over 10 minutes
```

**What it does:**

- Finds maximum sustainable load
- Tests system stability under prolonged stress
- Identifies resource bottlenecks
- Measures degradation patterns

### Step Load Testing

**Command:**

```
Run step load test on https://api.example.com/data:
Step 1: 25 users for 5 minutes
Step 2: 50 users for 5 minutes
Step 3: 100 users for 5 minutes
Step 4: 200 users for 5 minutes
```

**What it does:**

- Tests performance at different load levels
- Identifies performance thresholds
- Measures scalability characteristics
- Useful for capacity planning

## Authentication Testing

### JWT Token Authentication

**Command:**

```
Test JWT authentication flow:
1. POST login to get JWT token
2. Use token for 200 authenticated GET requests to https://api.example.com/protected/data
3. Test token refresh every 50 requests
Run for 100 virtual users over 20 minutes
```

**What it does:**

- Tests authentication system performance
- Validates token handling
- Tests token refresh mechanisms
- Simulates realistic auth patterns

### OAuth 2.0 Flow Testing

**Command:**

```
Test OAuth 2.0 flow:
1. GET authorization code from https://api.example.com/oauth/authorize
2. POST authorization code to https://api.example.com/oauth/token
3. Use access token for 300 API requests
4. Test token refresh when expired
Run 50 concurrent OAuth flows for 30 minutes
```

**What it does:**

- Tests OAuth 2.0 implementation
- Validates token exchange process
- Tests refresh token functionality
- Measures OAuth performance impact

## API-Specific Examples

### REST API Testing

**Command:**

```
Test REST API endpoints:
- GET /users - 40% of requests
- POST /users - 20% of requests
- PUT /users/{id} - 20% of requests
- DELETE /users/{id} - 20% of requests
Run 1000 total requests with 50 concurrent users
```

**What it does:**

- Tests all CRUD operations
- Simulates realistic API usage patterns
- Measures performance across different operations
- Validates API consistency

### GraphQL API Testing

**Command:**

```
Test GraphQL API at https://api.example.com/graphql:
Send query to get user with posts and comments
Run 100 concurrent queries for 5 minutes
```

**What it does:**

- Tests GraphQL query performance
- Validates complex data fetching
- Measures GraphQL-specific metrics
- Tests query optimization

### WebSocket Testing

**Command:**

```
Test WebSocket at wss://api.example.com/ws:
Connect 50 concurrent connections
Send message every 10 seconds
Maintain connections for 30 minutes
```

**What it does:**

- Tests WebSocket connection handling
- Measures real-time message performance
- Tests connection stability
- Validates concurrent connection limits

## Performance Testing Patterns

### Endurance Testing

**Command:**

```
Run endurance test on https://api.example.com/health:
Maintain 50 constant users for 8 hours
Monitor for memory leaks and performance degradation
```

**What it does:**

- Tests long-term system stability
- Identifies memory leaks
- Measures performance degradation over time
- Validates system reliability

### Volume Testing

**Command:**

```
Volume test https://api.example.com/upload:
Upload 10,000 files of 1MB each using 100 concurrent users
Test file processing and storage performance
```

**What it does:**

- Tests system capacity limits
- Validates large data handling
- Tests storage performance
- Measures throughput limits

### Baseline Performance Testing

**Command:**

```
Establish baseline performance for https://api.example.com:
Test with 1, 5, 10, 25, 50 concurrent users
Measure response times and throughput at each level
Create performance baseline for future comparisons
```

**What it does:**

- Establishes performance benchmarks
- Creates baseline metrics
- Enables performance regression detection
- Supports capacity planning

## Real-World Use Cases

### E-commerce Platform Testing

**Command:**

```
Test e-commerce platform performance:
1. Browse products (GET /products) - 50% of traffic
2. View product details (GET /products/{id}) - 25% of traffic
3. Add to cart (POST /cart/items) - 15% of traffic
4. Checkout process (POST /orders) - 8% of traffic
5. User registration (POST /users) - 2% of traffic

Simulate Black Friday traffic:
Start with 100 users, ramp to 5000 users over 2 hours
Maintain peak for 4 hours, then ramp down over 2 hours
```

**What it does:**

- Simulates realistic e-commerce traffic
- Tests peak shopping periods
- Validates checkout process performance
- Tests inventory management under load

### Social Media API Testing

**Command:**

```
Test social media API performance:
1. User timeline (GET /timeline) - 40% of requests
2. Post content (POST /posts) - 25% of requests
3. Like posts (POST /posts/{id}/like) - 20% of requests
4. Comment on posts (POST /posts/{id}/comments) - 10% of requests
5. Follow users (POST /users/{id}/follow) - 5% of requests

Run 1000 concurrent active users for 2 hours
```

**What it does:**

- Tests social media interaction patterns
- Validates real-time feed performance
- Tests user engagement features
- Measures social graph operations

### Banking API Testing

**Command:**

```
Test banking API with security focus:
1. Secure login with 2FA (POST /auth/login)
2. Get account balance (GET /accounts/balance)
3. Transfer funds (POST /transfers) with validation
4. Transaction history (GET /transactions)
5. Logout (POST /auth/logout)

Test with 200 concurrent users, ensure all transactions are secure
Run for 4 hours to test system stability
```

**What it does:**

- Tests financial transaction performance
- Validates security mechanisms
- Tests audit trail functionality
- Ensures data consistency

### IoT Data Ingestion Testing

**Command:**

```
Test IoT data ingestion API:
Simulate 10,000 IoT devices sending data every 30 seconds
POST sensor data to https://api.example.com/iot/data
Each device sends temperature, humidity, and location data
Test data processing and storage performance over 24 hours
```

**What it does:**

- Tests high-volume data ingestion
- Validates time-series data handling
- Tests real-time processing capabilities
- Measures storage performance

## Tips for Effective Load Testing

### 1. Start Small and Scale Up

```
Begin with: "Test with 10 users for 5 minutes"
Then scale: "Test with 100 users for 30 minutes"
Finally: "Test with 1000 users for 2 hours"
```

### 2. Use Realistic Data

```
Instead of: "Send requests with test data"
Use: "Send requests with realistic user profiles, addresses, and transaction amounts"
```

### 3. Test Different Scenarios

```
Happy path: "Test successful user registration flow"
Error scenarios: "Test with invalid data and measure error handling"
Edge cases: "Test with maximum payload sizes and boundary values"
```

### 4. Monitor System Resources

```
"Test API performance while monitoring CPU, memory, and database connections"
"Measure response times under different system loads"
```

### 5. Validate Business Logic

```
"Test order processing ensuring inventory is properly decremented"
"Validate that payment processing maintains transaction integrity"
```

These examples demonstrate the flexibility and power of StressMaster. The natural language interface allows you to describe complex testing scenarios that would traditionally require extensive scripting, making load testing accessible to both technical and non-technical team members.
