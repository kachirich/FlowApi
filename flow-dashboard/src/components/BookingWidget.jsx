import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

export default function BookingWidget() {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi({});
      cal("ui", {
        theme: "dark",
        styles: { branding: { brandColor: "#000000" } },
      });
    })();
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "scroll" }}>
      <Cal
        calLink="https://cal.com/support-flowapi-kvxbfs/15min"
        style={{ width: "100%", height: "100%", overflow: "scroll" }}
      />
    </div>
  );
}
