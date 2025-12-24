#!/bin/bash
set -e

APP_NAME="SmartThingsDRDemo"
TABLE_NAME="SmartAppTable"
REGION="us-east-1"
ROLE_NAME="${APP_NAME}-Role"
ZIP_FILE="function.zip"

echo "=== AWS Setup & Deployment: $APP_NAME ==="

# 1. Zip Code
echo "[1/6] Zipping code..."
rm -f $ZIP_FILE
zip -r -q $ZIP_FILE . -x "*.git*" "data_store.json" "deploy.sh" "README.md" "app_spec.txt"

# 2. IAM Role
echo "[2/6] Configuring IAM Role..."
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

if aws iam get-role --role-name $ROLE_NAME >/dev/null 2>&1; then
    echo "  Role $ROLE_NAME exists."
else
    echo "  Creating role $ROLE_NAME..."
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document "$TRUST_POLICY" >/dev/null
    # Attach basic execution
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    # Add DynamoDB Access
    POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='AmazonDynamoDBFullAccess'].Arn" --output text)
    aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN
    echo "  Waiting for role propagation (10s)..."
    sleep 10
fi

# 3. DynamoDB Table
echo "[3/6] Configuring DynamoDB Table..."
if aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION >/dev/null 2>&1; then
    echo "  Table $TABLE_NAME exists."
else
    echo "  Creating table $TABLE_NAME..."
    aws dynamodb create-table \
        --table-name $TABLE_NAME \
        --attribute-definitions AttributeName=SmartAppId,AttributeType=S \
        --key-schema AttributeName=SmartAppId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region $REGION >/dev/null
    echo "  Table created."
fi

# 4. Deploy Lambda
echo "[4/6] Deploying Lambda Function..."
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)

if aws lambda get-function --function-name $APP_NAME --region $REGION >/dev/null 2>&1; then
    echo "  Updating function code..."
    aws lambda update-function-code --function-name $APP_NAME --zip-file fileb://$ZIP_FILE --region $REGION >/dev/null
else
    echo "  Creating function..."
    aws lambda create-function \
        --function-name $APP_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler lambda.handler \
        --timeout 60 \
        --zip-file fileb://$ZIP_FILE \
        --region $REGION \
        --environment "Variables={DYNAMODB_TABLE=$TABLE_NAME}" >/dev/null
fi

# Update Config if exists but timeout may be old
echo "  Waiting for code update to propagate..."
sleep 5
aws lambda update-function-configuration --function-name $APP_NAME --timeout 60 --region $REGION >/dev/null

# 5. Function URL (Public Access)
echo "[5/6] enhanced configuration..."
# Add permissions for URL
aws lambda add-permission --function-name $APP_NAME \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION >/dev/null 2>&1 || true

echo "[6/6] Getting Function URL..."
if aws lambda get-function-url-config --function-name $APP_NAME --region $REGION >/dev/null 2>&1; then
    URL=$(aws lambda get-function-url-config --function-name $APP_NAME --query 'FunctionUrl' --output text --region $REGION)
else
    URL=$(aws lambda create-function-url-config --function-name $APP_NAME --auth-type NONE --query 'FunctionUrl' --output text --region $REGION)
fi

echo ""
echo "SUCCESS!"
echo "Your SmartApp Lambda URL is: $URL"
echo "Update this URL in your SmartThings Developer Workspace."
