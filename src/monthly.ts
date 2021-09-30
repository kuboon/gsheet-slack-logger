import main from './main.js'
import settings from './settings.js';
import * as core from '@actions/core';

import { Temporal } from '@js-temporal/polyfill';

let year = parseInt(core.getInput('year'))
let month = parseInt(core.getInput('month'))
if (isNaN(year)) {
  if (!isNaN(month)) {
    core.setFailed('should specify both year and month')
    process.exit(1)
  }
  const now = new Date
  year = now.getFullYear()
  month = now.getMonth() + 1 - 2
}
core.notice(`start backing up ${year}/${month}`)

const timeZone = settings.tz;
const from = Temporal.ZonedDateTime.from({ timeZone, year, month, day: 1})
const to = Temporal.ZonedDateTime.from({ timeZone, year, month: month+1, day: 1})
main(false, new Date(from.epochMilliseconds), new Date(to.epochMilliseconds)).catch(e => {
  console.error(e)
  core.setFailed(`Action failed with error ${e}`);
})
