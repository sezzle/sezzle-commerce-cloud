# Sezzle Salesforce Commerce Cloud Cartridge

## Testing
### Running unit tests

To run unit tests you can use the following command:

```
bun run test
```

### Running integration tests
Integration tests are located in the `storefront-reference-architecture/test/integration` directory.

To run integration tests you can use the following command:

```
bun run test:integration -- --baseUrl https://devxx-sitegenesis-dw.demandware.net/on/demandware.store/Sites-RefArch-Site/en_US
```

Obviously you have to replace "devxx-sitegenesis-dw.demandware.net" with your base url.

## Dependency overrides
`package.json` `overrides` force patched versions of transitive dev dependencies whose parents have not released a fix (MERCHANT-4895). Remove an entry once every consumer's declared range allows a patched version.

| Package | Forced | Vulnerable version on `production` | Advisory | Consumers now outside their declared range |
|---|---|---|---|---|
| diff | >=8.0.3 | 3.5.0, 5.0.0 | [GHSA-73rr-hh4g-fpgx](https://github.com/advisories/GHSA-73rr-hh4g-fpgx) | mocha (wants ^7) |
| merge | ^2.1.1 | 1.2.1 | [GHSA-7wpw-2hjm-89gp](https://github.com/advisories/GHSA-7wpw-2hjm-89gp) | exec-sh (wants ^1.2) |
| serialize-javascript | ^7.0.5 | 4.0.0, 6.0.0 | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v), [GHSA-76p7-773f-r4q5](https://github.com/advisories/GHSA-76p7-773f-r4q5) | mocha (wants ^6) |
| uuid | ^11.1.1 | 3.4.0 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | istanbul-lib-processinfo, node-notifier (want ^8) |
