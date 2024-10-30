import * as fs from "fs";
import { ApiGatewayV2Client, GetApisCommand } from "@aws-sdk/client-apigatewayv2";
import { ENUMS, TYPES, WriterFactory } from "@cny-common/aws.cdk.ts";

const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";
const client = new ApiGatewayV2Client({ region: AWS_REGION });
const API_GATEWAYS_FETCH_LIMIT = "100";

const extendedEndpointsData: TYPES.ExtendedGroupEndpoints = JSON.parse(fs.readFileSync("../inputs/inputs.json", "utf-8"));

const inputData: TYPES.ExtendedGroupEndpoints[] = [extendedEndpointsData];
export class ApiCodeGenOutputWriter {
     protected outputType: ENUMS.WriterType;
     protected endpoints: TYPES.ExtendedEndpoint[];
     protected outputData: TYPES.OutputData[] = [];
     protected outputFileDirectory: string;

     constructor() {
          this.outputFileDirectory = "../outputs";
          this.outputType = ENUMS.WriterType.JSON;
     }

     async writeOutputFile(): Promise<void> {
          await this.createOutputData();
          await this.generateOutputFile();
     }

     async createOutputData() {
          for (const input of inputData) {
               for (const [deploymentGroup, deploymentGroupObj] of Object.entries(input)) {
                    for (const [gatewayGroup, gatewayGroupObj] of Object.entries(deploymentGroupObj)) {
                         this.outputType = gatewayGroupObj.outputType!;
                         const endpoints = gatewayGroupObj.endpointsInfoArray;
                         for (const endpoint of endpoints) {
                              let endpointData: TYPES.OutputData = <TYPES.OutputData>{};
                              endpointData["id"] = endpoint.id!;
                              endpointData["endpointId"] = endpoint.endpointId;
                              endpointData["stackName"] = deploymentGroup;
                              endpointData["projectName"] = endpoint.projectName;
                              endpointData["projectShortName"] = endpoint.projectShortName;
                              endpointData["resourceName"] = endpoint.resourceName;
                              endpointData["method"] = endpoint.httpMethod;
                              if (endpoint.pathPrefix != "" && endpoint.path === "/") {
                                   endpoint.path = "";
                              }
                              if (endpoint.serverUrl != ENUMS.DeploymentType.AWS) {
                                   endpointData[
                                        "url"
                                   ] = `https://${endpoint.serverUrl}/${endpoint.resourceName}${endpoint.pathPrefix}${endpoint.path}`;
                              }
                              endpointData["awsUrl"] = `https://${await getApiId(
                                   `${gatewayGroup}-${endpoint.stage}`
                              )}.execute-api.${gatewayGroupObj.region}.amazonaws.com${endpoint.pathPrefix}${endpoint.path}`;
                              this.outputData.push(endpointData);
                         }
                    }
               }
          }
     }

     async generateOutputFile() {
          const { outputFileDirectory, outputData, outputType } = this;
          const outputWriter = WriterFactory.create(outputType, { outputFileDirectory, outputData });
          console.log("Writing output data\n");
          await outputWriter.writeData();
     }
}

const apiCodeGenOutputWriter = new ApiCodeGenOutputWriter();
apiCodeGenOutputWriter.writeOutputFile();

async function getApiId(apiGatewayName: string) {

     try {
          const command = new GetApisCommand({ MaxResults: API_GATEWAYS_FETCH_LIMIT });
          const response = await client.send(command);

          if (!response.Items) {
               return null;
          }

          for (const item of response.Items) {
               if (item.Name === apiGatewayName) {
                    return item.ApiId;
               }
          }
          return null;
     } catch (error) {
          console.log("Error happened while getting apiId from cloudformation");
          console.log(error);
          throw new Error(`Error happened while getting apiId from cloudformation: ${error}`);
     }
}
