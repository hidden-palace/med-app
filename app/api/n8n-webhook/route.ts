import { NextRequest, NextResponse } from 'next/server';
import { handleN8NWebhook } from '@/lib/n8n-client';
import { updateValidationResult } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('N8N webhook received');
    
    let webhookData;
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
    
    // Validate webhook data
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
    
    console.log('Processing webhook for validation:', webhookData.validationId);
    
    // Extract the data we need
    const {
      validationId,
      status,
      resultSummary,
      resultDetails,
      executionId
    } = webhookData;
    
    // Update the validation record directly
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
      validationId: result.id 
    });
  } catch (error) {
    console.error('Error processing N8N webhook:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
