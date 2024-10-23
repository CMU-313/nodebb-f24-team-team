'use strict';

const db = require('../../database');
const meta = require('../../meta');
module.exports = {
  name: 'Generate customHTML block from old customJS setting',
  timestamp: Date.UTC(2017, 9, 12),
  method: function (callback) {
    db.getObjectField('config', 'customJS', (err, newHTML) => {
      if (err) {
        return callback(err);
      }
      let newJS = [];
      const scriptMatch = /^<script\s?(?!async|deferred)?>([\s\S]+?)<\/script>/m;
      let match = scriptMatch.exec(newHTML);
      while (match) {
        if (match[1]) {
          newJS.push(match[1].trim());
          newHTML = ((match.index > 0 ? newHTML.slice(0, match.index) : '') + newHTML.slice(match.index + match[0].length)).trim();
        }
        match = scriptMatch.exec(newHTML);
      }
      newJS = newJS.join('\n\n');
      meta.configs.setMultiple({
        customHTML: newHTML,
        customJS: newJS
      }, callback);
    });
  }
};