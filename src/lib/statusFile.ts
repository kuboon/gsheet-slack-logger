import settings from "../settings.js";
import { channelsIt } from "./slack.js";
import { GSheet, GSheetSchema, sheets_v4 } from "./google/sheet.js";
import { Timestamp } from "./timestamp.js"
import * as fs from 'fs';

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
    channels.push({
      name: c.name!,
      channel_id: c.id!,
      ts
    })
  }
  channels.sort((a, b) => a.name!.localeCompare(b.name!))
  for (const c of channels) {
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
