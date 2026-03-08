import { NextRequest, NextResponse } from 'next/server'
import { postToN8N, N8N_PLACEHOLDER_URL } from '@/lib/n8n-client'
import type { ValidationRequest } from '@/lib/n8n-client'

const PLACEHOLDER_MESSAGE = 'Validation service is not configured. Please contact an administrator.'

function resolveServerWebhookUrl(): string | null {
  const directUrl = process.env.N8N_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL

  if (!directUrl || directUrl === N8N_PLACEHOLDER_URL) {
    return null
  }

  return directUrl
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ValidationRequest | undefined

    if (!payload || !payload.validationId) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload.' },
        { status: 400 }
      )
    }

    const webhookUrl = resolveServerWebhookUrl()

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: PLACEHOLDER_MESSAGE },
        { status: 503 }
      )
    }

    const result = await postToN8N(payload, webhookUrl)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error proxying request to N8N:', error)

    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    )
  }
}
