"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportSource = void 0;
const node_crypto_1 = require("node:crypto");
class ImportSource {
    sImport;
    uri;
    fUrl;
    fDir;
    isWSDL;
    guid;
    gFile;
    static fileCount = 1;
    countFile;
    hashFile;
    constructor(sImport) {
        this.sImport = sImport;
        this.uri = new URL(sImport);
        this.guid = crypto.randomUUID();
        this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
        this.isWSDL = this.fUrl.endsWith(".wsdl");
        if (!this.isWSDL)
            this.fUrl += ".xsd";
        this.fDir = this.fUrl.substring(0, this.fUrl.lastIndexOf("/"));
        this.gFile = this.guid + (this.isWSDL ? ".wsdl" : ".xsd");
        this.countFile = ImportSource.fileCount.toString() + (this.isWSDL ? ".wsdl" : ".xsd");
        const hash = (0, node_crypto_1.createHash)('sha256');
        hash.update(sImport);
        this.hashFile = hash.digest('hex') + (this.isWSDL ? ".wsdl" : ".xsd");
        ImportSource.fileCount++;
    }
    get portlessUrl() {
        return this.sImport.replace(":80", "");
    }
}
exports.ImportSource = ImportSource;
//# sourceMappingURL=ImportSource.js.map