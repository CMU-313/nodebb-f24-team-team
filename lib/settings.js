'use strict';

const meta = require('./meta');
const pubsub = require('./pubsub');
function expandObjBy(obj1, obj2) {
  let changed = false;
  if (!obj1 || !obj2) {
    return changed;
  }
  for (const [key, val2] of Object.entries(obj2)) {
    const val1 = obj1[key];
    const xorIsArray = Array.isArray(val1) !== Array.isArray(val2);
    if (xorIsArray || !obj1.hasOwnProperty(key) || typeof val2 !== typeof val1) {
      obj1[key] = val2;
      changed = true;
    } else if (typeof val2 === 'object' && !Array.isArray(val2)) {
      if (expandObjBy(val1, val2)) {
        changed = true;
      }
    }
  }
  return changed;
}
function trim(obj1, obj2) {
  for (const [key, val1] of Object.entries(obj1)) {
    if (!obj2.hasOwnProperty(key)) {
      delete obj1[key];
    } else if (typeof val1 === 'object' && !Array.isArray(val1)) {
      trim(val1, obj2[key]);
    }
  }
}
function mergeSettings(cfg, defCfg) {
  if (typeof defCfg !== 'object') {
    return;
  }
  if (typeof cfg._ !== 'object') {
    cfg._ = defCfg;
  } else {
    expandObjBy(cfg._, defCfg);
    trim(cfg._, defCfg);
  }
}
function Settings(hash, version, defCfg, callback, forceUpdate, reset) {
  this.hash = hash;
  this.version = version || this.version;
  this.defCfg = defCfg;
  const self = this;
  if (reset) {
    this.reset(callback);
  } else {
    this.sync(function () {
      this.checkStructure(callback, forceUpdate);
    });
  }
  pubsub.on(`action:settings.set.${hash}`, data => {
    try {
      self.cfg._ = JSON.parse(data._);
    } catch (err) {}
  });
}
Settings.prototype.hash = '';
Settings.prototype.defCfg = {};
Settings.prototype.cfg = {};
Settings.prototype.version = '0.0.0';
Settings.prototype.sync = function (callback) {
  const _this = this;
  meta.settings.get(this.hash, (err, settings) => {
    try {
      if (settings._) {
        settings._ = JSON.parse(settings._);
      }
    } catch (_error) {}
    _this.cfg = settings;
    if (typeof _this.cfg._ !== 'object') {
      _this.cfg._ = _this.defCfg;
      _this.persist(callback);
    } else if (expandObjBy(_this.cfg._, _this.defCfg)) {
      _this.persist(callback);
    } else if (typeof callback === 'function') {
      callback.apply(_this, err);
    }
  });
};
Settings.prototype.persist = function (callback) {
  let conf = this.cfg._;
  const _this = this;
  if (typeof conf === 'object') {
    conf = JSON.stringify(conf);
  }
  meta.settings.set(this.hash, this.createWrapper(this.cfg.v, conf), (...args) => {
    if (typeof callback === 'function') {
      callback.apply(_this, args || []);
    }
  });
  return this;
};
Settings.prototype.get = function (key, def) {
  let obj = this.cfg._;
  const parts = (key || '').split('.');
  let part;
  for (let i = 0; i < parts.length; i += 1) {
    part = parts[i];
    if (part && obj != null) {
      obj = obj[part];
    }
  }
  if (obj === undefined) {
    if (def === undefined) {
      def = this.defCfg;
      for (let j = 0; j < parts.length; j += 1) {
        part = parts[j];
        if (part && def != null) {
          def = def[part];
        }
      }
    }
    return def;
  }
  return obj;
};
Settings.prototype.getWrapper = function () {
  return this.cfg;
};
Settings.prototype.createWrapper = function (version, settings) {
  return {
    v: version,
    _: settings
  };
};
Settings.prototype.createDefaultWrapper = function () {
  return this.createWrapper(this.version, this.defCfg);
};
Settings.prototype.set = function (key, val) {
  let part;
  let obj;
  let parts;
  this.cfg.v = this.version;
  if (val == null || !key) {
    this.cfg._ = val || key;
  } else {
    obj = this.cfg._;
    parts = key.split('.');
    for (let i = 0, _len = parts.length - 1; i < _len; i += 1) {
      part = parts[i];
      if (part) {
        if (!obj.hasOwnProperty(part)) {
          obj[part] = {};
        }
        obj = obj[part];
      }
    }
    obj[parts[parts.length - 1]] = val;
  }
  return this;
};
Settings.prototype.reset = function (callback) {
  this.set(this.defCfg).persist(callback);
  return this;
};
Settings.prototype.checkStructure = function (callback, force) {
  if (!force && this.cfg.v === this.version) {
    if (typeof callback === 'function') {
      callback();
    }
  } else {
    mergeSettings(this.cfg, this.defCfg);
    this.cfg.v = this.version;
    this.persist(callback);
  }
  return this;
};
module.exports = Settings;