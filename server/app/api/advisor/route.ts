import { GET as getInsights } from '../ai/insights/route';

export async function GET(request: Request) {
  return getInsights(request);
}

export async function POST(request: Request) {
  return getInsights(request);
}
