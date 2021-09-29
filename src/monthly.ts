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
import main from './main.js'
core.debug('core debug')
core.notice(`core notice ${year}`)
main(false, new Date(year, month - 1), new Date(year, month)).catch(console.error)
