const getTrace = (e: Error) => e.stack!.split("\n"); //.slice(1, -1)

export class ObjError extends Error {
  public obj: any[];
  public trace: string[];
  constructor(error: Error);
  constructor(msg: string, obj: any);
  constructor(arg1: Error | string, obj?: any) {
    const error = arg1 instanceof Error ? arg1 : undefined;
    const msg = typeof arg1 === "string" ? arg1 : undefined;
    super(error?.message || msg);
    this.trace = getTrace(error || this);
    if (error) error.stack = undefined;
    this.obj = [error || obj];
    this.stack = undefined;
  }
  static throw(msg: string, obj?: any): never { throw new ObjError(msg, obj) }
}
export function rethrow(error_: Error, obj?: any): never {
  const error = error_ instanceof ObjError ? error_ : new ObjError(error_);
  if (obj) error.obj.push(obj);

  const here = { message: "rethrow" } as Error;
  Error.captureStackTrace(here, rethrow);
  const trace = getTrace(here);
  error.trace.push(...trace);
  throw error;
}

//
async function hoge() {
  await new Promise((ok, ng) =>
    setTimeout(() => {
      ng(Error("abc"));
    }, 400)
  ).catch((e) => rethrow(e));
}
async function test1() {
  await hoge().catch((e) => rethrow(e));
}
//test1().catch((e) => console.error(e));
