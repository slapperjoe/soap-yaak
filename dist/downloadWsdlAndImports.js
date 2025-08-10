"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadWsdlAndImports = downloadWsdlAndImports;
const xml2js_1 = __importDefault(require("xml2js"));
const ImportSource_1 = require("./ImportSource");
async function downloadWsdlAndImports(wsdlUrl, targetDir, zipfile, headerSet) {
    try {
        let response;
        const importObj = new ImportSource_1.ImportSource(wsdlUrl);
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
                const schemaLocation = imp["$"].location + ".xsd";
                wsdlContent = wsdlContent.replace(imp["$"].location, schemaLocation);
                const importedUrl = new URL(schemaLocation, importObj.uri).href;
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        if (result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
                const schemaLocation = imp["$"].schemaLocation + ".xsd";
                wsdlContent = wsdlContent.replace(imp["$"].schemaLocation, schemaLocation);
                const importedUrl = new URL(schemaLocation, importObj.uri).href;
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        // Find and download XSD imports (within types section)
        if (result[`${headNamespace}:definitions`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`]) {
            for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0]["xsd:schema"][0]["xsd:import"]) {
                const schemaLocation = new ImportSource_1.ImportSource(imp["$"].schemaLocation);
                wsdlContent = wsdlContent.replace(importObj.sImport, importObj.fUrl);
                const importedUrl = new URL(schemaLocation.fUrl, importObj.uri).href;
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.fDir, zipfile, headerSet); // Recursive call
                }
            }
        }
        if (result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
                const schemaLocation = (imp["$"].schemaLocation + ".xsd");
                wsdlContent = wsdlContent.replace(imp["$"].schemaLocation, schemaLocation);
                const importedUrl = new URL(schemaLocation, importObj.uri).href;
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        zipfile.addBuffer(Buffer.from(wsdlContent.replaceAll(":80", "")), importObj.fUrl);
        console.log(`Downloaded: ${wsdlUrl}`);
    }
    catch (error) {
        console.error(`Error downloading ${wsdlUrl}:`, error.message);
    }
}
//# sourceMappingURL=downloadWsdlAndImports.js.map