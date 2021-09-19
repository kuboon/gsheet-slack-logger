import settings from "../settings.js";
import { WebClient } from "@slack/web-api";
import { Member } from "@slack/web-api/dist/response/UsersListResponse";
import { Message } from "@slack/web-api/dist/response/ConversationsHistoryResponse";

const slack = new WebClient(settings.slack.token)

export { Message }
export async function* channelsIt() {
  let cursor: string | undefined;
  do {
    const res = await slack.conversations.list({
      cursor,
      types: "public_channel",
    });
    cursor = res!.response_metadata?.next_cursor;
    for (const c of res!.channels!) {
      if (c.is_member) yield c;
    }
  } while (cursor);
}
export async function* historyIt(channel: string, oldest: string, latest?: string): AsyncGenerator<Message, void, void> {
  let cursor: string | undefined;
  do {
    // passing latest causes pagination from latest to oldest
    const res = await slack.conversations.history({
      channel,
      cursor,
      oldest
      // latest
    });
    cursor = res!.response_metadata?.next_cursor;
    const messages = res!.messages!

    // api response always ordered from latest to oldest unless latest is null
    // we should return oldest first
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (latest && parseFloat(latest) < parseFloat(msg.ts!)) {
        cursor = undefined
        break
      }
      // should check responses
      yield msg;
      if (msg.reply_count) {
        yield* replies(channel, msg.ts!)
      }
    }
  } while (cursor);
}
async function* replies(channel: string, ts: string) {
  let cursor: string | undefined;
  do {
    // passing latest causes pagination from latest to oldest
    const res = await slack.conversations.replies({
      channel,
      cursor,
      ts
    });
    cursor = res!.response_metadata?.next_cursor;
    const messages = res!.messages!
    for (const m of messages) {
      if (m.ts != ts) yield m
    }
  } while (cursor)
}
const Regex = {
  user_id: /<@([^|>]+)(?:\|[^>]+)?>/g,
  group_id: /<!subteam\^([^|>]+)(?:\|[^>]+)?>/g,
  channel_id: /<#([^|>]+)(?:\|[^>]+)?>/g,
  specials: /<!([^^|>]+)>/g
}
function unescape(str: string) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
async function users() {
  const res = await slack.users.list()
  return res.members!
}
export class MessageProcessor {
  users: Member[]
  groups: { id: string, name: string }[]
  channels: { id: string, name: string }[]
  constructor() {
    this.users = []
    this.groups = []
    this.channels = []
  }
  async await() {
    this.users = await users()
    return this
  }
  readable(raw: string | undefined) {
    if (!raw || raw == '') return
    const ret = raw.replaceAll(Regex.user_id, (s, s1) => {
      const user = this.users.find(x => x.id == s1)
      return `@${user?.name || s1}`
    }).replaceAll(Regex.group_id, (s, s1) => {
      const hit = this.groups.find(x => x.id == s1)
      return `@${hit?.name || s1}`
    }).replaceAll(Regex.channel_id, (s, s1) => {
      const hit = this.channels.find(x => x.id == s1)
      return `@${hit?.name || s1}`
    }).replaceAll(Regex.specials, (s, s1) => {
      return `@${s1}`
    })
    return unescape(ret)
  }
  username(id?: string) {
    if (!id) return
    const user = this.users.find(x => x.id == id)
    return user?.real_name || user?.name || id
  }
}
