'use strict';

const crypto = require('crypto');
const meta = require('../../meta');
module.exports = {
  name: 'Clearing stale digest templates that were accidentally saved as custom',
  timestamp: Date.UTC(2017, 8, 6),
  method: async function () {
    const matches = ['112e541b40023d6530dd44df4b0d9c5d', '110b8805f70395b0282fd10555059e9f', '9538e7249edb369b2a25b03f2bd3282b'];
    const fieldset = await meta.configs.getFields(['email:custom:digest']);
    const hash = fieldset['email:custom:digest'] ? crypto.createHash('md5').update(fieldset['email:custom:digest']).digest('hex') : null;
    if (matches.includes(hash)) {
      await meta.configs.remove('email:custom:digest');
    }
  }
};