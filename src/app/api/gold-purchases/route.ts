import '@/engine.server';
import { crudListHandlers } from '@lumilab/engine/server';
import { goldCrudSpec, goldIds } from '@/lib/gold/crud-spec';

export async function GET(req: Request) {
  const { GET: handler } = crudListHandlers(goldCrudSpec(await goldIds()));
  return handler(req as never);
}
export async function POST(req: Request) {
  const { POST: handler } = crudListHandlers(goldCrudSpec(await goldIds()));
  return handler(req as never);
}
