# github-secrets-to-aws-secrets-manager action

Sync GitHub Secrets to AWS Secrets Manager with automatic secret cleanup.

## Features

- ✅ Creates new secrets or updates existing ones
- ✅ Supports PREFIX for organized secret namespacing
- ✅ Automatically deletes secrets that are removed from GitHub
- ✅ Safe: Only manages secrets with the specified PREFIX
- ✅ Multi-environment support via GitHub environments

## Usage

### Basic Example

```yaml
name: Sync Secrets
on:
  workflow_dispatch:

jobs:
  sync_secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsRole
          aws-region: us-east-1

      - name: Sync to Secrets Manager
        uses: kasperpihl/github-secrets-to-aws-secrets-manager@main
        with:
          PREFIX: myapp
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
          STRIPE_API_KEY: ${{ secrets.STRIPE_API_KEY }}
```

This creates secrets in AWS Secrets Manager:
- `myapp/GOOGLE_OAUTH_CLIENT_SECRET`
- `myapp/STRIPE_API_KEY`

### Multi-Environment Example

Use GitHub environments to manage different AWS accounts/regions:

```yaml
name: Sync Secrets
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        type: environment
        default: 'dev'

jobs:
  sync_secrets:
    environment: ${{ inputs.environment }}
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT }}:role/GithubActionsRole
          aws-region: us-east-1

      - name: Sync to Secrets Manager
        uses: kasperpihl/github-secrets-to-aws-secrets-manager@main
        with:
          PREFIX: myapp
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
```

Each environment (dev, staging, prod) syncs to its own AWS account, but uses the same secret names.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `PREFIX` | Prefix for organizing secrets | No | `appsecrets` |
| Additional inputs | Any other input becomes a secret | No | - |

## Secret Naming

Secrets are named: `{PREFIX}/{SECRET_NAME}`

Examples:
- `myapp/GOOGLE_OAUTH_CLIENT_SECRET`
- `myapp/DATABASE_PASSWORD`

## Automatic Cleanup

The action automatically deletes secrets that:
1. Match the `PREFIX`
2. Are not included in the GitHub Action inputs

This keeps your Secrets Manager clean and synchronized with GitHub Secrets.

**Safety**: Only secrets with the specified `PREFIX` are managed. Other secrets in your AWS account are never touched.

## Use Cases

### 1. CloudFormation/CDK Integration

Some AWS services (like Cognito identity providers) require Secrets Manager and don't support SSM Parameter Store.

```yaml
# Sync Cognito secrets to Secrets Manager
- uses: kasperpihl/github-secrets-to-aws-secrets-manager@main
  with:
    PREFIX: myapp
    GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
```

### 2. Hybrid Approach (SSM + Secrets Manager)

Use SSM for most secrets (free) and Secrets Manager only when required:

```yaml
# Sync to SSM (free, fast, works for Lambda runtime)
- uses: kasperpihl/github-secrets-to-aws-ssm@main
  with:
    PREFIX: myapp
    API_KEY: ${{ secrets.API_KEY }}
    WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}

# Sync to Secrets Manager (required for CloudFormation)
- uses: kasperpihl/github-secrets-to-aws-secrets-manager@main
  with:
    PREFIX: myapp
    GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
```

## Requirements

- AWS credentials configured (use `aws-actions/configure-aws-credentials@v4`)
- IAM permissions:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "secretsmanager:CreateSecret",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecrets"
        ],
        "Resource": "*"
      }
    ]
  }
  ```

## Cost

AWS Secrets Manager pricing (as of 2026):
- **Storage**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 requests

Example: 5 secrets × $0.40 = $2.00/month = $24/year

## License

This project is released under the [MIT License](LICENSE).
