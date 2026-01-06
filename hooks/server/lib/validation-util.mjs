// Shared validation sandbox for relay hooks
// Runs custom validation.mjs in a restricted environment

import vm from 'node:vm';

export function runValidationSandbox(validationCode, changes, readFromTreeFn) {
  if (!validationCode) {
    // If no validation.mjs, allow by default
    return { ok: true };
  }

  const api = {
    listStaged: () => changes.map((c) => ({ status: c.status, path: c.path })),
    readFile: (p) => {
      const buf = readFromTreeFn(p);
      if (!buf) return null;
      return buf;
    },
  };

  const contextObj = { api, console: console, Buffer, TextDecoder };
  const context = vm.createContext(contextObj, { name: 'validation-sandbox' });
  const code = `${validationCode.toString()}\n//# sourceURL=validation.mjs`;
  const script = new vm.Script(code, { filename: 'validation.mjs' });

  try {
    const result = script.runInContext(context, { timeout: 2000 });
    let validateFn = context.validate || (result && result.validate);

    if (!validateFn && typeof contextObj.module?.exports?.validate === 'function') {
      validateFn = contextObj.module.exports.validate;
    }
    if (typeof validateFn !== 'function') {
      validateFn = context.default || result?.default;
    }
    if (typeof validateFn !== 'function') {
      const vr = context.validationResult || result?.validationResult;
      if (vr && typeof vr === 'object') return vr;
      return { ok: true };
    }

    const vr = validateFn(api);
    if (vr && typeof vr.then === 'function') {
      throw new Error('validation.mjs returned a Promise; async not supported');
    }
    return vr || { ok: true };
  } catch (e) {
    return { ok: false, message: `validation.mjs error: ${e.message || e}` };
  }
}
