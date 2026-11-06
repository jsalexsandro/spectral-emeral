/**
 * Runtime confiável injetado dentro do iframe sandbox, antes do script gerado
 * pelo modelo. É a única ponte permitida entre o widget e a aplicação.
 *
 * Regras:
 * - nunca usa eval;
 * - só envia mensagens de ação/abertura em resposta a interação do usuário;
 * - não expõe nada além do objeto `spectral`.
 */
export const WIDGET_RUNTIME_SCRIPT = String.raw`
(function () {
  "use strict";

  var config = window.__SPECTRAL_WIDGET__ || {};
  var protocol = config.protocol;
  var nonce = config.nonce;
  var MAX_ACTIONS = 40;
  var actionCount = 0;
  var isReady = false;
  var theme = config.theme === "dark" ? "dark" : "light";
  var themeListeners = [];
  var readyListeners = [];

  function post(message) {
    message.protocol = protocol;
    message.nonce = nonce;
    try {
      window.parent.postMessage(message, "*");
    } catch (error) {
      void error;
    }
  }

  function userInitiated() {
    try {
      var activation = window.navigator.userActivation;
      return Boolean(activation && activation.isActive);
    } catch (error) {
      return false;
    }
  }

  function sendAction(action) {
    if (!action || typeof action !== "object") {
      return false;
    }

    if (actionCount >= MAX_ACTIONS) {
      return false;
    }

    actionCount += 1;
    post({
      type: "widget:action",
      requestId: "req-" + actionCount + "-" + String(Date.now()),
      action: action,
      userInitiated: userInitiated()
    });

    return true;
  }

  function openUrl(url) {
    if (typeof url !== "string" || url.length > 2048) {
      return false;
    }

    post({ type: "widget:open", url: url, userInitiated: userInitiated() });
    return true;
  }

  function applyTheme(next) {
    theme = next === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;

    for (var index = 0; index < themeListeners.length; index += 1) {
      try {
        themeListeners[index](theme);
      } catch (error) {
        void error;
      }
    }
  }

  function reportHeight() {
    var body = document.body;
    var height = Math.ceil(
      Math.max(
        document.documentElement.scrollHeight,
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0
      )
    );

    post({ type: "widget:resize", height: height });
  }

  var heightScheduled = false;

  function scheduleHeight() {
    if (heightScheduled) {
      return;
    }

    heightScheduled = true;

    var run = function () {
      heightScheduled = false;
      reportHeight();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 16);
    }
  }

  document.addEventListener(
    "click",
    function (event) {
      var node = event.target;

      while (node && node !== document) {
        if (node.getAttribute) {
          var rawAction = node.getAttribute("data-spectral-action");

          if (rawAction) {
            event.preventDefault();

            try {
              sendAction(JSON.parse(rawAction));
            } catch (error) {
              void error;
            }

            return;
          }

          if (
            node.tagName === "A" &&
            node.getAttribute("href") &&
            !node.hasAttribute("data-spectral-action")
          ) {
            event.preventDefault();
            openUrl(node.getAttribute("href"));
            return;
          }
        }

        node = node.parentNode;
      }
    },
    true
  );

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) {
      return;
    }

    var data = event.data;

    if (!data || data.protocol !== protocol || data.nonce !== nonce) {
      return;
    }

    if (data.type === "widget:theme" || data.type === "widget:context") {
      applyTheme(data.theme);
    }
  });

  function markReady() {
    if (isReady) {
      return;
    }

    isReady = true;

    for (var index = 0; index < readyListeners.length; index += 1) {
      try {
        readyListeners[index]();
      } catch (error) {
        void error;
      }
    }

    post({ type: "widget:ready" });
  }

  var api = {
    protocol: protocol,
    action: sendAction,
    open: openUrl,
    onThemeChange: function (listener) {
      if (typeof listener === "function") {
        themeListeners.push(listener);
        listener(theme);
      }

      return function () {
        var index = themeListeners.indexOf(listener);

        if (index >= 0) {
          themeListeners.splice(index, 1);
        }
      };
    },
    onReady: function (listener) {
      if (typeof listener !== "function") {
        return;
      }

      readyListeners.push(listener);

      if (isReady) {
        try {
          listener();
        } catch (error) {
          void error;
        }
      }
    }
  };

  Object.defineProperty(api, "theme", {
    get: function () {
      return theme;
    },
    enumerable: true
  });

  Object.defineProperty(window, "spectral", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true
  });

  window.addEventListener("load", scheduleHeight);
  window.addEventListener("resize", scheduleHeight);

  if (typeof ResizeObserver === "function") {
    var observer = new ResizeObserver(scheduleHeight);
    observer.observe(document.documentElement);

    if (document.body) {
      observer.observe(document.body);
    }
  }

  applyTheme(theme);
  scheduleHeight();
  window.setTimeout(markReady, 0);
})();
`
