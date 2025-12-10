# deploy.ps1 - Windows Deployment Script for SmartThings DR Demo
$ErrorActionPreference = "Stop"

$APP_NAME = "SmartThingsDRDemo"
$TABLE_NAME = "SmartAppTable"
$REGION = "us-east-1"
$ROLE_NAME = "${APP_NAME}-Role"
$ZIP_FILE = "function.zip"

Write-Host "=== AWS Setup & Deployment: $APP_NAME (Windows) ==="

# 1. Zip Code
Write-Host "[1/6] Zipping code..."
if (Test-Path $ZIP_FILE) { Remove-Item $ZIP_FILE }
# Exclude specific files by only selecting what we need or excluding git
# PowerShell Compress-Archive can be tricky with excludes, simpler to just include what we need or exclude commonly
Get-ChildItem -Path . -Exclude ".git*", "data_store.json", "deploy.sh", "deploy.ps1", "README.md", "app_spec.txt", "frontend" | Compress-Archive -DestinationPath $ZIP_FILE -Update

# 2. IAM Role
Write-Host "[2/6] Configuring IAM Role..."
$TRUST_POLICY = '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

# Check if role exists
$roleExists = aws iam get-role --role-name $ROLE_NAME 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Role $ROLE_NAME exists."
} else {
    Write-Host "  Creating role $ROLE_NAME..."
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document $TRUST_POLICY | Out-Null
    # Attach basic execution
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    # Add DynamoDB Access
    $POLICY_ARN = aws iam list-policies --query "Policies[?PolicyName=='AmazonDynamoDBFullAccess'].Arn" --output text
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN
    Write-Host "  Waiting for role propagation (10s)..."
    Start-Sleep -Seconds 10
}

# 3. DynamoDB Table
Write-Host "[3/6] Configuring DynamoDB Table..."
$tableExists = aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Table $TABLE_NAME exists."
} else {
    Write-Host "  Creating table $TABLE_NAME..."
    aws dynamodb create-table `
        --table-name $TABLE_NAME `
        --attribute-definitions AttributeName=SmartAppId,AttributeType=S `
        --key-schema AttributeName=SmartAppId,KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --region $REGION | Out-Null
    Write-Host "  Table created."
}

# 4. Deploy Lambda
Write-Host "[4/6] Deploying Lambda Function..."
$ROLE_ARN = aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text

$functionExists = aws lambda get-function --function-name $APP_NAME --region $REGION 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Updating function code..."
    aws lambda update-function-code --function-name $APP_NAME --zip-file fileb://$ZIP_FILE --region $REGION | Out-Null
} else {
    Write-Host "  Creating function..."
    aws lambda create-function `
        --function-name $APP_NAME `
        --runtime nodejs18.x `
        --role $ROLE_ARN `
        --handler lambda.handler `
        --timeout 60 `
        --zip-file fileb://$ZIP_FILE `
        --region $REGION `
        --environment "Variables={DYNAMODB_TABLE=$TABLE_NAME}" | Out-Null
}

# Update Config if exists
aws lambda update-function-configuration --function-name $APP_NAME --timeout 60 --region $REGION | Out-Null

# 5. Function URL
Write-Host "[5/6] Configuring Public Access..."
aws lambda add-permission --function-name $APP_NAME `
    --statement-id FunctionURLAllowPublicAccess `
    --action lambda:InvokeFunctionUrl `
    --principal "*" `
    --function-url-auth-type NONE `
    --region $REGION 2>$null | Out-Null

Write-Host "[6/6] Getting Function URL..."
$URL = aws lambda get-function-url-config --function-name $APP_NAME --query 'FunctionUrl' --output text --region $REGION 2>$null
if (-not $URL) {
    $URL = aws lambda create-function-url-config --function-name $APP_NAME --auth-type NONE --query 'FunctionUrl' --output text --region $REGION
}

Write-Host ""
Write-Host "SUCCESS!"
Write-Host "Your SmartApp Lambda URL is: $URL"
Write-Host "Update this URL in your SmartThings Developer Workspace."
