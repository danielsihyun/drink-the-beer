# Native authenticated integration testing

`LiveIntegrationTests` verifies that one authenticated native session can read
the V2 contracts without changing data. It covers feed/cursor pagination,
progression, achievements, discovery, collections, people search, suggestions,
profile posts, friends, notifications, and duels.

It deliberately does **not** call uploads, finalization, delete, cheers,
friendship commands, profile edits, or duel commands. Those require disposable
fixtures and cleanup; never run them against shared production data.

Create a dedicated non-production integration account and supply its short-lived
access token. Never commit a token or put it in an Xcode project.

```sh
DRINKR_INTEGRATION_API_URL='https://your-app.example' \\
DRINKR_INTEGRATION_ACCESS_TOKEN='eyJ...' \\
swift test --package-path native/Drinkr --filter LiveIntegrationTests
```

The API URL must use HTTPS. In GitHub Actions, configure the same values as
repository secrets `DRINKR_INTEGRATION_API_URL` and
`DRINKR_INTEGRATION_ACCESS_TOKEN`; the scheduled/manual workflow runs only when
both are present. Rotate the token before it expires.
