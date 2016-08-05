#!/bin/sh
':' //# http://sambal.org/?p=1014 ; exec /usr/bin/env node "$0" "$@"
'use strict';

const meow = require('@offirmo/cli-toolbox/framework/meow')
const sync = require('./sync')

const cli = meow(`
    Usage
      $ ./scripts/index.js

    Options
      --dry-run  don't write anything

    Examples
      $ ./scripts/index.js --sync --dry-run
`)


if (cli.flags.sync)
	return sync(Object.assign({}, { i18n: true}, cli.flags))

cli.showHelp(1)
