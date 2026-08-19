// Stands in for the `server-only` package under Vitest.
//
// That package exists to fail the build if a server module is pulled into a
// client bundle. Under the test runner there is no bundle and no client, so the
// guard has nothing to protect and would only stop the module loading at all.
export {};
