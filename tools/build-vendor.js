/* eslint-env node */
'use strict';
const path = require('path');

const endent = require('endent');
const fetch = require('make-fetch-happen');
const fse = require('fs-extra');
const glob = require('tiny-glob');

const files = {
  'codemirror': [
    'addon/comment/comment.js',
    'addon/dialog',
    'addon/edit/closebrackets.js',
    'addon/edit/matchbrackets.js',
    'addon/fold/brace-fold.js',
    'addon/fold/comment-fold.js',
    'addon/fold/foldcode.js',
    'addon/fold/foldgutter.*',
    'addon/fold/indent-fold.js',
    'addon/hint/css-hint.js',
    'addon/hint/show-hint.*',
    'addon/lint/css-lint.js',
    'addon/lint/json-lint.js',
    'addon/lint/lint.*',
    'addon/scroll/annotatescrollbar.js',
    'addon/search/matchesonscrollbar.*',
    'addon/search/searchcursor.js',
    'addon/selection/active-line.js',
    'theme'
  ],
  'jsonlint': [
    'lib/jsonlint.js → jsonlint.js'
  ],
  'less-bundle': [
    'dist/less.min.js → less.min.js'
  ],
  'lz-string-unsafe': [
    'lz-string-unsafe.min.js'
  ],
  'semver-bundle': [
    'dist/semver.js → semver.js'
  ],
  'stylelint-bundle': [
    'stylelint-bundle.min.js'
  ],
  'stylus-lang-bundle': [
    'stylus.min.js'
  ],
  'usercss-meta': [
    'dist/usercss-meta.min.js → usercss-meta.min.js'
  ],
  'db-to-cloud': [
    'dist/db-to-cloud.min.js → db-to-cloud.min.js'
  ],
  'uuid': [
    'https://bundle.run/uuid@{VERSION}/v4.js → uuid.min.js'
  ]
};

main().catch(console.error);

async function main() {
  for (const pkg in files) {
    console.log('\x1b[32m%s\x1b[0m', `Building ${pkg}...`);
    // other files
    const [fetched, copied] = await buildFiles(pkg, files[pkg]);
    // README
    await fse.outputFile(`vendor/${pkg}/README.md`, generateReadme(pkg, fetched, copied));
    // LICENSE
    await fse.copy(`node_modules/${pkg}/LICENSE`, `vendor/${pkg}/LICENSE`);
  }
  console.log('\x1b[32m%s\x1b[0m', 'updating codemirror themes list...');
  await fse.outputFile('edit/codemirror-themes.js', await generateThemeList());
}

async function generateThemeList() {
  const themes = (await fse.readdir('vendor/codemirror/theme'))
    .filter(name => name.endsWith('.css'))
    .map(name => name.replace('.css', ''))
    .sort();
  return endent`
    /* exported CODEMIRROR_THEMES */
    // this file is generated by update-codemirror-themes.js
    'use strict';

    const CODEMIRROR_THEMES = ${JSON.stringify(themes, null, 2)};
  `.replace(/"/g, "'") + '\n';
}

async function buildFiles(pkg, patterns) {
  const fetchedFiles = [];
  const copiedFiles = [];
  for (let pattern of patterns) {
    pattern = pattern.replace('{VERSION}', require(`${pkg}/package.json`).version);
    const [src, dest] = pattern.split(/\s*→\s*/);
    if (src.startsWith('http')) {
      const content = await (await fetch(src)).text();
      fse.outputFile(`vendor/${pkg}/${dest}`, content);
      fetchedFiles.push([src, dest]);
    } else {
      for (const file of glob(`node_modules/${pkg}/${src}`)) {
        if (!dest) {
          await fse.copy(file, path.join('vendor', path.relative('node_modules', file)));
        } else {
          await fse.copy(file, dest);
        }
        copiedFiles.push([path.relative(`node_modules/${pkg}`, file), dest]);
      }
    }
  }
  return [fetchedFiles, copiedFiles];
}

function generateReadme(lib, fetched, copied) {
  const pkg = require(`${lib}/package.json`);
  let txt = `## ${pkg.name} v${pkg.version}\n\n`;
  if (fetched.length) {
    txt += `Following files are downloaded from HTTP:\n\n${generateList(fetched)}\n\n`;
  }
  if (copied.length) {
    txt += `Following files are copied from npm (node_modules):\n\n${generateList(copied)}\n`;
  }
  return txt;
}

function generateList(list) {
  return list.map(([src, dest]) => {
    if (dest) {
      return `* ${dest}: ${src}`;
    }
    return `* ${src}`;
  }).join('\n');
}

// Rename CodeMirror$1 -> CodeMirror for development purposes
// FIXME: is this a workaround for old version of codemirror?
// function renameCodeMirrorVariable(filePath) {
  // const file = fs.readFileSync(filePath, 'utf8');
  // fs.writeFileSync(filePath, file.replace(/CodeMirror\$1/g, 'CodeMirror'));
// }
