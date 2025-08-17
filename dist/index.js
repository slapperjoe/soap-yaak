"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const apiconnect_wsdl_1 = require("apiconnect-wsdl");
const fs_1 = __importDefault(require("fs"));
const yazl_1 = __importDefault(require("yazl"));
const downloadWsdlAndImports_1 = require("./downloadWsdlAndImports");
/**
 * Creates a 10-character, non-cryptographic hash from a string.
 *
 * @param {string} inputString The string to hash.
 * @returns {string} A 10-character hash containing [a-z, A-Z, 0-9].
 */
function createHash(inputString) {
    if (!inputString)
        return null;
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let hash = 0;
    let result = '';
    if (inputString.length === 0) {
        return 'a'.repeat(10); // Return a default for empty strings
    }
    // A simple algorithm (variant of djb2) to create an initial integer hash
    for (let i = 0; i < inputString.length; i++) {
        const charCode = inputString.charCodeAt(i);
        hash = (hash << 5) - hash + charCode;
        hash |= 0; // Convert to 32bit integer
    }
    // Use the integer hash to select 10 characters from the charSet
    for (let i = 0; i < 10; i++) {
        const index = Math.abs(hash) % charSet.length;
        result += charSet[index];
        // Alter the hash for the next character to avoid repetition
        hash = (hash << 3) - hash + i;
        hash |= 0;
    }
    return result;
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
            const myPromise = new Promise(async (resolve, reject) => {
                let idx = 0;
                for (const url of importFile?.urls) {
                    await new Promise(async (resolve2, reject2) => {
                        try {
                            idx++;
                            const zipfile = new yazl_1.default.ZipFile();
                            const zipName = idx + "-" + (new Date()).getTime() + ".zip";
                            let headerSet = [];
                            try {
                                await (0, downloadWsdlAndImports_1.downloadWsdlAndImports)(url, zipfile, headerSet);
                            }
                            catch (e) {
                                _ctx.toast.show({ message: `${e.message}` });
                                resolve2(false);
                            }
                            console.log(`${zipName} created for ${url}.`);
                            zipfile.outputStream
                                .pipe(fs_1.default.createWriteStream(zipName))
                                .on("error", async (e, a) => {
                                debugger;
                            })
                                .on("close", async () => {
                                console.log("done");
                                try {
                                    const wsdls = await (0, apiconnect_wsdl_1.getJsonForWSDL)(zipName, undefined, {
                                        apiFromXSD: true,
                                        allowExtraFiles: true,
                                        implicitHeaderFiles: headerSet.filter(a => !a.isWSDL).map(a => a.hashFile), //headerFile,
                                    });
                                    const wsdlSet = [wsdls.find((a) => Object.keys(a.namespaces).length > 0)];
                                    const serviceData = (0, apiconnect_wsdl_1.getWSDLServices)(wsdlSet);
                                    // Loop through all services
                                    for (const item in serviceData.services) {
                                        const svcName = serviceData.services[item].service;
                                        console.log(`Adding ${svcName}`);
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
                                            workspaceId: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
                                            folderId: null,
                                            sortPriority: folders.length,
                                            name: svcName,
                                            id: `fl_${createHash(svcName)}`,
                                        });
                                        const swagger = (0, apiconnect_wsdl_1.getSwaggerForService)(wsdlEntry, svcName, wsdlId, swaggerOptions);
                                        delete swagger.info["x-ibm-name"];
                                        delete swagger["x-ibm-configuration"];
                                        const reqDateString = (new Date()).toISOString();
                                        Object.entries(swagger.paths).forEach((ent) => {
                                            const req = ent[1].post;
                                            const inputLoc = req.parameters.find((a) => a.in == "body");
                                            const schemaRef = inputLoc.schema.$ref;
                                            const inputs = schemaRef.substring(schemaRef.lastIndexOf("/") + 1);
                                            folders.push({
                                                model: "folder",
                                                workspaceId: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
                                                folderId: `fl_${createHash(svcName)}`,
                                                sortPriority: folders.length,
                                                name: req.operationId,
                                                description: `${req.summary} - ${req.description}`,
                                                id: `fl_${createHash(req.operationId)}`,
                                            });
                                            requests.push({
                                                model: "http_request",
                                                id: `GENERATE_ID::HTTP_REQUEST_${requestCount}`,
                                                workspaceId: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
                                                folderId: `fl_${createHash(req.operationId)}`,
                                                name: reqDateString,
                                                method: "POST",
                                                url: `${modifyUrl(url, importFile.urlReplace || [])}${ent[0]}`,
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
                                        _ctx.toast.show({ message: `${svcName} imported.` });
                                        resolve2(true);
                                    }
                                }
                                catch (e) {
                                    _ctx.toast.show({ message: `Failed to import: ${e.message}` });
                                    resolve2(false);
                                }
                            });
                            zipfile.end();
                        }
                        catch (e) {
                            _ctx.toast.show({ message: `Failed to import: ${e.message}` });
                            reject2(false);
                        }
                    });
                }
                ;
                let response = {
                    resources: {
                        workspaces: [
                            {
                                model: "workspace",
                                id: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
                                name: importFile.name || "New Collection",
                            },
                        ],
                        environments: [
                            {
                                id: `en_${createHash(importFile.workspaceId)}`,
                                model: "environment",
                                base: false,
                                name: "GlobalX Variables",
                                variables: (importFile.urlReplace || []).map((a) => {
                                    return { name: a.key, value: a.value };
                                }) || [],
                                workspaceId: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
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
            await myPromise.then(() => {
                console.log("SOAP Import Complete");
                _ctx.toast.show({ message: "SOAP Import Complete" });
            });
            return myPromise;
        },
    },
};
function modifyUrl(url, replacements) {
    let modifiedUrl = url;
    replacements.forEach((replacement) => {
        modifiedUrl = modifiedUrl.replace(new RegExp(replacement.value, 'g'), `{{${replacement.key}}}`);
    });
    return modifiedUrl.replace("?WSDL", "");
}
exports.plugin.importer?.onImport({
    clipboard: {
        copyText: function (text) {
            throw new Error("Function not implemented.");
        },
    },
    toast: {
        show: function (args) {
            console.log(args.message);
            return Promise.resolve();
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
        "http://acg-r02-dit-osb.myac.gov.au:80/AgedCare/OrganisationApplications?WSDL",
        "http://acg-r02-dit-osb.myac.gov.au:80/AgedCare/ServiceReferral?WSDL"
      ],
      "name": "Demo Workspace",
      "workspaceId": "testwrkspc",
      "urlReplace":[{
          "key": "environment",
          "value": "dit"        
      }]
    }`,
});
//SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.Header
//# sourceMappingURL=index.js.map