import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new VPC with 2 Availability Zones
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,

      natGateways: 1,

      // Define subnets to be created in the VPC
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    //Sceurity Groups
    const albSG = new ec2.SecurityGroup(this, "ALBSecurityGroup", {
      vpc,
      description: "Allow HTTP from internet",
      allowAllOutbound: true,
    });
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");

    const ec2SG = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc,
      description: "Allow HTTP from ALB only",
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, ec2.Port.tcp(80), "Allow ALB");

    //User Data Script on boot of WP-Instance
    const userData = ec2.UserData.forLinux();

    userData.addCommands(
      "sudo dnf update -y",
      "sudo dnf install -y httpd",
      "sudo systemctl start httpd",
      "sudo systemctl enable httpd",
      "sudo systemctl status httpd",
      "sudo dnf install -y php php-mysqlnd php-fpm php-json php-gd wget unzip mariadb105",
      "sudo systemctl restart httpd",
      "cd /var/www/html",
      "sudo wget https://wordpress.org/latest.tar.gz",
      "sudo tar -xzf latest.tar.gz",
      "sudo mv wordpress/* .",
      "sudo rm -rf wordpress latest.tar.gz",
      "sudo chown -R apache:apache /var/www/html",
      "sudo chmod -R 755 /var/www/html"
    );

    //Create EC2 instance in private subnet
    const instance1 = new ec2.Instance(this, "WP-Instance", {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },

      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SG,
      userData: userData,
    });

    //Public Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
    });

    const listener = alb.addListener("Listener", {
      port: 80,
      open: true,
    });

    listener.addTargets("WPTargets", {
      port: 80,
      targets: [new targets.InstanceTarget(instance1)],
      healthCheck: { path: "/" },
    });

    //Outputs of CDK Stack
    new cdk.CfnOutput(this, "VpcId", {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, "ALB-DNS", {
      value: alb.loadBalancerDnsName,
    });
  }
}
