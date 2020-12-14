'use strict';

define(require => {
  const {
    $,
    $create,
    getEventKeyName,
    messageBoxProxy,
    moveFocus,
  } = require('/js/dom');
  const t = require('/js/localization');
  const prefs = require('/js/prefs');

  let CodeMirror;

  const util = {

    get CodeMirror() {
      return CodeMirror;
    },
    set CodeMirror(val) {
      CodeMirror = val;
    },

    helpPopup: {
      show(title = '', body) {
        const div = $('#help-popup');
        const contents = $('.contents', div);
        div.className = '';
        contents.textContent = '';
        if (body) {
          contents.appendChild(typeof body === 'string' ? t.HTML(body) : body);
        }
        $('.title', div).textContent = title;
        $('.dismiss', div).onclick = util.helpPopup.close;
        window.on('keydown', util.helpPopup.close, true);
        // reset any inline styles
        div.style = 'display: block';
        util.helpPopup.originalFocus = document.activeElement;
        return div;
      },
      close(event) {
        const canClose =
          !event ||
          event.type === 'click' || (
            getEventKeyName(event) === 'Escape' &&
            !$('.CodeMirror-hints, #message-box') && (
              !document.activeElement ||
              !document.activeElement.closest('#search-replace-dialog') &&
              document.activeElement.matches(':not(input), .can-close-on-esc')
            )
          );
        const div = $('#help-popup');
        if (!canClose || !div) {
          return;
        }
        if (event && div.codebox && !div.codebox.options.readOnly && !div.codebox.isClean()) {
          setTimeout(async () => {
            const ok = await messageBoxProxy.confirm(t('confirmDiscardChanges'));
            return ok && util.helpPopup.close();
          });
          return;
        }
        if (div.contains(document.activeElement) && util.helpPopup.originalFocus) {
          util.helpPopup.originalFocus.focus();
        }
        const contents = $('.contents', div);
        div.style.display = '';
        contents.textContent = '';
        window.off('keydown', util.helpPopup.close, true);
        window.dispatchEvent(new Event('closeHelp'));
      },
    },

    clipString(str, limit = 100) {
      return str.length <= limit ? str : str.substr(0, limit) + '...';
    },

    createHotkeyInput(prefId, onDone = () => {}) {
      return $create('input', {
        type: 'search',
        spellcheck: false,
        value: prefs.get(prefId),
        onkeydown(event) {
          const key = CodeMirror.keyName(event);
          if (key === 'Tab' || key === 'Shift-Tab') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          switch (key) {
            case 'Enter':
              if (this.checkValidity()) onDone(true);
              return;
            case 'Esc':
              onDone(false);
              return;
            default:
              // disallow: [Shift?] characters, modifiers-only, [modifiers?] + Esc, Tab, nav keys
              if (!key || new RegExp('^(' + [
                '(Back)?Space',
                '(Shift-)?.', // a single character
                '(Shift-?|Ctrl-?|Alt-?|Cmd-?){0,2}(|Esc|Tab|(Page)?(Up|Down)|Left|Right|Home|End|Insert|Delete)',
              ].join('|') + ')$', 'i').test(key)) {
                this.value = key || this.value;
                this.setCustomValidity('Not allowed');
                return;
              }
          }
          this.value = key;
          this.setCustomValidity('');
          prefs.set(prefId, key);
        },
        oninput() {
          // fired on pressing "x" to clear the field
          prefs.set(prefId, '');
        },
        onpaste(event) {
          event.preventDefault();
        },
      });
    },

    async rerouteHotkeys(...args) {
      require(['./reroute-hotkeys'], res => res(...args));
    },

    showCodeMirrorPopup(title, html, options) {
      const popup = util.helpPopup.show(title, html);
      popup.classList.add('big');

      let cm = popup.codebox = CodeMirror($('.contents', popup), Object.assign({
        mode: 'css',
        lineNumbers: true,
        lineWrapping: prefs.get('editor.lineWrapping'),
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'],
        matchBrackets: true,
        styleActiveLine: true,
        theme: prefs.get('editor.theme'),
        keyMap: prefs.get('editor.keyMap'),
      }, options));
      cm.focus();
      util.rerouteHotkeys(false);

      document.documentElement.style.pointerEvents = 'none';
      popup.style.pointerEvents = 'auto';

      const onKeyDown = event => {
        if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
          const search = $('#search-replace-dialog');
          const area = search && search.contains(document.activeElement) ? search : popup;
          moveFocus(area, event.shiftKey ? -1 : 1);
          event.preventDefault();
        }
      };
      window.on('keydown', onKeyDown, true);

      window.on('closeHelp', () => {
        window.off('keydown', onKeyDown, true);
        document.documentElement.style.removeProperty('pointer-events');
        util.rerouteHotkeys(true);
        cm = popup.codebox = null;
      }, {once: true});

      return popup;
    },

    trimCommentLabel(str, limit = 1000) {
      // stripping /*** foo ***/ to foo
      return util.clipString(str.replace(/^[!-/:;=\s]*|[-#$&(+,./:;<=>\s*]*$/g, ''), limit);
    },
  };

  return util;
});
