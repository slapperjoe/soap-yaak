"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadWsdlAndImports = downloadWsdlAndImports;
const xml2js_1 = __importDefault(require("xml2js"));
const ImportSource_1 = require("./ImportSource");
async function downloadWsdlAndImports(wsdlUrl, zipfile, headerSet) {
    try {
        let response;
        let importObj = new ImportSource_1.ImportSource(wsdlUrl);
        response = await fetch(importObj.sImport);
        let wsdlContent = await response.text();
        const parser = new xml2js_1.default.Parser();
        const result = await parser.parseStringPromise(wsdlContent);
        const headElement = Object.keys(result)[0];
        const headNamespace = headElement?.substring(0, headElement.indexOf(":"));
        // Find and download WSDL imports
        if (result[`${headNamespace}:definitions`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:import`]) {
            for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:import`]) {
                let schemaLocation = new ImportSource_1.ImportSource(imp["$"].location);
                wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
            }
        }
        if (result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
                let schemaLocation = new ImportSource_1.ImportSource(imp["$"].schemaLocation);
                wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
            }
        }
        // Find and download XSD imports (within types section)
        if (result[`${headNamespace}:definitions`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`]) {
            for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0]["xsd:schema"][0]["xsd:import"]) {
                let schemaLocation = new ImportSource_1.ImportSource(imp["$"].schemaLocation);
                wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
            }
        }
        if (result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
                let schemaLocation = new ImportSource_1.ImportSource(imp["$"].schemaLocation);
                wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
            }
        }
        wsdlContent = wsdlContent.replaceAll(":80", "");
        wsdlContent = wsdlContent.replaceAll(/<!--[^>]*-->/g, "");
        zipfile.addBuffer(wsdlContent, importObj.hashFile);
        console.log(`Downloaded: ${wsdlUrl}`);
    }
    catch (error) {
        throw new Error(`Error downloading ${wsdlUrl}:`, error.message);
    }
}
async function processData(schemaLocation, headerSet, wsdlContent, zipfile) {
    let headerItem = headerSet.find(a => a.hashFile == schemaLocation.hashFile);
    if (headerItem)
        schemaLocation = headerItem;
    wsdlContent = wsdlContent.replaceAll(schemaLocation.sImport, schemaLocation.hashFile);
    if (!headerItem) {
        headerSet.push(schemaLocation);
        await downloadWsdlAndImports(schemaLocation.sImport, zipfile, headerSet); // Recursive call
    }
    return wsdlContent;
}
//# sourceMappingURL=downloadWsdlAndImports.js.map