"use client";

import dynamic from "next/dynamic";

/**
 * WorkHub — My hours (WH-2).
 * A phone-native screen; the admin Performance page is no longer shown to the crew.
 * Providers (query client, auth, i18n, theme) come from WorkHubProviders in the layout.
 */
const MyHoursScreen = dynamic(
    () => import("@/components/workhub/screens/MyHoursScreen").then(m => m.MyHoursScreen),
    { ssr: false }
);

export default function WorkHubTimesheetsPage() {
    return <MyHoursScreen />;
}
