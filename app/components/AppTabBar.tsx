import { useState } from "react";

export type AppTab = { id: string; label: string };

export function AppTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: AppTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <s-stack direction="inline" gap="small">
      {tabs.map((tab) => (
        <s-button
          key={tab.id}
          variant={value === tab.id ? "primary" : "secondary"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </s-button>
      ))}
    </s-stack>
  );
}

export function useAppTab(defaultId: string) {
  return useState(defaultId);
}
