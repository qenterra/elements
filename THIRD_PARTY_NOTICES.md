# Third-party notices

Elements uses open-source npm packages. Direct dependency versions are pinned
in `package.json`; `package-lock.json` records the exact transitive versions.

## Included in the extension bundle

These packages are used by the extension at runtime or are compiled into its
JavaScript bundle.

| Package | Version | License | Copyright / attribution | Source |
| --- | ---: | --- | --- | --- |
| `react` | 19.2.7 | MIT | Meta Platforms, Inc. and affiliates | [facebook/react](https://github.com/facebook/react) |
| `react-dom` | 19.2.7 | MIT | Meta Platforms, Inc. and affiliates | [facebook/react](https://github.com/facebook/react) |
| `scheduler` | 0.27.0 | MIT | Meta Platforms, Inc. and affiliates | [facebook/react/tree/main/packages/scheduler](https://github.com/facebook/react/tree/main/packages/scheduler) |
| `@wxt-dev/browser` | 0.2.2 | MIT | Aaron Klinker / WXT project | [wxt-dev/wxt](https://github.com/wxt-dev/wxt) |

## Development and build tools

The following packages are used to build or test Elements. They are not
included in the published extension bundle.

| Package | Version | License | Copyright / attribution | Source |
| --- | ---: | --- | --- | --- |
| `@wxt-dev/module-react` | 1.2.2 | MIT | Aaron (WXT project) | [wxt-dev/wxt](https://github.com/wxt-dev/wxt) |
| `wxt` | 0.20.27 | MIT | Aaron (WXT project) | [wxt-dev/wxt](https://github.com/wxt-dev/wxt) |
| `@vitejs/plugin-react` | 6.0.3 | MIT | Yuxi (Evan) You and Vite contributors | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| `typescript` | 7.0.2 | Apache-2.0 | Microsoft Corporation | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| `vitest` | 4.1.10 | MIT | VoidZero Inc. and Vitest contributors | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| `@types/react` | 19.2.17 | MIT | Microsoft Corporation | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@types/react-dom` | 19.2.3 | MIT | Microsoft Corporation | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |

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

TypeScript is distributed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
The package distributions contain the corresponding copyright notices and full
license texts; the pinned versions can be audited from `package-lock.json`.
