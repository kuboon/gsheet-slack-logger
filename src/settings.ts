export default {
  tz: Deno.env.get("INPUT_TIMEZONE")!,
  folder: Deno.env.get("INPUT_FOLDERID")!,
  autoJoin: Deno.env.get("INPUT_AUTOJOIN") == "true",
  skipChannels: (Deno.env.get("INPUT_SKIPCHANNELS") || "").split(" "),
  slack: {
    token: Deno.env.get("INPUT_SLACKTOKEN")!,
  },
  google: {
    email: Deno.env.get("INPUT_GOOGLECLIENTEMAIL")!,
    key: Deno.env.get("INPUT_GOOGLEPRIVATEKEY")!,
  },
};
