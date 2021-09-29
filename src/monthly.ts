import main from './main.js'
import * as core from '@actions/core';

let year = parseInt(core.getInput('year'))
let month = parseInt(core.getInput('month'))
if (year == 0) {
  if (month != 0) {
    core.setFailed('should specify both year and month')
    process.exit(1)
  }
  const now = new Date
  year = now.getFullYear()
  month = now.getMonth() + 1 - 2
}
core.notice(`start backing up ${year}/${month}`)

main(false, new Date(year, month - 1), new Date(year, month)).catch(e => {
  console.error(e)
  core.setFailed(`Action failed with error ${e}`);
})
