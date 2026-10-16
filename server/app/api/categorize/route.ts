import { POST as postCategorize } from '../ai/categorize/route';

export async function POST(request: Request) {
  return postCategorize(request);
}
