const N8N_PLACEHOLDER_URL = 'https://your-n8n-instance.com/webhook/validate-note'

const PUBLIC_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || N8N_PLACEHOLDER_URL
const SERVER_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || PUBLIC_WEBHOOK_URL

export interface ValidationRequest {
  validationId: string
  fileName: string
  fileType: string
  content: string
  state: string
  region: string
  userId: string
  fileUrl?: string
}

export interface ValidationResponse {
  executionId: string
  status: 'processing' | 'completed' | 'failed'
  message: string
}

function resolveWebhookUrl(): string {
  if (!SERVER_WEBHOOK_URL || SERVER_WEBHOOK_URL === N8N_PLACEHOLDER_URL) {
    throw new Error(
      'N8N webhook URL is not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL or N8N_WEBHOOK_URL.'
    )
  }

  return SERVER_WEBHOOK_URL
}

async function buildValidationResponse(response: Response): Promise<ValidationResponse> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const result = await response.json()
    return {
      executionId: result.executionId ?? 'unknown',
      status: (result.status as ValidationResponse['status']) ?? 'processing',
      message: result.message ?? 'Request accepted'
    }
  }

  const textResponse = await response.text()
  return {
    executionId: 'unknown',
    status: response.ok ? 'processing' : 'failed',
    message: textResponse || 'Request accepted'
  }
}

export async function postToN8N(
  validationData: ValidationRequest,
  webhookUrl = resolveWebhookUrl()
): Promise<ValidationResponse> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validationData),
  })

  if (!response.ok) {
    const message = N8N request failed:  
    throw new Error(message)
  }

  return buildValidationResponse(response)
}

export async function sendToN8N(
  validationData: ValidationRequest
): Promise<ValidationResponse> {
  console.log('Validation data being sent:', validationData)

  try {
    if (typeof window === 'undefined') {
      return postToN8N(validationData)
    }

    const response = await fetch('/api/n8n/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validationData),
    })

    const proxyResult = await response.json()

    if (!response.ok || !proxyResult.success) {
      throw new Error(proxyResult.error || 'Validation service returned an error.')
    }

    return proxyResult.data as ValidationResponse
  } catch (error) {
    console.error('Error sending to N8N:', error)
    console.error('Full error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      webhookUrl: SERVER_WEBHOOK_URL,
    })
    throw error
  }
}

export async function handleN8NWebhook(webhookData: any) {
  const { validationId, status, resultSummary, resultDetails, executionId } = webhookData

  const { updateValidationResult } = await import('./database')

  return updateValidationResult(
    validationId,
    status,
    resultSummary,
    resultDetails,
    executionId
  )
}

export { N8N_PLACEHOLDER_URL }
