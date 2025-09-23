import { NextRequest, NextResponse } from 'next/server';
import { handleN8NWebhook } from '@/lib/n8n-client';

export async function POST(request: NextRequest) {
  try {
    const webhookData = await request.json();
    
    // Validate webhook data
    if (!webhookData.validationId || !webhookData.status) {
      return NextResponse.json(
        { error: 'Invalid webhook data' },
        { status: 400 }
      );
    }
    
    // Process the webhook
    const result = await handleN8NWebhook(webhookData);
    
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error processing N8N webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}