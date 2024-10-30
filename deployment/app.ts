#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {TYPES} from "@cny-common/aws.cdk.ts";
import {ApiGenStack} from "./ApiGenStack";
import {generateResourceName} from "@cny-helpers/nodejs";
import {listAndReadS3Files} from "./helpers";

const app = new cdk.App();

listAndReadS3Files().then((data) => {
     if (typeof data === "string") {
          throw new Error("Error while fetching input data ");
     } else {
          const extendedGroupEndpoints: TYPES.ExtendedGroupEndpoints = data;
          for (const [deploymentGroup, deploymentGroupObj] of Object.entries(extendedGroupEndpoints)) {
               const gatewayName = Object.keys(deploymentGroupObj)[0];
               const {stage, productShortName, orgShortName} = deploymentGroupObj[gatewayName];
               const stackName = generateResourceName({
                    stage,
                    productShortName,
                    orgShortName,
                    resourceConstant: `${deploymentGroup}`
               });

               const stack = new ApiGenStack(app, stackName, extendedGroupEndpoints);
               stack.deploy();
          }
     }
});
