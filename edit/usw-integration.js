/* global $ toggleDataset */// dom.js
/* global editor */
'use strict';

/* exported uswIntegration */
const uswIntegration = (() => {
  /** @type chrome.runtime.Port */
  let port;

  return {
    revokeLinking() {
      connectPort();
      port.postMessage({reason: 'revoke', data: editor.style});
    },

    publishStyle() {
      connectPort();
      const sourceCode = editor.getEditors()[0].getValue();
      const data = Object.assign(editor.style, {sourceCode});
      port.postMessage({reason: 'publish', data});
    },

    updateUI(style = editor.style) {
      const usw = style._usw || {};
      toggleDataset($('#publish'), 'connected', usw.token);
      $('#usw-style-name').textContent = usw.name || '';
      $('#usw-style-descr').textContent = usw.description || '';
    },
  };

  function connectPort() {
    if (!port) {
      port = chrome.runtime.connect({name: 'link-style-usw'});
      port.onDisconnect.addListener(err => {
        throw err;
      });
    }
  }
})();
