import main from './main.js'
import settings from './settings.js';
import * as core from '@actions/core';

import { Temporal } from '@js-temporal/polyfill';

const timeZone = settings.tz;
const year = parseInt(core.getInput('year'));
const month = parseInt(core.getInput('month'));
let from
if (isNaN(year)) {
    if (!isNaN(month)) {
        core.setFailed('should specify both year and month');
        process.exit(1);
    }
    const now = Temporal.Now.zonedDateTimeISO(timeZone).toPlainYearMonth();
    const twoMonths = Temporal.Duration.from({months: 2});
    from = now.subtract(twoMonths).toPlainDate({day: 1}).toZonedDateTime(timeZone);
} else {
    const ym = Temporal.PlainDateTime.from({
        year,
        month
      });
    from = ym.toZonedDateTime(timeZone)
}
core.notice(`start backing up ${from.year}/${from.month}`);
const to = from.add({months: 1})

main(false, new Date(from.epochMilliseconds), new Date(to.epochMilliseconds)).catch(e => {
  console.error(e)
  core.setFailed(`Action failed with error ${e}`);
})
