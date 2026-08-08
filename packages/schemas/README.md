# @localize-infra/schemas

Zod contracts shared between the `localize-infra` CLI, its API and its web
surfaces. Publishing them separately is what lets the open-source CLI and a
self-hosted API agree on request and response shapes without either depending
on the other's internals.

This package is a set of type definitions and validators. It performs no I/O
and calls no network.

```ts
import { OwnerRepoSchema, TranslateRequestSchema } from '@localize-infra/schemas';

OwnerRepoSchema.parse({ owner: 'acme', repo: 'web-app' });
```

Part of the [localize-infra](https://github.com/maxencerousseau38-prog/localize-infra)
monorepo. MIT.
