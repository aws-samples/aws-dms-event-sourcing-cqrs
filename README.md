## Event Sourcing & CQRS with AWS Database Migration Service (DMS)

This repository contains 2 examples of implementing CQRS using AWS Database Migration Service (DMS).

Both are deployed using Serverless Application Model (SAM) templates. For both deployments you can accept all the default parameters, unless you explicitly want to change any of them. If you don't have the SAM CLI installed locally, follow the instructions [in the SAM documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

### Getting Started

Ensure that you have the **dms-vpc-role** & **AWSServiceRoleForKafkaConnect** IAM roles already present in the target AWS account. These roles will have been created automatically if you have used DMS & MSK via the AWS console. If you have not, you can deploy the dms-vpc-role CloudFormation template included in this repository first:

```
sam deploy --guided -t dms-vpc-role.yaml --capabilities CAPABILITY_NAMED_IAM
```

To deploy the DMS only solution:

```
sam deploy --guided -t s3-event-store.yaml
```

To deploy the DMS + Amazon Managed Streaming for Apache Kafka (MSK) solution:

```
sam build -t kafka-event-stream.yaml --use-container
sam deploy --guided
```

### Next Steps

These samples use AWS Secrets Manager to securely manage access credentials to the database. When you move this architecture to production, it is strongly recommended that you implement [automated secrets rotation using Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html).
