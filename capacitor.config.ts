import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ecftech.flowday",
  appName: "Flow Day Planner",
  webDir: "dist",
  server: {
    url: "https://plannificateur.vercel.app",
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_flow_day",
      iconColor: "#6366F1",
    },
  },
};

export default config;
