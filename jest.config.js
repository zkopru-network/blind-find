module.exports = {
    // To fix `ReferenceError: TextEncoder is not defined`[1]. This error is weird since we use
    //  node v12 and jest with jsdom which support `TextEncoder`. The cause is because
    //  by default tsdx does **not** use node test environment. Thus we need to specify it
    //  explicitly here. This config is *shallow merged* with tsdx's default config[2].
    // Ref:
    //  - [1]: https://github.com/facebook/jest/issues/9983#issuecomment-625298464
    //  - [2]: https://github.com/formium/tsdx#jest
    testEnvironment: "node"
}
