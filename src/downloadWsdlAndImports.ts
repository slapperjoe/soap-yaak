import xml2js from "xml2js";
import { ImportSource } from "./ImportSource";

export async function downloadWsdlAndImports(
  wsdlUrl: string,
  zipfile: any,
  headerSet: Array<ImportSource>) {
  try {
    let response;
    let importObj = new ImportSource(wsdlUrl);
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
        let schemaLocation = new ImportSource(imp["$"].location);

        wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
      }
    }

    if (result[`${headNamespace}:schema`] &&
      result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
      for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
        let schemaLocation = new ImportSource(imp["$"].schemaLocation);

        wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
      }
    }

    // Find and download XSD imports (within types section)
    if (result[`${headNamespace}:definitions`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`]) {
      for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0]["xsd:schema"][0]["xsd:import"]) {
        let schemaLocation = new ImportSource(imp["$"].schemaLocation);
 
        wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
      }
    }

    if (result[`${headNamespace}:schema`] &&
      result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
      for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
        let schemaLocation = new ImportSource(imp["$"].schemaLocation);
        
        wsdlContent = await processData(schemaLocation, headerSet, wsdlContent, zipfile);
      }
    }

    wsdlContent = wsdlContent.replaceAll(":80", "")

    wsdlContent = wsdlContent.replaceAll(/<!--[^>]*-->/g, "");

    zipfile.addBuffer(wsdlContent, importObj.hashFile);

    console.log(`Downloaded: ${wsdlUrl}`);
  } catch (error: any) {
    throw new Error(`Error downloading ${wsdlUrl}:`, error.message);
  }
}

async function processData(schemaLocation: ImportSource, headerSet: Array<ImportSource>, wsdlContent: string, zipfile: any) {
  let headerItem = headerSet.find(a => a.hashFile == schemaLocation.hashFile);
  if (headerItem) schemaLocation = headerItem;
  wsdlContent = wsdlContent.replaceAll(
    schemaLocation.sImport,
    schemaLocation.hashFile
  );

  if (!headerItem) {
    headerSet.push(schemaLocation);
    await downloadWsdlAndImports(
      schemaLocation.sImport,
      zipfile,
      headerSet
    ); // Recursive call
  }
  return wsdlContent;
}
