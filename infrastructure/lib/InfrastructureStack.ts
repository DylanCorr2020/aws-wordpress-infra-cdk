import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as rds from "aws-cdk-lib/aws-rds";

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

    //EC2 Secuirty Group
    const ec2SG = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc,
      description: "Allow HTTP from ALB only",
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, ec2.Port.tcp(80), "Allow ALB");

    //RDS Secuirty Group
    const rdsSG = new ec2.SecurityGroup(this, "RDSSecuirtyGroup", {
      vpc,
      description: "Allow EC2 to connect to RDS on port 3306",
      allowAllOutbound: true,
    });
    rdsSG.addIngressRule(ec2SG, ec2.Port.tcp(3306), "Allow EC2SG");

    // Create the RDS Instance
    const rdsinstance = new rds.DatabaseInstance(this, "rdsInstance", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      securityGroups: [rdsSG],
      credentials: rds.Credentials.fromGeneratedSecret("admin"),
      databaseName: "wordpress",
    });

    //User Data Script on boot of WP-Instance
    const userData = ec2.UserData.forLinux();

    userData.addCommands(
      // Install all dependencies
      "sudo dnf update -y",
      "sudo dnf install -y httpd php php-mysqlnd php-fpm php-json php-gd wget unzip mariadb105 awscli jq",
      "sudo systemctl enable --now httpd",
      "sudo systemctl enable --now php-fpm",

      // Download and install WordPress
      "cd /var/www/html",
      "sudo wget https://wordpress.org/latest.tar.gz",
      "sudo tar -xzf latest.tar.gz",
      "sudo mv wordpress/* .",
      "sudo rm -rf wordpress latest.tar.gz",
      "sudo chown -R apache:apache /var/www/html",
      "sudo chmod -R 755 /var/www/html",

      // Fetch DB credentials from Secrets Manager
      `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${
        rdsinstance.secret!.secretArn
      } --query SecretString --output text --region ${this.region})`,
      "DB_USER=$(echo $DB_SECRET | jq -r .username)",
      "DB_PASS=$(echo $DB_SECRET | jq -r .password)",
      "DB_HOST=$(echo $DB_SECRET | jq -r .host)",
      "DB_NAME=$(echo $DB_SECRET | jq -r .dbname)",

      // Configure WordPress wp-config.php
      "cp wp-config-sample.php wp-config.php",
      'sed -i "s/database_name_here/$DB_NAME/" wp-config.php',
      'sed -i "s/username_here/$DB_USER/" wp-config.php',
      'sed -i "s/password_here/$DB_PASS/" wp-config.php',
      'sed -i "s/localhost/$DB_HOST/" wp-config.php'
    );

    //Create EC2 instance in private subnet
    const instance1 = new ec2.Instance(this, "WP-Instance", {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },

      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SG,
      userData: userData,
    });

    //Permissions

    //Grant permissiom for EC2 instance to read from RDS
    rdsinstance.secret?.grantRead(instance1.role);

    // Enable SSM Session Manager for EC2
    instance1.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

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
