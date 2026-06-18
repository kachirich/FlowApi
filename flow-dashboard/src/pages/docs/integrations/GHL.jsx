import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "contact": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@acme.com",
    "phone": "+15551234567",
    "companyName": "Acme Corp"
  },
  "locationId": "loc_abc123"
}`;

export default function GHL() {
  return (
    <PlatformDoc
      name="GoHighLevel"
      accent="indigo"
      subtitle="Send leads from your GHL Workflows straight into your FlowAPI pipeline using the built-in Webhook action."
      steps={[
        { step: 'Open a GHL Workflow', detail: 'In GoHighLevel, go to Automation → Workflows and open (or create) the workflow that fires when a new contact or opportunity is created.' },
        { step: 'Add a Webhook action', detail: 'Add a new action and choose "Webhook" — set the method to POST so the contact payload is sent as JSON.' },
        { step: 'Paste the URL above', detail: 'Drop the FlowGateway webhook URL into the action\'s URL field exactly as shown.' },
        { step: 'Add header: x-api-key → your key', detail: 'Under custom headers, add x-api-key with the API key you generated in your FlowAPI dashboard, then save and publish the workflow.' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
