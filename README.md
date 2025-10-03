# 🚀 AWS WordPress Infrastructure with CDK (TypeScript)

This project demonstrates how to **deploy a secure, modern, and automated WordPress infrastructure** on AWS using the **Cloud Development Kit (CDK)** with TypeScript.

The setup uses **best practices** like private subnets, managed RDS, Secrets Manager, and SSM Session Manager to ensure both **security** 🔒 and **scalability** 📈.

---

## ✨ Features

- 🌐 **Application Load Balancer (ALB)** in a public subnet, routing traffic to WordPress.
- 🖥 **EC2 instance** running WordPress inside a private subnet (not exposed to the internet).
- 🗄 **Amazon RDS (MySQL)** in a private subnet for secure database hosting.
- 🔑 **AWS Secrets Manager** for secure credential storage (no hardcoding passwords).
- 🔧 **EC2 User Data** script for automatic WordPress + Apache + PHP bootstrapping.
- 📦 **NAT Gateway** for private instances to fetch updates securely.
- 🛡 **Security Groups** carefully configured (ALB → EC2 → RDS).
- 🖥 **AWS Systems Manager (SSM)** Session Manager enabled (no need for SSH keys).
- 🧹 **Infrastructure as Code (IaC)** with AWS CDK for reproducibility.

---

## 🏥 Client Scenario

TechHealth Inc, a healthcare technology startup, originally spun up their **WordPress-based patient portal** directly via the AWS Console.

⚠️ Over time, this became **hard to manage**:

- All resources lived in **public subnets** (poor security).
- **Manual Security Groups** led to inconsistent rules.
- No version control or repeatable deployments.
- Infrastructure was **not scalable** and lacked documentation.

➡️ The solution? **Migrate everything to Infrastructure as Code (IaC) with AWS CDK**.

---

## 🏗 Improved Architecture

Here’s what the new setup looks like ✅

- 🌍 **ALB** in the public subnet, handling HTTP requests.
- 🔒 **EC2 instance** (WordPress) in private subnet, hidden from direct internet access.
- 📡 **NAT Gateway** allows EC2 to fetch updates securely.
- 🗄 **RDS MySQL** database in private subnet (only EC2 can access it).
- 🔑 **Secrets Manager** provides credentials dynamically.
- 🖥 **SSM Session Manager** replaces SSH for secure admin access.

📊 **Architecture Diagram:**  
_(Insert your diagram screenshot here for visual impact)_

---

## 🛠 Deployment with CDK

### 🕸 Networking (VPC, Subnets, NAT Gateway)

- 2️⃣ Availability Zones for resilience.
- 🌐 Public Subnets → ALB & NAT Gateway.
- 🔒 Private Subnets with egress → EC2 & RDS.
- NAT Gateway ensures private instances can download updates securely.

### 🛡 Security Groups

- ALB → Allows HTTP traffic from the internet.
- EC2 → Accepts only traffic from ALB.
- RDS → Accepts only traffic from EC2 on port 3306.

### 🗄 RDS Database

- Engine: MySQL 8.0
- Storage: 20 GB (demo purposes).
- Deployed in a **private subnet**.
- Credentials stored in **Secrets Manager**.

### ⚡️ Bootstrapping WordPress (User Data Script)

On first boot, the EC2 instance:

- Installs Apache, PHP, MariaDB, AWS CLI, jq.
- Starts services (Apache & PHP-FPM).
- Downloads & configures WordPress.
- Fetches DB credentials from Secrets Manager.
- Updates `wp-config.php` with dynamic values.

### 🖥 WordPress EC2 Instance

- Private Subnet → hidden from internet.
- Latest **Amazon Linux 2023 AMI**.
- Auto-configured with User Data.
- Linked to ALB for traffic routing.

### 🌐 Application Load Balancer

- Public-facing entry point.
- Routes requests to EC2 target group.
- Health checks to ensure uptime.

### 🔑 IAM & Permissions

- EC2 granted **read access to Secrets Manager**.
- **AmazonSSMManagedInstanceCore** policy attached for SSM Session Manager.

---

## 📖 Full Walkthrough

👉 Check out my detailed Medium post where I break down the **client scenario, architecture, and full CDK code snippets**:

🔗 [Secure WordPress Deployment on AWS using CDK](https://medium.com/your-link-here)

---

## 🚀 Getting Started

### Prerequisites

- Node.js & npm/yarn installed
- AWS CDK installed globally (`npm install -g aws-cdk`)
- AWS CLI configured with credentials

### Clone the repo

```bash
git clone https://github.com/DylanCorr2020/aws-wordpress-infra-cdk.git
cd aws-wordpress-infra-cdk
```
