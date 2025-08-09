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
  introspectWSDL
} from "apiconnect-wsdl";
import { ImportPluginResponse } from "@yaakapp/api/lib/plugins/ImporterPlugin";

import axios from "axios";
import xml2js from "xml2js";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { zip } from 'zip-a-folder';
import yazl from "yazl";

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

type RootFields = "name" | "id" | "model";
type CommonFields = RootFields | "workspaceId";

interface ImportStructure {
  urls: Array<string>;
  name: string;
}

async function downloadWsdlAndImports(wsdlUrl: string, targetDir: string, zipfile: any, headerSet: Array<string>) {
  try {
    const response = await fetch(wsdlUrl.replace(".xsd", ""))

    const wsdlContent = await response.text();

    const filePath = wsdlUrl.indexOf("?WSDL") > -1 ? wsdlUrl.replace("?WSDL", ".wsdl") : wsdlUrl;// + ".xsd";// path.basename(new URL(wsdlUrl).pathname);
    //fs.writeFileSync(path.join(targetDir, fileName), wsdlContent);


    zipfile.addBuffer(Buffer.from(wsdlContent), filePath);
    //archiver.append(wsdlContent, {name: wsdlUrl.replace("?WSDL",".wsdl").replaceAll("/","\\/")}); 

    //zipStuff(wsdlContent, wsdlUrl, "happy.zip")

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(wsdlContent);

    const headElement = Object.keys(result)[0];
    const headNamespace = headElement?.substring(0, headElement.indexOf(':'));

    // Find and download WSDL imports
    if (
      (result[`${headNamespace}:definitions`] &&
        result[`${headNamespace}:definitions`][`${headNamespace}:import`])
    ) {
      for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:import`]) {
        const importLocation = imp["$"].location;
        const importedUrl = new URL(importLocation, wsdlUrl).href.replace("//", "/");
        if (headerSet.indexOf(importedUrl) == -1) {
          headerSet.push(importedUrl);
          await downloadWsdlAndImports(importedUrl, importLocation.substring(0, importLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
        }
      }
    }

    if (

      (result[`${headNamespace}:schema`] &&
        result[`${headNamespace}:schema`][`${headNamespace}:import`])
    ) {
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
    if ((
      result[`${headNamespace}:definitions`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`] &&
      result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][`xsd:schema`][0][`xsd:import`])
    ) {
      for (const imp of result[`${headNamespace}:definitions`][`${headNamespace}:types`][0][
        "xsd:schema"
      ][0]["xsd:import"]) {
        const schemaLocation = (imp["$"].schemaLocation += ".xsd");
        const importedUrl = new URL(schemaLocation, wsdlUrl).href.replace("//", "/");
        if (headerSet.indexOf(importedUrl) == -1) {
          headerSet.push(importedUrl);
          await downloadWsdlAndImports(importedUrl, schemaLocation.substring(0, schemaLocation.lastIndexOf("/")), zipfile, headerSet); // Recursive call
        }
      }
    }

    if (
      (result[`${headNamespace}:schema`] &&
        result[`${headNamespace}:schema`][`${headNamespace}:include`])
    ) {
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
  } catch (error: any) {
    console.error(`Error downloading ${wsdlUrl}:`, error.message);
  }
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
      const myPromise = new Promise<ImportPluginResponse>((resolve, reject) => {
        importFile?.urls.forEach(async (url, idx) => {
          try {
            const zipfile = new yazl.ZipFile();

            let headerSet: Array<string> = [];
            //const wsdls = await getJsonForWSDL(`bob.zip`);
            await downloadWsdlAndImports(url, "", zipfile, headerSet);
            //var jim = await introspectWSDL(url);

            zipfile.outputStream.pipe(fs.createWriteStream("bob.zip")).on("error", async (e: any, a: any) => {
              debugger;
            }).on("close", async () => {
              console.log("done");
              const wsdls = await getJsonForWSDL(`bob.zip`, undefined, {
                apiFromXSD: true,
                allowExtraFiles: true,
                implicitHeaderFiles: headerSet
              });
              const serviceData = getWSDLServices(wsdls);

              // Loop through all services
              for (const item in serviceData.services) {
                // eslint-disable-line
                const svcName = serviceData.services[item].service;
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
                  workspaceId: "GENERATE_ID::WORKSPACE_0",
                  folderId: null,
                  sortPriority: -Date.now(),
                  name: svcName,
                  id: `GENERATE_ID::FOLDER_${folderCount}`,
                });

                const swagger = getSwaggerForService(
                  wsdlEntry,
                  svcName,
                  wsdlId,
                  swaggerOptions
                );
                delete swagger.info["x-ibm-name"];
                delete swagger["x-ibm-configuration"];

                Object.entries(swagger.paths).forEach((ent: Array<any>) => {
                  const req = ent[1].post;
                  const inputLoc = req.parameters.find((a: any) => a.in == "body");
                  const schemaRef = inputLoc.schema.$ref;
                  const inputs = schemaRef.substring(
                    schemaRef.lastIndexOf("/") + 1
                  );
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

              let response: ImportPluginResponse = {
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
            })
            // todo zip content in directory

            zipfile.end();

          } catch (e) {
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

plugin.importer?.onImport(
  {
    clipboard: {
      copyText: function (text: string): Promise<void> {
        throw new Error("Function not implemented.");
      },
    },
    toast: {
      show: function (args: ShowToastRequest): Promise<void> {
        throw new Error("Function not implemented.");
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
        "http://acg-r02-dit-osb.myac.gov.au:80/AgedCare/Client?WSDL"
      ],
     "name": "Demo Workspace"
   }`
  }
);
