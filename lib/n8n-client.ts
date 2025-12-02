// N8N integration utilities for note validation
export const N8N_PLACEHOLDER_URL = 'https://your-n8n-instance.com/webhook/validate-note';

export interface ValidationRequest {
  validationId: string;
  fileName: string;
  fileType: string;
  content: string;
  state: string;
  region: string;
  userId: string;
  fileUrl?: string;
  prompt?: string;
}

export interface ValidationResponse {
  executionId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
}

function ensureConfiguredWebhookUrl(url: string | null | undefined): string {
  if (!url || url === N8N_PLACEHOLDER_URL) {
    throw new Error(
      'N8N webhook URL is not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL or N8N_WEBHOOK_URL.'
    );
  }

  return url;
}

function normalizeStatus(value: unknown): ValidationResponse['status'] {
  if (value === 'completed' || value === 'failed') {
    return value;
  }

  return 'processing';
}

function normalizeMessage(value: unknown, fallback = 'Request accepted'): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function normalizeExecutionId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return 'unknown';
}

function buildDefaultResponse(message?: string): ValidationResponse {
  return {
    executionId: 'unknown',
    status: 'processing',
    message: normalizeMessage(message, 'Request accepted'),
  };
}

async function parseN8NResponse(response: Response): Promise<ValidationResponse> {
  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch (error) {
      console.warn('Failed to read N8N error response body:', error);
    }

    const errorMessage = errorBody
      ? `N8N request failed: ${response.status} ${response.statusText} - ${errorBody}`
      : `N8N request failed: ${response.status} ${response.statusText}`;

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const parsed = (await response.json()) as Record<string, unknown>;
      return {
        executionId: normalizeExecutionId(parsed.executionId),
        status: normalizeStatus(parsed.status),
        message: normalizeMessage(parsed.message),
      };
    } catch (error) {
      console.warn('Unable to parse N8N JSON response, falling back to text:', error);
    }
  }

  const text = await response.text();
  return buildDefaultResponse(text);
}

export async function postToN8N(
  validationData: ValidationRequest,
  webhookUrl: string
): Promise<ValidationResponse> {
  const targetUrl = ensureConfiguredWebhookUrl(webhookUrl);

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validationData),
  });

  console.log('N8N webhook response status:', response.status, 'url:', targetUrl);

  return parseN8NResponse(response);
}

function resolveTriggerEndpoint(): string {
  if (typeof window !== 'undefined') {
    return '/api/n8n/trigger';
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith('http')
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : null);

  if (!baseUrl) {
    throw new Error(
      'Unable to determine base URL for the N8N trigger endpoint. Set NEXT_PUBLIC_SITE_URL or provide N8N webhook configuration.'
    );
  }

  const trimmedBaseUrl = baseUrl.replace(/\/+$/, '');
  return `${trimmedBaseUrl}/api/n8n/trigger`;
}

export async function sendToN8N(
  validationData: ValidationRequest
): Promise<ValidationResponse> {
  const directWebhook = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  const hasDirectWebhook = Boolean(directWebhook && directWebhook !== N8N_PLACEHOLDER_URL);
  const isServer = typeof window === 'undefined';

  if (hasDirectWebhook && isServer) {
    console.log('Sending validation request directly to N8N webhook.');
    return postToN8N(validationData, directWebhook as string);
  }

  console.log('Proxying validation request through /api/n8n/trigger.');

  const triggerEndpoint = resolveTriggerEndpoint();
  const response = await fetch(triggerEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validationData),
  });

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown> | null;
  } catch (error) {
    console.warn('Unable to parse proxy response as JSON:', error);
  }

  const payloadSuccess = Boolean(
    payload &&
      Object.prototype.hasOwnProperty.call(payload, 'success') &&
      (payload as { success?: unknown }).success
  );

  if (!response.ok || !payloadSuccess) {
    const rawError =
      payload && typeof (payload as { error?: unknown }).error === 'string'
        ? ((payload as { error: string }).error).trim()
        : '';

    const errorMessage =
      rawError.length > 0
        ? rawError
        : `Failed to trigger validation: ${response.status} ${response.statusText}`;

    throw new Error(errorMessage);
  }

  if (
    payload &&
    typeof (payload as { data?: unknown }).data === 'object' &&
    (payload as { data?: unknown }).data
  ) {
    const data = (payload as { data: Record<string, unknown> }).data;
    return {
      executionId: normalizeExecutionId((data as { executionId?: unknown }).executionId),
      status: normalizeStatus((data as { status?: unknown }).status),
      message: normalizeMessage((data as { message?: unknown }).message),
    };
  }

  const fallbackMessage =
    payload && typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : undefined;

  return buildDefaultResponse(fallbackMessage);
}

export async function handleN8NWebhook(webhookData: any) {
  console.log('handleN8NWebhook called with:', webhookData);

  const {
    validationId,
    status,
    resultSummary,
    resultDetails,
    executionId,
  } = webhookData ?? {};

  if (!validationId) {
    throw new Error('Missing validationId in webhook data');
  }

  if (!status) {
    throw new Error('Missing status in webhook data');
  }

  const { updateValidationResult } = await import('./database');

  return updateValidationResult(
    validationId,
    status === 'completed' ? 'completed' : 'failed',
    resultSummary,
    resultDetails,
    executionId
  );
}
