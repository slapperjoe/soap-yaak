import type {
  Context,
  FindHttpResponsesRequest,
  FindHttpResponsesResponse,
  Folder,
  GetHttpRequestByIdRequest,
  GetHttpRequestByIdResponse,
  HttpRequest,
  OpenWindowRequest,
  PluginDefinition,
  PromptTextRequest,
  PromptTextResponse,
  RenderHttpRequestRequest,
  RenderHttpRequestResponse,
  SendHttpRequestRequest,
  SendHttpRequestResponse,
  ShowToastRequest,
  TemplateRenderRequest,
  TemplateRenderResponse,
} from "@yaakapp/api";
import {
  getJsonForWSDL,
  getWSDLServices,
  findWSDLForServiceName,
  getSwaggerForService,
  introspectWSDL,
} from "apiconnect-wsdl";
import { ImportPluginResponse } from "@yaakapp/api/lib/plugins/ImporterPlugin";

import fs from "fs";
import path from "path";
import yazl from "yazl";
import { downloadWsdlAndImports } from "./downloadWsdlAndImports";
import { ImportSource } from "./ImportSource";

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

type RootFields = "name" | "id" | "model";
type CommonFields = RootFields | "workspaceId";

interface ImportStructure {
  urls: Array<string>;
  name: string;
  workspaceId?: string;
  urlReplace?: [{ key: string; value: string }];
}

/**
 * Creates a 10-character, non-cryptographic hash from a string.
 *
 * @param {string} inputString The string to hash.
 * @returns {string} A 10-character hash containing [a-z, A-Z, 0-9].
 */
