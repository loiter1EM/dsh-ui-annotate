/**
 * Host half of dsh-ui-annotate.
 *
 * Everything the plugin does happens in the browser (see ./client.js); this file
 * exists only so the package is a well-formed DSH bundle entry. Keeping the host
 * half empty means zero extra work on the Node side and zero risk to the agent.
 */

export const name = 'dsh-ui-annotate'

export const inject = []

export function apply() {
  // no host-side behaviour
}
