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
  ts: string
}
type Status = {
  ts: string,
  sheetId?: string,
  channels: ChannelStatus[]
};
class StatusFile {
  filePath = 'lastStatus'
  async load(): Promise<Status> {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return { ts: '0', channels: [] };
    }
  }
  async save(status: Status) {
    fs.writeFileSync(this.filePath, JSON.stringify(status));
  }
}

async function prepareSheets(gSheet: GSheet) {
  const channels: ChannelStatus[] = []
  const batches: sheets_v4.Schema$Request[] = []
  for await (const c of channelsIt()) {
    const s: ChannelStatus = {
      name: c.name!,
      channel_id: c.id!,
      ts: '0'
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

async function prepareWorkSheet(sid: string | undefined, fName: string) {
  if (sid) {
    return new GSheet(sid)
  } else {
    return GSheet.create(fName, GSheetSchema.sheetNames(settings.tz, ['_']), settings.folder)
  }
}

async function main(append = false, oldest: Timestamp, latest: Timestamp) {
  const file = new StatusFile();
  const status = await file.load();
  if (!append) status.sheetId = undefined

  const gSheet = await prepareWorkSheet(status.sheetId, oldest.date(settings.tz))

  const channels = await prepareSheets(gSheet)

  for await (const s of channels) {
    const cs = status.channels.find(x => x.channel_id === s.channel_id)
    if (cs) {
      s.ts = append ? cs.ts : oldest.slack()
    }
  }
  status.channels = channels
  await file.save(status);

  const updater = batchUpdater(gSheet)
  let counter = 0
  for await (const c of status.channels) {
    console.log(c.name)
    for await (const msg of historyIt(c.channel_id, c.ts, latest.slack())) {
      await updater.next({ sheetId: c.sheetId!, msg })
      counter++
      if (counter > 100) break
    }
  }
  await updater.next()
  await file.save(status);
}

main(false, new Timestamp(2020, 8), new Timestamp(2021, 10)).catch(console.error)
