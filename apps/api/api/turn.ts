// Vercel serverless function. Set the project's root directory to apps/api.
import { handleTurn } from "../src/turn";

export const config = { maxDuration: 30 };

export function POST(request: Request): Promise<Response> {
  return handleTurn(request);
}
