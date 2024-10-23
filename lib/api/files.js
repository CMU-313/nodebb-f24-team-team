'use strict';

const fs = require('fs').promises;
const filesApi = module.exports;
filesApi.delete = async (_, {
  path
}) => await fs.unlink(path);
filesApi.createFolder = async (_, {
  path
}) => await fs.mkdir(path);