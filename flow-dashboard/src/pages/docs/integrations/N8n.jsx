import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "email": "jane@acme.com",
  "name": "Jane Doe",
  "phone": "+15551234567",
  "company": "Acme Corp"
}`;

export default function N8n() {
  return (
    <PlatformDoc
      name="n8n"
      accent="amber"
      subtitle="Trigger FlowGateway from any n8n workflow using a standard HTTP Request node."
      steps={[
        { step: 'Add an HTTP Request node', detail: 'In your n8n workflow, add an HTTP Request node after whatever step produces the lead data.' },
        { step: 'Set method: POST', detail: 'Choose POST as the request method and set the body content type to JSON.' },
        { step: 'Paste URL above', detail: 'Enter the FlowGateway webhook URL in the node\'s URL field.' },
        { step: 'Add Header: x-api-key', detail: 'Under "Headers", add x-api-key with your FlowAPI key (store it as an n8n credential or expression so it stays out of the workflow JSON).' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
