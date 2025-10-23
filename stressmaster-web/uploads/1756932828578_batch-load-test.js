import { SharedArray } from 'k6/data';
import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration
const url = 'http://backbone.mumz.io/netsuite/stock-sync';
const headers = {
  'x-api-key': '2f8a6e4d-91b1-4f63-8f42-bb91a3cb56a9'
};

// Load batch data using SharedArray with a more reliable approach
const batchFiles = new SharedArray('batches', function() {
  console.log('🔍 Loading batch data from k6-batch-data.json...');
  
  try {
    // Use the consolidated JSON file we created
    const content = open('./k6-batch-data.json');
    const allBatches = JSON.parse(content);
    
    console.log(`✅ Successfully loaded ${allBatches.length} batches`);
    return allBatches;
  } catch (error) {
    console.log(`❌ Failed to load batch data: ${error.message}`);
    console.log('🔄 Falling back to sample data...');
    
    // Fallback to sample data if file loading fails
    const sampleBatches = [];
    for (let i = 1; i <= 10; i++) {
      const batch = {
        requestId: `batch-${i.toString().padStart(4, '0')}`,
        type: "power-rangers-preprod",
        payload: [
          {
            externalId: `ext-${i.toString().padStart(4, '0')}`,
            sourceItems: [
              {
                sku: `SKU-${i.toString().padStart(4, '0')}-001`,
                quantity: 10,
                location: "WAREHOUSE-A",
                status: "IN_STOCK"
              }
            ]
          }
        ]
      };
      sampleBatches.push(batch);
    }
    return sampleBatches;
  }
});

export const options = {
  stages: [
    { duration: '30m', target: 10 } // Run for 30 minutes with 10 virtual users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2 seconds
    http_req_failed: ['rate<0.1'], // Less than 10% of requests should fail
  },
};

export default function () {
  const batchIndex = __VU % batchFiles.length;
  const originalBatch = batchFiles[batchIndex];

  // Create a deep copy to avoid modifying the read-only original
  const batchPayload = JSON.parse(JSON.stringify(originalBatch));

  // Modify requestId and externalId to make them unique for each request
  const timestamp = Date.now();
  const uniqueId = `${batchPayload.requestId}-${timestamp}-${__VU}`;
  batchPayload.requestId = uniqueId;

  // Update externalId in each payload object (assuming payload is an array of objects)
  if (Array.isArray(batchPayload.payload)) {
    batchPayload.payload.forEach((payloadObj, index) => {
      payloadObj.externalId = `${payloadObj.externalId}-${timestamp}-${__VU}-${index}`;
    });
  }

  const res = http.post(url, JSON.stringify(batchPayload), { headers });

  check(res, {
    'is status 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  sleep(1); // 1-second delay between requests
} 