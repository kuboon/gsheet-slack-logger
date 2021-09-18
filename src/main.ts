process.env.TZ = 'UTC'
import settings from "./settings.js";
import { channelsIt, historyIt, Message, MessageProcessor } from "./lib/slack.js";
import { Timestamp } from "./lib/timestamp.js"
import { formattedCell, GSheet, GSheetSchema, sheets_v4 } from "./lib/google/sheet.js";
import * as fs from 'fs';
import { ObjError } from "./lib/objError.js";

type ChannelStatus = {
  name: string,
  channel_id: string,
  sheetId?: number,
  ts: string,
}
type Status = {
  gSheetId: null | string,
  channels: ChannelStatus[]
};
export class StatusFile {
  filePath = 'lastStatus'
  status: Status
  constructor() {
    this.status = { gSheetId: null, channels: [] }
  }
  async load() {
    try {
      const json = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.status = json
    } catch {
    }
  }
  async save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.status));
  }
  async prepare(append: boolean, oldest: Timestamp) {
    if (append) await this.load();
    const gSheet = await prepareWorkSheet(this.status.gSheetId, oldest.date(settings.tz))
    this.status.gSheetId = gSheet.id

    const channels = await prepareSheets(gSheet, oldest.slack())
    if (append) {
      for await (const s of channels) {
        const cs = this.status.channels.find(x => x.channel_id === s.channel_id)
        if (cs) s.ts = cs.ts
      }
    }
    this.status.channels = channels

    return { gSheet, channels }
  }
}

async function prepareSheets(gSheet: GSheet, ts: string) {
  const channels: ChannelStatus[] = []
  const batches: sheets_v4.Schema$Request[] = []
  for await (const c of channelsIt()) {
    const s: ChannelStatus = {
      name: c.name!,
      channel_id: c.id!,
      ts
    }
    channels.push(s)
    let sheetId = await gSheet.getSheetIdByName(c.name!);
    if (!sheetId) {
      batches.push({ addSheet: { properties: { title: c.name } } })
    }
  }
  if (batches.length > 0) {
    await gSheet.batchUpdate(batches)
    await gSheet.metaReload()
  }
  for (const s of channels) {
    const sheetId = (await gSheet.getSheetIdByName(s.name))!;
    s.sheetId = sheetId
  };
  return channels
}

async function prepareWorkSheet(sid: string | null, fName: string) {
  if (sid) {
    return new GSheet(sid)
  } else {
    return GSheet.create(fName, GSheetSchema.sheetNames(settings.tz, ['_']), settings.folder)
  }
}

async function* batchUpdater(gSheet: GSheet): AsyncGenerator<void, void, { sheetId: number, msg: Message }> {
  const batches: sheets_v4.Schema$Request[] = []
  let rows: sheets_v4.Schema$RowData[] = []
  let count = 0
  let lastSheetId: number = 0
  const messageProcessor = await new MessageProcessor().await()
  while (true) {
    const input = yield
    const { sheetId, msg } = input || { sheetId: null, msg: null }
    count++
    if (lastSheetId != sheetId && rows.length > 0) {
      const req: sheets_v4.Schema$Request = { appendCells: { sheetId: lastSheetId, rows, fields: '*' } }
      batches.push(req)
      batches.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: lastSheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: 4,
          },
        },
      })
      rows = []
    }
    if (!sheetId) break

    lastSheetId = sheetId
    rows.push(msgToRow(msg, messageProcessor))
    if (count > 100) {
      const req: sheets_v4.Schema$Request = { appendCells: { sheetId, rows, fields: '*' } }
      batches.push(req)
      await gSheet.batchUpdate(batches)
      process.stdout.write('.')
      rows = []
      batches.length = 0
      count = 0
    }
  }
  if (batches.length > 0) {
    await gSheet.batchUpdate(batches)
    process.stdout.write('.')
  }
}

function msgToRow(msg: Message, p: MessageProcessor) {
  const { ts, user, text, ...rest } = msg
  const threadMark = msg.reply_count ? '+' : msg.thread_ts ? '>' : ''

  try {
    const row: sheets_v4.Schema$RowData = {
      values: [
        formattedCell(threadMark),
        formattedCell(Timestamp.fromSlack(ts!)!, settings.tz),
        formattedCell(p.username(user)),
        formattedCell(p.readable(text!)),
        formattedCell(JSON.stringify(rest))
      ]
    }
    return row
  } catch (e: any) {
    throw new ObjError(`${ts} ${user} ${text}`, e)
  }
}

async function* ahead<T>(gen: AsyncGenerator<T, void, void>): AsyncGenerator<{ msg: T, next?: T }, void, void> {
  let msg = (await gen.next()).value!
  for await (const next of gen) {
    yield { msg, next }
    msg = next!
  }
  yield { msg }
}
async function main(append = false, oldest: Timestamp, latest: Timestamp) {
  const file = new StatusFile();
  const { gSheet, channels } = await file.prepare(append, oldest)
  await file.save();

  const { status } = file

  for await (const s of channels) {
    const cs = status.channels.find(x => x.channel_id === s.channel_id)
    if (cs) {
      s.ts = append ? cs.ts : oldest.slack()
    }
  }
  status.channels = channels
  await file.save();

  const updater = batchUpdater(gSheet)
  let counter = 0
  for await (const c of status.channels) {
    console.log(c.name)
    for await (const { msg, next } of ahead(historyIt(c.channel_id, c.ts, latest.slack()))) {
      await updater.next({ sheetId: c.sheetId!, msg })
      counter++
      if (counter > 100) break
    }
  }
  await updater.next()
  await file.save();
}

main(false, new Timestamp(2020, 8), new Timestamp(2021, 10)).catch(console.error)
