# Sezzle Salesforce Commerce Cloud Cartridge

## Testing
### Running unit tests

To run unit tests you can use the following command:

```
npm run test
```

### Running integration tests
Integration tests are located in the `storefront-reference-architecture/test/integration` directory.

To run integration tests you can use the following command:

```
npm run test:integration -- --baseUrl https://devxx-sitegenesis-dw.demandware.net/on/demandware.store/Sites-RefArch-Site/en_US
```

Obviously you have to replace "devxx-sitegenesis-dw.demandware.net" with your base url.
