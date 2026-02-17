import OpenAI from 'openai';
import { z } from 'zod';
import type { ProviderAdapter, ProviderGenerateParams, ProviderGenerateResult } from './types';

const PROVIDER_NAME = 'openai';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const MODEL_CASCADE = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o'] as const;

type OpenAIModel = (typeof MODEL_CASCADE)[number];

function isValidModel(model?: string): model is OpenAIModel {
  return !!model && MODEL_CASCADE.includes(model as OpenAIModel);
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const status = error.status ?? error.code;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function describeError(error: any): string {
  if (!error) return 'unknown error';
  const status = error.status ?? error.code;
  const message = error?.message ?? (typeof error === 'string' ? error : error?.toString?.() ?? '');

  if (status === 429) return 'rate limited';
  if (status === 500 || status === 502 || status === 503) return 'service unavailable';
  if (status === 504) return 'gateway timeout';
  if (status === 401 || message.toLowerCase().includes('unauthorized')) return 'authentication failed';
  if (status === 400) return 'invalid request';
  if (message.toLowerCase().includes('context_length_exceeded')) return 'context length exceeded';
  if (message.toLowerCase().includes('timeout')) return 'timeout';

  return 'unknown error';
}

/**
 * Ensures all object schemas have `additionalProperties: false` as required
 * by OpenAI's structured outputs API.
 */
function addAdditionalProperties(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  if (Array.isArray(schema)) {
    return schema.map(addAdditionalProperties);
  }

  const result: Record<string, any> = { ...schema };

  // Add additionalProperties: false to all objects
  if (schema.type === 'object' && schema.properties) {
    result.additionalProperties = false;
  }

  // Recursively process nested schemas
  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = addAdditionalProperties(value);
    }
  }

  if (schema.items) {
    result.items = addAdditionalProperties(schema.items);
  }

  // Handle anyOf/oneOf by converting nullable types
  if (schema.anyOf || schema.oneOf) {
    const schemas = schema.anyOf || schema.oneOf;
    const nonNullSchemas = schemas.filter((s: any) => s.type !== 'null');

    if (nonNullSchemas.length === 1) {
      const converted = addAdditionalProperties(nonNullSchemas[0]);
      if (converted && typeof converted === 'object') {
        converted.nullable = true;
      }
      return converted;
    }

    if (nonNullSchemas.length > 0) {
      return addAdditionalProperties(nonNullSchemas[0]);
    }

    // If only null schema remains, return a simple nullable string
    return { type: 'string', nullable: true };
  }

  return result;
}

function convertToOpenAISchema(zodSchema: z.ZodTypeAny): any {
  try {
    const jsonSchema = z.toJSONSchema(zodSchema);
    return addAdditionalProperties(jsonSchema);
  } catch (error) {
    console.error('[OpenAI] Failed to convert Zod schema to JSON schema', error);
    throw new Error(
      error instanceof Error
        ? `Failed to convert schema: ${error.message}`
        : 'Failed to convert schema'
    );
  }
}

function buildModelList(model?: string) {
  if (isValidModel(model)) {
    return [model, ...MODEL_CASCADE.filter((candidate) => candidate !== model)];
  }
  return [...MODEL_CASCADE];
}

function normalizeUsage(usage: any, latencyMs: number) {
  if (!usage) {
    return { latencyMs };
  }

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    latencyMs,
  };
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
}

export function createOpenaiAdapter(): ProviderAdapter {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is required to use the OpenAI provider. Set the environment variable and try again.'
    );
  }

  const baseURL = process.env.OPENAI_API_BASE_URL?.replace(/\/$/, '');
  const openai = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return {
    name: PROVIDER_NAME,
    defaultModel: DEFAULT_MODEL,
    async generate(params: ProviderGenerateParams): Promise<ProviderGenerateResult> {
      const models = buildModelList(params.model);
      let lastError: unknown;
      const promptLength = params.prompt.length;

      for (const modelName of models) {
        try {
          const requestOptions: OpenAI.ChatCompletionCreateParams = {
            model: modelName,
            messages: [
              {
                role: 'user',
                content: params.prompt,
              },
            ],
          };

          if (typeof params.temperature === 'number') {
            requestOptions.temperature = params.temperature;
          }
          if (typeof params.topP === 'number') {
            requestOptions.top_p = params.topP;
          }
          if (typeof params.maxOutputTokens === 'number') {
            requestOptions.max_tokens = params.maxOutputTokens;
          }

          if (params.zodSchema) {
            const jsonSchema = convertToOpenAISchema(params.zodSchema);
            requestOptions.response_format = {
              type: 'json_schema',
              json_schema: {
                name: params.schemaName || 'ResponseSchema',
                schema: jsonSchema,
                strict: true,
              },
            };
          }

          const requestStart = Date.now();
          const apiCallPromise = openai.chat.completions.create(requestOptions);

          const response = params.timeoutMs
            ? await Promise.race([apiCallPromise, createTimeoutPromise(params.timeoutMs)])
            : await apiCallPromise;

          const latencyMs = Date.now() - requestStart;

          const choice = response.choices?.[0];
          const content = choice?.message?.content;

          if (typeof content === 'string' && content.trim().length > 0) {
            const usage = normalizeUsage(response.usage, latencyMs);

            console.log(
              `[OpenAI][${modelName}] latency=${latencyMs}ms promptChars=${promptLength} ` +
                `promptTokens=${usage.promptTokens ?? 'n/a'} completionTokens=${
                  usage.completionTokens ?? 'n/a'
                } totalTokens=${usage.totalTokens ?? 'n/a'}`
            );

            return {
              content,
              rawResponse: response,
              provider: PROVIDER_NAME,
              model: modelName,
              usage,
            };
          }

          console.warn(
            `[OpenAI] Model ${modelName} returned empty response, trying next...`
          );
        } catch (error) {
          lastError = error;
          const description = describeError(error);

          // Handle context length exceeded - don't retry with other models
          if (
            error instanceof Error &&
            error.message.toLowerCase().includes('context_length_exceeded')
          ) {
            throw new Error(
              `OpenAI API error: The prompt is too long for model ${modelName}. Please reduce the input length.`
            );
          }

          if (!isRetryableError(error)) {
            console.error(
              `[OpenAI] Model ${modelName} failed with non-retryable error (${description}):`,
              error
            );
            throw new Error(
              `OpenAI API error (${description}): ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }

          console.warn(
            `[OpenAI] Model ${modelName} ${description}, attempting next fallback...`
          );
        }
      }

      const description = describeError(lastError);
      throw new Error(
        `All OpenAI models failed. Last error type: ${description}. ${
          lastError instanceof Error ? lastError.message : 'Unknown error'
        }`
      );
    },
  };
}
