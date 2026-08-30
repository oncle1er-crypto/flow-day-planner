# Testing strategy

Unit tests cover recurrence, reminder planning and deduplication, finance calculations and security,
task date logic, and import validation. GitHub Actions runs dependency auditing, typechecking,
linting, unit tests, production builds, connected browser E2E tests, Android builds, and iOS
simulator builds for pull requests. A second workflow validates the deployed `main` commit against
production after every merge.
