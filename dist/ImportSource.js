"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportSource = void 0;
const node_crypto_1 = require("node:crypto");
class ImportSource {
    sImport;
    uri;
    fUrl;
    isWSDL;
    guid;
    hashFile;
    constructor(sImport) {
        this.sImport = sImport;
        this.uri = new URL(sImport);
        this.guid = crypto.randomUUID();
        this.uri.href = this.uri.href.replace("?wsdl", "?WSDL");
        this.fUrl = this.uri.href.replace(":80", "");
        this.isWSDL = this.fUrl.indexOf("?WSDL") > -0;
        this.fUrl += (this.isWSDL) ? ".wsdl" : ".xsd";
        const hash = (0, node_crypto_1.createHash)('sha256');
        hash.update(sImport);
        this.hashFile = hash.digest('hex') + (this.isWSDL ? ".wsdl" : ".xsd");
    }
    get portlessUrl() {
        return this.sImport.replace(":80", "");
    }
}
exports.ImportSource = ImportSource;
//# sourceMappingURL=ImportSource.js.map