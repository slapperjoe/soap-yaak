import xml2js from "xml2js";
import { ImportSource } from "./ImportSource";

export async function downloadWsdlAndImports(
  wsdlUrl: string,
  targetDir: string,
  zipfile: any,
  headerSet: Array<string>) {
  try {
    let response;
    const importObj = new ImportSource(wsdlUrl);
    response = await fetch(importObj.sImport);

    let wsdlContent = await response.text();

    const parser = new xml2js.Parser();
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
          await downloadWsdlAndImports(
            importedUrl,
            schemaLocation.substring(0, schemaLocation.lastIndexOf("/")),
            zipfile,
            headerSet
          ); // Recursive call
        }
      }
    }

    if (result[`${headNamespace}:schema`] &&
      result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
      for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
        const schemaLocation = imp["$"].schemaLocation + ".xsd";
        wsdlContent = wsdlContent.replace(
          imp["$"].schemaLocation,
          schemaLocation
        );
        const importedUrl = new URL(schemaLocation, importObj.uri).href;
        if (headerSet.indexOf(importedUrl) == -1) {
          headerSet.push(importedUrl);
          await downloadWsdlAndImports(
            importedUrl,
            schemaLocation.substring(0, schemaLocation.lastIndexOf("/")),
            zipfile,
            headerSet
          ); // Recursive call
        }
      }
    }

    // Find and download XSD imports (within types section)
    if (result[`${headNamespace}:definitions`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`]) {
      for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0]["xsd:schema"][0]["xsd:import"]) {
        const schemaLocation = (imp["$"].schemaLocation + ".xsd");
        wsdlContent = wsdlContent.replace(
          imp["$"].schemaLocation,
          schemaLocation
        );
        const importedUrl = new URL(schemaLocation, importObj.uri).href;
        if (headerSet.indexOf(importedUrl) == -1) {
          headerSet.push(importedUrl);
          await downloadWsdlAndImports(
            importedUrl,
            schemaLocation.substring(0, schemaLocation.lastIndexOf("/")),
            zipfile,
            headerSet
          ); // Recursive call
        }
      }
    }

    if (result[`${headNamespace}:schema`] &&
      result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
      for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
        const schemaLocation = (imp["$"].schemaLocation + ".xsd");
        wsdlContent = wsdlContent.replace(
          imp["$"].schemaLocation,
          schemaLocation
        );
        const importedUrl = new URL(schemaLocation, importObj.uri).href;
        if (headerSet.indexOf(importedUrl) == -1) {
          headerSet.push(importedUrl);
          await downloadWsdlAndImports(
            importedUrl,
            schemaLocation.substring(0, schemaLocation.lastIndexOf("/")),
            zipfile,
            headerSet
          ); // Recursive call
        }
      }
    }

    zipfile.addBuffer(Buffer.from(wsdlContent.replaceAll(":80", "")), importObj.fUrl);

    console.log(`Downloaded: ${wsdlUrl}`);
  } catch (error: any) {
    console.error(`Error downloading ${wsdlUrl}:`, error.message);
  }
}
