'use strict';

const _ = require('lodash');
const winston = require('winston');
const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const {
  mkdirp
} = require('mkdirp');
const plugins = require('../plugins');
const db = require('../database');
const file = require('../file');
const minifier = require('./minifier');
const utils = require('../utils');
const CSS = module.exports;
CSS.supportedSkins = ['cerulean', 'cosmo', 'cyborg', 'darkly', 'flatly', 'journal', 'litera', 'lumen', 'lux', 'materia', 'minty', 'morph', 'pulse', 'quartz', 'sandstone', 'simplex', 'sketchy', 'slate', 'solar', 'spacelab', 'superhero', 'united', 'vapor', 'yeti', 'zephyr'];
const buildImports = {
  client: function (source, themeData) {
    return [boostrapImport(themeData), '@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";', source, '@import "jquery-ui";', '@import "cropperjs/dist/cropper";'].join('\n');
  },
  admin: function (source) {
    return ['@import "admin/overrides";', '@import "bootstrap/scss/bootstrap";', '@import "mixins";', '@import "fontawesome/loader";', getFontawesomeStyle(), '@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";', '@import "generics";', '@import "responsive-utilities";', '@import "admin/admin";', source, '@import "jquery-ui";'].join('\n');
  }
};
function boostrapImport(themeData) {
  const {
    bootswatchSkin,
    bsVariables,
    isCustomSkin
  } = themeData;
  function bsvariables() {
    if (bootswatchSkin) {
      if (isCustomSkin) {
        return themeData._variables || '';
      }
      return `@import "bootswatch/dist/${bootswatchSkin}/variables";`;
    }
    return bsVariables;
  }
  return [bsvariables(), '@import "bootstrap/scss/mixins/banner";', '@include bsBanner("");', '@import "bootstrap/scss/functions";', '@import "./scss/overrides";', '@import "overrides.scss";', '@import "bootstrap/scss/variables";', '@import "bootstrap/scss/variables-dark";', '@import "bootstrap/scss/maps";', '@import "bootstrap/scss/mixins";', '@import "bootstrap/scss/utilities";', '@import "bootstrap/scss/root";', '@import "bootstrap/scss/reboot";', '@import "bootstrap/scss/type";', '@import "bootstrap/scss/images";', '@import "bootstrap/scss/containers";', '@import "bootstrap/scss/grid";', '@import "bootstrap/scss/tables";', '@import "bootstrap/scss/forms";', '@import "bootstrap/scss/buttons";', '@import "bootstrap/scss/transitions";', '@import "bootstrap/scss/dropdown";', '@import "bootstrap/scss/button-group";', '@import "bootstrap/scss/nav";', '@import "bootstrap/scss/navbar";', '@import "bootstrap/scss/card";', '@import "bootstrap/scss/accordion";', '@import "bootstrap/scss/breadcrumb";', '@import "bootstrap/scss/pagination";', '@import "bootstrap/scss/badge";', '@import "bootstrap/scss/alert";', '@import "bootstrap/scss/progress";', '@import "bootstrap/scss/list-group";', '@import "bootstrap/scss/close";', '@import "bootstrap/scss/toasts";', '@import "bootstrap/scss/modal";', '@import "bootstrap/scss/tooltip";', '@import "bootstrap/scss/popover";', '@import "bootstrap/scss/carousel";', '@import "bootstrap/scss/spinners";', '@import "bootstrap/scss/offcanvas";', '@import "bootstrap/scss/placeholders";', '@import "bootstrap/scss/helpers";', '@import "responsive-utilities";', '@import "bootstrap/scss/utilities/api";', '@import "fontawesome/loader";', getFontawesomeStyle(), '@import "mixins";', '@import "generics";', '@import "client";', '@import "./theme";', bootswatchSkin && !isCustomSkin ? `@import "bootswatch/dist/${bootswatchSkin}/bootswatch";` : ''].join('\n');
}
function getFontawesomeStyle() {
  const styles = utils.getFontawesomeStyles();
  return styles.map(style => `@import "fontawesome/style-${style}";`).join('\n');
}
async function copyFontAwesomeFiles() {
  await mkdirp(path.join(__dirname, '../../build/public/fontawesome/webfonts'));
  const fonts = await fs.promises.opendir(path.join(utils.getFontawesomePath(), '/webfonts'));
  const copyOperations = [];
  for await (const file of fonts) {
    if (file.isFile() && file.name.match(/\.(woff2|ttf|eot)?$/)) {
      copyOperations.push(fs.promises.copyFile(path.join(fonts.path, file.name), path.join(__dirname, '../../build/public/fontawesome/webfonts/', file.name)));
    }
  }
  await Promise.all(copyOperations);
}
async function filterMissingFiles(filepaths) {
  const exists = await Promise.all(filepaths.map(async filepath => {
    const exists = await file.exists(path.join(__dirname, '../../node_modules', filepath));
    if (!exists) {
      winston.warn(`[meta/css] File not found! ${filepath}`);
    }
    return exists;
  }));
  return filepaths.filter((filePath, i) => exists[i]);
}
async function getImports(files, extension) {
  const pluginDirectories = [];
  let source = '';
  function pathToImport(file) {
    if (!file) {
      return '';
    }
    const parsed = path.parse(file);
    const newFile = path.join(parsed.dir, parsed.name);
    return `\n@import "${newFile.replace(/\\/g, '/')}";`;
  }
  files.forEach(styleFile => {
    if (styleFile.endsWith(extension)) {
      source += pathToImport(styleFile);
    } else {
      pluginDirectories.push(styleFile);
    }
  });
  await Promise.all(pluginDirectories.map(async directory => {
    const styleFiles = await file.walk(directory);
    styleFiles.forEach(styleFile => {
      source += pathToImport(styleFile);
    });
  }));
  return source;
}
function getBaseTheme(themeData, themeId) {
  return path.join(nconf.get('themes_path'), themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-harmony');
}
async function getBundleMetadata(target) {
  const paths = [path.join(__dirname, '../../node_modules'), path.join(__dirname, '../../public/scss'), path.join(__dirname, '../../public/fontawesome/scss'), path.join(utils.getFontawesomePath(), 'scss')];
  let skin;
  let isCustomSkin = false;
  if (target.startsWith('client-')) {
    skin = target.split('-').slice(1).join('-');
    const isBootswatchSkin = CSS.supportedSkins.includes(skin);
    isCustomSkin = !isBootswatchSkin && (await CSS.isCustomSkin(skin));
    target = 'client';
    if (!isBootswatchSkin && !isCustomSkin) {
      skin = '';
    }
  }
  let themeData = null;
  if (target === 'client') {
    themeData = await db.getObjectFields('config', ['theme:type', 'theme:id', 'useBSVariables', 'bsVariables']);
    const themeId = themeData['theme:id'] || 'nodebb-theme-harmony';
    const baseThemePath = getBaseTheme(themeData, themeId);
    paths.unshift(baseThemePath);
    paths.unshift(`${baseThemePath}/node_modules`);
    themeData.bsVariables = parseInt(themeData.useBSVariables, 10) === 1 ? themeData.bsVariables || '' : '';
    themeData.bootswatchSkin = skin;
    themeData.isCustomSkin = isCustomSkin;
    const customSkin = isCustomSkin ? await CSS.getCustomSkin(skin) : null;
    themeData._variables = customSkin && customSkin._variables;
  }
  const [scssImports, cssImports, acpScssImports] = await Promise.all([filterGetImports(plugins.scssFiles, '.scss'), filterGetImports(plugins.cssFiles, '.css'), target === 'client' ? '' : filterGetImports(plugins.acpScssFiles, '.scss')]);
  async function filterGetImports(files, extension) {
    const filteredFiles = await filterMissingFiles(files);
    return await getImports(filteredFiles, extension);
  }
  let imports = `${cssImports}\n${scssImports}\n${acpScssImports}`;
  imports = buildImports[target](imports, themeData);
  return {
    paths: paths,
    imports: imports
  };
}
CSS.getSkinSwitcherOptions = async function (uid) {
  const user = require('../user');
  const meta = require('./index');
  const [userSettings, customSkins] = await Promise.all([user.getSettings(uid), CSS.getCustomSkins()]);
  const foundCustom = customSkins.find(skin => skin.value === meta.config.bootswatchSkin);
  const defaultSkin = foundCustom ? foundCustom.name : _.capitalize(meta.config.bootswatchSkin) || '[[user:no-skin]]';
  const defaultSkins = [{
    name: `[[user:default, ${defaultSkin}]]`,
    value: '',
    selected: userSettings.bootswatchSkin === ''
  }, {
    name: '[[user:no-skin]]',
    value: 'noskin',
    selected: userSettings.bootswatchSkin === 'noskin'
  }];
  const lightSkins = ['cerulean', 'cosmo', 'flatly', 'journal', 'litera', 'lumen', 'lux', 'materia', 'minty', 'morph', 'pulse', 'sandstone', 'simplex', 'sketchy', 'spacelab', 'united', 'yeti', 'zephyr'];
  const darkSkins = ['cyborg', 'darkly', 'quartz', 'slate', 'solar', 'superhero', 'vapor'];
  function parseSkins(skins) {
    skins = skins.map(skin => ({
      name: _.capitalize(skin),
      value: skin
    }));
    skins.forEach(skin => {
      skin.selected = skin.value === userSettings.bootswatchSkin;
    });
    return skins;
  }
  return await plugins.hooks.fire('filter:meta.css.getSkinSwitcherOptions', {
    default: defaultSkins,
    custom: customSkins.map(s => ({
      ...s,
      selected: s.value === userSettings.bootswatchSkin
    })),
    light: parseSkins(lightSkins),
    dark: parseSkins(darkSkins)
  });
};
CSS.getCustomSkins = async function (opts = {}) {
  const meta = require('./index');
  const slugify = require('../slugify');
  const {
    loadVariables
  } = opts;
  const customSkins = await meta.settings.get('custom-skins');
  const returnSkins = [];
  if (customSkins && Array.isArray(customSkins['custom-skin-list'])) {
    customSkins['custom-skin-list'].forEach(customSkin => {
      if (customSkin) {
        returnSkins.push({
          name: customSkin['custom-skin-name'],
          value: slugify(customSkin['custom-skin-name']),
          _variables: loadVariables ? customSkin._variables : undefined
        });
      }
    });
  }
  return returnSkins;
};
CSS.isSkinValid = async function (skin) {
  return CSS.supportedSkins.includes(skin) || (await CSS.isCustomSkin(skin));
};
CSS.isCustomSkin = async function (skin) {
  const skins = await CSS.getCustomSkins();
  return !!skins.find(s => s.value === skin);
};
CSS.getCustomSkin = async function (skin) {
  const skins = await CSS.getCustomSkins({
    loadVariables: true
  });
  return skins.find(s => s.value === skin);
};
CSS.buildBundle = async function (target, fork) {
  if (target === 'client') {
    let files = await fs.promises.readdir(path.join(__dirname, '../../build/public'));
    files = files.filter(f => f.match(/^client.*\.css$/));
    await Promise.all(files.map(f => fs.promises.unlink(path.join(__dirname, '../../build/public', f))));
  }
  const data = await getBundleMetadata(target);
  const minify = process.env.NODE_ENV !== 'development';
  const {
    ltr,
    rtl
  } = await minifier.css.bundle(data.imports, data.paths, minify, fork);
  await Promise.all([fs.promises.writeFile(path.join(__dirname, '../../build/public', `${target}.css`), ltr.code), fs.promises.writeFile(path.join(__dirname, '../../build/public', `${target}-rtl.css`), rtl.code), copyFontAwesomeFiles()]);
  return [ltr.code, rtl.code];
};