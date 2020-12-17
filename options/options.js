'use strict';

define(require => {
  const {API, msg} = require('/js/msg');
  const {
    CHROME,
    CHROME_HAS_BORDER_BUG,
    OPERA,
    FIREFOX,
    URLS,
    capitalize,
    ignoreChromeError,
    openURL,
  } = require('/js/toolbox');
  const t = require('/js/localization');
  const {
    $,
    $$,
    $create,
    $createLink,
    getEventKeyName,
    messageBoxProxy,
    setupLivePrefs,
  } = require('/js/dom');
  const prefs = require('/js/prefs');

  setupLivePrefs();
  setupRadioButtons();
  $$('input[min], input[max]').forEach(enforceInputRange);
  setTimeout(splitLongTooltips);

  if (CHROME_HAS_BORDER_BUG) {
    const borderOption = $('.chrome-no-popup-border');
    if (borderOption) {
      borderOption.classList.remove('chrome-no-popup-border');
    }
  }

  // collapse #advanced block in Chrome pre-66 (classic chrome://extensions UI)
  if (!FIREFOX && !OPERA && CHROME < 66) {
    const block = $('#advanced');
    $('h1', block).onclick = event => {
      event.preventDefault();
      block.classList.toggle('collapsed');
      const isCollapsed = block.classList.contains('collapsed');
      const visibleToggle = $(isCollapsed ? '.is-collapsed' : '.is-expanded', block);
      visibleToggle.focus();
    };
    block.classList.add('collapsible', 'collapsed');
  }

  if (FIREFOX && 'update' in (chrome.commands || {})) {
    $('[data-cmd="open-keyboard"]').classList.remove('chromium-only');
  }

  // actions
  $('#options-close-icon').onclick = () => {
    top.dispatchEvent(new CustomEvent('closeOptions'));
  };

  document.onclick = async e => {
    const target = e.target.closest('[data-cmd]');
    if (!target) {
      return;
    }
    // prevent double-triggering in case a sub-element was clicked
    e.stopPropagation();

    switch (target.dataset.cmd) {
      case 'open-manage':
        API.openManage();
        break;

      case 'check-updates':
        checkUpdates();
        break;

      case 'open-keyboard':
        if (FIREFOX) {
          customizeHotkeys();
        } else {
          openURL({url: URLS.configureCommands});
        }
        e.preventDefault();
        break;

      case 'reset':
        $$('input')
          .filter(input => input.id in prefs.defaults)
          .forEach(input => prefs.reset(input.id));
        break;

      case 'note': {
        e.preventDefault();
        messageBoxProxy.show({
          className: 'note',
          contents: target.dataset.title,
          buttons: [t('confirmClose')],
        });
      }
    }
  };

  // sync to cloud
  (() => {
    const elCloud = $('.sync-options .cloud-name');
    const elStart = $('.sync-options .connect');
    const elStop = $('.sync-options .disconnect');
    const elSyncNow = $('.sync-options .sync-now');
    const elStatus = $('.sync-options .sync-status');
    const elLogin = $('.sync-options .sync-login');
    /** @type {Sync.Status} */
    let status = {};
    msg.onExtension(e => {
      if (e.method === 'syncStatusUpdate') {
        setStatus(e.status);
      }
    });
    API.sync.getStatus()
      .then(setStatus);

    elCloud.on('change', updateButtons);
    for (const [btn, fn] of [
      [elStart, () => API.sync.start(elCloud.value)],
      [elStop, API.sync.stop],
      [elSyncNow, API.sync.syncNow],
      [elLogin, API.sync.login],
    ]) {
      btn.on('click', e => {
        if (getEventKeyName(e) === 'L') {
          fn();
        }
      });
    }

    function setStatus(newStatus) {
      status = newStatus;
      updateButtons();
    }

    function updateButtons() {
      const {state, STATES} = status;
      const isConnected = state === STATES.connected;
      const isDisconnected = state === STATES.disconnected;
      if (status.currentDriveName) {
        elCloud.value = status.currentDriveName;
      }
      for (const [el, enable] of [
        [elCloud, isDisconnected],
        [elStart, isDisconnected && elCloud.value !== 'none'],
        [elStop, isConnected && !status.syncing],
        [elSyncNow, isConnected && !status.syncing],
      ]) {
        el.disabled = !enable;
      }
      elStatus.textContent = getStatusText();
      elLogin.hidden = !isConnected || status.login;
    }

    function getStatusText() {
      let res;
      if (status.syncing) {
        const {phase, loaded, total} = status.progress || {};
        res = phase
          ? t(`optionsSyncStatus${capitalize(phase)}`, [loaded + 1, total], false) ||
            `${phase} ${loaded} / ${total}`
          : t('optionsSyncStatusSyncing');
      } else {
        const {state, errorMessage, STATES} = status;
        res = (state === STATES.connected || state === STATES.disconnected) && errorMessage ||
          t(`optionsSyncStatus${capitalize(state)}`, null, false) || state;
      }
      return res;
    }
  })();

  function checkUpdates() {
    let total = 0;
    let checked = 0;
    let updated = 0;
    const maxWidth = $('#update-progress').parentElement.clientWidth;

    chrome.runtime.onConnect.addListener(function onConnect(port) {
      if (port.name !== 'updater') return;
      port.onMessage.addListener(observer);
      chrome.runtime.onConnect.removeListener(onConnect);
    });

    API.updater.checkAllStyles({observe: true});

    function observer(info) {
      if ('count' in info) {
        total = info.count;
        document.body.classList.add('update-in-progress');
      } else if (info.updated) {
        updated++;
        checked++;
      } else if (info.error) {
        checked++;
      } else if (info.done) {
        document.body.classList.remove('update-in-progress');
      }
      $('#update-progress').style.width = Math.round(checked / total * maxWidth) + 'px';
      $('#updates-installed').dataset.value = updated || '';
    }
  }

  async function customizeHotkeys() {
    // command name -> i18n id
    const hotkeys = new Map([
      ['_execute_browser_action', 'optionsCustomizePopup'],
      ['openManage', 'openManage'],
      ['styleDisableAll', 'disableAllStyles'],
    ]);

    messageBoxProxy.show({
      title: t('shortcutsNote'),
      contents: [
        $create('table',
          [...hotkeys.entries()].map(([cmd, i18n]) =>
            $create('tr', [
              $create('td', t(i18n)),
              $create('td',
                $create('input', {
                  id: 'hotkey.' + cmd,
                  type: 'search',
                  //placeholder: t('helpKeyMapHotkey'),
                })),
            ]))),
      ],
      className: 'center',
      buttons: [t('confirmClose')],
      onshow(box) {
        const ids = [];
        for (const cmd of hotkeys.keys()) {
          const id = 'hotkey.' + cmd;
          ids.push(id);
          $('#' + id).oninput = onInput;
        }
        setupLivePrefs(ids);
        $('button', box).insertAdjacentElement('beforebegin',
          $createLink(
            'https://developer.mozilla.org/Add-ons/WebExtensions/manifest.json/commands#Key_combinations',
            t('helpAlt')));
      },
    });

    function onInput() {
      const name = this.id.split('.')[1];
      const shortcut = this.value.trim();
      if (!shortcut) {
        browser.commands.reset(name).catch(ignoreChromeError);
        this.setCustomValidity('');
        return;
      }
      try {
        browser.commands.update({name, shortcut}).then(
          () => this.setCustomValidity(''),
          err => this.setCustomValidity(err)
        );
      } catch (err) {
        this.setCustomValidity(err);
      }
    }
  }

  function enforceInputRange(element) {
    const min = Number(element.min);
    const max = Number(element.max);
    const doNotify = () => element.dispatchEvent(new Event('change', {bubbles: true}));
    const onChange = ({type}) => {
      if (type === 'input' && element.checkValidity()) {
        doNotify();
      } else if (type === 'change' && !element.checkValidity()) {
        element.value = Math.max(min, Math.min(max, Number(element.value)));
        doNotify();
      }
    };
    element.on('change', onChange);
    element.on('input', onChange);
  }

  function splitLongTooltips() {
    for (const el of $$('[title]')) {
      el.dataset.title = el.title;
      el.title = el.title.replace(/<\/?\w+>/g, ''); // strip html tags
      if (el.title.length < 50) {
        continue;
      }
      const newTitle = el.title
        .split('\n')
        .map(s => s.replace(/([^.][.。?!]|.{50,60},)\s+/g, '$1\n'))
        .map(s => s.replace(/(.{50,80}(?=.{40,}))\s+/g, '$1\n'))
        .join('\n');
      if (newTitle !== el.title) el.title = newTitle;
    }
  }

  function setupRadioButtons() {
    const sets = {};
    const onChange = function () {
      const newValue = sets[this.name].indexOf(this);
      if (newValue >= 0 && prefs.get(this.name) !== newValue) {
        prefs.set(this.name, newValue);
      }
    };
    // group all radio-inputs by name="prefName" attribute
    for (const el of $$('input[type="radio"][name]')) {
      (sets[el.name] = sets[el.name] || []).push(el);
      el.on('change', onChange);
    }
    // select the input corresponding to the actual pref value
    for (const name in sets) {
      sets[name][prefs.get(name)].checked = true;
    }
    // listen to pref changes and update the values
    prefs.subscribe(Object.keys(sets), (key, value) => {
      sets[key][value].checked = true;
    });
  }

  window.onkeydown = e => {
    if (getEventKeyName(e) === 'Escape') {
      top.dispatchEvent(new CustomEvent('closeOptions'));
    }
  };
});
