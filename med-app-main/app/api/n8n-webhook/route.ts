import { NextRequest, NextResponse } from 'next/server';
import { updateValidationResult, ValidationRecordNotFoundError } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('N8N webhook received');

    let webhookData: any;
    try {
      webhookData = await request.json();
      console.log('Webhook data parsed:', JSON.stringify(webhookData, null, 2));
    } catch (parseError) {
      console.error('Error parsing webhook JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (!webhookData.validationId) {
      console.error('Missing validationId in webhook data');
      return NextResponse.json(
        { error: 'Missing validationId' },
        { status: 400 }
      );
    }

    if (!webhookData.status) {
      console.error('Missing status in webhook data');
      return NextResponse.json(
        { error: 'Missing status' },
        { status: 400 }
      );
    }

    const {
      validationId,
      status,
      resultSummary,
      resultDetails,
      executionId,
    } = webhookData;

    const result = await updateValidationResult(
      validationId,
      status === 'completed' ? 'completed' : 'failed',
      resultSummary,
      resultDetails,
      executionId
    );

    console.log('Validation record updated successfully:', result.id);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      validationId: result.id,
    });
  } catch (error) {
    console.error('Error processing N8N webhook:', error);

    if (error instanceof ValidationRecordNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
