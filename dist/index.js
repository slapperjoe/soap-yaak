"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const apiconnect_wsdl_1 = require("apiconnect-wsdl");
const xml2js_1 = __importDefault(require("xml2js"));
const fs_1 = __importDefault(require("fs"));
const yazl_1 = __importDefault(require("yazl"));
async function downloadWsdlAndImports(wsdlUrl, targetDir, zipfile, headerSet) {
    try {
        const response = await fetch(wsdlUrl.replace(".xsd", ""));
        const wsdlContent = await response.text();
        const filePath = wsdlUrl.indexOf("?WSDL") > -1 ? wsdlUrl.replace("?WSDL", ".wsdl") : wsdlUrl; // + ".xsd";// path.basename(new URL(wsdlUrl).pathname);
        //fs.writeFileSync(path.join(targetDir, fileName), wsdlContent);
        zipfile.addBuffer(Buffer.from(wsdlContent), filePath);
        //archiver.append(wsdlContent, {name: wsdlUrl.replace("?WSDL",".wsdl").replaceAll("/","\\/")}); 
        //zipStuff(wsdlContent, wsdlUrl, "happy.zip")
        const parser = new xml2js_1.default.Parser();
        const result = await parser.parseStringPromise(wsdlContent);
        const headElement = Object.keys(result)[0];
        const headNamespace = headElement?.substring(0, headElement.indexOf(':'));
        // Find and download WSDL imports
        if ((result[`${headNamespace}:definitions`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:import`])) {
            for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:import`]) {
                const importLocation = imp["$"].location;
                const importedUrl = new URL(importLocation, wsdlUrl).href.replace("//", "/");
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, importLocation.substring(0, importLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        if ((result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:import`])) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:import`]) {
                const schemaLocation = imp["$"].schemaLocation;
                const importedUrl = new URL(schemaLocation, wsdlUrl).href.replace("//", "/");
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        // Find and download XSD imports (within types section)
        if ((result[`${headNamespace}:definitions`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
            result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`])) {
            for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0]["xsd:schema"][0]["xsd:import"]) {
                const schemaLocation = (imp["$"].schemaLocation += ".xsd");
                const importedUrl = new URL(schemaLocation, wsdlUrl).href.replace("//", "/");
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        if ((result[`${headNamespace}:schema`] &&
            result[`${headNamespace}:schema`][`${headNamespace}:include`])) {
            for (const imp of result[`${headNamespace}:schema`][`${headNamespace}:include`]) {
                const schemaLocation = (imp["$"].schemaLocation += ".xsd");
                const importedUrl = new URL(schemaLocation, wsdlUrl).href.replace("//", "/");
                if (headerSet.indexOf(importedUrl) == -1) {
                    headerSet.push(importedUrl);
                    await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
                }
            }
        }
        console.log(`Downloaded: ${wsdlUrl}`);
    }
    catch (error) {
        console.error(`Error downloading ${wsdlUrl}:`, error.message);
    }
}
exports.plugin = {
    importer: {
        name: "soapWSDLs",
        description: "Import SOAP WSDL URLs",
        async onImport(_ctx, args) {
            process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let importFile = JSON.parse(args.text);
            let folders = [];
            let folderCount = 0;
            let requests = [];
            let requestCount = 0;
            const myPromise = new Promise((resolve, reject) => {
                importFile?.urls.forEach(async (url, idx) => {
                    try {
                        const zipfile = new yazl_1.default.ZipFile();
                        let headerSet = [];
                        //const wsdls = await getJsonForWSDL(`bob.zip`);
                        await downloadWsdlAndImports(url, "", zipfile, headerSet);
                        //var jim = await introspectWSDL(url);
                        zipfile.outputStream.pipe(fs_1.default.createWriteStream("bob.zip")).on("error", async (e, a) => {
                            debugger;
                        }).on("close", async () => {
                            console.log("done");
                            const wsdls = await (0, apiconnect_wsdl_1.getJsonForWSDL)(`bob.zip`, undefined, {
                                apiFromXSD: true,
                                allowExtraFiles: true,
                                implicitHeaderFiles: headerSet
                            });
                            const serviceData = (0, apiconnect_wsdl_1.getWSDLServices)(wsdls);
                            // Loop through all services
                            for (const item in serviceData.services) {
                                // eslint-disable-line
                                const svcName = serviceData.services[item].service;
                                const wsdlId = serviceData.services[item].filename;
                                const wsdlEntry = (0, apiconnect_wsdl_1.findWSDLForServiceName)(wsdls, svcName);
                                const swaggerOptions = {
                                    inlineAttributes: true,
                                    suppressExamples: false,
                                    type: "wsdl",
                                    wssecurity: true,
                                };
                                folders.push({
                                    model: "folder",
                                    workspaceId: "GENERATE_ID::WORKSPACE_0",
                                    folderId: null,
                                    sortPriority: -Date.now(),
                                    name: svcName,
                                    id: `GENERATE_ID::FOLDER_${folderCount}`,
                                });
                                const swagger = (0, apiconnect_wsdl_1.getSwaggerForService)(wsdlEntry, svcName, wsdlId, swaggerOptions);
                                delete swagger.info["x-ibm-name"];
                                delete swagger["x-ibm-configuration"];
                                Object.entries(swagger.paths).forEach((ent) => {
                                    const req = ent[1].post;
                                    const inputLoc = req.parameters.find((a) => a.in == "body");
                                    const schemaRef = inputLoc.schema.$ref;
                                    const inputs = schemaRef.substring(schemaRef.lastIndexOf("/") + 1);
                                    requests.push({
                                        model: "http_request",
                                        id: `GENERATE_ID::HTTP_REQUEST_${requestCount}`,
                                        workspaceId: "GENERATE_ID::WORKSPACE_0",
                                        folderId: `GENERATE_ID::FOLDER_${folderCount}`,
                                        name: req.operationId,
                                        method: "POST",
                                        url: `${url.replace("?WSDL", "")}${ent[0]}`,
                                        urlParameters: [],
                                        body: { text: swagger.definitions[inputs].example },
                                        bodyType: "text/xml",
                                        authentication: {},
                                        authenticationType: null,
                                        headers: [],
                                        description: req.description,
                                    });
                                    requestCount++;
                                });
                                folderCount++;
                            }
                            let response = {
                                resources: {
                                    workspaces: [
                                        {
                                            model: "workspace",
                                            id: "GENERATE_ID::WORKSPACE_0",
                                            name: "New Collection",
                                        },
                                    ],
                                    environments: [
                                        {
                                            id: "GENERATE_ID::ENVIRONMENT_0",
                                            model: "environment",
                                            name: "Global Variables",
                                            variables: [],
                                            workspaceId: "GENERATE_ID::WORKSPACE_0",
                                        },
                                    ],
                                    folders: folders,
                                    httpRequests: requests,
                                    grpcRequests: [],
                                    websocketRequests: [],
                                },
                            };
                            return resolve(response);
                        });
                        // todo zip content in directory
                        zipfile.end();
                    }
                    catch (e) {
                        console.error(e);
                        _ctx.toast.show({ message: `error: ${JSON.stringify(e)}` });
                        reject();
                    }
                });
            });
            await myPromise.then(() => {
                _ctx.toast.show({ message: "SOAP Import Complete" });
            });
            return myPromise;
        },
    },
};
exports.plugin.importer?.onImport({
    clipboard: {
        copyText: function (text) {
            throw new Error("Function not implemented.");
        },
    },
    toast: {
        show: function (args) {
            throw new Error("Function not implemented.");
        },
    },
    prompt: {
        text: function (args) {
            throw new Error("Function not implemented.");
        },
    },
    store: {
        set: function (key, value) {
            throw new Error("Function not implemented.");
        },
        get: function (key) {
            throw new Error("Function not implemented.");
        },
        delete: function (key) {
            throw new Error("Function not implemented.");
        },
    },
    window: {
        openUrl: function (args) {
            throw new Error("Function not implemented.");
        },
    },
    httpRequest: {
        send: function (args) {
            throw new Error("Function not implemented.");
        },
        getById: function (args) {
            throw new Error("Function not implemented.");
        },
        render: function (args) {
            throw new Error("Function not implemented.");
        },
    },
    httpResponse: {
        find: function (args) {
            throw new Error("Function not implemented.");
        },
    },
    templates: {
        render: function (args) {
            throw new Error("Function not implemented.");
        },
    },
}, 
// {
//   "text": `{
//     "urls": [
//         "http://www.dneonline.com/calculator.asmx?WSDL"
//     ],
//     "name": "Demo Workspace"
// }`
{
    "text": `{
      "urls": [
        "http://acg-r02-dit-osb.myac.gov.au:80/AgedCare/Client?WSDL"
      ],
     "name": "Demo Workspace"
   }`
});
//# sourceMappingURL=index.js.map