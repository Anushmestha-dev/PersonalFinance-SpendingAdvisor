import { POST as postChat } from '../chat/route';

export async function POST(request: Request) {
  return postChat(request);
}
