import Joi from "joi";
import {
  LoadTestSpec,
  RequestSpec,
  LoadPattern,
  PayloadSpec,
  VariableDefinition,
  WorkflowStep,
  CorrelationRule,
  ResponseValidation,
  StepCondition,
  DataExtraction,
  Duration,
  ValidationResult,
  HttpMethod,
  TestType,
  LoadPatternType,
  VariableType,
} from "./index.js";

// Duration schema
const durationSchema = Joi.object({
  value: Joi.number().positive().required(),
  unit: Joi.string().valid("seconds", "minutes", "hours").required(),
});

// Variable definition schema
const variableDefinitionSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string()
    .valid(
      "random_id",
      "uuid",
      "timestamp",
      "random_string",
      "sequence",
      "custom",
      "array_item",
      "random_array",
      "bulk_data"
    )
    .required(),
  parameters: Joi.object().optional(),
});

// Payload spec schema
const payloadSpecSchema = Joi.object({
  template: Joi.string().required(),
  variables: Joi.array().items(variableDefinitionSchema).required(),
});

// Response validation schema
const responseValidationSchema = Joi.object({
  type: Joi.string()
    .valid("status_code", "response_time", "content", "header")
    .required(),
  condition: Joi.string().required(),
  expectedValue: Joi.any().required(),
});

// Request spec schema
const requestSpecSchema = Joi.object({
  method: Joi.string()
    .valid("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS")
    .required(),
  url: Joi.string().uri().required(),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  payload: payloadSpecSchema.optional(),
  validation: Joi.array().items(responseValidationSchema).optional(),
});

// Load pattern schema
const loadPatternSchema = Joi.object({
  type: Joi.string()
    .valid("constant", "ramp-up", "spike", "step", "random-burst")
    .required(),
  virtualUsers: Joi.number().positive().optional(),
  requestsPerSecond: Joi.number().positive().optional(),
  rampUpTime: durationSchema.optional(),
  plateauTime: durationSchema.optional(),
  rampDownTime: durationSchema.optional(),
  baselineVUs: Joi.number().positive().optional(),
  spikeIntensity: Joi.number().positive().optional(),
  volumeTarget: Joi.number().positive().optional(),
  burstConfig: Joi.object({
    minBurstSize: Joi.number().positive().required(),
    maxBurstSize: Joi.number().positive().required(),
    minIntervalSeconds: Joi.number().positive().required(),
    maxIntervalSeconds: Joi.number().positive().required(),
    burstProbability: Joi.number().min(0).max(1).required(),
  }).optional(),
  stages: Joi.array()
    .items(
      Joi.object({
        duration: Joi.string().required(),
        target: Joi.number().required(),
      })
    )
    .optional(),
})
  .custom((value: any, helpers: any) => {
    // At least one of virtualUsers or requestsPerSecond must be specified
    if (!value.virtualUsers && !value.requestsPerSecond) {
      return helpers.error("custom.missingLoadMetric");
    }
    return value;
  }, "Load pattern validation")
  .messages({
    "custom.missingLoadMetric":
      "Either virtualUsers or requestsPerSecond must be specified",
  });

// Step condition schema
const stepConditionSchema = Joi.object({
  type: Joi.string()
    .valid("response_code", "response_content", "response_time")
    .required(),
  operator: Joi.string()
    .valid("equals", "not_equals", "greater_than", "less_than", "contains")
    .required(),
  value: Joi.any().required(),
  action: Joi.string().valid("continue", "skip", "fail").required(),
});

// Data extraction schema
const dataExtractionSchema = Joi.object({
  name: Joi.string().required(),
  source: Joi.string()
    .valid("response_body", "response_header", "status_code")
    .required(),
  extractor: Joi.string().valid("json_path", "regex", "xpath").required(),
  expression: Joi.string().required(),
});

// Workflow step schema
const workflowStepSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  request: requestSpecSchema.required(),
  thinkTime: durationSchema.optional(),
  conditions: Joi.array().items(stepConditionSchema).optional(),
  dataExtraction: Joi.array().items(dataExtractionSchema).optional(),
});

// Correlation rule schema
const correlationRuleSchema = Joi.object({
  sourceStep: Joi.string().required(),
  sourceField: Joi.string().required(),
  targetStep: Joi.string().required(),
  targetField: Joi.string().required(),
});

// Load test spec schema
const loadTestSpecSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  testType: Joi.string()
    .valid("spike", "stress", "endurance", "volume", "baseline")
    .required(),
  requests: Joi.array().items(requestSpecSchema).min(1).required(),
  loadPattern: loadPatternSchema.required(),
  duration: durationSchema.required(),
  workflow: Joi.array().items(workflowStepSchema).optional(),
  dataCorrelation: Joi.array().items(correlationRuleSchema).optional(),
})
  .custom((value, helpers) => {
    // If workflow is specified, validate correlation rules reference valid steps
    if (value.workflow && value.dataCorrelation) {
      const stepIds = value.workflow.map((step: WorkflowStep) => step.id);
      for (const rule of value.dataCorrelation) {
        if (!stepIds.includes(rule.sourceStep)) {
          return helpers.error("custom.invalidSourceStep", {
            sourceStep: rule.sourceStep,
          });
        }
        if (!stepIds.includes(rule.targetStep)) {
          return helpers.error("custom.invalidTargetStep", {
            targetStep: rule.targetStep,
          });
        }
      }
    }
    return value;
  }, "Workflow correlation validation")
  .messages({
    "custom.invalidSourceStep":
      'Source step "{{#sourceStep}}" not found in workflow',
    "custom.invalidTargetStep":
      'Target step "{{#targetStep}}" not found in workflow',
  });

/**
 * Validates a LoadTestSpec object
 */
export function validateLoadTestSpec(spec: LoadTestSpec): ValidationResult {
  const result = loadTestSpecSchema.validate(spec, { abortEarly: false });

  return {
    isValid: !result.error,
    errors: result.error
      ? result.error.details.map((detail) => detail.message)
      : [],
    warnings: [],
  };
}

/**
 * Validates a RequestSpec object
 */
export function validateRequestSpec(spec: RequestSpec): ValidationResult {
  const result = requestSpecSchema.validate(spec, { abortEarly: false });

  return {
    isValid: !result.error,
    errors: result.error
      ? result.error.details.map((detail) => detail.message)
      : [],
    warnings: [],
  };
}

/**
 * Validates a LoadPattern object
 */
export function validateLoadPattern(pattern: LoadPattern): ValidationResult {
  const result = loadPatternSchema.validate(pattern, { abortEarly: false });

  return {
    isValid: !result.error,
    errors: result.error
      ? result.error.details.map((detail) => detail.message)
      : [],
    warnings: [],
  };
}

/**
 * Validates a PayloadSpec object
 */
export function validatePayloadSpec(spec: PayloadSpec): ValidationResult {
  const result = payloadSpecSchema.validate(spec, { abortEarly: false });

  return {
    isValid: !result.error,
    errors: result.error
      ? result.error.details.map((detail) => detail.message)
      : [],
    warnings: [],
  };
}

/**
 * Validates a Duration object
 */
export function validateDuration(duration: Duration): ValidationResult {
  const result = durationSchema.validate(duration, { abortEarly: false });

  return {
    isValid: !result.error,
    errors: result.error
      ? result.error.details.map((detail) => detail.message)
      : [],
    warnings: [],
  };
}
