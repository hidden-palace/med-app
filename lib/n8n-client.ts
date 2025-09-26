// N8N Integration for Note Validation
const N8N_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ||
  'https://your-n8n-instance.com/webhook/validate-note'

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

export async function sendToN8N(
  validationData: ValidationRequest
): Promise<ValidationResponse> {
  try {
    // Debug: Log the webhook URL to verify it's loaded correctly
    console.log('N8N_WEBHOOK_URL at runtime:', N8N_WEBHOOK_URL);
    console.log('Validation data being sent:', validationData);
    
    // ✅ Check if the webhook URL is still the placeholder
    if (N8N_WEBHOOK_URL === 'https://your-n8n-instance.com/webhook/validate-note') {
      throw new Error(
        'N8N webhook URL is not configured. Please set NEXT_PUBLIC_N8N_WEBHOOK_URL in your environment variables.'
      )
    }

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validationData),
    })

    console.log('N8N response status:', response.status);
    console.log('N8N response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText}`)
    }

    // Handle both JSON and text responses from N8N
    const contentType = response.headers.get('content-type')
    let result: ValidationResponse
    
    if (contentType && contentType.includes('application/json')) {
      // Parse as JSON if content-type indicates JSON
      result = await response.json()
      console.log('N8N JSON response:', result);
    } else {
      // Handle text responses (like "Accepted")
      const textResponse = await response.text()
      console.log('N8N text response:', textResponse)
      
      // Create a mock ValidationResponse for text responses
      result = {
        executionId: 'unknown',
        status: 'processing',
        message: textResponse || 'Request accepted'
      }
    }
    
    return result as ValidationResponse
  } catch (error) {
    console.error('Error sending to N8N:', error)
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      webhookUrl: N8N_WEBHOOK_URL
    }
    console.error('Full error details:', errorDetails);
    throw error
  }
}

// Function to handle N8N webhook responses
export async function handleN8NWebhook(webhookData: any) {
  console.log('handleN8NWebhook called with:', webhookData);
  
  const { 
    validationId, 
    status, 
    resultSummary, 
    resultDetails, 
    executionId 
  } = webhookData;
  
  if (!validationId) {
    throw new Error('Missing validationId in webhook data');
  }
  
  if (!status) {
    throw new Error('Missing status in webhook data');
  }

  // Update the validation record in Supabase
  const { updateValidationResult } = await import('./database');

  return await updateValidationResult(
    validationId,
    status === 'completed' ? 'completed' : 'failed',
    resultSummary,
    resultDetails,
    executionId
  );
}
