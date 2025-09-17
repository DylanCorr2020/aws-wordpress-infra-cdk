#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/VPCstack";

const app = new cdk.App();

const vpcStack = new VpcStack(app, "VpcStack");
