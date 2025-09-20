import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new VPC with 2 Availability Zones
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,

      // Define subnets to be created in the VPC
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    //Sceurity Groups
    const ec2SecurityGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc: vpc,
      allowAllOutbound: true,
      description: "Security group for WP-Instance in public subnet",
    });
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS"
    );
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP"
    );

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

    //Create EC2 instance in public subnet
    const instance1 = new ec2.Instance(this, "WP-Instance", {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },

      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SecurityGroup,
      userData: userData,
    });

    //Outputs of CDK Stack
    new cdk.CfnOutput(this, "VpcId", {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: instance1.instancePublicIp,
    });

    new cdk.CfnOutput(this, "InstancePublicDns", {
      value: instance1.instancePublicDnsName,
    });
  }
}
