"use client";

import dynamic from "next/dynamic";

/**
 * WorkHub — Time Off (WH-2).
 * A phone-native screen of its own. Providers (query client, auth, i18n, theme) come from
 * WorkHubProviders in the layout — this page adds no second set and no admin stylesheet.
 */
const TimeOffScreen = dynamic(
    () => import("@/components/workhub/screens/TimeOffScreen").then(m => m.TimeOffScreen),
    { ssr: false }
);

export default function WorkHubLeavePage() {
    return <TimeOffScreen />;
}
