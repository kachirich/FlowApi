import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "form_response": {
    "form_id": "lT4Z3j",
    "answers": [
      { "field": { "ref": "name" }, "type": "text", "text": "Jane Doe" },
      { "field": { "ref": "email" }, "type": "email", "email": "jane@acme.com" },
      { "field": { "ref": "phone" }, "type": "phone_number", "phone_number": "+15551234567" }
    ]
  }
}`;

export default function Typeform() {
  return (
    <PlatformDoc
      name="Typeform"
      accent="cyan"
      subtitle="Route Typeform responses directly into your flows the moment a respondent hits submit."
      steps={[
        { step: 'Open your Typeform', detail: 'Open the form in your Typeform workspace and switch to the Connect tab at the top.' },
        { step: 'Connect → Webhooks', detail: 'Select Webhooks and click "Add a webhook" to register a new delivery endpoint.' },
        { step: 'Paste the URL above', detail: 'Use the FlowGateway webhook URL as the endpoint and toggle the webhook on.' },
        { step: 'Add header in advanced settings', detail: 'In the webhook\'s advanced settings, add a custom header x-api-key with your FlowAPI key so requests authenticate.' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
