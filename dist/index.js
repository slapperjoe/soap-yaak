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
const headerFile = [
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FMessagingObjects%2FClient%2FAgedCare.Client.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FPerson%2FClient.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FAddress%2FAddress.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.Types.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FService%2FService.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FAttachment%2FAttachment.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FInteraction%2FInteractions.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.BusinessMessage.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FPerson%2FEmployee.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FOutlet.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FReference%2FReference.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FABNDetails.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FLegalDetails.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FStatusDetails.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FContactDetails.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FContact%2FContact.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FCulturalSpecialisations.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FReligiousSpecialisations.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FOrganisation.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FPerson%2FPerson.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FEnterprise.Models%2FResources%2FInternal%2FSchemas%2FMessagingObjects%2FAttachment%2FEnterprise.Attachment_v3.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FEnterprise.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FAttachment%2FAttachment_v3.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FEnterprise.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FEnterprise.BusinessMessage.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FClassification%2FAgedCare.Classification.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FIncorporationDetails.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FContract.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FSpecialisations.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.Types_v2.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FNotification%2FNotification.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FOrganisation%2FNNCAndSanctions.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FCarePlan%2FAgedCare.CarePlan.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FAssessment%2FAgedCare.Assessment.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FReferral%2FAgedCare.AssessmentReferral.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FReferral%2FReferral.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FSupportPlan%2FSupportPlanReview.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FPerson%2FAgedCare.Client.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FFundingAssessment%2FAgedCare.FundingAssessment.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FSupportPlan%2FAgedCare.SupportPlan.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FBusinessObjects%2FDelegateApproval%2FAgedCare.DelegateApproval.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FMessagingObjects%2FClient%2FAgedCare.ClientReferrals.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.Header.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.Fault.xsd",
    "http:/acg-r02-dit-osb.myac.gov.au/AgedCare/Client?SCHEMA%2FAgedCare.Models%2FResources%2FInternal%2FSchemas%2FCommon%2FCommon.AuditHeader.xsd",
];
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
                        await (0, downloadWsdlAndImports_1.downloadWsdlAndImports)(url, "", zipfile, headerSet);
                        //var jim = await introspectWSDL(url);
                        zipfile.outputStream
                            .pipe(fs_1.default.createWriteStream("bob.zip"))
                            .on("error", async (e, a) => {
                            debugger;
                        })
                            .on("close", async () => {
                            console.log("done");
                            const wsdls = await (0, apiconnect_wsdl_1.getJsonForWSDL)(`bob.zip`, undefined, {
                                apiFromXSD: true,
                                allowExtraFiles: true,
                                implicitHeaderFiles: headerSet, //headerFile,
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
   }`,
});
//# sourceMappingURL=index.js.map