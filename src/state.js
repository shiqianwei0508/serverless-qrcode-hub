// Shared runtime state for the Worker.
//
// Cloudflare Workers populate the env bindings (DB, KV_BINDING) at request time,
// so they cannot be module-level constants. Instead we expose them as `let`
// live bindings: after initState(env) runs inside fetch()/scheduled(), every
// module that imports { DB } / { KV_BINDING } sees the assigned value. This is
// the ES module live-binding guarantee and lets us avoid threading `env` through
// every data-layer call.

export let DB;
export let KV_BINDING;

export function initState(env) {
  DB = env.DB;
  KV_BINDING = env.KV_BINDING;
}
