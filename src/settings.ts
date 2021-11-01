export default {
  tz: process.env['INPUT_TIMEZONE']!,
  folder: process.env['INPUT_FOLDERID']!,
  autoJoin: process.env['INPUT_AUTOJOIN'] == 'true',
  skipChannels: (process.env['INPUT_SKIPCHANNELS'] || '').split(' '),
  slack: {
    token: process.env['INPUT_SLACKTOKEN']!
  },
  google: {
    email: process.env['INPUT_GOOGLECLIENTEMAIL']!,
    key: process.env['INPUT_GOOGLEPRIVATEKEY']!
  }
};
