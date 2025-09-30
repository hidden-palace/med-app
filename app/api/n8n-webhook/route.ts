import { NextRequest, NextResponse } from 'next/server'
import { updateValidationResult, ValidationRecordNotFoundError } from '@/lib/database'
import { getSupabaseAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

type AnyRecord = Record<string, unknown>

type NormalizedWebhookPayload = {
  validationId: string
  status: 'completed' | 'failed'
  resultSummary?: string
  resultDetails?: unknown
  executionId?: string
}

class InvalidWebhookPayloadError extends Error {
  status = 400

  constructor(message: string) {
    super(message)
    this.name = 'InvalidWebhookPayloadError'
  }
}

const STATUS_MAP: Record<string, NormalizedWebhookPayload['status']> = {
  completed: 'completed',
  complete: 'completed',
  success: 'completed',
  succeeded: 'completed',
  done: 'completed',
  finished: 'completed',
  failed: 'failed',
  failure: 'failed',
  error: 'failed',
  errored: 'failed',
  aborted: 'failed',
  cancelled: 'failed',
  canceled: 'failed',
}

function coerceToRecord(value: unknown): AnyRecord {
  if (!value || typeof value !== 'object') {
    throw new InvalidWebhookPayloadError('Webhook payload must be an object')
  }

  return value as AnyRecord
}

function normalizeWebhookPayload(rawPayload: unknown): NormalizedWebhookPayload {
  const topLevel = coerceToRecord(rawPayload)
  const candidate =
    topLevel.body && typeof topLevel.body === 'object'
      ? coerceToRecord(topLevel.body)
      : topLevel

  const validationIdSource =
    candidate.validationId ?? candidate.validation_id ?? candidate.id

  const validationId =
    typeof validationIdSource === 'string' || typeof validationIdSource === 'number'
      ? String(validationIdSource).trim()
      : ''

  if (!validationId) {
    throw new InvalidWebhookPayloadError('Missing validationId in webhook data')
  }

  const statusSource = candidate.status ?? candidate.validationStatus ?? candidate.state
  const statusKey =
    typeof statusSource === 'string' ? statusSource.trim().toLowerCase() : ''

  const mappedStatus = STATUS_MAP[statusKey]
  if (!mappedStatus) {
    throw new InvalidWebhookPayloadError(
      `Unsupported validation status "${String(statusSource)}"`
    )
  }

  const resultSummary =
    typeof candidate.resultSummary === 'string'
      ? candidate.resultSummary
      : typeof candidate.summary === 'string'
        ? candidate.summary
        : undefined

  const resultDetails =
    candidate.resultDetails ?? candidate.details ?? candidate.data ?? undefined

  const executionIdSource =
    candidate.executionId ??
    candidate.execution_id ??
    candidate.n8nExecutionId

  const executionId =
    typeof executionIdSource === 'string' || typeof executionIdSource === 'number'
      ? String(executionIdSource).trim()
      : undefined

  return {
    validationId,
    status: mappedStatus,
    resultSummary,
    resultDetails,
    executionId,
  }
}

function buildErrorResponse(error: unknown) {
  if (error instanceof InvalidWebhookPayloadError) {
    return {
      status: error.status,
      body: {
        success: false,
        error: 'Invalid webhook payload',
        message: error.message,
      },
    }
  }

  if (error instanceof ValidationRecordNotFoundError) {
    return {
      status: 404,
      body: {
        success: false,
        error: 'Validation record not found',
        message: error.message,
      },
    }
  }

  if (error instanceof Error) {
    const code = (error as { code?: string | number }).code
    const statusFromError = (error as { status?: number }).status
    const hint = (error as { hint?: unknown }).hint
    const details = (error as { details?: unknown }).details

    const normalizedStatus =
      typeof statusFromError === 'number'
        ? statusFromError
        : code === 'PGRST116'
        ? 404
        : code === '401' || code === 401
        ? 401
        : code === '403' || code === 403
        ? 403
        : error.message.toLowerCase().includes('invalid api key')
        ? 401
        : error.message.toLowerCase().includes('permission denied')
        ? 403
        : 500

    const body: Record<string, unknown> = {
      success: false,
      error: normalizedStatus >= 500 ? 'Internal server error' : 'Request failed',
      message: error.message,
    }

    if (typeof code !== 'undefined') {
      body.code = code
    }

    if (typeof hint !== 'undefined' || typeof details !== 'undefined') {
      body.context = {
        ...(typeof details !== 'undefined' ? { details } : {}),
        ...(typeof hint !== 'undefined' ? { hint } : {}),
      }
    }

    return { status: normalizedStatus, body }
  }

  return {
    status: 500,
    body: {
      success: false,
      error: 'Internal server error',
      message: 'Unknown error',
    },
  }
}

export async function POST(request: NextRequest) {
  console.log('N8N webhook received')

  let rawPayload: unknown

  try {
    rawPayload = await request.json()
    console.log('Webhook data parsed:', JSON.stringify(rawPayload, null, 2))
  } catch (parseError) {
    console.error('Error parsing webhook JSON:', parseError)
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON payload',
        message: 'Request body is not valid JSON',
      },
      { status: 400 }
    )
  }

  try {
    const payload = normalizeWebhookPayload(rawPayload)
    console.log(
      'Processing webhook for validation:',
      payload.validationId,
      'status:',
      payload.status
    )

    const supabaseAdmin = getSupabaseAdminClient()

    const result = await updateValidationResult(
      payload.validationId,
      payload.status,
      payload.resultSummary,
      payload.resultDetails,
      payload.executionId,
      supabaseAdmin
    )
    console.log('Validation record updated successfully:', result.id)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      validationId: result.id,
    })
  } catch (error) {
    console.error('Error processing N8N webhook:', error)
    if (error instanceof Error && error.stack) {
      console.error('Error stack:', error.stack)
    }

    const { status, body } = buildErrorResponse(error)
    return NextResponse.json(body, { status })
  }
}