function createHash(inputString: string | undefined) {
  if (!inputString) return null;
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


export const plugin: PluginDefinition = {
  importer: {
    name: "soapWSDLs",
    description: "Import SOAP WSDL URLs",
    async onImport(_ctx: Context, args: { text: string }) {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let importFile: ImportStructure = JSON.parse(args.text);

      let folders: Array<AtLeast<Folder, CommonFields>> = [];
      let folderCount = 0;
      let requests: Array<AtLeast<HttpRequest, CommonFields>> = [];
      let requestCount = 0;

      let zipFiles: Array<string> = [];
      const myPromise = new Promise<ImportPluginResponse>(async (resolve, reject) => {
        let idx = 0;
        for (const url of importFile?.urls) {
          await new Promise<Boolean>(async (resolve2, reject2) => {
            try {
              idx++;
              const zipfile = new yazl.ZipFile();
              const zipName = idx + "-" + (new Date()).getTime() + ".zip";

              let headerSet: Array<ImportSource> = [];
              try {
                await downloadWsdlAndImports(url, zipfile, headerSet);
              } catch (e: any) {
                _ctx.toast.show({ message: `${e.message}` });  
                resolve2(false);
              }

              console.log(`${zipName} created for ${url}.`);

              zipfile.outputStream
                .pipe(fs.createWriteStream(zipName))
                .on("error", async (e: any, a: any) => {
                  debugger;
                })
                .on("close", async () => {
                  console.log("done");
                  try {
                    const wsdls = await getJsonForWSDL(zipName, undefined, {
                      apiFromXSD: true,
                      allowExtraFiles: true,
                      implicitHeaderFiles: headerSet.filter(a => !a.isWSDL).map(a => a.hashFile), //headerFile,
                    });
                    const wsdlSet = [wsdls.find((a: any) => Object.keys(a.namespaces).length > 0)];
                    const serviceData = getWSDLServices(wsdlSet);
                  

                    // Loop through all services
                    for (const item in serviceData.services) {
                      const svcName = serviceData.services[item].service;
                      console.log(`Adding ${svcName}`);
                      const wsdlId = serviceData.services[item].filename;
                      const wsdlEntry = findWSDLForServiceName(wsdls, svcName);
                      const swaggerOptions = {
                        inlineAttributes: true,
                        suppressExamples: false,
                        type: "wsdl",
                        wssecurity: true,
                      };

                      folders.push({
                        model: "folder" as const,
                        workspaceId: importFile.workspaceId || "GENERATE_ID::WORKSPACE_0",
                        folderId: null,
                        sortPriority: folders.length,
                        name: svcName,
                        id: `fl_${createHash(svcName)}`,
                      });

                      const swagger = getSwaggerForService(
                        wsdlEntry,
                        svcName,
                        wsdlId,
                        swaggerOptions
                      );
                      delete swagger.info["x-ibm-name"];
                      delete swagger["x-ibm-configuration"];

                      const reqDateString = (new Date()).toISOString();

                      Object.entries(swagger.paths).forEach((ent: Array<any>) => {
                        const req = ent[1].post;
                        const inputLoc = req.parameters.find(
                          (a: any) => a.in == "body"
                        );
                        const schemaRef = inputLoc.schema.$ref;
                        const inputs = schemaRef.substring(
                          schemaRef.lastIndexOf("/") + 1
                        );

                        folders.push({
                          model: "folder" as const,
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
                  } catch (e: any){                    
                    _ctx.toast.show({ message: `Failed to import: ${e.message}` });  
                    resolve2(false);
                  }
                });

              zipfile.end();
              zipFiles.push(zipName);
            } catch (e: any) {
              _ctx.toast.show({ message: `Failed to import: ${e.message}` });  
              reject2(false);
            }
          });
        };
        let response: ImportPluginResponse = {
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
        zipFiles.forEach(a => {
          fs.unlink(a, (err) => _ctx.toast.show({message: `Unable to delete: ${a}: ${err}`}));
        })
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

function modifyUrl(url: string, replacements: Array<{ key: string; value: string }>): string {
  let modifiedUrl = url;
  replacements.forEach((replacement) => {
    modifiedUrl = modifiedUrl.replace(new RegExp(replacement.value, 'g'), `{{${replacement.key}}}`);
  });
  return modifiedUrl.replace("?WSDL", "");
}

plugin.importer?.onImport(
  {
    clipboard: {
      copyText: function (text: string): Promise<void> {
        throw new Error("Function not implemented.");
      },
    },
    toast: {
      show: function (args: ShowToastRequest): Promise<void> {
        console.log(args.message);
        return Promise.resolve();
      },
    },
    prompt: {
      text: function (
        args: PromptTextRequest
      ): Promise<PromptTextResponse["value"]> {
        throw new Error("Function not implemented.");
      },
    },
    store: {
      set: function <T>(key: string, value: T): Promise<void> {
        throw new Error("Function not implemented.");
      },
      get: function <T>(key: string): Promise<T | undefined> {
        throw new Error("Function not implemented.");
      },
      delete: function (key: string): Promise<boolean> {
        throw new Error("Function not implemented.");
      },
    },
    window: {
      openUrl: function (
        args: OpenWindowRequest & {
          onNavigate?: (args: { url: string }) => void;
          onClose?: () => void;
        }
      ): Promise<{ close: () => void }> {
        throw new Error("Function not implemented.");
      },
    },
    httpRequest: {
      send: function (
        args: SendHttpRequestRequest
      ): Promise<SendHttpRequestResponse["httpResponse"]> {
        throw new Error("Function not implemented.");
      },
      getById: function (
        args: GetHttpRequestByIdRequest
      ): Promise<GetHttpRequestByIdResponse["httpRequest"]> {
        throw new Error("Function not implemented.");
      },
      render: function (
        args: RenderHttpRequestRequest
      ): Promise<RenderHttpRequestResponse["httpRequest"]> {
        throw new Error("Function not implemented.");
      },
    },
    httpResponse: {
      find: function (
        args: FindHttpResponsesRequest
      ): Promise<FindHttpResponsesResponse["httpResponses"]> {
        throw new Error("Function not implemented.");
      },
    },
    templates: {
      render: function (
        args: TemplateRenderRequest
      ): Promise<TemplateRenderResponse["data"]> {
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
        "http://acg-r02-dit-osb.myac.gov.au:80/AgedCare/ServiceReferral?WSDL"
      ],
      "name": "Demo Workspace",
      "workspaceId": "testwrkspc",
      "urlReplace":[{
          "key": "environment",
          "value": "dit"        
      }]
    }`,
  }
);

