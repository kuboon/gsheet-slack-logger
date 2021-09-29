import * as core from '@actions/core';

const args = process.argv.slice(2)

let year, month
if (args.length < 2 || args[0] == "") {
  const now = new Date
  year = now.getFullYear()
  month = now.getMonth() + 1 - 2
} else {
  year = parseInt(args[0])
  month = parseInt(args[1])
}
core.notice(`start backing up ${year}/${month}`)

import main from './main.js'
main(false, new Date(year, month - 1), new Date(year, month)).catch(e => {
  console.error(e)
  core.setFailed(`Action failed with error ${e}`);
})
