import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "eventType": "FORM_RESPONSE",
  "formId": "wgp1Az",
  "data": {
    "fields": [
      { "key": "question_1", "label": "Email", "value": "jane@acme.com" },
      { "key": "question_2", "label": "First Name", "value": "Jane" },
      { "key": "question_3", "label": "Phone", "value": "+15551234567" }
    ]
  }
}`;

export default function Tally() {
  return (
    <PlatformDoc
      name="Tally.so"
      accent="violet"
      subtitle="Forward every Tally form submission into FlowGateway with a native webhook integration — no code required."
      steps={[
        { step: 'Open your Tally form', detail: 'Head to your Tally dashboard and open the form whose submissions you want to route.' },
        { step: 'Go to Integrations → Webhooks', detail: 'In the form\'s Integrations tab, choose Webhooks and click "Connect" to add a new endpoint.' },
        { step: 'Paste the URL above', detail: 'Enter the FlowGateway webhook URL as the destination Tally will POST each submission to.' },
        { step: 'Add custom header: x-api-key', detail: 'Expand the advanced/header options and add x-api-key set to your FlowAPI key, then save the webhook.' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
