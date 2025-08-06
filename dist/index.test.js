"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.describe)('Example Plugin', () => {
    (0, vitest_1.test)('Exports plugin object', () => {
        (0, vitest_1.expect)(index_1.plugin).toBeTypeOf('object');
    });
});
//# sourceMappingURL=index.test.js.map