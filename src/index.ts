import type {
  Context,
  Folder,
  HttpRequest,
  PluginDefinition,
} from "@yaakapp/api";
import {
  getJsonForWSDL,
  getWSDLServices,
  findWSDLForServiceName,
  getSwaggerForService,
} from "apiconnect-wsdl";
import { ImportPluginResponse } from "@yaakapp/api/lib/plugins/ImporterPlugin";

type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

type RootFields = "name" | "id" | "model";
type CommonFields = RootFields | "workspaceId";

interface ImportStructure {
  urls: Array<string>;
  name: string;
}

export const plugin: PluginDefinition = {
  importer: {
    name: "soapWSDLs",
    description: "Import SOAP WSDL URLs",
    async onImport(_ctx: Context, args: { text: string }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let importFile: ImportStructure = JSON.parse(args.text);

      let folders: Array<AtLeast<Folder, CommonFields>> = [];
      let folderCount = 0;
      let requests: Array<AtLeast<HttpRequest, CommonFields>> = [];
      let requestCount = 0;
      const myPromise = new Promise<ImportPluginResponse>((resolve, reject) => {
        importFile?.urls.forEach(async (url) => {
          try {
            const wsdls = await getJsonForWSDL(url);
            const serviceData = getWSDLServices(wsdls);


            let items: Array<AtLeast<HttpRequest, CommonFields>> = [];
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
              
              Object.entries(swagger.paths).forEach((ent:Array<any>) => {
                const req = ent[1].post;
                const inputLoc = (req.parameters).find(a => a.in == 'body');
                const schemaRef = inputLoc.schema.$ref;
                const inputs = schemaRef.substring(schemaRef.lastIndexOf("/")+1);
                requests.push({                  
                    model: "http_request",
                    id: `GENERATE_ID::HTTP_REQUEST_${requestCount}`,
                    workspaceId: "GENERATE_ID::WORKSPACE_0",
                    folderId: `GENERATE_ID::FOLDER_${folderCount}`,
                    name: req.operationId,
                    method: "POST",
                    url: `${url.replace("?WSDL", "")}${ent[0]}`,
                    urlParameters: [],
                    body: {text: swagger.definitions[inputs].example},
                    bodyType: "text/xml",
                    authentication: {},
                    authenticationType: null,
                    headers: [],
                    description: req.description,
                })
                requestCount++
              })
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
            _ctx.toast.show({message: JSON.stringify(e)})
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
