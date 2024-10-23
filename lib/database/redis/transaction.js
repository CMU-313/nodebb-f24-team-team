'use strict';

module.exports = function (module) {
  module.transaction = function (perform, callback) {
    perform(module.client, callback);
  };
};