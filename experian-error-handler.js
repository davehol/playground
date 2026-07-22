/**
 * ExperianErrorHandler
 * -----------------------------------------------------------------------
 * Reusable handler for surfacing Experian verification rejection codes
 * as field-level errors on a FormAssembly (wForms) form.
 *
 * USAGE
 * -----------------------------------------------------------------------
 * new ExperianErrorHandler({
 *   selector: ".errorMessage",           // element that holds the raw Experian response
 *   rules: [
 *     {
 *       // Match when the error text contains ALL of these codes
 *       codes: ["EXPERIAN_REJECTED_EMAIL_AND_MOBILE"],
 *       fields: [
 *         { id: "tfa_475", message: "Please check the mobile you've provided and try again." },
 *         { id: "tfa_3",   message: "Please check the email you've provided and try again." }
 *       ]
 *     },
 *     {
 *       codes: ["EXPERIAN_REJECTED_EMAIL"],
 *       fields: [
 *         { id: "tfa_3", message: "Please check the email you've provided and try again." }
 *       ]
 *     },
 *     {
 *       codes: ["EXPERIAN_REJECTED_MOBILE"],
 *       fields: [
 *         { id: "tfa_475", message: "Please check the mobile you've provided and try again." }
 *       ]
 *     }
 *   ]
 * }).watch();
 *
 * Each form only needs to pass in its own field IDs / messages — the
 * matching, waiting, and wForms plumbing is shared.
 * -----------------------------------------------------------------------
 */
class ExperianErrorHandler {
  /**
   * @param {Object} options
   * @param {string}  options.selector          CSS selector for the raw error element (default: ".errorMessage")
   * @param {Array}   options.rules             Ordered list of { codes: string[], fields: {id, message}[] }
   *                                              First rule whose codes ALL appear in the error text wins.
   * @param {number}  [options.interval=1000]   Polling interval (ms) while waiting for the element
   * @param {number}  [options.timeout=5000]    Max time (ms) to wait before giving up
   * @param {boolean} [options.fallbackReveal=true]
   *                                              If no rule matches, reveal the raw element instead of hiding it
   * @param {Function} [options.onNoMatch]      Optional custom callback(el) run instead of fallbackReveal
   * @param {Function} [options.onTimeout]      Optional custom callback() run if the element never appears
   */
  constructor(options = {}) {
    this.selector = options.selector || ".errorMessage";
    this.rules = options.rules || [];
    this.interval = options.interval || 1000;
    this.timeout = options.timeout || 5000;
    this.fallbackReveal = options.fallbackReveal !== false;
    this.onNoMatch = options.onNoMatch || null;
    this.onTimeout = options.onTimeout || null;
  }

  /** Start watching the DOM for the error element and process it once found. */
  watch() {
    this._waitForElement(this.selector, (el) => this._handleElement(el));
  }

  /** Poll the DOM until `selector` appears, then invoke `callback(el)` once. */
  _waitForElement(selector, callback) {
    const start = Date.now();

    const timer = setInterval(() => {
      const el = document.querySelector(selector);

      if (el) {
        clearInterval(timer);
        callback(el);
        return;
      }

      if (Date.now() - start >= this.timeout) {
        clearInterval(timer);
        console.warn("ExperianErrorHandler: timed out waiting for", selector);
        if (this.onTimeout) this.onTimeout();
      }
    }, this.interval);
  }

  /** Match the element's content against configured rules and act on the result. */
  _handleElement(el) {
    const text = el.innerHTML || "";

    const matchedRule = this.rules.find((rule) =>
      rule.codes.every((code) => text.indexOf(code) > -1)
    );

    if (matchedRule) {
      matchedRule.fields.forEach(({ id, message }) =>
        this._forceFieldError(id, message)
      );
      return;
    }

    // No rule matched
    if (this.onNoMatch) {
      this.onNoMatch(el);
    } else if (this.fallbackReveal) {
      el.style.display = "block";
    }
  }

  /** Force a wForms validation error onto a specific field. */
  _forceFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) {
      console.warn("ExperianErrorHandler: field not found:", fieldId);
      return;
    }

    const form = wFORMS.helpers.getForm(field);
    const validationInstance = wFORMS.getBehaviorInstance(form, "validation");

    if (!validationInstance) {
      console.warn(
        "ExperianErrorHandler: no validation instance found for this form"
      );
      return;
    }

    // Clear any existing error first, then apply the new one
    validationInstance.removeErrorMessage(field);
    validationInstance.fail(field, message);

    validationInstance.elementsInError =
      validationInstance.elementsInError || {};
    validationInstance.elementsInError[fieldId] = {
      id: fieldId,
      rule: "custom",
    };
  }
}

/* -----------------------------------------------------------------------
 * Example instantiation per form — this is the only bit that changes
 * between forms. Drop this block (with form-specific field IDs) into
 * each form's custom JS.
 * ---------------------------------------------------------------------*/
// new ExperianErrorHandler({
//   rules: [
//     {
//       codes: ["EXPERIAN_REJECTED_EMAIL_AND_MOBILE"],
//       fields: [
//         { id: "tfa_475", message: "Please check the mobile you've provided and try again." },
//         { id: "tfa_3",   message: "Please check the email you've provided and try again." },
//       ],
//     },
//     {
//       codes: ["EXPERIAN_REJECTED_EMAIL"],
//       fields: [
//         { id: "tfa_3", message: "Please check the email you've provided and try again." },
//       ],
//     },
//     {
//       codes: ["EXPERIAN_REJECTED_MOBILE"],
//       fields: [
//         { id: "tfa_475", message: "Please check the mobile you've provided and try again." },
//       ],
//     },
//   ],
// }).watch();
