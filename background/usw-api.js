/* global URLS */ // toolbox.js
'use strict';

/* exported uswApi */
const uswApi = {

  async fetchStyleInfo(token) {
    return (await (await fetch(`${URLS.usw}api/style`, {
      method: 'GET',
      headers: new Headers({
        'Authorization': `Bearer ${token}`,
      }),
      credentials: 'omit',
    })).json()).data;
  },

  async uploadStyle(style) {
    return (await (await fetch(`${URLS.usw}api/style/${style._usw.id}`, {
      method: 'POST',
      headers: new Headers({
        'Authorization': `Bearer ${style._usw.token}`,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        code: style.sourceCode,
      }),
      credentials: 'omit',
    })).json()).data;
  },

};
