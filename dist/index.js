"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const apiconnect_wsdl_1 = require("apiconnect-wsdl");
const axios_1 = __importDefault(require("axios"));
const xml2js_1 = __importDefault(require("xml2js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const zip_a_folder_1 = require("zip-a-folder");
async function downloadWsdlAndImports(wsdlUrl, targetDir) {
    try {
        const response = await axios_1.default.get(wsdlUrl);
        const wsdlContent = response.data;
        const fileName = path_1.default.basename(new URL(wsdlUrl).pathname);
        fs_1.default.writeFileSync(path_1.default.join(targetDir, fileName), wsdlContent);
        const parser = new xml2js_1.default.Parser();
        const result = await parser.parseStringPromise(wsdlContent);
        // Find and download WSDL imports
        if (result["wsdl:definitions"] &&
            result["wsdl:definitions"]["wsdl:import"]) {
            for (const imp of result["wsdl:definitions"]["wsdl:import"]) {
                const importLocation = imp["$"].location;
                const importedUrl = new URL(importLocation, wsdlUrl).href;
                await downloadWsdlAndImports(importedUrl, targetDir); // Recursive call
            }
        }
        // Find and download XSD imports (within types section)
        if (result["wsdl:definitions"] &&
            result["wsdl:definitions"]["wsdl:types"] &&
            result["wsdl:definitions"]["wsdl:types"][0]["xsd:schema"] &&
            result["wsdl:definitions"]["wsdl:types"][0]["xsd:schema"][0]["xsd:import"]) {
            for (const imp of result["wsdl:definitions"]["wsdl:types"][0]["xsd:schema"][0]["xsd:import"]) {
                const schemaLocation = imp["$"].schemaLocation;
                const importedUrl = new URL(schemaLocation, wsdlUrl).href;
                await downloadWsdlAndImports(importedUrl, targetDir); // Recursive call
            }
        }
        console.log(`Downloaded: ${wsdlUrl}`);
    }
    catch (error) {
        console.error(`Error downloading ${wsdlUrl}:`, error.message);
    }
}
function zipDirectory(inputDir, outZip) {
    const output = fs_1.default.createWriteStream(outZip);
    const archive = (0, archiver_1.default)('zip');
    output.on("close", function () {
        console.log(archive.pointer() + " total bytes");
        console.log("Archiver has been finalized and the output file descriptor has closed.");
    });
    archive.on("error", function (err) {
        throw err;
    });
    archive.pipe(output);
    archive.directory(inputDir, false); // 'false' means don't include the parent directory in the archive root
    archive.finalize();
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
                        let urlData = await fetch(url);
                        let urlText = await urlData.text();
                        fs_1.default.mkdir(`./_temp${idx}`, { recursive: true }, (err) => {
                            if (err) {
                                console.error("Error creating directory:", err);
                                return;
                            }
                            console.log("Directory created successfully!");
                        });
                        await downloadWsdlAndImports(url, `./_temp${idx}`);
                        var jim = await (0, apiconnect_wsdl_1.introspectWSDL)(url);
                        await (0, zip_a_folder_1.zip)(`./_temp${idx}/`, `_temp${idx}.zip`);
                        // todo zip content in directory
                        const wsdls = await (0, apiconnect_wsdl_1.getJsonForWSDL)(`_temp${idx}.zip`);
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
}, {
    "text": `{
      "urls": [
          "http://www.dneonline.com/calculator.asmx?WSDL"
      ],
      "name": "Demo Workspace"
  }`
    //   {
    //     "text": `{
    //       "urls": [
    //         "https://acg-r02-dit-osb.myac.gov.au/AgedCare/Client?WSDL",
    //         "https://acg-r02-dit-osb.myac.gov.au/AgedCare/SupportPlan?WSDL"
    //       ],
    //      "name": "Demo Workspace"
    //    }`
});
//# sourceMappingURL=index.js.map