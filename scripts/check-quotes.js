'use strict';

const fs = require('fs');
const path = require('path');
const { validateQuotes, BUNDLED_QUOTES, bodyLength } = require('../extension/daily-quote');

const file = path.join(__dirname, '..', 'extension', 'quotes.json');
const quotes = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = validateQuotes(quotes);
if (errors.length) {
  errors.forEach((line) => console.error(line));
  process.exit(1);
}
if (JSON.stringify(BUNDLED_QUOTES) !== JSON.stringify(quotes)) {
  console.error('daily-quote.js catalog does not match quotes.json');
  process.exit(1);
}
const longest = quotes.reduce((best, quote) => Math.max(best, bodyLength(quote.text)), 0);
console.log('quotes ok ' + quotes.length + ' longest ' + longest);
