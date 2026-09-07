import '@/engine.server';
import { crudItemHandlers } from '@lumilab/engine/server';
import { goldCrudSpec, goldIds } from '@/lib/gold/crud-spec';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return crudItemHandlers(goldCrudSpec(await goldIds())).GET(req as never, ctx);
}
export async function PATCH(req: Request, ctx: Ctx) {
  return crudItemHandlers(goldCrudSpec(await goldIds())).PATCH(req as never, ctx);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return crudItemHandlers(goldCrudSpec(await goldIds())).DELETE(req as never, ctx);
}
