"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportSource = void 0;
class ImportSource {
    sImport;
    uri;
    fUrl;
    fDir;
    isWSDL;
    constructor(sImport) {
        this.sImport = sImport;
        this.uri = new URL(sImport);
        this.fUrl = this.uri.href.replace("?WSDL", ".wsdl").replace(":80", "");
        this.isWSDL = this.fUrl.endsWith(".wsdl");
        if (!this.isWSDL)
            this.fUrl += ".xsd";
        this.fDir = this.fUrl.substring(0, this.fUrl.lastIndexOf("/"));
    }
}
exports.ImportSource = ImportSource;
//# sourceMappingURL=ImportSource.js.map