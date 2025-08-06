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

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

type RootFields = "name" | "id" | "model";
type CommonFields = RootFields | "workspaceId";

interface ImportStructure {
  urls: Array<string>;
  name: string;
}

async function downloadWsdlAndImports(wsdlUrl: string, targetDir: string) {
  try {
    const response = await axios.get(wsdlUrl);
    const wsdlContent = response.data;
    const fileName = path.basename(new URL(wsdlUrl).pathname);
    fs.writeFileSync(path.join(targetDir, fileName), wsdlContent);

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(wsdlContent);

    // Find and download WSDL imports
    if (
      result["wsdl:definitions"] &&
      result["wsdl:definitions"]["wsdl:import"]
    ) {
      for (const imp of result["wsdl:definitions"]["wsdl:import"]) {
        const importLocation = imp["$"].location;
        const importedUrl = new URL(importLocation, wsdlUrl).href;
        await downloadWsdlAndImports(importedUrl, targetDir); // Recursive call
      }
    }

    // Find and download XSD imports (within types section)
    if (
      result["wsdl:definitions"] &&
      result["wsdl:definitions"]["wsdl:types"] &&
      result["wsdl:definitions"]["wsdl:types"][0]["xsd:schema"] &&
      result["wsdl:definitions"]["wsdl:types"][0]["xsd:schema"][0]["xsd:import"]
    ) {
      for (const imp of result["wsdl:definitions"]["wsdl:types"][0][
        "xsd:schema"
      ][0]["xsd:import"]) {
        const schemaLocation = imp["$"].schemaLocation;
        const importedUrl = new URL(schemaLocation, wsdlUrl).href;
        await downloadWsdlAndImports(importedUrl, targetDir); // Recursive call
      }
    }

    console.log(`Downloaded: ${wsdlUrl}`);
  } catch (error: any) {
    console.error(`Error downloading ${wsdlUrl}:`, error.message);
  }
}

function zipDirectory(inputDir: string, outZip: string) {

  const output = fs.createWriteStream(outZip);
  const archive = archiver('zip');

  output.on("close", function () {
    console.log(archive.pointer() + " total bytes");
    console.log(
      "Archiver has been finalized and the output file descriptor has closed."
    );
  });

  archive.on("error", function (err: any) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(inputDir, false); // 'false' means don't include the parent directory in the archive root
  archive.finalize();
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
            let urlData = await fetch(url);
            let urlText = await urlData.text();
            fs.mkdir(`./_temp${idx}`, { recursive: true }, (err) => {
              if (err) {
                console.error("Error creating directory:", err);
                return;
              }
              console.log("Directory created successfully!");
            });
            await downloadWsdlAndImports(url, `./_temp${idx}`);

            var jim = await introspectWSDL(url);

            await zip(`./_temp${idx}/`, `_temp${idx}.zip`)
            // todo zip content in directory
            const wsdls = await getJsonForWSDL(`_temp${idx}.zip`);
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

  {
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
   }
);
