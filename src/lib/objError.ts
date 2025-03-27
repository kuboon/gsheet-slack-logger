const getTrace = (e: Error) => e.stack!.split("\n"); //.slice(1, -1)

export class ObjError extends Error {
  public obj: unknown[];
  public trace: string[];
  constructor(error: Error);
  constructor(msg: string, obj: unknown);
  constructor(arg1: Error | string, obj?: unknown) {
    const error = arg1 instanceof Error ? arg1 : undefined;
    const msg = typeof arg1 === "string" ? arg1 : undefined;
    super(error?.message || msg);
    this.trace = getTrace(error || this);
    if (error) error.stack = undefined;
    this.obj = [error || obj];
    this.stack = undefined;
  }
  static throw(msg: string, obj?: unknown): never {
    throw new ObjError(msg, obj);
  }
}
export function rethrow(error_: Error, obj?: unknown): never {
  const error = error_ instanceof ObjError ? error_ : new ObjError(error_);
  if (obj) error.obj.push(obj);

  const here = { message: "rethrow" } as Error;
  Error.captureStackTrace(here, rethrow);
  const trace = getTrace(here);
  error.trace.push(...trace);
  throw error;
}

Deno.test({
  name: "ObjError",
  fn: async () => {
    const func1 = () => {
      throw new Error("test");
    };
    const func2 = async () => {
      await func1();
    };
    try {
      await func2().catch(ObjError.throw);
    } catch (e) {
      console.error(e);
    }
  },
});
