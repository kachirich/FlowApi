import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "email": "jane@acme.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+15551234567",
  "company": "Acme Corp"
}`;

export default function Zapier() {
  return (
    <PlatformDoc
      name="Zapier / Make"
      accent="teal"
      subtitle="Use Webhooks by Zapier or Make's HTTP module to pipe leads from any of 6,000+ connected apps into FlowGateway."
      steps={[
        { step: 'Create a new Zap/Scenario', detail: 'Start a new Zap in Zapier (or a Scenario in Make) and pick the trigger app that captures your leads.' },
        { step: 'Choose Webhooks / HTTP module', detail: 'Add an action step using "Webhooks by Zapier" (POST) or Make\'s "HTTP → Make a request" module.' },
        { step: 'POST to the URL above', detail: 'Set the request URL to the FlowGateway webhook endpoint and map your trigger fields into the JSON body.' },
        { step: 'Add x-api-key as a request header', detail: 'In the headers section, add x-api-key with your FlowAPI key, then turn the Zap/Scenario on.' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
