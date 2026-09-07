# [0.10.0-beta.3](https://github.com/mi-examples/cs-helper/compare/v0.10.0-beta.2...v0.10.0-beta.3) (2026-09-07)


### Bug Fixes

* **sanity-check:** check script-timeout-param across all parseParams calls ([926366b](https://github.com/mi-examples/cs-helper/commit/926366b603c961e1032242468e8221c68af23615))


### Features

* **sanity-check:** add rule suppression via comments and config ([4559b88](https://github.com/mi-examples/cs-helper/commit/4559b8866cedf7a21b27c99cab62fab641ed2485))

# [0.10.0-beta.2](https://github.com/mi-examples/cs-helper/compare/v0.10.0-beta.1...v0.10.0-beta.2) (2026-09-05)


### Bug Fixes

* **sanity-check:** fix two false-positive-prone rules found on real scripts ([3969b07](https://github.com/mi-examples/cs-helper/commit/3969b073e8ebbd4f5a087bfcd8001def59b3ce0b))

# [0.10.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.9.1-beta.1...v0.10.0-beta.1) (2026-09-04)


### Bug Fixes

* **deps:** resolve npm audit vulnerabilities ([6c0380a](https://github.com/mi-examples/cs-helper/commit/6c0380ac69db22996c3858938e271b3aedfb0060))
* **sanity-check:** downgrade script-timeout-param to info, not required ([3741b21](https://github.com/mi-examples/cs-helper/commit/3741b21f35e4aed8a8909d8b4b42b7031982a90e))


### Features

* **params:** add Password/ScriptTimeout marker types + suggestedTimeoutMinutes ([a6310fa](https://github.com/mi-examples/cs-helper/commit/a6310fa2f6735ec834d3cccce3a7158446aea27c))
* **sanity-check:** add 8 more rules (token, heartbeat, node-api, password, jquery, eval) ([35dd228](https://github.com/mi-examples/cs-helper/commit/35dd228be905192f2d663ceeaf4258a3edbcad13))
* **sanity-check:** add sanity-check function for custom scripts ([e3baf03](https://github.com/mi-examples/cs-helper/commit/e3baf0372426dd07a832093323c1b95f3200685f))

## [0.9.1-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.9.0...v0.9.1-beta.1) (2026-08-12)


### Bug Fixes

* **deps:** patch undici vulnerability ([efc88bf](https://github.com/mi-examples/cs-helper/commit/efc88bf76f27b8f81e94fd26ba9a782f20b5140c))

# [0.9.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.8.2...v0.9.0-beta.1) (2026-08-03)


### Bug Fixes

* **deps:** patch brace-expansion/tar/js-yaml/fast-uri vulnerabilities ([637a854](https://github.com/mi-examples/cs-helper/commit/637a854fd3ac6735a5caa1877a4584c524c2fa2e))


### Features

* **create:** track ai-addon freshness and add --update-ai to refresh them ([eff5265](https://github.com/mi-examples/cs-helper/commit/eff52654fef8e36560e92eb26ea3d1c64c696792))
* **types:** add window.req and window.user (CustomScriptRequestUser) globals ([8b1e341](https://github.com/mi-examples/cs-helper/commit/8b1e34118daecca0b9f6ee070b56c6f272c069de))

## [0.8.1-beta.2](https://github.com/mi-examples/cs-helper/compare/v0.8.1-beta.1...v0.8.1-beta.2) (2026-07-14)


### Bug Fixes

* **deps:** patch sigstore/tar/js-yaml/undici/[@babel-core](https://github.com/babel-core) vulnerabilities ([361c927](https://github.com/mi-examples/cs-helper/commit/361c927590490ad7b2f6ffd80647f643ded85b42))

## [0.8.1-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.8.0...v0.8.1-beta.1) (2026-05-26)


### Bug Fixes

* **params:** show optional number params as number in docs ([c0b8632](https://github.com/mi-examples/cs-helper/commit/c0b863207b053e8b5e3cdc1e38f89b21dfc8dd52))
* **parseParams:** allow optional properties in generic constraint ([2580cdc](https://github.com/mi-examples/cs-helper/commit/2580cdc857d88153e215ff0cd8897050acee7c62))

# [0.8.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.7.2...v0.8.0-beta.1) (2026-05-26)


### Bug Fixes

* **build:** chmod cli bins for unix npm exec ([89e4209](https://github.com/mi-examples/cs-helper/commit/89e420952e520fd61c39e7bf37f106dd0d814289))


### Features

* **templates:** add scriptTimeout and scheduleClose scaffolds ([44175fc](https://github.com/mi-examples/cs-helper/commit/44175fc1f7ab2daba8eb53501ac2725b47f431b2))
* **types:** add heartBeat, isClosed, and updateHeartBeat ([307a2e1](https://github.com/mi-examples/cs-helper/commit/307a2e148f0763ad43f92b289cf4ab0465dee7d5))

# [0.7.0-beta.3](https://github.com/mi-examples/cs-helper/compare/v0.7.0-beta.2...v0.7.0-beta.3) (2026-04-14)


### Bug Fixes

* **log:** use performance.now when enabling performance mode ([41c9bb0](https://github.com/mi-examples/cs-helper/commit/41c9bb0cce7b2ed70831c88057629e09b6858ed1))

# [0.7.0-beta.2](https://github.com/mi-examples/cs-helper/compare/v0.7.0-beta.1...v0.7.0-beta.2) (2026-04-14)


### Bug Fixes

* **log:** rename setLogPerformance param to avoid shadowing performance ([8e63342](https://github.com/mi-examples/cs-helper/commit/8e6334288c7c68fa94af0cf2970e62f1ab350dc0))
* **test:** install scaffold from local cs-helper pack tarball ([3007b9d](https://github.com/mi-examples/cs-helper/commit/3007b9d1f97d6a1b7082b3a497097e8a87043095))

# [0.7.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.6.4...v0.7.0-beta.1) (2026-04-14)


### Features

* **api:** expand CustomScript type and logging utilities ([6b68353](https://github.com/mi-examples/cs-helper/commit/6b683530f5963d49b0d402472f026cc14ae9a044))
* **create:** optional ai-addons copy and --ai flag ([abc0290](https://github.com/mi-examples/cs-helper/commit/abc029001364242bda80d50b34dd16ab53a3af7c))

## [0.6.4-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.6.3...v0.6.4-beta.1) (2026-04-03)


### Bug Fixes

* **deps:** resolve npm audit and bump ts-loader ([39a0a8e](https://github.com/mi-examples/cs-helper/commit/39a0a8e4a3c1d1b89d0ea8f88a599c511ff174d0))

## [0.6.1-beta.2](https://github.com/mi-examples/cs-helper/compare/v0.6.1-beta.1...v0.6.1-beta.2) (2026-02-26)


### Bug Fixes

* **create:** handle prompts import for CommonJS and ESM ([3858da1](https://github.com/mi-examples/cs-helper/commit/3858da1c220996118a9f2886861d36f40fccaa51))

## [0.6.1-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.6.0...v0.6.1-beta.1) (2026-02-24)


### Bug Fixes

* **build:** resolve webpack from package root and fix chalk ESM interop ([c7f1822](https://github.com/mi-examples/cs-helper/commit/c7f18220f5dec0a90b5ea13ba91696f2479eee85))
* **create:** use resolved path in copyFilesRecursive and cd output ([5a9eb12](https://github.com/mi-examples/cs-helper/commit/5a9eb12edaf2c62acf99251381e0e3749af00bd2))

# [0.6.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.5.1...v0.6.0-beta.1) (2026-02-24)


### Bug Fixes

* **create:** add type assertion for writeFileSync ([89b55d4](https://github.com/mi-examples/cs-helper/commit/89b55d419377246c23d8fe65b31e9892dac89475))


### Features

* **build:** add normalization for git repository URL formats ([20ca768](https://github.com/mi-examples/cs-helper/commit/20ca7684b29eb60857636b99c81481ea60eaf6d5))

## [0.5.1-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.5.0...v0.5.1-beta.1) (2026-02-08)


### Bug Fixes

* **build:** normalize content before checksum calculation ([8178231](https://github.com/mi-examples/cs-helper/commit/8178231ae4509919564ba0d816c8ffe1358382a7))

# [0.4.0-beta.1](https://github.com/mi-examples/cs-helper/compare/v0.3.2...v0.4.0-beta.1) (2026-01-28)


### Features

* add log util and export from package ([d0ebd74](https://github.com/mi-examples/cs-helper/commit/d0ebd747b8717977f406b02e90ed11a3062aeec8))
* **build:** add script source hash and build checksum in banner ([35196ba](https://github.com/mi-examples/cs-helper/commit/35196ba4bfb7b3f90edfaf64bbe3f854bc095e85))
