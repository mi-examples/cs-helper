# Changelog

## [0.11.0](https://github.com/mi-examples/cs-helper/compare/v0.10.0...v0.11.0) (2026-09-24)

### Features

* **deps:** upgrade to Babel 8, commander 15 and chalk 6 ([46b73c2](https://github.com/mi-examples/cs-helper/commit/46b73c28c89ac83cc978cadeab9b262c9572d98e))
* **types:** provide jQuery types to custom scripts in the IDE ([da91831](https://github.com/mi-examples/cs-helper/commit/da91831111c2dce7de8c295304cd21360c2b3536))

### Bug Fixes

* **build:** transpile the script's own JS files for v6 ([78608fb](https://github.com/mi-examples/cs-helper/commit/78608fbc70cb61aa556b984a768bb7e452a6ab92))
* **deps:** remove install-time npm patch hook and stale overrides ([7676345](https://github.com/mi-examples/cs-helper/commit/7676345c2e3030ae30c3b33bbb8854ac35a85bc2))

## [0.10.0](https://github.com/mi-examples/cs-helper/compare/v0.9.1...v0.10.0) (2026-09-07)

### Features

* **sanity-check:** add rule suppression via comments and config ([4559b88](https://github.com/mi-examples/cs-helper/commit/4559b8866cedf7a21b27c99cab62fab641ed2485))
* **params:** add Password/ScriptTimeout marker types + suggestedTimeoutMinutes ([a6310fa](https://github.com/mi-examples/cs-helper/commit/a6310fa2f6735ec834d3cccce3a7158446aea27c))
* **sanity-check:** add 8 more rules (token, heartbeat, node-api, password, jquery, eval) ([35dd228](https://github.com/mi-examples/cs-helper/commit/35dd228be905192f2d663ceeaf4258a3edbcad13))
* **sanity-check:** add sanity-check function for custom scripts ([e3baf03](https://github.com/mi-examples/cs-helper/commit/e3baf0372426dd07a832093323c1b95f3200685f))

### Bug Fixes

* **sanity-check:** check script-timeout-param across all parseParams calls ([926366b](https://github.com/mi-examples/cs-helper/commit/926366b603c961e1032242468e8221c68af23615))
* **sanity-check:** fix two false-positive-prone rules found on real scripts ([3969b07](https://github.com/mi-examples/cs-helper/commit/3969b073e8ebbd4f5a087bfcd8001def59b3ce0b))
* **sanity-check:** downgrade script-timeout-param to info, not required ([3741b21](https://github.com/mi-examples/cs-helper/commit/3741b21f35e4aed8a8909d8b4b42b7031982a90e))
* **deps:** resolve npm audit vulnerabilities ([6c0380a](https://github.com/mi-examples/cs-helper/commit/6c0380ac69db22996c3858938e271b3aedfb0060))

### Changes

* Add MIT license ([eea4822](https://github.com/mi-examples/cs-helper/commit/eea48226f0b8d61f741be1c0c33e976f1a5b247f))

## [0.9.1](https://github.com/mi-examples/cs-helper/compare/v0.9.0...v0.9.1) (2026-08-12)

### Bug Fixes

* **deps:** patch undici vulnerability ([efc88bf](https://github.com/mi-examples/cs-helper/commit/efc88bf76f27b8f81e94fd26ba9a782f20b5140c))

## [0.9.0](https://github.com/mi-examples/cs-helper/compare/v0.8.2...v0.9.0) (2026-08-03)

### Features

* **create:** track ai-addon freshness and add --update-ai to refresh them ([eff5265](https://github.com/mi-examples/cs-helper/commit/eff52654fef8e36560e92eb26ea3d1c64c696792))
* **types:** add window.req and window.user (CustomScriptRequestUser) globals ([8b1e341](https://github.com/mi-examples/cs-helper/commit/8b1e34118daecca0b9f6ee070b56c6f272c069de))

### Bug Fixes

* **deps:** patch brace-expansion/tar/js-yaml/fast-uri vulnerabilities ([637a854](https://github.com/mi-examples/cs-helper/commit/637a854fd3ac6735a5caa1877a4584c524c2fa2e))

## [0.8.2](https://github.com/mi-examples/cs-helper/compare/v0.8.1...v0.8.2) (2026-07-14)

### Bug Fixes

* **deps:** patch sigstore/tar/js-yaml/undici/@babel-core vulnerabilities ([361c927](https://github.com/mi-examples/cs-helper/commit/361c927590490ad7b2f6ffd80647f643ded85b42))

## [0.8.1](https://github.com/mi-examples/cs-helper/compare/v0.8.0...v0.8.1) (2026-05-26)

### Bug Fixes

* **parseParams:** allow optional properties in generic constraint ([2580cdc](https://github.com/mi-examples/cs-helper/commit/2580cdc857d88153e215ff0cd8897050acee7c62))
* **params:** show optional number params as number in docs ([c0b8632](https://github.com/mi-examples/cs-helper/commit/c0b863207b053e8b5e3cdc1e38f89b21dfc8dd52))

## [0.8.0](https://github.com/mi-examples/cs-helper/compare/v0.7.2...v0.8.0) (2026-05-26)

### Features

* **templates:** add scriptTimeout and scheduleClose scaffolds ([44175fc](https://github.com/mi-examples/cs-helper/commit/44175fc1f7ab2daba8eb53501ac2725b47f431b2))
* **types:** add heartBeat, isClosed, and updateHeartBeat ([307a2e1](https://github.com/mi-examples/cs-helper/commit/307a2e148f0763ad43f92b289cf4ab0465dee7d5))

### Bug Fixes

* **build:** chmod cli bins for unix npm exec ([89e4209](https://github.com/mi-examples/cs-helper/commit/89e420952e520fd61c39e7bf37f106dd0d814289))

## [0.7.2](https://github.com/mi-examples/cs-helper/compare/v0.7.1...v0.7.2) (2026-05-22)

No notable changes.

## [0.7.1](https://github.com/mi-examples/cs-helper/compare/v0.7.0...v0.7.1) (2026-04-22)

No notable changes.

## [0.7.0](https://github.com/mi-examples/cs-helper/compare/v0.6.4...v0.7.0) (2026-04-15)

### Features

* **api:** expand CustomScript type and logging utilities ([6b68353](https://github.com/mi-examples/cs-helper/commit/6b683530f5963d49b0d402472f026cc14ae9a044))
* **create:** optional ai-addons copy and --ai flag ([abc0290](https://github.com/mi-examples/cs-helper/commit/abc029001364242bda80d50b34dd16ab53a3af7c))

### Bug Fixes

* **log:** use performance.now when enabling performance mode ([41c9bb0](https://github.com/mi-examples/cs-helper/commit/41c9bb0cce7b2ed70831c88057629e09b6858ed1))
* **log:** rename setLogPerformance param to avoid shadowing performance ([8e63342](https://github.com/mi-examples/cs-helper/commit/8e6334288c7c68fa94af0cf2970e62f1ab350dc0))

## [0.6.4](https://github.com/mi-examples/cs-helper/compare/v0.6.3...v0.6.4) (2026-04-03)

### Bug Fixes

* **deps:** resolve npm audit and bump ts-loader ([39a0a8e](https://github.com/mi-examples/cs-helper/commit/39a0a8e4a3c1d1b89d0ea8f88a599c511ff174d0))

## [0.6.3](https://github.com/mi-examples/cs-helper/compare/v0.6.2...v0.6.3) (2026-03-19)

### Dependencies

* upgrade packages and fix vulnerabilities ([bd8c964](https://github.com/mi-examples/cs-helper/commit/bd8c96404c0f8b1d2f11cbb7446a3f8cc195ac7a))

## [0.6.2](https://github.com/mi-examples/cs-helper/compare/v0.6.1...v0.6.2) (2026-02-26)

### Bug Fixes

* **create:** handle prompts import for CommonJS and ESM ([3858da1](https://github.com/mi-examples/cs-helper/commit/3858da1c220996118a9f2886861d36f40fccaa51))

## [0.6.1](https://github.com/mi-examples/cs-helper/compare/v0.6.0...v0.6.1) (2026-02-24)

### Bug Fixes

* **create:** use resolved path in copyFilesRecursive and cd output ([5a9eb12](https://github.com/mi-examples/cs-helper/commit/5a9eb12edaf2c62acf99251381e0e3749af00bd2))
* **build:** resolve webpack from package root and fix chalk ESM interop ([c7f1822](https://github.com/mi-examples/cs-helper/commit/c7f18220f5dec0a90b5ea13ba91696f2479eee85))

## [0.6.0](https://github.com/mi-examples/cs-helper/compare/v0.5.1...v0.6.0) (2026-02-24)

### Features

* **build:** add normalization for git repository URL formats ([20ca768](https://github.com/mi-examples/cs-helper/commit/20ca7684b29eb60857636b99c81481ea60eaf6d5))

### Bug Fixes

* **create:** add type assertion for writeFileSync ([89b55d4](https://github.com/mi-examples/cs-helper/commit/89b55d419377246c23d8fe65b31e9892dac89475))

## [0.5.1](https://github.com/mi-examples/cs-helper/compare/v0.5.0...v0.5.1) (2026-02-09)

### Bug Fixes

* **build:** normalize content before checksum calculation ([8178231](https://github.com/mi-examples/cs-helper/commit/8178231ae4509919564ba0d816c8ffe1358382a7))

### Changes

* Removed duplicated line ([92587d9](https://github.com/mi-examples/cs-helper/commit/92587d94293d37fb7264c53b5ad79064829ef276))
* Apply suggestion from @coderabbitai[bot] ([145e05c](https://github.com/mi-examples/cs-helper/commit/145e05c178abe0f8846f277a809fd059177fd950))

## [0.5.0](https://github.com/mi-examples/cs-helper/compare/v0.4.0...v0.5.0) (2026-02-03)

### Changes

* Add package.json exports and typesVersions configuration ([ffcc215](https://github.com/mi-examples/cs-helper/commit/ffcc2150d41f8cd15ff6327ca6b53465f971527c))
* Add params-base64 feature for encoding parameter metadata ([eac9a4f](https://github.com/mi-examples/cs-helper/commit/eac9a4fbf0c6407efa12bcef6f6a6e8e18039b03))

## [0.4.0](https://github.com/mi-examples/cs-helper/compare/v0.3.2...v0.4.0) (2026-01-29)

### Features

* add log util and export from package ([d0ebd74](https://github.com/mi-examples/cs-helper/commit/d0ebd747b8717977f406b02e90ed11a3062aeec8))
* **build:** add script source hash and build checksum in banner ([35196ba](https://github.com/mi-examples/cs-helper/commit/35196ba4bfb7b3f90edfaf64bbe3f854bc095e85))

## [0.3.2](https://github.com/mi-examples/cs-helper/compare/v0.3.1...v0.3.2) (2024-09-16)

### Changes

* Removed polyfills for v7 and changed build target to es2022 ([56b0d79](https://github.com/mi-examples/cs-helper/commit/56b0d798e8de7078516b71610bf7414fe7c4a1f0))

## [0.3.1](https://github.com/mi-examples/cs-helper/compare/v0.3.0...v0.3.1) (2024-09-12)

### Changes

* Hotfix ([09da38a](https://github.com/mi-examples/cs-helper/commit/09da38aed1dcf2aba21236a79da0f5ffd4f76d20))

## [0.3.0](https://github.com/mi-examples/cs-helper/compare/v0.2.0...v0.3.0) (2024-09-12)

### Changes

* Fixed code issue ([08b0b3c](https://github.com/mi-examples/cs-helper/commit/08b0b3c99b171e74cbfb306161e38add5d3f5802))
* Changed tempate index file names after new repo creation ([08bb905](https://github.com/mi-examples/cs-helper/commit/08bb9055228f1b49ea37a6d9b9a3c99cda080918))
* Added ability to build CS only for v7 ([a4abf82](https://github.com/mi-examples/cs-helper/commit/a4abf824374c1a88a42c9952a57534e9411278cc))

## [0.2.0](https://github.com/mi-examples/cs-helper/compare/v0.1.5...v0.2.0) (2023-11-09)

### Changes

* Bump version to `0.2.0` ([41708d3](https://github.com/mi-examples/cs-helper/commit/41708d387a7a80784263888fced5571f8b6e877f))
* New features: ([651a287](https://github.com/mi-examples/cs-helper/commit/651a287960324258d2c91a9e03f713c7b502e796))

## [0.1.5](https://github.com/mi-examples/cs-helper/compare/v0.1.4...v0.1.5) (2023-04-25)

### Changes

* 0.1.5 ([bad7f9b](https://github.com/mi-examples/cs-helper/commit/bad7f9b5437475c90e0fcb621bf281f021224303))
* - Fixed dependencies ([2c29e5f](https://github.com/mi-examples/cs-helper/commit/2c29e5fec219cd2b6983043e117380e2b50d1882))

## [0.1.4](https://github.com/mi-examples/cs-helper/compare/v0.1.3...v0.1.4) (2023-04-25)

### Changes

* 0.1.4 ([295e987](https://github.com/mi-examples/cs-helper/commit/295e9878231a85e658067ba9ec325e07b9db9fa3))
* - Bump helper version in templates ([c150272](https://github.com/mi-examples/cs-helper/commit/c1502728cf2e4c4facf4f76c11b6ec86d8def7f4))

## [0.1.3](https://github.com/mi-examples/cs-helper/compare/v0.1.2...v0.1.3) (2023-04-25)

### Changes

* 0.1.3 ([980eea3](https://github.com/mi-examples/cs-helper/commit/980eea3c98909ba230c91ed8d4785d8ac9a20a97))
* - Added babel-loader to webpack build config - All code include node_modules will be transpiled to es5 ([78860c8](https://github.com/mi-examples/cs-helper/commit/78860c8c018461b34aa988f21a49a864e06c920e))

## [0.1.2](https://github.com/mi-examples/cs-helper/compare/v0.1.1...v0.1.2) (2023-04-24)

### Changes

* 0.1.2 ([3c241ff](https://github.com/mi-examples/cs-helper/commit/3c241ff62f7e6f7f762fd1186476e19e7a2c5ea6))
* - Added missed package string-includes-polyfill ([c657da2](https://github.com/mi-examples/cs-helper/commit/c657da2444994935f301614a22764aa552a6056e))

## [0.1.1](https://github.com/mi-examples/cs-helper/compare/v0.1.0...v0.1.1) (2023-04-12)

### Changes

* 0.1.1 ([8f054b2](https://github.com/mi-examples/cs-helper/commit/8f054b29e2557798d6d7abda9d389f1bbee59fa6))
* - Added.npmignore and fixed publish workflow ([4129acf](https://github.com/mi-examples/cs-helper/commit/4129acf9e40ee5e0986ffd001381004927e8bc31))

## 0.1.0 (2023-04-12)

### Changes

* - Updated publish workflow ([33a137c](https://github.com/mi-examples/cs-helper/commit/33a137cb8035e88596946c8bddf6b2a2a613a420))
* - Fixed bin build code ([258c350](https://github.com/mi-examples/cs-helper/commit/258c350a9f40c3a8a7b603aec9da205cdcdbf73b))
* Created publish workflow ([1019ad4](https://github.com/mi-examples/cs-helper/commit/1019ad42d8f95553c044eda110cb5a75c4db2fec))
* - Added cli to create custom script from the template - Added custom script templates for JavaScript and Typescript - Changed build configuration to be compatible with execution context ([11ee81a](https://github.com/mi-examples/cs-helper/commit/11ee81a07c42ad56ec24d9d93fc3ca2fcbd29cef))
* MI-21308 Custom Script helper tool ([a642ef4](https://github.com/mi-examples/cs-helper/commit/a642ef40779c5fee73dd9e6fbe89dd17e9c5f19b))
