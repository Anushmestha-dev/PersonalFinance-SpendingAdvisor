import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '../../../lib/gemini';

export async function GET() {
  const keyResult = getGeminiApiKey();
  if ('error' in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }

  return NextResponse.json({ message: 'AI service configured successfully.' });
}

export async function POST(request: Request) {
  const keyResult = getGeminiApiKey();
  if ('error' in keyResult) {
    return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
  }

  return NextResponse.json({ message: 'AI request processed successfully.' });
}
