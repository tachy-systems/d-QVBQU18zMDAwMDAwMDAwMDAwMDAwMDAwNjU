import {S3Client, GetObjectCommand, ListObjectsV2Command} from "@aws-sdk/client-s3";
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";
const s3Client = new S3Client({region: AWS_REGION});
import * as s3Data from "./s3Data.json";
import {TYPES} from "@cny-common/aws.cdk.ts";

export async function listAndReadS3Files() {
     try {
          const {Bucket, Prefix} = s3Data;
          const listCommand = new ListObjectsV2Command({Bucket, Prefix});
          const listResponse = await s3Client.send(listCommand);

          if (!listResponse.Contents) {
               console.log("No files found in the bucket.");
               return [];
          }

          const fileContentsArray: any[] = [];

          for (const object of listResponse.Contents) {
               const fileKey = object.Key;
               console.log(`Reading file: ${fileKey}`);

               const getObjectCommand = new GetObjectCommand({Bucket, Key: fileKey});
               const getObjectResponse = await s3Client.send(getObjectCommand);

               const bodyContents = await getObjectResponse.Body!.transformToString();
               fileContentsArray.push(JSON.parse(bodyContents));
          }

          return transformInputArray(fileContentsArray);
     } catch (error) {
          console.error("Error retrieving files from S3:", error);
          return [];
     }
}

function transformInputArray(arr:  any[]) {
     const endpointArray: any[] = [];

     for (const item of arr) {
          const stackName = Object.keys(item)[0];
          const apigatewayName = Object.keys(item[stackName])[0];
          const {endpoint} = item[stackName][apigatewayName];
          endpointArray.push(endpoint);
     }

     const endpointData = arr[0];
     const stackName = Object.keys(endpointData)[0];
     const apigatewayName = Object.keys(endpointData[stackName])[0];
     delete endpointData[stackName][apigatewayName].endpoint;
     endpointData[stackName][apigatewayName]["endpointsInfoArray"] = endpointArray;

     return endpointData;
}
