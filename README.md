# SmartThings DR Demo App

A Proof of Concept (PoC) SmartApp that demonstrates a Demand Response (DR) workflow:
1.  **Event Trigger**: Receives a webhook from a utility/simulator.
2.  **Notification**: Simulates notifying the user.
3.  **Opt-Out Period**: Waits 30 seconds for user action.
4.  **Control**: Automatically turns off selected devices (e.g., smart plugs/switches) to save energy.

## Prerequisites

*   **Node.js**: Installed on your machine.
*   **ngrok**: For exposing your local server to the internet ([Download](https://ngrok.com/download)).
*   **Samsung Account**: For accessing SmartThings Developer Workspace.
*   **SmartThings App**: Installed on your mobile device (Developer Mode enabled).

### Deployment (Windows)
1.  **Install Prerequisites**:
    *   Node.js
    *   AWS CLI (`winget install Amazon.AWSCLI`)
    *   Configure AWS: `aws configure`
2.  **Deploy**:
    Open PowerShell and run:
    ```powershell
    .\deploy.ps1
    ```
    *Copy the specific Lambda URL output.*

### Deployment (Mac/Linux)
1.  **Install Prerequisites**:
    *   Node.js
    *   AWS CLI (`brew install awscli`)
    *   Configure AWS: `aws configure`
2.  **Deploy**:
    ```bash
    chmod +x deploy.sh
    ./deploy.sh
    ```
    *Copy the Lambda URL output.*

## Setup & Configuration

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment Variables**
    Create a `.env` file in the root directory:
    ```ini
    # Found in SmartThings Developer Workspace after registration
    SMART_APP_ID=your-app-id-here
    CLIENT_ID=your-client-id-here
    CLIENT_SECRET=your-client-secret-here
    ```

3.  **Start the Server**
    ```bash
    node server.js
    ```
    *Output: `DR-SmartApp server running on port 8080`*

4.  **Expose to Internet**
    In a separate terminal:
    ```bash
    ngrok http 8080
    ```
    *Copy the HTTPS URL (e.g., `https://random-name.ngrok-free.app`).*

## Registration (SmartThings Workspace)

1.  Go to [SmartThings Developer Workspace](https://developer.smartthings.com/workspace).
2.  Create a new **Automation** Project > **SmartApp** > **Webhook**.
3.  **Target URL**: Paste your ngrok HTTPS URL.
4.  **Scopes**: Ensure you select:
    *   `r:devices:*` (Read devices)
    *   `x:devices:*` (Execute commands)
5.  **Verify**: Click "Verify App Registration".
    *   *Note: If verification fails initially, ensure your server is running. You may need to click the link in the server logs if it doesn't auto-verify.*
6.  **Copy Credentials**: Copy the `App ID`, `Client ID`, and `Client Secret` into your `.env` file and **restart the server**.

## Installation (Mobile App)

1.  Open SmartThings App on your phone.
2.  Go to **Automations** > **+ (Add)** > **Add Routine/SmartApp**.
3.  Scroll to **Custom / Developer Apps**.
4.  Select **DR Demo App** (or whatever you named it).
5.  Follow the wizard:
    *   Select the smart switches/plugs you want to control.
    *   Click Done.

## Running the Demo

Trigger a simulated DR event using `curl`:

```bash
curl -X POST http://localhost:8080/dr-event \
  -H "Content-Type: application/json" \
  -d '{"eventId": "demo-1", "level": "HIGH", "duration": 10}'
```

### Expected Flow
1.  **Terminal Log**: `Received DR Signal...`
2.  **Notification**: `>>> SIMULATING PUSH NOTIFICATION...`
3.  **Wait**: System waits **30 seconds**.
4.  **Action**: Selected devices turn **OFF**.
5.  **Terminal Log**: `Turning OFF device... Success`.

## Troubleshooting

*   **App Not Visible**: Ensure your phone and developer workspace use the *same* Samsung Account and that Developer Mode is enabled in the mobile app settings.
*   **Verification Failed**: Check server logs. If you see a `CONFIRMATION` log, copy the URL and visit it in your browser manually.
*   **Port Conflict**: If `EADDRINUSE`, run `lsof -i :8080` and kill the process.
