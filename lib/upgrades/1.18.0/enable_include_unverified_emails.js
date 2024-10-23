'use strict';

const meta = require('../../meta');
module.exports = {
  name: 'Enable setting to include unverified emails for all mailings',
  timestamp: Date.UTC(2021, 5, 18),
  method: async () => {
    await meta.configs.set('includeUnverifiedEmails', 1);
  }
};