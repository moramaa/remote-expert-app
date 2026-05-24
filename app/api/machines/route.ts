import { MACHINES } from '@/lib/machines';

export async function GET(): Promise<Response> {
  return Response.json(MACHINES);
}
