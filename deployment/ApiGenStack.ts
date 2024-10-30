import {App} from "aws-cdk-lib";
import * as fileSystemPath from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import {
     TYPES,
     ENUMS,
     DiscoveryServiceDefaultData,
     DiscoveryServiceConfigurator,
     AwsServerlessStackBase
} from "@cny-common/aws.cdk.ts";
import {generateResourceName} from "@cny-helpers/nodejs";

export class ApiGenStack extends AwsServerlessStackBase {
     protected apiGatewayObj: TYPES.GateWayGroup;
     protected stackObj: {
          [gatewayGroup: string]: TYPES.GateWayGroup;
     };
     constructor(scope: App, id: string, props: TYPES.ExtendedGroupEndpoints) {
          //Setting account information:
          super(scope, id);

          //Deployment
          this.lambdaDeploymentType = ENUMS.LambdaCreationType.Asset;
          this.stackObj = Object.values(props)[0];
          this.apiGatewayObj = Object.values(this.stackObj)[0];
          this.productShortName = this.apiGatewayObj.productShortName.toLowerCase();
          this.orgShortName = this.apiGatewayObj.orgShortName?.toLowerCase();
          this.stage = this.apiGatewayObj.stage;
          this.apiGatewayName = `${Object.keys(this.stackObj)[0]}`;
          this.resourceName = this.apiGatewayObj.endpointsInfoArray[0].resourceName;
          this.endpoints = this.apiGatewayObj.endpointsInfoArray;
          this.mappingDomain = this.apiGatewayObj.serverUrl!;

          // //Development Needed:
          // this.resources = this.apiGatewayObj.resources;    //TBD
          // permissions    //TBD

          //Discovery service
          this.dsConfigurator = new DiscoveryServiceConfigurator({
               parentStack: this,
               stage: this.stage!,
               resourceName: this.resourceName,
               productShortName: this.apiGatewayObj.productShortName,
               orgShortName: this.apiGatewayObj.orgShortName
          });
          this.defaultData = new DiscoveryServiceDefaultData(props);
          this.defaultData.initializeValues();

          //Authorization
          this.isAuthorizationExists = this.apiGatewayObj.features[ENUMS.ApiFeatures.Authorization];
     }

     async doDeployment(): Promise<void> {
          const {productShortName, orgShortName, stage} = this;

          const dbName = generateResourceName({productShortName, orgShortName, stage, resourceConstant: `dummyDB`});
          //DB Creation:
          const dynamoDBTable = await this.createDynamodbTable(dbName, {
               pk: dynamodb.AttributeType.STRING,
               sk: dynamodb.AttributeType.STRING
          });

          //Apigateway Creation:
          await this.createApiGateway();

          //Assigning roles:
          const lambdaRole = new iam.Role(this, "LambdaRole-SystemManagerGetAccess", {
               assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
          });

          lambdaRole.addToPolicy(
               new iam.PolicyStatement({
                    resources: ["*"],
                    actions: [
                         "ssm:*",
                         "logs:*",
                         "dynamodb:GetItem",
                         "dynamodb:PutItem",
                         "dynamodb:Query",
                         "dynamodb:UpdateItem",
                         "dynamodb:DeleteItem"
                    ]
               })
          );

          //Lmabda Creation
          this.endpoints.forEach(async (endpoint) => {
               const environment = {
                    STAGE: this.stage!,
                    DEFAULT_DYNAMODB_TABLE: dynamoDBTable.tableName
               };

               const lambdaBundlingProps = {};
               const layer: any = [];
               const buildArgs = {};

               const lambdaPath = fileSystemPath.join(__dirname, `../lambda/${endpoint.serviceMethodName}/src/index.js`);

               await this.createNodejsLambda(
                    endpoint,
                    environment,
                    lambdaPath,
                    {},
                    lambdaRole,
                    lambdaBundlingProps,
                    layer,
                    buildArgs
               );
          });
     }
}
