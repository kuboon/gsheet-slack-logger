Deno.env.set("TZ", "UTC");
import settings from "./settings.ts";
import { StatusFile } from "./lib/statusFile.ts";
import { BatchBuilder } from "./lib/batchBuilder.ts";
import { historyIt, Message, MessageProcessor } from "./lib/slack.ts";
import { Timestamp } from "./lib/timestamp.ts";
import { formattedCell, sheets_v4 } from "./lib/google/sheet.ts";
import { ObjError } from "./lib/objError.ts";

const sleep = (msec: number) => new Promise((ok) => setTimeout(ok, msec));

// console.log without new line
async function print(input: string | Uint8Array, to = Deno.stdout) {
  const stream = new Blob([input]).stream();
  await stream.pipeTo(to.writable, { preventClose: true });
}

function msgToRow(msg: Message, p: MessageProcessor) {
  const { ts, user, text, ...rest } = msg;
  const threadMark = msg.reply_count ? "+" : msg.parent_user_id ? ">" : "";

  try {
    const row: sheets_v4.Schema$RowData = {
      values: [
        formattedCell(threadMark),
        formattedCell(Timestamp.fromSlack(ts!)!, settings.tz),
        formattedCell(p.username(user) || rest.username || ""),
        formattedCell(p.readable(text) || rest.attachments?.[0].fallback || ""),
        formattedCell(JSON.stringify(rest)),
      ],
    };
    return row;
  } catch (e) {
    ObjError.throw(`${ts} ${user} ${text}`, e);
  }
}

async function* ahead<T>(
  gen: AsyncGenerator<T, void, void>,
): AsyncGenerator<{ msg: T; next?: T }, void, void> {
  let msg = (await gen.next()).value!;
  for await (const next of gen) {
    yield { msg, next };
    msg = next!;
  }
  yield { msg };
}
export default async function main(
  append = false,
  oldest_: Date,
  latest_: Date,
) {
  const oldest = new Timestamp(oldest_);
  const latest = new Timestamp(latest_);
  const file = new StatusFile();
  const { gSheet } = await file.prepare(append, oldest);
  await file.save();
  console.log("https://docs.google.com/spreadsheets/d/" + gSheet.id);

  const builder = new BatchBuilder();
  const messageProcessor = await new MessageProcessor().asyncInit();
  const tsRecord: Record<string, string> = {};
  async function flushAndSave() {
    const batches = builder.flush();
    if (batches.length == 0) return;
    await gSheet.batchUpdate(batches).catch((e) => {
      if (e.code == 429) {
        console.error(e.errors);
        Deno.exit(1);
      } else throw e;
    });
    for (const id in tsRecord) {
      const c = file.status.channels.find((x) => x.channel_id == id)!;
      c.ts = tsRecord[id];
    }
    await file.save();
  }
  for await (const c of file.status.channels) {
    console.log(c.name);
    builder.setSheetId(c.sheetId!);
    for await (
      const { msg, next } of ahead(
        historyIt(c.channel_id, c.ts, latest.slack()),
      )
    ) {
      if (!msg) {
        builder.pushDeleteSheet();
        await print(" x");
        break;
      }
      const row = msgToRow(msg, messageProcessor);
      const estimate = builder.push(row);
      if (!next) {
        tsRecord[c.channel_id] = msg.ts!;
      }
      if (estimate > 10000 && (!next || !next.parent_user_id)) {
        await print(".");
        tsRecord[c.channel_id] = msg.ts!;
        await flushAndSave();

        // https://developers.google.com/sheets/api/reference/limits
        await sleep(1000);
      }
    }
    console.log("");
  }
  await flushAndSave();
}
