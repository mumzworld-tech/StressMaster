# StressMaster Web UI Setup

## Core AI Integration

The web UI now has real AI integration with your existing StressMaster backend!

### Environment Configuration

Create a `.env.local` file in the `stressmaster-web` directory with:

```bash
# AI Service Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_API_KEY=your_api_key_here

# Development Settings
NODE_ENV=development
```

### What's Implemented

✅ **AI Service Layer**: Connects to your existing AI backend
✅ **File Upload API**: Handles OpenAPI, JSON, YAML, XML files
✅ **Real AI Responses**: No more fake responses - real command parsing
✅ **File Processing**: Files are uploaded and analyzed by AI
✅ **Load Test Commands**: AI generates actual load test specifications

### API Endpoints

- `POST /api/ai/complete` - AI completion requests
- `POST /api/files/upload` - File uploads
- `GET /api/loadtest/status/:id` - Test status (coming soon)
- `POST /api/loadtest/execute` - Execute tests (coming soon)

### Next Steps

1. **Connect to Real Backend**: Update API endpoints to point to your actual StressMaster CLI
2. **Load Test Execution**: Implement real test execution and monitoring
3. **Results Display**: Show actual test metrics and charts
4. **Export Functionality**: Implement session export features

### Testing

Try these commands in the chat:

- "Send 100 requests to my API"
- "Test my website with 50 concurrent users"
- "Load test my database endpoint"

The AI will now generate real load test configurations based on your requests!
