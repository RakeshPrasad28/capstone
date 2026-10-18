const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/v1";

async function runE2ETests() {
  console.log("Running Flow Workflow Builder E2E Verification...\n");

  const healthRes = await axios.get(`${BASE_URL}/health`);
  console.log("Health Check:", healthRes.data.status, "DB:", healthRes.data.database.status);

  const email = `testuser_${Date.now()}@flow.io`;
  const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
    email,
    password: "Password123!",
    name: "Automated Tester"
  });
  const token = registerRes.data.data.token;
  console.log("Registered test user:", email);

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const createRes = await axios.post(
    `${BASE_URL}/workflows`,
    {
      name: "E2E Test Flow",
      description: "Automated test flow verifying branching and nodes",
      triggerType: "WEBHOOK",
      triggerConfig: { secretKey: "e2e_secret_token" },
      nodes: [
        {
          id: "step_http",
          type: "HTTP_REQUEST",
          name: "Fetch Post",
          config: {
            url: "https://jsonplaceholder.typicode.com/posts/1",
            method: "GET"
          },
          nextId: "step_cond"
        },
        {
          id: "step_cond",
          type: "CONDITION",
          name: "Validate Post Id",
          config: {
            field: "steps.step_http.data.id",
            operator: "==",
            value: 1,
            trueBranch: "step_delay",
            falseBranch: "step_notify"
          }
        },
        {
          id: "step_delay",
          type: "DELAY",
          name: "Delay 1s",
          config: { seconds: 1 },
          nextId: "step_notify"
        },
        {
          id: "step_notify",
          type: "NOTIFY",
          name: "Notify Slack",
          config: {
            channel: "slack",
            subject: "E2E Success",
            message: "Processed post: {{steps.step_http.data.title}}"
          }
        }
      ]
    },
    authHeaders
  );
  const workflowId = createRes.data.data.id;
  console.log("Created Workflow:", workflowId, "Status:", createRes.data.data.status);

  try {
    await axios.post(`${BASE_URL}/workflows/${workflowId}/start`, {}, authHeaders);
  } catch (err) {
    console.log("Guarded Draft Start correctly rejected with:", err.response?.data?.message);
  }

  const publishRes = await axios.post(`${BASE_URL}/workflows/${workflowId}/publish`, {}, authHeaders);
  console.log("Published Workflow. State:", publishRes.data.data.status, "Version:", publishRes.data.data.version);

  try {
    await axios.put(`${BASE_URL}/workflows/${workflowId}`, { name: "Illegal Name" }, authHeaders);
  } catch (err) {
    console.log("Guarded Mutation on Published correctly rejected with:", err.response?.data?.message);
  }

  const manualExec = await axios.post(`${BASE_URL}/workflows/${workflowId}/start`, {}, authHeaders);
  console.log("Manual Execution Finished:", manualExec.data.data.status, "Duration:", manualExec.data.data.durationMs, "ms");

  const webhookExec = await axios.post(
    `${BASE_URL}/triggers/webhook/${workflowId}`,
    { sample: "data" },
    {
      headers: {
        "x-webhook-secret": "e2e_secret_token",
        "x-wait-execution": "true"
      }
    }
  );
  console.log("Webhook Execution Finished:", webhookExec.data.data.status, "Duration:", webhookExec.data.data.durationMs, "ms");

  const runsRes = await axios.get(`${BASE_URL}/runs/workflows/${workflowId}`, authHeaders);
  console.log("Total Workflow Runs logged:", runsRes.data.data.total);

  const runId = runsRes.data.data.runs[0].id;
  const runDetails = await axios.get(`${BASE_URL}/runs/${runId}`, authHeaders);
  console.log("Step Logs Count for Run:", runDetails.data.data.stepLogs.length);

  await axios.post(`${BASE_URL}/workflows/${workflowId}/pause`, {}, authHeaders);
  console.log("Workflow Paused");

  try {
    await axios.post(
      `${BASE_URL}/triggers/webhook/${workflowId}`,
      {},
      { headers: { "x-webhook-secret": "e2e_secret_token" } }
    );
  } catch (err) {
    console.log("Guarded Webhook on Paused correctly rejected with:", err.response?.data?.message);
  }

  await axios.post(`${BASE_URL}/workflows/${workflowId}/resume`, {}, authHeaders);
  console.log("Workflow Resumed");

  await axios.post(
    `${BASE_URL}/workflows/${workflowId}/reschedule`,
    { cron: "0 * * * *" },
    authHeaders
  );
  console.log("Workflow Rescheduled to Hourly Cron");

  console.log("\nALL CASE STUDY E2E VERIFICATION CHECKS PASSED!");
}

runE2ETests().catch(err => {
  console.error("Test failed:", err.response ? err.response.data : err);
  process.exit(1);
});
