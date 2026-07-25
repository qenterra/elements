# Third-party notices

Elements uses open-source npm packages. Direct dependencies are declared in
`package.json`; `package-lock.json` records the exact installed versions and
transitive dependency graph.

## Included in the extension bundle

These packages are used by the extension at runtime or are compiled into its
JavaScript bundle.

| Package            | Version | License | Copyright / attribution             | Source                                                                                                        |
| ------------------ | ------: | ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `react`            |  19.2.7 | MIT     | Meta Platforms, Inc. and affiliates | [facebook/react](https://github.com/facebook/react)                                                           |
| `react-dom`        |  19.2.7 | MIT     | Meta Platforms, Inc. and affiliates | [facebook/react](https://github.com/facebook/react)                                                           |
| `scheduler`        |  0.27.0 | MIT     | Meta Platforms, Inc. and affiliates | [facebook/react/tree/main/packages/scheduler](https://github.com/facebook/react/tree/main/packages/scheduler) |
| `@wxt-dev/browser` |   0.2.2 | MIT     | Aaron Klinker / WXT project         | [wxt-dev/wxt](https://github.com/wxt-dev/wxt)                                                                 |

## Development and build tools

The following packages are used to build or test Elements. They are not
included in the published extension bundle.

| Package                       | Version | License    | Copyright / attribution               | Source                                                                                            |
| ----------------------------- | ------: | ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@axe-core/playwright`        |  4.12.1 | MPL-2.0    | Deque Systems, Inc.                   | [dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm)                               |
| `@playwright/test`            |  1.61.1 | Apache-2.0 | Microsoft Corporation                 | [microsoft/playwright](https://github.com/microsoft/playwright)                                   |
| `@resvg/resvg-js`             |   2.6.2 | MPL-2.0    | Yisi Yu (yisibl)                      | [yisibl/resvg-js](https://github.com/yisibl/resvg-js)                                             |
| `@testing-library/dom`        |  10.4.1 | MIT        | Testing Library contributors          | [testing-library/dom-testing-library](https://github.com/testing-library/dom-testing-library)     |
| `@testing-library/react`      |  16.3.2 | MIT        | Testing Library contributors          | [testing-library/react-testing-library](https://github.com/testing-library/react-testing-library) |
| `@testing-library/user-event` |  14.6.1 | MIT        | Testing Library contributors          | [testing-library/user-event](https://github.com/testing-library/user-event)                       |
| `@types/node`                 |  26.1.1 | MIT        | DefinitelyTyped contributors          | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                             |
| `@types/react`                | 19.2.17 | MIT        | DefinitelyTyped contributors          | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                             |
| `@types/react-dom`            |  19.2.3 | MIT        | DefinitelyTyped contributors          | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped)                             |
| `@vitejs/plugin-react`        |   6.0.3 | MIT        | Yuxi (Evan) You and Vite contributors | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react)                           |
| `@wxt-dev/module-react`       |   1.2.2 | MIT        | Aaron (WXT project)                   | [wxt-dev/wxt](https://github.com/wxt-dev/wxt)                                                     |
| `jsdom`                       |  29.1.1 | MIT        | jsdom contributors                    | [jsdom/jsdom](https://github.com/jsdom/jsdom)                                                     |
| `oxlint`                      |  1.75.0 | MIT        | Oxc contributors                      | [oxc-project/oxc](https://github.com/oxc-project/oxc)                                             |
| `prettier`                    |   3.9.6 | MIT        | Prettier contributors                 | [prettier/prettier](https://github.com/prettier/prettier)                                         |
| `typescript`                  |   7.0.2 | Apache-2.0 | Microsoft Corporation                 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript)                                   |
| `vitest`                      |  4.1.10 | MIT        | VoidZero Inc. and Vitest contributors | [vitest-dev/vitest](https://github.com/vitest-dev/vitest)                                         |
| `wxt`                         | 0.20.27 | MIT        | Aaron (WXT project)                   | [wxt-dev/wxt](https://github.com/wxt-dev/wxt)                                                     |

The lockfile records the exact transitive dependency graph. If a package is
added, removed, or upgraded, regenerate this file before publishing a new
version so that the notices remain accurate.

## License texts

The copyright notices in the tables above belong to the respective package
authors. Packages marked MIT are distributed under the following license:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the “Software”), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.

TypeScript and Playwright are distributed under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
`@axe-core/playwright` and `@resvg/resvg-js` are distributed under the
[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). They are
test and build tools and do not ship in the browser bundle.
The package distributions contain the corresponding copyright notices and full
license texts; the pinned versions can be audited from `package-lock.json`.

## GitHub Pages runtime

The public product page loads the following pinned browser script. It is not
included in the extension archives.

| Package | Version | License                 | Copyright / attribution | Source                                              |
| ------- | ------: | ----------------------- | ----------------------- | --------------------------------------------------- |
| `gsap`  |  3.15.0 | GSAP Standard no-charge | GreenSock, Inc.         | [greensock/GSAP](https://github.com/greensock/GSAP) |

GSAP is distributed under the
[GSAP Standard License](https://gsap.com/standard-license/). The Pages document
pins both GSAP and ScrollTrigger to version 3.15.0 and verifies their payloads
with subresource-integrity hashes.
