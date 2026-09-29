// src/lib/describe-error.ts
// Pure. No imports. Safe on server AND client.

export function describeError(err: unknown): string {
  try {
    if (typeof err === 'string') {
      return err;
    }
    if (err === null || err === undefined) {
      return 'Error: (no detail)';
    }

    let name = 'Error';
    let message = '';

    if (typeof err === 'object' || typeof err === 'function') {
      try {
        const potentialName = (err as { name?: unknown }).name;
        if (typeof potentialName === 'string' && potentialName.trim().length > 0) {
          name = potentialName;
        }
      } catch {
        // Ignored, fallback to 'Error'
      }

      try {
        const potentialMsg = (err as { message?: unknown }).message;
        if (typeof potentialMsg === 'string' && potentialMsg.trim().length > 0) {
          message = potentialMsg;
        }
      } catch {
        // Ignored
      }

      if (!message) {
        try {
          const cause = (err as { cause?: unknown }).cause;
          if (cause !== null && cause !== undefined) {
            if (typeof cause === 'object' || typeof cause === 'function') {
              try {
                const causeMsg = (cause as { message?: unknown }).message;
                if (typeof causeMsg === 'string' && causeMsg.trim().length > 0) {
                  message = causeMsg;
                }
              } catch {
                // Ignored
              }
            } else {
              const strCause = String(cause);
              if (strCause.trim().length > 0) {
                message = strCause;
              }
            }
          }
        } catch {
          // Ignored
        }
      }

      if (!message) {
        try {
          const strErr = String(err);
          if (strErr !== '[object Object]' && strErr.trim().length > 0) {
            message = strErr;
          }
        } catch {
          // Ignored
        }
      }

      if (!message) {
        try {
          const json = JSON.stringify(err);
          if (json && json !== '{}') {
            message = json;
          }
        } catch {
          // Ignored
        }
      }
    } else {
      message = String(err);
    }

    if (!message) {
      message = '(no detail)';
    }

    return `${name}: ${message}`;
  } catch {
    return 'Error: (undescribable)';
  }
}
