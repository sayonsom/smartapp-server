const fs = require('fs');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'SmartAppTable';
const PARTITION_KEY = 'SmartAppId';
const CONTEXT_STORE_FILE = './data_store.json';

// Initialize DynamoDB Client (only used if running in Lambda/AWS)
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Loads the data store.
 * @param {string} id - The ID of the installed app (context.installedAppId) - used as key in DB
 * @returns {Promise<Object>} The stored data
 */
async function loadStore(id = 'default') {
    if (isLambda) {
        console.log(`[Store] Loading from DynamoDB table ${TABLE_NAME} for key ${id}`);
        try {
            const command = new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    [PARTITION_KEY]: id
                }
            });
            const response = await client.send(command);
            // docClient usually returns unmarshalled, but let's be safe
            // Actually I used client.send with GetCommand from lib-dynamodb which is the doc client cmd
            // Wait, I mixed client and docClient.
            // Correction: GetCommand should be sent via docClient.
            const docResponse = await docClient.send(command);
            return docResponse.Item ? docResponse.Item.data : {};
        } catch (e) {
            console.error("[Store] DynamoDB Load Error:", e);
            return {};
        }
    } else {
        // Local File Store
        try {
            if (fs.existsSync(CONTEXT_STORE_FILE)) {
                return JSON.parse(fs.readFileSync(CONTEXT_STORE_FILE));
            }
        } catch (e) {
            console.error("[Store] File Load Error:", e);
        }
        return {};
    }
}

/**
 * Saves the data store.
 * @param {string} id - The ID of the installed app
 * @param {Object} data - The data to save
 */
async function saveStore(id = 'default', data) {
    if (isLambda) {
        console.log(`[Store] Saving to DynamoDB table ${TABLE_NAME} for key ${id}`);
        try {
            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    [PARTITION_KEY]: id,
                    data: data
                }
            });
            await docClient.send(command);
        } catch (e) {
            console.error("[Store] DynamoDB Save Error:", e);
        }
    } else {
        // Local File Store
        fs.writeFileSync(CONTEXT_STORE_FILE, JSON.stringify(data, null, 2));
    }
}

module.exports = { loadStore, saveStore };
