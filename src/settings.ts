export default {
  tz: process.env['INPUT_TIMEZONE']!,
  folder: process.env['INPUT_FOLDER-ID']!,
  slack: {
    token: process.env['INPUT_SLACK-TOKEN']!
  },
  google: {
    email: process.env['INPUT_GOOGLE-CLIENT-EMAIL']!,
    key: process.env['INPUT_GOOGLE-PRIVATE-KEY']!
  }
};
