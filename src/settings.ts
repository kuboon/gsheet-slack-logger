export default {
  slack: {
    token: Deno.env.get("INPUT_SLACKTOKEN")!,
  },
  google: {
    email: Deno.env.get("INPUT_GOOGLECLIENTEMAIL")!,
    key: Deno.env.get("INPUT_GOOGLEPRIVATEKEY")!,
  },
  tz: Deno.env.get("INPUT_TIMEZONE")!,
  folder: Deno.env.get("INPUT_FOLDERID")!,
  year: Deno.env.get("INPUT_YEAR"),
  month: Deno.env.get("INPUT_MONTH"),
  autoJoin: Deno.env.get("INPUT_AUTOJOIN") == "true",
  skipChannels: (Deno.env.get("INPUT_SKIPCHANNELS") || "").split(" "),
};
