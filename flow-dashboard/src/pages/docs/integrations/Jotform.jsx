import PlatformDoc from '../../../components/docs/PlatformDoc';

const SAMPLE = `{
  "formID": "240123456789",
  "submissionID": "5891234567890123456",
  "rawRequest": "{\\"q3_email\\":\\"jane@acme.com\\",\\"q4_name\\":{\\"first\\":\\"Jane\\",\\"last\\":\\"Doe\\"},\\"q5_phone\\":\\"+15551234567\\"}"
}`;

export default function Jotform() {
  return (
    <PlatformDoc
      name="Jotform"
      accent="rose"
      subtitle="Send Jotform submissions to FlowGateway automatically whenever someone completes your form."
      steps={[
        { step: 'Open your form settings', detail: 'In the Jotform builder, open Settings for the form you want to connect.' },
        { step: 'Integrations → Webhooks', detail: 'Go to Integrations, search for "Webhooks", and select it to add a new POST endpoint.' },
        { step: 'Paste the URL above', detail: 'Enter the FlowGateway webhook URL and complete the integration so Jotform posts each submission.' },
        { step: 'Note: add key as URL param ?api_key=... if headers unsupported', detail: 'Jotform\'s native webhook UI can\'t set custom headers, so append ?api_key=YOUR_KEY to the URL, or relay through Zapier/Make if you prefer the x-api-key header.' },
      ]}
      samplePayload={SAMPLE}
    />
  );
}
